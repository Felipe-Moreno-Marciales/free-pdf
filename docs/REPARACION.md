# Reparación de documentos en Free PDF

Este documento explica qué hace «Reparar PDF», qué no puede hacer, y —lo más importante— **cómo se ha medido** cada afirmación.

## Qué es reparar

Reparar consiste en que qpdf lea el documento y lo **vuelva a escribir entero**: tabla de referencias cruzadas nueva, objetos renumerados y estructura normalizada.

Sirve cuando el archivo se puede leer pero está desordenado. El caso típico y real: un servidor mal configurado antepone una cabecera HTTP o un mensaje de error al archivo, con lo que todos los desplazamientos internos se desplazan. Muchos lectores rechazan ese PDF; qpdf lo lee sin pestañear y escribe uno limpio.

No hay ninguna opción `--repair` en qpdf. La reparación es el efecto de volver a escribir el documento con un motor que sabe recuperarse de una estructura imperfecta.

## Qué no puede hacer, medido y no supuesto

Aquí es fácil prometer de más, así que las afirmaciones de este documento salen de ejecutar el motor real. Están en [`motorQpdf.prueba.ts`](../src/pruebas/motorQpdf.prueba.ts) y se comprueban en cada `pnpm pruebas`.

| Daño provocado | `--check` | ¿Escribe salida? | ¿Se recupera? |
| -------------- | --------- | ---------------- | ------------- |
| Ninguno | código 0 | Sí | — |
| 40 bytes de basura antes de `%PDF` | **código 0** | Sí | **Sí**, todas las páginas |
| `startxref` sobrescrito | código 2 | **No** | No |
| El desplazamiento de `startxref` falseado | código 2 | **No** | No |
| Las entradas de la tabla falseadas | código 2 | **No** | No |
| No es un PDF | código 2 | **No** | No |
| Cifrado | código 2 (`invalid password`) | — | Hay que desbloquearlo antes |

**La conclusión que importa:** este build de qpdf **no reconstruye** una tabla de referencias destruida. O consigue leer el documento —y entonces lo reescribe limpio—, o termina con código 2 y no escribe nada. No hay término medio.

Yo mismo di por hecho lo contrario al empezar. Las primeras pruebas afirmaban que qpdf reconstruiría cualquier tabla rota, fallaron al ejecutarse contra el motor real, y lo que se corrigió fue la suposición, no la prueba. Las pruebas actuales afirman el comportamiento medido.

**Y por tanto:** si el documento llegó incompleto, las páginas que falten seguirán faltando. No se inventa nada, y la herramienta dice cuántas páginas tiene el resultado y cuántas se perdieron, con el número exacto.

## Un matiz sobre el diagnóstico

«Sin problemas detectados» significa que **qpdf** no encontró errores. No significa que todos los lectores vayan a aceptar el archivo.

El caso de la basura al principio lo demuestra: `--check` devuelve 0 y el diagnóstico sale limpio, aunque el archivo tenga 40 bytes de porquería delante que hacen que otros programas lo rechacen. Repararlo sirve de todos modos.

La interfaz lo dice tal cual, en lugar de dar a entender que un diagnóstico limpio hace inútil la reparación.

## Cómo funciona por dentro

El diagnóstico y la reparación se ejecutan en el **mismo Web Worker** que ya usaban «Proteger PDF» y «Desbloquear PDF». Esa infraestructura ya estaba construida y auditada, así que reparar no trajo ningún motor nuevo: es una invocación más, con su verificación.

Todo lo que decide qué argumentos recibe qpdf y cómo se interpreta su salida está en [`reparacionPdf.ts`](../src/seguridad/qpdf/reparacionPdf.ts), que es **puro**: sin navegador, sin WebAssembly, probado entero.

### El orden de la operación

1. Se diagnostica el original con `--check`, para poder decir después qué estaba mal.
2. Se cuentan sus páginas con `--show-npages`, si se puede.
3. Se reescribe con qpdf, que es lo que reconstruye la estructura.
4. Se diagnostica y se cuentan las páginas **del resultado**, en una instancia nueva del motor.
5. Si el resultado no tiene páginas, **no se entrega**.

El paso 5 no es una formalidad. Un documento «reparado» sin páginas no está reparado: está vacío, y entregarlo sería peor que fallar, porque parecería que ha funcionado.

### Niveles

| Nivel | Argumentos | Para qué |
| ----- | ---------- | -------- |
| Conservadora | `--stream-data=preserve` | Reconstruye la estructura y deja los flujos intactos. Es la recomendada para un archivo dañado: cada transformación adicional es una oportunidad más de perder algo. |
| Completa | `--object-streams=generate` | Regenera además los flujos de objetos. Suele dar un archivo menor, pero reescribe más. |

No se usa `--replace-input`, que sobrescribiría la entrada. Aquí se trabaja sobre un sistema de archivos virtual y conviene conservar el original para poder comparar el número de páginas antes y después.

Reparar **no cifra ni descifra nada**. Hay una prueba con el motor real que confirma que el documento reparado sigue abriéndose sin contraseña.

### Los mensajes técnicos de qpdf no se traducen

Cuando hay hallazgos, se conserva una muestra acotada del texto técnico de
qpdf en inglés, sin traducirlo. Cada línea tiene un límite y, si qpdf produce
demasiadas, se preservan las primeras y las últimas con un resumen de las
omitidas. El recolector también redacta cualquier secreto antes de exponer la
salida.

Traducirlo perdería precisión y haría imposible buscar el mensaje en la documentación de qpdf o en un foro. Lo que sí está en español es la **clasificación** de cada hallazgo —referencias cruzadas, objeto dañado, flujo dañado, árbol de páginas, cifrado, estructura— para poder entender de qué va sin leer el detalle.

### Filtrado del ruido

qpdf escribe varias líneas en todos los documentos, sanos o no: `checking …`, `PDF Version: …`, `File is not linearized`, `File is not encrypted` y la frase de «no se han encontrado errores», que además **parte en dos líneas**.

Filtrarlas importa más de lo que parece. Sin hacerlo, un documento perfectamente sano aparecería con «irregularidades» y nadie volvería a fiarse del diagnóstico. Dos de esos filtros se añadieron precisamente porque una prueba falló y reveló que faltaban:

- La continuación de la frase de «todo correcto», que llegaba como un mensaje aparte.
- `File is not encrypted`, que se clasificaba como un hallazgo de cifrado. Ese mismo defecto habría hecho creer que un documento sin cifrar necesitaba contraseña, así que la detección se cambió para buscar la frase afirmativa completa (`file is encrypted`) en lugar de un `encrypt` suelto.

## Limitaciones conocidas

- **Un documento cifrado no se puede reparar** sin la contraseña. La herramienta lo detecta y remite a «Desbloquear PDF». No se puede reparar lo que no se puede leer.
- **No hay recuperación parcial.** qpdf no ofrece un modo «sácame lo que puedas de este archivo destrozado»: o lo lee, o no. Si aparece una herramienta libre que sí lo haga, será un añadido, no un cambio de este canal.
- **El diagnóstico no puede predecir si la reparación servirá.** Un documento marcado como «dañado» puede resultar irrecuperable, y eso solo se sabe al intentarlo. Por eso el diagnóstico informa y no decide: el botón de reparar sigue disponible.
- **Si el diagnóstico falla, la reparación sigue permitida.** Es deliberado: cuando `--check` no consigue ni leer el archivo, intentar repararlo es lo único que puede ayudar, y negárselo por no haber podido diagnosticarlo sería absurdo.
- **No se comprueba el contenido, solo la estructura.** Que un documento se abra y tenga sus páginas no garantiza que el texto o las imágenes de dentro estén completos.

## Recomendación práctica

Después de reparar, **abre el documento y compruébalo**. La herramienta te dice cuántas páginas ha recuperado y si se ha perdido alguna, pero solo tú sabes si el contenido que esperabas está ahí.

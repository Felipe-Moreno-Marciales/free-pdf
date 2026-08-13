# Seguridad y privacidad en Free PDF

Este documento explica qué protege Free PDF, qué no protege y cómo informar de un problema.

## Modelo de amenazas

Conviene ser preciso sobre de qué protege esta aplicación y de qué no.

### De qué protege

**De que tus documentos lleguen a un tercero al procesarlos.** Es la amenaza que Free PDF aborda por diseño: no hay servidor al que subir nada, así que no existe el riesgo de que un documento quede almacenado en un sistema ajeno, se filtre en una brecha o se use para entrenar algo.

Esto no es una promesa de intenciones, es una consecuencia de la arquitectura:

- No hay backend. La aplicación es un sitio estático.
- El único `fetch` propio pertenece al service worker de la PWA y solo recupera
  recursos estáticos de Free PDF desde el mismo origen. No transporta archivos
  de la persona. No hay `XMLHttpRequest`, `WebSocket`, `EventSource` ni
  `sendBeacon` operativos.
- Las únicas peticiones son a recursos propios del mismo origen: el código, los recursos de PDF.js y el WebAssembly de qpdf. Ninguna lleva datos tuyos.
- No hay telemetría, analítica, publicidad ni rastreo.
- No se guarda ningún documento, imagen, resultado, contraseña o preferencia en
  `localStorage`, `sessionStorage`, `IndexedDB`, cookies ni `Cache Storage`. La
  PWA guarda en `Cache Storage` únicamente el código y los motores públicos.

Puedes comprobarlo tú mismo: abre las herramientas de desarrollo, ve a la pestaña de red y usa cualquier herramienta. Verás las descargas de los recursos de la aplicación y nada más.

### De qué NO protege

- **De tu propio dispositivo.** Si el equipo está comprometido —con un registrador de teclas, una extensión maliciosa o malware—, nada de lo que haga una aplicación web puede evitarlo. La contraseña que escribes pasa por el teclado y por el navegador.
- **De quien ya tiene el documento.** Cifrar un PDF no borra las copias que existan.
- **De quien conoce la contraseña.**
- **De un análisis forense del archivo original.** Las herramientas que modifican un documento no eliminan lo que ya hubiera dentro salvo que se diga expresamente.
- **De la suplantación.** La aplicación no verifica la identidad de nadie.

## Procesamiento local

Todo ocurre en el navegador:

| Qué | Con qué |
| --- | ------- |
| Leer y modificar documentos | [pdf-lib](https://pdf-lib.js.org/) |
| Dibujar páginas | [PDF.js](https://mozilla.github.io/pdf.js/) |
| Cifrar, descifrar e inspeccionar la estructura | [qpdf](https://github.com/qpdf/qpdf) 12.2.0 compilado a WebAssembly |
| Tratar imágenes | `canvas` y `createImageBitmap` del navegador |
| Comprimir | [fflate](https://github.com/101arrowz/fflate) |

Los recursos auxiliares —el worker de PDF.js, sus tablas de caracteres, sus tipografías estándar, sus módulos WebAssembly y el WebAssembly de qpdf— se distribuyen **dentro del propio sitio**. No se usa ninguna red de distribución de contenidos. La integración continua lo verifica en cada compilación.

## Contraseñas

Están tratadas con detalle en [CIFRADO.md](CIFRADO.md). Resumen:

- Viven en el estado de React **solo mientras se usan**, y se borran en cuanto la operación termina, con éxito o con error.
- No se guardan en ningún almacenamiento del navegador.
- No aparecen en nombres de archivo, ni en rutas, ni en registros, ni en mensajes de error.
- Al descifrar viajan en un archivo del sistema virtual, no en los argumentos, así que ni un mensaje de uso podría mostrarlas.
- Al cifrar sí viajan en los argumentos, porque qpdf no admite otra forma. Ocurre dentro del Web Worker, los argumentos no se registran nunca y la salida del motor se intercepta y se depura antes de salir del trabajador.

**Limitación honesta:** las cadenas de JavaScript son inmutables, así que no se pueden sobrescribir en memoria. Lo único posible es dejar de referenciarlas para que el recolector de basura las reclame, y eso es lo que se hace.

## Inspector de seguridad PDF

El inspector realiza un **análisis estructural**, no un análisis antivirus. qpdf
12.2.0 genera dentro del Web Worker una representación JSON de los objetos del
documento y omite los datos de los flujos. Un recorrido acotado y defensivo trata
esa representación como entrada no confiable y busca las claves y relaciones
relevantes.

El informe señala JavaScript, acciones al abrir o adicionales, acciones
`/Launch`, envíos de formularios, enlaces externos, RichMedia, AcroForm, XFA y
archivos incrustados. Cuando qpdf facilita sus metadatos, también muestra el
nombre, la extensión y el tipo declarado del adjunto, y destaca extensiones que
parecen ejecutables o scripts. Una extensión o una característica estructural
**no demuestra por sí sola que el documento sea malicioso**.

Durante la inspección:

- no se evalúa JavaScript;
- no se ejecutan acciones;
- no se abren enlaces;
- no se extraen ni abren adjuntos;
- no se envían el archivo, su hash ni los hallazgos a ningún servicio.

La clasificación usa cuatro niveles descriptivos —sin indicios, bajo,
precaución y elevado— y reglas deterministas. No usa una puntuación que sugiera
una certeza inexistente. Una acción `/Launch`, un adjunto con extensión ejecutable
o una acción automática asociada a JavaScript elevan el resultado; un enlace
externo aislado no se presenta como malware.

Si el documento está cifrado y qpdf no puede leer su estructura sin contraseña,
el inspector no solicita la clave ni presenta un resultado parcial como
definitivo: indica que primero debe usarse «Desbloquear PDF». El análisis tampoco
puede detectar vulnerabilidades del lector, contenido oculto fuera de la
estructura interpretada ni afirmar que un archivo sea seguro. **No sustituye a
un antivirus y no puede garantizar la ausencia de malware.**

## Firma visual

*Pendiente de implementación.* Cuando exista, la distinción será explícita: una firma dibujada, escrita o importada es una **imagen colocada en el documento**. No es una firma digital: no incluye certificado, no valida la identidad de nadie, no lleva sello de tiempo y no detecta si el documento se modificó después. Sirve para lo mismo que firmar un papel con bolígrafo, ni más ni menos.

## Limpieza de recursos

La aplicación libera lo que reserva:

- Los documentos de PDF.js y su worker se liberan al cambiar de documento y al salir de la herramienta.
- Los `canvas` se vacían al desmontarse.
- Las imágenes descodificadas se cierran en cuanto se han dibujado.
- Las URL temporales se revocan siempre, también tras cada descarga.
- Los dibujados pendientes se cancelan con `AbortController`.
- Las pistas de la cámara se detienen al cambiar de cámara, al apagarla, al restablecer y al desmontar.
- **El Web Worker de qpdf se destruye con `terminate()`** al salir de la herramienta y al restablecer. El hilo, el WebAssembly y su sistema de archivos virtual desaparecen con él.
- Cada operación de qpdf usa una **instancia nueva** del motor, así que arranca con el sistema de archivos vacío, y borra con `unlink` todo lo que escribe —incluido el JSON temporal del inspector—, también cuando falla.

## Verificación antes de entregar

Las herramientas de seguridad no entregan un archivo sin comprobarlo:

- **Proteger** verifica que el documento quedó cifrado con AES-256, que la contraseña correcta lo vuelve a abrir y que conserva el número de páginas.
- **Desbloquear** verifica que el resultado ya no está cifrado, que pdf-lib puede abrirlo y que conserva páginas.

Si una comprobación falla, no se descarga nada.

## Recorte y censura

**El recorte no elimina el contenido oculto.** «Recortar PDF» ajusta la caja de recorte del formato PDF: el contenido que queda fuera sigue dentro del archivo y se puede recuperar. Es una herramienta para ajustar encuadres, **no para ocultar información confidencial**. La interfaz lo advierte.

Eliminar contenido de verdad requiere reconstruir el documento, y corresponde a la herramienta de censura permanente, todavía no implementada.

## Dependencias

Se añaden con criterio restrictivo. Antes de integrar cualquier dependencia se revisa su licencia, su mantenimiento, sus dependencias transitivas, si incluye telemetría y si puede funcionar sin CDN. La auditoría de qpdf está documentada en [CIFRADO.md](CIFRADO.md).

Dependencias de producción actuales:

| Dependencia | Licencia | Para qué |
| ----------- | -------- | -------- |
| `react`, `react-dom` | MIT | Interfaz |
| `pdf-lib` | MIT | Crear y modificar documentos |
| `pdfjs-dist` | Apache-2.0 | Dibujar páginas |
| `fflate` | MIT | Generar ZIP |
| `@neslinesli93/qpdf-wasm` | ISC | Cifrar, descifrar, reparar, comprimir e inspeccionar estructura |

## Informar de una vulnerabilidad

Si encuentras un problema de seguridad:

1. **No abras una incidencia pública** si el problema permitiría acceder a documentos o contraseñas de otras personas.
2. Escribe al mantenimiento del proyecto a través de los [contactos del repositorio](https://github.com/Felipe-Moreno-Marciales/free-pdf), indicando:
   - Qué versión o commit has probado.
   - Qué navegador y sistema operativo.
   - Los pasos para reproducirlo.
   - Qué esperabas y qué ocurrió.
3. Si puedes, indica el impacto: ¿se filtra un documento? ¿una contraseña? ¿se genera un archivo que parece protegido y no lo está?

Interesan especialmente:

- Cualquier petición de red que lleve datos de la persona.
- Cualquier contraseña que aparezca en la consola, en un mensaje de error o en almacenamiento persistente.
- Cualquier caso en el que una herramienta afirme haber protegido o verificado algo que no cumple.
- Cualquier resto que sobreviva a cambiar de herramienta o de documento.

Como el proyecto es software libre bajo AGPL-3.0, también puedes revisar el código y proponer la corrección directamente.

## Qué NO es un problema de seguridad

Para ahorrar tiempo a todo el mundo:

- Que los permisos PDF no se respeten en algún lector. Es una limitación del formato, está documentada y la interfaz lo advierte.
- Que no se pueda abrir un documento sin su contraseña. Es lo que se pretende.
- Que el recorte conserve el contenido oculto. Está documentado y advertido en la interfaz.
- Que una contraseña permanezca en memoria hasta que el recolector de basura actúe. Es una limitación de JavaScript, no del diseño.

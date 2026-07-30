# Censura permanente en Free PDF

Este documento explica por qué una caja negra no basta, cómo funciona la censura de Free PDF y qué se puede afirmar de verdad sobre ella.

## Por qué una caja negra no basta

La forma intuitiva de censurar un PDF es dibujar un rectángulo negro encima. Es también la forma equivocada, y el motivo es que **un PDF no es una imagen: es una lista de instrucciones de dibujo**.

Cuando se superpone un rectángulo, el documento pasa a contener:

1. La instrucción que dibuja el texto original.
2. La instrucción que dibuja el rectángulo encima.

El texto sigue ahí. Basta con:

- Seleccionarlo y copiarlo, porque la capa de texto no se ha tocado.
- Extraerlo con cualquier herramienta de línea de órdenes.
- Borrar el rectángulo con un editor de PDF.
- Leer el flujo de contenido directamente.

Se han filtrado documentos reales así, en organismos públicos y en litigios. No es un riesgo teórico.

**Free PDF no hace eso.**

## Cómo funciona la censura de Free PDF

El canal completo está en [`src/seguridad/censura/censurarPdf.ts`](../src/seguridad/censura/censurarPdf.ts):

1. **Cada página se dibuja con PDF.js** a la resolución elegida, sobre un `canvas`.
2. **Las zonas censuradas se pintan sobre esos píxeles.** A partir de ese momento, lo que había debajo ya no existe en la imagen: no está tapado, está sustituido.
3. **Se crea un documento nuevo** con `PDFDocument.create()`.
4. **Cada página del documento nuevo es esa imagen.**

Lo que **no** ocurre en ningún momento:

- No se copian los flujos de contenido originales.
- No se copian las anotaciones.
- No se copian los campos de formulario.
- No se copia el JavaScript incrustado.
- No se copian los archivos adjuntos.
- No se copian las capas opcionales.
- No se copian los metadatos: el título, el autor, el asunto y las palabras clave se dejan explícitamente vacíos.

### Todas las páginas se reconstruyen, no solo las censuradas

Esto es deliberado y es importante. Si solo se rasterizaran las páginas con zonas marcadas, el resto conservaría sus flujos originales y el documento sería una mezcla: parte reconstruida, parte intacta. Eso complica razonar sobre lo que se ha eliminado y deja metadatos y estructuras del original.

Reconstruir el documento completo da una garantía sencilla de enunciar: **ninguna página del resultado proviene del contenido original**.

Hay una prueba automatizada que lo verifica: si alguien cambiara el código para rasterizar solo las páginas censuradas, esa prueba fallaría.

## Consecuencias, que son reales

Reconstruir desde píxeles tiene un precio, y conviene aceptarlo a conciencia:

| Antes | Después |
| ----- | ------- |
| El texto se puede seleccionar y buscar | El texto es parte de la imagen: no se puede seleccionar ni buscar |
| Los enlaces son interactivos | Los enlaces dejan de funcionar |
| Los formularios se pueden rellenar | Los formularios desaparecen |
| Las anotaciones son objetos | Las anotaciones desaparecen |
| Un lector de pantalla puede leer el texto | **La estructura de accesibilidad se pierde** |
| Tamaño según el contenido | El archivo suele ocupar más |

La pérdida de accesibilidad es la consecuencia más seria y no se puede evitar con este método: un documento de imágenes no tiene texto que leer. Si el documento debe seguir siendo accesible, la censura por rasterizado no es la herramienta adecuada.

La interfaz exige **confirmar explícitamente** que se entienden estas consecuencias antes de permitir la operación.

## Resolución

Se ofrecen tres perfiles, documentados en [`coordenadasCensura.ts`](../src/seguridad/censura/coordenadasCensura.ts):

| Perfil | Densidad | Escala | Para qué |
| ------ | -------- | ------ | -------- |
| Ligera | 150 ppp | 2,08 | Documentos que solo se van a leer en pantalla |
| Equilibrada | 200 ppp | 2,78 | Opción predeterminada |
| Alta | 300 ppp | 4,17 | Documentos que se van a imprimir o con letra pequeña |

La escala se deriva de la densidad dividida por 72, porque un punto PDF es 1/72 de pulgada.

**Memoria.** Una página A4 a 300 ppp son unos 2550 × 3300 píxeles, es decir, unos 34 MB mientras se dibuja. Las páginas se procesan **de una en una** y el lienzo se vacía en cuanto se tienen los bytes. Aun así, la herramienta avisa cuando se combinan muchas páginas con la resolución alta.

**Formato.** Las páginas se incrustan como JPEG con calidad 92. Una página rasterizada es, a efectos prácticos, una fotografía: en PNG el documento resultante sería varias veces más grande sin ganancia apreciable.

## Coordenadas

Las zonas se guardan en **fracciones** del ancho y del alto de la página visible, entre 0 y 1. No en píxeles de pantalla.

Esto importa: la misma zona debe tapar exactamente lo mismo cuando se ve en una miniatura de 200 píxeles y cuando se rasteriza a 300 ppp. Guardarla en fracciones es lo que lo garantiza.

Al traducir a píxeles, las medidas se **redondean hacia fuera**: es preferible tapar un píxel de más que dejar medio carácter asomando por el borde. Hay pruebas que lo verifican, incluida una que comprueba que la misma zona cubre la misma proporción a resoluciones muy distintas.

## Verificación

No se entrega ningún archivo sin comprobarlo. El comprobador está en [`verificarCensura.ts`](../src/seguridad/censura/verificarCensura.ts) y vuelve a abrir el resultado para confirmar:

1. **Número de páginas**: debe coincidir con el original.
2. **Texto extraíble**: PDF.js recorre todas las páginas y **no debe encontrar ninguna cadena de texto**. Si encuentra algo, es que la reconstrucción falló.
3. **Anotaciones interactivas**: no debe quedar ninguna.
4. **Campos de formulario**: pdf-lib abre el documento y no debe encontrar ninguno.
5. **Se puede dibujar**: al menos una página debe tener medidas válidas, es decir, el documento no solo es correcto sobre el papel sino utilizable.

**Si alguna comprobación falla, no se descarga nada.** Un error claro es preferible a un archivo que parezca censurado y no lo esté.

### Qué demuestra la verificación y qué no

Conviene ser preciso, porque aquí es fácil prometer de más.

**Lo que se puede afirmar**, porque es exactamente lo implementado y comprobado:

- El documento entregado se construyó a partir de píxeles.
- Los flujos de contenido originales no se copiaron.
- El resultado no contiene capa de texto extraíble, ni campos de formulario, ni anotaciones interactivas.
- El resultado se puede abrir y dibujar.

**Lo que NO se afirma:**

- Que esté matemáticamente demostrado que ningún dato pueda recuperarse. Es una afirmación más fuerte y no se hace.
- Que el rasterizado de PDF.js sea idéntico al de cualquier otro lector.
- Que un análisis forense de la imagen no pueda deducir nada por el contexto: la longitud de una zona tapada sigue revelando cuántos caracteres había, y eso es inherente a tapar en lugar de eliminar y recomponer.

## Diferencia con «Recortar PDF»

Es la distinción más importante de toda la suite y merece quedar clara:

| | Recortar PDF | Censurar permanentemente |
| --- | --- | --- |
| Qué cambia | La caja de recorte (`CropBox`) | Todo el documento |
| El contenido oculto | **Sigue dentro del archivo** | No está en el resultado |
| Reversible | Sí, ampliando la caja | No |
| El texto sigue seleccionable | Sí | No |
| Para qué sirve | Ajustar encuadres y márgenes | Eliminar información |
| ¿Sirve para ocultar datos confidenciales? | **No** | Sí, con las limitaciones de arriba |

Recortar es una operación de presentación. Censurar es una operación de seguridad. Confundirlas es exactamente el error que provoca filtraciones, y por eso las dos herramientas lo advierten en su propia interfaz.

## Limitaciones conocidas

- **No hay búsqueda de texto todavía.** Las zonas se marcan a mano. La búsqueda por texto —encontrar todas las apariciones de una palabra y proponer zonas— está prevista pero no implementada. Ver [PROGRESO_AUTONOMO.md](PROGRESO_AUTONOMO.md).
- **No hay detección automática de datos sensibles.** No se buscan DNI, números de tarjeta ni nombres.
- **No hay OCR.** Si el documento ya es un escaneado sin capa de texto, la censura funciona igual —se rasteriza y se tapa—, pero no se puede buscar texto porque no hay ninguno.
- **Las zonas se ajustan con campos numéricos**, en porcentaje, no arrastrando. Es deliberado: unos controles numéricos funcionan con el teclado y con lector de pantalla, y en una herramienta de seguridad conviene poder indicar una medida exacta. La vista previa muestra el resultado en cuanto se cambia un valor.
- **El pintado de los píxeles se verifica en el navegador.** La geometría —que una zona en fracciones se traduzca a los píxeles correctos— sí está cubierta por pruebas automatizadas; que el `canvas` rellene de verdad esos píxeles es responsabilidad del navegador y se comprueba abriendo el resultado.

## Recomendación práctica

Después de censurar, **abre el documento resultante y comprueba tú mismo** que no puedes seleccionar ni copiar lo que querías ocultar. La verificación automática lo comprueba, pero en algo así conviene mirarlo con los propios ojos.

Si el documento es especialmente sensible, considera además revisar el resultado en otro lector distinto.

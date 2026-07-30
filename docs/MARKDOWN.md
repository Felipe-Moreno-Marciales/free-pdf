# PDF a Markdown

La herramienta «PDF a Markdown» extrae la capa de texto de un documento con PDF.js y genera un archivo `free-pdf.md`. Todo sucede en el navegador: el PDF no se sube, no hay backend, no se usa ningún modelo generativo y no se llama a servicios externos.

## Qué reconstruye

Un PDF no guarda encabezados, párrafos, listas o tablas como tales. Guarda instrucciones para dibujar fragmentos en coordenadas. Free PDF usa esas coordenadas y el tamaño de la fuente para deducir, de forma aproximada:

- encabezados de tres niveles;
- párrafos y saltos de línea;
- listas numeradas y con viñetas;
- citas marcadas con `>`;
- enlaces anotados en el PDF;
- tablas sencillas con columnas alineadas.

La vista previa siempre es editable. Se puede copiar o descargar como Markdown UTF-8. Los caracteres con significado en Markdown se escapan y solo se conservan enlaces `http`, `https` y `mailto`.

## Flujo y memoria

`src/extraccion/textoPdf.ts` procesa las páginas seleccionadas secuencialmente con `getTextContent()` y `getAnnotations()`. Cada página se limpia con `cleanup()` antes de abrir la siguiente. El documento y su trabajador pertenecen al cargador compartido y se destruyen al reemplazarlo, empezar de nuevo o abandonar la herramienta.

La cancelación se comprueba antes y después de cada lectura y se cede el hilo entre páginas para que el botón siga respondiendo. La herramienta informa la página actual y el avance total.

## Documento sin texto

Si ninguna página elegida contiene fragmentos de texto, no se inventa un resultado vacío como si fuese una conversión correcta. La interfaz explica que el documento necesita OCR y remite a la herramienta local correspondiente.

## Límites conocidos

- Un documento de dos o más columnas puede producir texto entrelazado.
- Una tabla compleja, con celdas combinadas o contenido en varias líneas, no se reconstruye fielmente.
- El tamaño de fuente solo permite estimar encabezados; no demuestra su jerarquía semántica.
- Los enlaces solo se recuperan cuando el PDF contiene una anotación enlazada que se cruza con el texto.
- El orden de lectura de diseños complejos depende de las posiciones dibujadas por el documento.

La interfaz anuncia estas limitaciones antes de procesar. La salida debe revisarse y puede corregirse en la vista previa.

## Verificación automatizada

`src/pruebas/pdfAMarkdown.prueba.ts` cubre encabezados, párrafos, listas, enlaces, tablas sencillas, varias páginas, selección por rangos, documento sin texto, cancelación, escapado de Markdown y el archivo descargable. Dos pruebas generan PDF mínimos con pdf-lib y los abren con el motor PDF.js real.

# Comparación de documentos en Free PDF

Este documento explica qué compara Free PDF, cómo lo compara y —lo más importante— **qué no se puede concluir** de un resultado.

## Dos planos que no hay que confundir

La comparación mira dos cosas distintas. Confundirlas es el error más fácil de esta herramienta, y por eso la interfaz las muestra por separado y no las mezcla en un veredicto único.

### El texto extraíble — es la comparación fiable

Se extrae con PDF.js y se compara palabra por palabra. Dos documentos con el mismo texto dicen lo mismo.

Se compara por **multiconjunto**: qué palabras sobran y qué palabras faltan, contando repeticiones. Es una decisión consciente frente a un algoritmo de diferencias por líneas:

- **A favor:** mover un párrafo de sitio no cambia las palabras, así que no se señala nada. Un algoritmo de líneas lo marcaría como un cambio enorme.
- **En contra:** reordenar palabras dentro de una frase pasa desapercibido en las listas de añadidas y eliminadas. Se detecta de todos modos —el texto normalizado no coincide— y se dice «el texto es el mismo pero está en otro orden», pero no se señala dónde.

El espacio en blanco se normaliza antes de comparar. PDF.js parte el texto en fragmentos según cómo esté dibujado, y dos documentos idénticos pueden dar fragmentos distintos con las mismas palabras; sin normalizar, saldrían diferencias falsas.

### Los píxeles — detecta más, pero concluye menos

Cada página se dibuja a 900 píxeles de ancho y se cuentan los píxeles que cambian.

Detecta lo que el texto no ve: una imagen distinta, un sello movido, otro color, un gráfico modificado.

**Pero una diferencia visual no implica una diferencia de contenido.** Cambiar de tipografía altera todos los píxeles sin cambiar una sola palabra. Reexportar el mismo documento con otro programa puede mover todo medio punto. Esto está dicho en la interfaz y **también dentro del informe descargable**, porque el archivo se puede archivar o reenviar y quien lo lea meses después merece la misma advertencia.

#### Tolerancia y umbral

Son dos cosas distintas:

- **Tolerancia por canal (12 de 255, fija).** Dibujar la misma página dos veces puede dar valores que difieren en una o dos unidades por el antialias. Con tolerancia cero, cada página saldría «modificada» aunque los documentos fueran idénticos.
- **Umbral (configurable, 0,5 % por omisión).** Fracción de píxeles que tienen que cambiar para que la página se considere modificada. Por debajo se considera ruido del dibujado.

Las zonas con diferencias se localizan con una rejilla de 12 × 12 y se resaltan las celdas donde se concentran los cambios. **No se agrupan celdas contiguas en rectángulos mayores** a propósito: daría una impresión de precisión que el método no tiene.

## Qué más se compara

| Aspecto | Cómo |
| ------- | ---- |
| Número de páginas | Directo. Las páginas que sobran se marcan como añadidas o eliminadas. |
| Medidas | Con media décima de tolerancia: reescribir un documento puede variar una medida en una fracción de punto. |
| Giro | Exacto. |
| Metadatos | Título, autor, asunto, palabras clave, creador y productor, leídos con pdf-lib. |

## Las páginas se emparejan por su número

No se busca la página más parecida. Emparejar por semejanza detectaría una página insertada en medio, pero exigiría comparar todas contra todas y produciría resultados difíciles de explicar.

La consecuencia es concreta y hay que saberla: **insertar una página al principio marca todas las siguientes como modificadas**. Se dice en la interfaz y en el informe en lugar de disimularlo.

## Procesamiento y recursos

- **Página por página, en orden.** Dibujar dos páginas a la vez multiplica la memoria sin ganar nada, y el progreso y la cancelación tienen que ser reales.
- **Cada lienzo se libera** en cuanto se han extraído sus píxeles, y cada página de PDF.js se limpia después de usarla.
- **Los dos documentos se cierran siempre**, también si la comparación falla o se cancela. Dejarlos abiertos mantendría vivos los trabajadores de PDF.js.
- **Se puede cancelar** en cualquier momento, entre páginas.
- El visor abre el documento, dibuja la página y **lo cierra inmediatamente**. Mantener dos documentos abiertos mientras se navega consumiría memoria; reabrir tarda unas décimas.

Los 900 píxeles de ancho de la comparación no son arbitrarios: la comparación busca **dónde** hay diferencias, no reproducir el documento. A ese ancho una A4 son unos 1,1 megapíxeles, que se comparan rápido y detectan cualquier cambio apreciable. Subirlo multiplicaría el tiempo sin encontrar nada nuevo.

## El informe

Se descarga como `free-pdf-informe-comparacion.html`.

**Es HTML y no PDF, a propósito.** Un PDF exigiría incrustar tipografías para escribir los acentos y las eñes, y las estándar del formato no cubren todo lo que puede aparecer en el texto comparado. Un HTML se abre en cualquier navegador, se imprime a PDF desde ahí si hace falta y **no pierde ni un carácter**.

El archivo es **completamente autónomo**: los estilos van dentro, y no hay ni un `script`, ni una imagen, ni una referencia externa. Se puede archivar, enviar o abrir sin conexión, y no ejecuta nada. Hay una prueba que comprueba que no contiene `<script>`, ni `http://`, ni `https://`, ni `<img>`, ni `<link>`.

Todo el texto que viene de los documentos —nombres de archivo, palabras comparadas, metadatos— **se escapa** antes de insertarlo. Un documento llamado `<script>alert(1)</script>.pdf` no puede inyectar nada, y hay pruebas de los dos casos.

El informe se adapta al modo claro y oscuro del sistema, y tiene estilos de impresión que evitan cortar las secciones por la mitad.

## Limitaciones conocidas

- **Un documento escaneado sin capa de texto** no aporta texto que comparar. Solo se compara visualmente, y conviene saberlo antes de interpretar el resultado.
- **Reordenar palabras dentro de una frase** se detecta pero no se localiza, por lo explicado arriba.
- **Insertar una página en medio** desplaza el emparejamiento y marca todo lo siguiente como modificado.
- **No se comparan** anotaciones, campos de formulario, marcadores, adjuntos ni JavaScript incrustado. Un cambio en cualquiera de esas cosas puede no aparecer si no altera el texto ni los píxeles.
- **No encontrar diferencias no demuestra que los archivos sean idénticos byte a byte**, solo que esta comparación no encuentra ninguna. Es la afirmación que la herramienta se cuida de no hacer.
- **El resaltado de zonas es aproximado**, con la granularidad de la rejilla.

## Recomendación práctica

Si el resultado dice que cambia un porcentaje pequeño de píxeles pero el texto es idéntico, lo más probable es que el documento se haya reexportado con otro programa. Mira las páginas en modo superpuesto y mueve la opacidad: es la forma más rápida de ver si algo se ha movido de verdad o si solo ha cambiado la forma de dibujarlo.

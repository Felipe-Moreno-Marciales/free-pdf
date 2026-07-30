# Compresión de documentos en Free PDF

Este documento explica los dos tipos de compresión que hace Free PDF, cuánto reduce cada uno y qué se pierde con cada uno.

## Los dos tipos de compresión, y aquí se hacen los dos

Cuando alguien dice «comprimir un PDF» puede querer decir dos cosas distintas. Free PDF hace ambas, en este orden, y con consecuencias muy diferentes.

### 1. Recompresión de imágenes — con pérdida

Las imágenes JPEG del documento se descodifican, se redibujan a menor tamaño y se vuelven a codificar con menos calidad. **Es lo que de verdad reduce un PDF de fotografías**, y es irreversible sobre el archivo que se descarga.

Lo hace el navegador, con `createImageBitmap` y `canvas`. No hay ninguna petición de red: el JPEG nunca sale del hilo.

**Lo importante: el documento no se rasteriza.** Se sustituyen los flujos de las imágenes uno por uno con la API de bajo nivel de pdf-lib, y todo lo demás queda intacto —el texto sigue siendo texto seleccionable, los vectores siguen siendo vectores y las tipografías siguen incrustadas—. Es la diferencia esencial con las herramientas que convierten el documento en un álbum de fotos, y con la censura de Free PDF, que sí rasteriza a propósito.

Medido: un documento de 162 KB con una imagen de 400 × 400 bajó a 12,7 KB —un **92,2 %**— sustituyendo esa imagen, y el texto y la tipografía Helvetica seguían presentes.

**Solo se tocan las imágenes JPEG.** Un flujo `DCTDecode` es un JPEG completo y se puede recodificar sabiendo solo eso. Las imágenes `FlateDecode` guardan píxeles crudos cuya interpretación depende de `/ColorSpace`, `/BitsPerComponent`, `/Decode` y a veces de una paleta indexada; recodificarlas exigiría reproducir esa interpretación con exactitud, y equivocarse significa cambiar los colores del documento. No merece la pena: qpdf ya las recomprime sin pérdida.

### 2. Optimización estructural — sin pérdida

Después, qpdf reorganiza el contenedor: agrupa los objetos en flujos comprimidos, recomprime los flujos que venían flojos y reescribe el índice. **No cambia ni un píxel ni una letra.**

El orden importa: primero las imágenes con pdf-lib, después la estructura con qpdf. Al revés, qpdf dejaría el documento con flujos de objetos y pdf-lib tendría que rehacerlos al guardar, deshaciendo parte del trabajo.

## Lo que qpdf no hace, medido y no supuesto

Esto se midió antes de escribir la herramienta, y es la razón de que exista la recompresión de imágenes:

| Documento | Reducción solo con qpdf |
| --------- | ----------------------- |
| Texto, sin flujos de objetos | −49,5 % |
| Imagen en Flate mal comprimida | −37,2 % |
| **JPEG incrustado (`DCTDecode`)** | **−1,5 %** |
| Ya optimizado | −1,9 % |

Con un documento de 93 KB cuyos 90 KB eran un JPEG, qpdf solo consiguió un **1,5 %**, y el `DCTDecode` seguía intacto en el resultado. Hay una prueba con el motor real que lo comprueba en cada ejecución.

**Conclusión:** qpdf no recomprime imágenes, y por eso la reducción de imágenes se hace aparte, en el navegador.

## Los tres perfiles

Cada perfil combina un límite de tamaño en píxeles con una calidad JPEG:

| Perfil | Lado máximo | Calidad | Qué esperar |
| ------ | ----------- | ------- | ----------- |
| Ligera | 2200 px | 90 % | A la vista no se nota. Sigue valiendo para imprimir a 200 puntos por pulgada en A4. |
| Equilibrada | 1600 px | 78 % | La recomendada para documentos que se van a leer en pantalla. |
| Alta | 1100 px | 60 % | Reduce mucho más, y en las fotografías **se va a notar**. |

**Se limita el lado en píxeles y no la densidad.** El motivo es concreto: el documento no dice a qué tamaño se dibuja cada imagen —eso está en los flujos de contenido de cada página, y averiguarlo exigiría interpretarlos—. Limitar el lado es una regla predecible que se puede explicar en una frase, y la interfaz dice el número exacto de cada perfil.

**La proporción se conserva siempre.** Se escala por el lado más largo y el otro se deriva, con un mínimo de un píxel para que una imagen muy alargada no termine con un lado de cero. Hay pruebas de las dos cosas.

### Imágenes que no se tocan

- Las que **no son JPEG**, por lo explicado arriba.
- Las **diminutas**, por debajo de 4 KB: un icono de 32 × 32 no va a ahorrar nada y sí puede quedar peor.
- Las que **ya caben en el límite** cuando el perfil es ligero: con calidad 90 % no merece la pena recodificar sin redimensionar.
- Las que **el navegador no consigue descodificar**. Ocurre de verdad con JPEG en CMYK o con variantes raras; en ese caso la imagen se deja como estaba y se sigue con la siguiente. No es un error de la herramienta y se informa de cuántas fueron.
- Las que **no mejoran**: si la imagen recomprimida no es al menos un 5 % más pequeña, se conserva la original. Sustituirla por una que pesa lo mismo empeoraría la calidad a cambio de nada, que es el peor resultado posible.

## Procesamiento secuencial, progreso y cancelación

Las imágenes se procesan **una por una**. Una fotografía de 4000 × 3000 ocupa unos 48 MB descodificada, y hacerlo en paralelo agotaría la memoria en un documento con muchas. A cambio, el progreso es real —imagen 3 de 12— y la cancelación es efectiva.

El mapa de bits se cierra en cuanto se ha codificado el resultado, y el lienzo se libera después de cada imagen.

El proceso informa de cuatro etapas: analizar el documento, recomprimir las imágenes, optimizar la estructura y comprobar el resultado.

## Borrado de metadatos

Es opcional, y **no es una medida de compresión**: los metadatos ocupan poquísimo. Es una medida de privacidad, y se ofrece aquí porque quien está comprimiendo un documento normalmente lo está preparando para enviarlo.

Un PDF suele llevar el nombre de quien lo creó, el programa con el que se hizo y las fechas exactas. La interfaz **enseña qué hay antes de que decidas**, porque nadie debería aceptar borrar algo sin ver qué es.

Las fechas no se pueden dejar sin valor con pdf-lib, así que se fijan a un instante neutro y no a la fecha de hoy: poner la fecha actual delataría cuándo se procesó el documento, que es justo lo que se trata de evitar.

## Dos opciones que no se ofrecen, y por qué

Ambas están **medidas** y ambas hacen el archivo más grande:

| Opción | Efecto medido | Por qué existe en qpdf |
| ------ | ------------- | ---------------------- |
| `--linearize` | **+96,9 %** en el documento ya optimizado | Reorganiza el archivo para que un lector pueda mostrar la primera página antes de descargarlo entero. Sirve para servir por red, no para comprimir. |
| `--normalize-content=y` | **+472 %** | Descomprime los flujos de contenido para poder leerlos. Es lo contrario de comprimir. |

Ofrecer `--linearize` en una herramienta llamada «Comprimir» sería engañoso, así que no está. Hay dos pruebas que fallarían si alguien las volviera a añadir.

## La regla que gobierna la entrega

**Si el archivo no queda más pequeño, no se entrega.**

El umbral es medio por ciento. Por debajo de eso:

- No se descarga nada.
- Se muestra este mensaje exacto: «No se pudo reducir el tamaño con este método local. El documento puede estar ya optimizado.»
- Se dan las tres cifras de todos modos: tamaño original, tamaño final y la diferencia real, en bytes y en porcentaje.
- **Tu archivo original sigue intacto**, porque nunca se modifica: la herramienta solo puede producir un archivo nuevo.

Entregar una copia que no es más pequeña sería hacer creer que se ha ganado algo. Y hay un motivo adicional: el documento reescrito pierde cualquier particularidad del original que no fuera estrictamente necesaria, así que cambiar de archivo a cambio de nada es un mal negocio.

La decisión se toma en un solo sitio, `construirResultado`, que deja el `blob` en `null` cuando no procede entregar nada. Así ni la interfaz ni la descarga automática pueden entregar por descuido un archivo que no debía salir.

## Verificación

Antes de dar por bueno el resultado se comprueba:

1. **qpdf puede leer lo que acaba de escribir** (`--check` sin errores). Si no, se conserva la versión que salió de pdf-lib con las imágenes ya recomprimidas, que es mucho mejor que perder ese trabajo.
2. **pdf-lib lo abre sin `ignoreEncryption`**. Si no, se lanza un error y no se entrega nada.
3. **El número de páginas coincide** con el del original. Si no, no se entrega.

Hay además pruebas de que el documento resultante conserva el texto y la tipografía incrustada —la comprobación de que no se ha rasterizado nada—, de que comprimir no cifra, y de que comprimir dos veces no vuelve a reducir, que es la forma de confirmar que la operación converge en lugar de degradar el archivo poco a poco.

## Documentos cifrados

No se pueden comprimir sin la contraseña: qpdf no puede leer su contenido. Se detecta antes de intentarlo y se remite a «Desbloquear PDF», en lugar de dejar que el motor falle con un mensaje que no explica nada.

## Limitaciones conocidas

- **Solo se recomprimen las imágenes JPEG**, por lo explicado arriba. Un documento cuyo peso esté en imágenes PNG o en mapas de bits indexados se reducirá menos.
- **No se quitan las tipografías incrustadas** ni se recortan a los glifos usados. Reduciría en documentos con tipografías grandes, pero exige rehacer los subconjuntos y arriesga que el documento deje de mostrarse igual.
- **No se cambia el espacio de color.** Convertir a escala de grises reduciría más en documentos que no necesitan color, pero es una decisión sobre el contenido que la herramienta no debe tomar por su cuenta.
- **La transparencia se pierde en las imágenes recomprimidas.** El JPEG no tiene canal alfa, así que se pinta un fondo blanco antes de dibujar. Una imagen con transparencia sobre un fondo de color se verá distinta.
- **La recompresión pierde calidad y es irreversible** sobre el archivo descargado. El original nunca se toca, así que siempre se puede volver a él.
- **Un documento cifrado no se puede comprimir** sin la contraseña. Se detecta y se remite a «Desbloquear PDF».

## Recomendación práctica

Empieza con el perfil equilibrado y mira el porcentaje real que se te da. Si el documento es de texto, el ahorro vendrá de la estructura y no notarás ninguna diferencia. Si es de fotografías, compara el resultado con el original antes de quedarte con él: la calidad sí ha bajado.

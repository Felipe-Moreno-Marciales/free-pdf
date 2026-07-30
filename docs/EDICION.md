# Edición visual y firma en Free PDF

Este documento explica cómo funcionan «Editar y anotar» y «Firma visual», y sobre todo **qué no hacen**. Las dos herramientas comparten el mismo motor, y las dos se prestan a que alguien entienda de más.

## Las dos afirmaciones importantes

### «Editar y anotar» no modifica el texto original del PDF

Añade una **capa encima**. El documento original queda intacto por debajo: su texto sigue siendo texto seleccionable, sus enlaces siguen funcionando y su estructura de accesibilidad no se pierde.

Lo que **no** se puede hacer, y no se insinúa que se pueda: corregir una palabra de un párrafo que ya está en el documento. Un PDF no guarda párrafos, guarda instrucciones de dibujado con posiciones absolutas. Cambiar una palabra por otra más larga obligaría a recalcular el interletraje, la partición de líneas y el reflujo del resto del párrafo, con la tipografía exacta del original —que puede estar incrustada parcialmente, solo con los glifos usados—. Las herramientas que lo intentan producen documentos con líneas descolocadas y tipografías que no coinciden. Preferimos no ofrecerlo a ofrecerlo mal.

Si lo que necesitas es **ocultar** algo, la herramienta es «Censurar permanentemente». Tapar con un rectángulo desde aquí **no oculta nada**: el texto sigue debajo y se puede copiar. Está explicado en [CENSURA.md](CENSURA.md).

### «Firma visual» no es una firma digital

Coloca un dibujo o un texto sobre el documento. Nada más.

- No usa ningún certificado.
- No prueba la identidad de quien firma.
- No detecta si el documento se modifica después de firmarlo.
- No tiene validez de firma electrónica cualificada.
- Cualquiera puede recortar la imagen de la firma y ponerla en otro documento.

Vale lo que vale una firma en un papel escaneado, que en bastantes trámites es suficiente. Pero no es lo mismo, y tanto la interfaz como este documento lo dicen sin rodeos.

La firma electrónica con certificado queda fuera del alcance del proyecto: obliga a decidir dónde viven las claves privadas, y esa decisión afecta al modelo de privacidad del proyecto entero.

**La firma no se guarda.** Vive en el estado de la página y desaparece al recargar o al restablecer. No se escribe en `localStorage` ni en ningún otro sitio.

## Cómo está construido

### Coordenadas en fracciones

Todos los elementos guardan su posición y su tamaño como **fracciones de la página visible**, entre 0 y 1. Nunca en píxeles de pantalla.

Es la misma decisión que en la censura y en la marca de agua, y por el mismo motivo: la vista previa mide unos 400 píxeles y la página 595 puntos. Guardando fracciones, lo que se ve es exactamente lo que sale.

`superior` se mide **desde arriba**, porque así se mira una página. PDF mide desde abajo. La inversión ocurre en un solo sitio, [`calcularCajaVisible`](../src/edicion/colocarElementos.ts), y está cubierta por pruebas.

### Páginas giradas

Una página puede declarar una rotación de 90, 180 o 270 grados. El visor la gira al mostrarla, así que las coordenadas que ve quien edita no son las del documento.

La traducción se reutiliza de [`posicionarEnPagina.ts`](../src/pdf/posicionarEnPagina.ts), que ya resolvía este caso para la numeración y la marca de agua. Se añadió `calcularColocacionLibre` para poder colocar en un punto cualquiera en lugar de en una de nueve posiciones fijas, compartiendo toda la lógica difícil en vez de duplicarla.

### El giro no mueve el elemento

Al girar contenido, su caja envolvente crece. Si no se corrigiera, girar un elemento lo desplazaría hacia un lado sin que nadie lo haya pedido. Se recentra sobre la caja original, y hay una prueba que comprueba que el centro no se mueve.

### Los trazos

Un dibujo a mano alzada se guarda como una lista de trazos, y cada trazo como una sucesión de puntos **en fracciones de la caja del elemento**, no de la página. Así el dibujo se escala al redimensionar la caja sin recalcular ningún punto.

Se dibuja como segmentos rectos entre puntos consecutivos. Con la densidad de puntos que genera un gesto de ratón o de dedo, la diferencia con una curva suavizada no se aprecia, y a cambio no hay que calcular curvas de Bézier.

Se descartan los puntos que caen a menos de un 0,4 % del anterior: un gesto genera cientos de puntos por segundo y guardarlos todos solo engorda el documento con segmentos de longitud cero.

**El trazo no gira con el elemento.** Girar cada punto por separado daría un resultado distinto del de girar la caja, y hacerlo a medias sería peor que no hacerlo. Se documenta y la interfaz lo dice.

### Tipografías

Se usan las catorce tipografías estándar del PDF, que todos los lectores incluyen. Se eligieron porque **no hay que descargar nada**: cualquier otra habría que traerla de algún sitio, y traerla de un CDN está descartado en este proyecto.

El precio es real: solo cubren el alfabeto latino con codificación WinAnsi. Un texto en griego, cirílico, árabe o con caracteres CJK no se puede representar. La interfaz lo advierte en lugar de dibujar cuadraditos.

Cada tipografía se incrusta **una sola vez** por documento. Sin esa caché, cincuenta textos incrustarían cincuenta copias de Helvetica.

### Idempotencia

El documento de pdf-lib se abre **en el momento de aplicar**, no al cargar el archivo. Si se guardara en el estado, cada aplicación sucesiva dibujaría encima de la anterior y el resultado dependería de cuántas veces se hubiera pulsado el botón.

Abriendo de nuevo desde el archivo, aplicar dos veces con la misma capa da exactamente el mismo documento.

### Recuentos honestos

Un texto vacío, una forma sin relleno ni contorno, un trazo de un solo punto o cualquier elemento con opacidad cero **no dibujan nada**. Se descartan antes de aplicar, y el resultado informa de cuántos se dibujaron y cuántos se descartaron.

Un elemento colocado en una página que no existe se informa en `paginasInexistentes` en lugar de desaparecer sin más.

## Accesibilidad

Los elementos se pueden arrastrar con el ratón o el dedo, **y también**:

- Moverse con las flechas del teclado, con paso fino y paso grande usando Mayús.
- Ajustarse con campos numéricos en porcentaje, que además permiten indicar una medida exacta.
- Cambiarse de página, girarse y ajustar su opacidad con controles nativos.

Una interfaz que solo se pudiera usar arrastrando dejaría fuera a quien navega con teclado. Los campos numéricos no son un añadido: son la vía principal, y arrastrar es la comodidad.

Cada elemento del lienzo es un botón real con `aria-pressed` y una etiqueta que lo describe.

## Limitaciones conocidas

- **No se pueden incrustar imágenes todavía** desde la interfaz de «Editar y anotar». El tipo de elemento existe, está implementado y probado en el motor, y la firma escaneada como imagen es el siguiente paso natural. Mientras no esté en la interfaz, no se afirma que exista.
- **No hay deshacer general.** El lienzo de firma sí deshace trazos; la capa de elementos, no. Se quitan y se vuelven a añadir.
- **No hay ajuste automático de la caja al texto.** Si el texto no cabe en el alto de su caja, se recorta por líneas. Recortar no es lo ideal, pero es preferible a dejar que el texto se salga y se pinte sobre el resto de la página.
- **Solo caracteres latinos**, por lo explicado arriba.
- **La descripción de una imagen no se guarda en el documento.** Sirve para identificarla en la lista. pdf-lib no escribe texto alternativo de imágenes, y decir que sí sería falso.
- **La vista previa es una aproximación.** El dibujado real lo hace pdf-lib con las tipografías del PDF, y reproducirlo píxel a píxel en HTML no es posible. Lo que sí coincide, y es lo que se está ajustando, es la posición y el tamaño.

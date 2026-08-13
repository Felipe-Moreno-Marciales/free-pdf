# Hoja de ruta de Free PDF

Este documento recoge las cuatro fases del proyecto y el estado real de cada
herramienta. La fase 4 es la última y ya está cerrada: Free PDF está completo
con cinco herramientas terminadas en esa fase y PDF/A bloqueada de forma
documentada.

## Cómo leer esta hoja de ruta

**Estado**

| Valor | Significado |
| ----- | ----------- |
| Terminada | Implementada, probada y verificada. Se puede usar. |
| En desarrollo | Hay código, pero todavía no cumple todos sus requisitos. |
| Pendiente | Sin empezar. |
| Bloqueada | Evaluada, pero no existe una integración que cumpla los requisitos; no se publica. |

**Prioridad**

`Alta` es lo siguiente que se abordará; `Media` viene después; `Baja` queda para cuando el resto esté consolidado.

**Procesamiento**

| Valor | Significado |
| ----- | ----------- |
| Navegador | JavaScript puro en el navegador. Es la opción preferente. |
| WebAssembly | Necesita un módulo WebAssembly, que también se ejecuta en el navegador. |

Solo se marca como **Terminada** una herramienta cuyas pruebas automatizadas pasan y cuyo comportamiento se ha verificado.

---

## Fase 1 — Organización

**Estado de la fase: terminada.**

Las seis herramientas están implementadas, cubiertas por pruebas automatizadas y se ejecutan por completo en el navegador.

| Herramienta | Estado | Prioridad | Procesamiento | Dependencias | Limitaciones conocidas |
| ----------- | ------ | --------- | ------------- | ------------ | ---------------------- |
| Unir PDF | Terminada | Alta | Navegador | `pdf-lib` | No admite documentos cifrados. Todo se carga en memoria, así que muchos documentos grandes a la vez pueden agotarla. |
| Dividir PDF | Terminada | Alta | Navegador | `pdf-lib`, `fflate` | Genera un único ZIP en memoria; con documentos muy grandes el consumo crece. Solo copia los metadatos de texto básicos. |
| Extraer páginas | Terminada | Alta | Navegador | `pdf-lib`, `pdfjs-dist` | Conserva siempre el orden original: no reordena. |
| Eliminar páginas | Terminada | Alta | Navegador | `pdf-lib`, `pdfjs-dist` | No permite dejar el documento sin páginas. |
| Organizar páginas | Terminada | Alta | Navegador | `pdf-lib`, `pdfjs-dist` | El arrastre usa la API nativa de HTML y no está disponible en pantallas táctiles; ahí se usan los botones de movimiento. |
| Rotar páginas | Terminada | Alta | Navegador | `pdf-lib`, `pdfjs-dist` | Solo cuartos de vuelta, que es lo único que admite el formato PDF. |

---

## Fase 2 — Creación y personalización

**Estado de la fase: terminada.**

Las seis herramientas están implementadas, cubiertas por pruebas automatizadas y se ejecutan por completo en el navegador.

| Herramienta | Estado | Prioridad | Procesamiento | Dependencias | Limitaciones conocidas |
| ----------- | ------ | --------- | ------------- | ------------ | ---------------------- |
| Imágenes a PDF | Terminada | Alta | Navegador | `pdf-lib`, `canvas` del navegador | El tamaño «original» interpreta los píxeles a 96 por pulgada, así que una fotografía muy grande produce una página muy grande. El modo «cubrir» descarta parte de la imagen. |
| PDF a imágenes | Terminada | Alta | Navegador | `pdfjs-dist`, `fflate`, `canvas` del navegador | Las resoluciones altas consumen bastante memoria. Solo se puede cancelar entre páginas. |
| Numerar páginas | Terminada | Media | Navegador | `pdf-lib` | Las tipografías estándar cubren el español, pero no los alfabetos griego, cirílico ni asiático, ni los emoticonos. |
| Marca de agua | Terminada | Media | Navegador | `pdf-lib`, `canvas` del navegador para WebP | Misma limitación de tipografías. El mosaico limita el número de copias por página. |
| Recortar PDF | Terminada | Media | Navegador | `pdf-lib`, `pdfjs-dist` | Se ajusta la caja de recorte; **el contenido que queda fuera sigue existiendo en el archivo aunque no se vea**. |
| Escanear a PDF | Terminada | Baja | Navegador | `pdf-lib`, `getUserMedia`, `canvas` del navegador | Necesita permiso de cámara y un contexto seguro. Sin OCR, sin detección automática de bordes y sin corrección de perspectiva. |

### Detalle de cada herramienta

#### Imágenes a PDF

- **Estado:** terminada.
- **Procesamiento local:** completo. Las imágenes se descodifican con `createImageBitmap` y se dibujan en un `canvas`; pdf-lib compone el documento. Ninguna imagen sale del dispositivo.
- **Dependencias:** `pdf-lib`. El tratamiento de imágenes usa solo API del navegador.
- **Formatos compatibles:** JPEG (`.jpg`, `.jpeg`), PNG y WebP. JPEG y PNG se incrustan con sus bytes originales si no llevan giro, recorte ni filtro; WebP se convierte localmente a PNG.
- **Limitaciones:** el tamaño «original» convierte a 96 píxeles por pulgada. El modo «cubrir» recorta la imagen, centrada, para igualar la proporción de la página. Aplicar un giro obliga a volver a comprimir la imagen.
- **Memoria:** una fotografía de doce megapíxeles ocupa unos 48 MB mientras está descodificada. Las imágenes se procesan de una en una, así que solo hay una descodificada en cada momento. Se avisa cuando la selección supera los 12 MB o los 24 millones de píxeles.

#### PDF a imágenes

- **Estado:** terminada.
- **Procesamiento local:** completo. PDF.js dibuja cada página en un `canvas` y el navegador la convierte a PNG o JPEG.
- **Dependencias:** `pdfjs-dist`, `fflate` para el ZIP.
- **Formatos compatibles:** salida en PNG y en JPEG, con calidad configurable entre el 30 % y el 100 %.
- **Resoluciones:** estándar (escala 1,5 ≈ 108 ppp), alta (escala 3 ≈ 216 ppp) y muy alta (escala 4 ≈ 288 ppp). La escala se aplica sobre el tamaño natural de la página, donde 1 equivale a 72 ppp.
- **Limitaciones:** solo se puede cancelar entre páginas. Si una página resulta demasiado grande para el `canvas` del navegador se avisa en lugar de generar una imagen en blanco. Con una sola página se descarga la imagen suelta; con varias, un único ZIP.
- **Memoria:** una A4 a escala 4 son unos 2381 × 3368 píxeles, es decir, unos 32 MB mientras se dibuja. Se procesa una página a la vez y el lienzo se vacía en cuanto se tienen los bytes.

#### Numerar páginas

- **Estado:** terminada.
- **Procesamiento local:** completo, con pdf-lib.
- **Dependencias:** `pdf-lib`. Se usa Helvetica, una de las catorce tipografías estándar que el formato PDF incluye de serie: **no se descarga ninguna tipografía**.
- **Formatos compatibles:** entrada y salida en PDF.
- **Limitaciones:** los caracteres se limitan a los que cubre la codificación WinAnsi. Cubre el español completo, incluidos los acentos, la eñe y los signos de apertura, pero no los alfabetos griego, cirílico o asiático ni los emoticonos; si el texto lleva alguno se avisa antes de generar nada. Los únicos marcadores admitidos son `{pagina}` y `{total}`.
- **Regla de la numeración:** la primera página del documento recibe el número inicial y a partir de ahí se cuenta de uno en uno, se numere o no. `{total}` es el número que le corresponde a la última página del documento: con 10 páginas y el número inicial 5, `{total}` vale 14.
- **Memoria:** irrelevante; solo se añade texto.

#### Marca de agua

- **Estado:** terminada.
- **Procesamiento local:** completo. Las marcas de imagen en WebP se convierten con un `canvas` del navegador.
- **Dependencias:** `pdf-lib`.
- **Formatos compatibles:** marca de texto, o marca de imagen en PNG, JPEG y WebP.
- **Limitaciones:** misma limitación de caracteres que la numeración. El mosaico está limitado a 400 copias por página: con una marca diminuta y sin separación se avisa en lugar de generar un documento inservible. La vista previa es una aproximación sobre una A4 vertical.
- **Memoria:** la imagen de la marca se incrusta una sola vez y se reutiliza en todas las páginas, así que repetirla en un mosaico apenas aumenta el tamaño del documento.

#### Recortar PDF

- **Estado:** terminada.
- **Procesamiento local:** completo. PDF.js lee las medidas y dibuja la vista previa; pdf-lib ajusta las cajas.
- **Dependencias:** `pdf-lib`, `pdfjs-dist`.
- **Formatos compatibles:** entrada y salida en PDF. Márgenes en milímetros o en puntos PDF, con conversión probada en las dos direcciones.
- **Limitación importante:** el recorte ajusta la **caja de recorte** (`CropBox`) y deja intacta la caja de medios (`MediaBox`). Eso significa que **el contenido que queda fuera del área visible sigue estando dentro del archivo**: no se ve, pero se puede recuperar ampliando de nuevo la caja o leyendo el documento con herramientas de bajo nivel. **No es un método de eliminación segura de información.** La eliminación real corresponde a la herramienta de censura permanente de la fase 3.
- **Otras limitaciones:** el rectángulo de recorte se ajusta con campos numéricos, no arrastrando, para que funcione con teclado y con lector de pantalla sin añadir dependencias. Un recorte nuevo se mide sobre el área ya visible.
- **Memoria:** irrelevante; solo se modifican las cajas de las páginas.

#### Escanear a PDF

- **Estado:** terminada.
- **Procesamiento local:** completo. La cámara se maneja con `navigator.mediaDevices.getUserMedia`, un elemento `<video>` y un `canvas`. **Ninguna fotografía sale del dispositivo** y no interviene ningún servicio de cámara externo.
- **Dependencias:** `pdf-lib` y las API nativas de captura. Reutiliza el procesamiento de «Imágenes a PDF».
- **Formatos compatibles:** capturas de cámara (se guardan como JPEG) e imágenes cargadas en JPEG, PNG y WebP. Se pueden mezclar.
- **Ajustes por captura:** original, escala de grises y blanco y negro, más brillo y contraste. Todos se aplican con un `canvas`.
- **Limitaciones:**
  - **No añade reconocimiento de texto al PDF.** El resultado es un documento con imágenes, no un texto que se pueda buscar o copiar. «OCR local» puede extraer el texto después, pero no crea un PDF buscable sin una capa alineada verificable.
  - **No hay detección automática de bordes.** El recorte de cada captura es el que se indique a mano, en porcentaje.
  - **No hay corrección de perspectiva.**
  - La cámara **requiere permiso explícito**, que solo se pide después de pulsar el botón correspondiente.
  - **La disponibilidad de cámaras depende del navegador y del dispositivo.** Puede no haber ninguna, puede haber solo una y las etiquetas de los dispositivos únicamente están disponibles después de conceder el permiso.
  - `getUserMedia` solo funciona en contextos seguros: HTTPS o `localhost`.
  - Las capturas **no sobreviven a una recarga** de la página.
- **Memoria:** las fotografías de alta resolución consumen bastante al descodificarse y al filtrarse. Se procesan de una en una y se libera cada imagen en cuanto se ha usado.

---

## Fase 3 — Seguridad y edición

**Estado de la fase: terminada.** Las siete herramientas están implementadas y verificadas.

| Herramienta | Estado | Prioridad | Procesamiento | Dependencias | Limitaciones conocidas |
| ----------- | ------ | --------- | ------------- | ------------ | ---------------------- |
| Inspector de seguridad PDF | Terminada | Alta | WebAssembly | `qpdf` 12.2.0 vía `@neslinesli93/qpdf-wasm` | Es un análisis estructural, no un antivirus. No garantiza que el archivo sea seguro y no inspecciona cifrados que requieren contraseña. |
| Proteger con contraseña | Terminada | Alta | WebAssembly | `qpdf` 12.2.0 vía `@neslinesli93/qpdf-wasm` | Los permisos dependen de que el lector los respete. La accesibilidad se permite siempre con AES-256. Al cifrar, la contraseña viaja en los argumentos de qpdf dentro del trabajador. |
| Desbloquear | Terminada | Alta | WebAssembly | La misma que la anterior | Solo con la contraseña correcta. No se implementa ninguna forma de saltarse la protección. |
| Censurar permanentemente | Terminada | Alta | Navegador | `pdfjs-dist`, `pdf-lib` | Reconstruye **todas** las páginas como imágenes, así que el texto deja de ser seleccionable y **se pierde la estructura de accesibilidad**. No hay búsqueda de texto ni detección automática de datos sensibles: las zonas se marcan a mano. |
| Formularios | Terminada | Media | Navegador | `pdf-lib` | Cubre AcroForm; **XFA queda fuera** y se detecta para avisar. Los valores de los campos de contraseña no se leen nunca. Aplanar es irreversible. |
| Editar y anotar | Terminada | Media | Navegador | `pdfjs-dist`, `pdf-lib` | Añade una capa encima: **no modifica el texto original**, porque eso exigiría rehacer tipografía, interletraje y reflujo. Solo caracteres latinos, por usar las tipografías estándar del PDF. Todavía no se pueden incrustar imágenes desde la interfaz. |
| Firma visual | Terminada | Media | Navegador | `pdf-lib` | **No es una firma digital**: no usa certificados, no prueba identidad y no detecta modificaciones posteriores. La firma con certificado queda fuera del alcance del proyecto. La firma no se guarda en ningún sitio. |

**Siguiente bloque:** «Reparar PDF», que aprovecha la infraestructura de qpdf ya construida. El plan detallado está en [PROGRESO_AUTONOMO.md](PROGRESO_AUTONOMO.md).

### Detalle de las herramientas terminadas

#### Proteger PDF

- **Estado:** terminada y verificada con el motor real.
- **Procesamiento local:** completo. qpdf 12.2.0 compilado a WebAssembly, en un Web Worker.
- **Cifrado:** AES de 256 bits (revisión 6, `AESv3`). No se ofrece RC4 ni claves de 40 o 128 bits, y no se usa `--allow-insecure`.
- **Contraseña de propietario:** qpdf rechaza dejarla vacía con AES-256, así que cuando no se indica se genera una aleatoria de 32 bytes con `crypto.getRandomValues`. No se muestra ni se guarda.
- **Permisos:** se declaran de forma granular, sin el atajo `--modify`. **El bit de accesibilidad no existe con AES-256**, así que no se ofrece un control que no tendría efecto: la extracción para tecnología asistiva se permite siempre.
- **Verificación:** antes de entregar el archivo se comprueba que quedó cifrado con AES-256, que la contraseña correcta lo vuelve a abrir y que conserva el número de páginas. Si falla, no se descarga nada.
- **Limitaciones:** los permisos dependen del lector. Al cifrar, la contraseña va en los argumentos de qpdf porque `--password-file` solo sirve para abrir; ocurre dentro del trabajador, los argumentos no se registran y la salida del motor se intercepta y se depura.
- **Memoria:** el WASM son 1,33 MB y la PWA lo prepara para uso sin conexión,
  pero no se carga ni se ejecuta hasta abrir la herramienta. El documento se
  transfiere al trabajador en lugar de copiarse.

#### Desbloquear PDF

- **Estado:** terminada y verificada con el motor real.
- **Procesamiento local:** completo, con el mismo motor y el mismo trabajador.
- **Contraseña:** viaja en un archivo del sistema virtual mediante `--password-file`, así que **no aparece en los argumentos**. El archivo se borra en cuanto qpdf termina.
- **Verificación:** se comprueba que el resultado ya no declara cifrado, que pdf-lib puede abrirlo sin `ignoreEncryption` y que conserva páginas.
- **Diagnóstico:** se distingue la contraseña incorrecta («invalid password») de un documento dañado («can't find startxref») y de uno que no estaba cifrado.
- **Limitaciones:** exige la contraseña correcta. No hay fuerza bruta ni diccionarios, y no se añadirán.

#### Formularios PDF

- **Estado:** terminada y verificada.
- **Procesamiento local:** completo, con `pdf-lib` en el hilo principal.
- **Inspección:** lista los campos con su tipo, nombre, obligatoriedad, página y opciones. Los campos **XFA** se detectan y se avisa, porque `pdf-lib` no los cubre y rellenarlos daría un resultado engañoso.
- **Contraseñas:** el valor de un campo de tipo contraseña **no se lee nunca**, ni para mostrarlo en la interfaz. Se devuelve siempre vacío.
- **Rellenado:** el valor de cada campo es una unión discriminada (`texto`, `casilla`, `opcion`, `seleccion`), así que el tipo impide asignar un valor imposible para ese campo.
- **Creación:** se pueden añadir campos nuevos indicando página, posición y tamaño. El tamaño de la tipografía se fija **después** de colocar el campo en la página: hasta que el widget existe no hay apariencia predeterminada donde escribirlo y `pdf-lib` rechaza la operación.
- **Nombres:** se validan contra los caracteres que el formato prohíbe. El punto se admite a propósito, porque separa niveles en los nombres jerárquicos de PDF.
- **Aplanado:** convierte los campos en contenido dibujado. Es **irreversible** y la interfaz lo advierte antes.

#### Censurar permanentemente

- **Estado:** terminada y verificada.
- **Procesamiento local:** completo. `pdfjs-dist` para dibujar y `pdf-lib` para reconstruir.
- **Método:** cada página se dibuja a la resolución elegida, las zonas se pintan **sobre los píxeles** y se construye un documento nuevo. No se copian flujos de contenido, anotaciones, formularios, adjuntos ni metadatos.
- **Todas las páginas se reconstruyen**, no solo las que tienen zonas. Así la garantía es simple de enunciar: ninguna página del resultado proviene del contenido original. Hay una prueba que lo vigila.
- **Coordenadas:** en fracciones de la página, con redondeo hacia fuera al pasar a píxeles. Mejor tapar un píxel de más que dejar medio carácter asomando.
- **Verificación:** el resultado se vuelve a abrir y se comprueba que conserva las páginas, que **no queda texto extraíble**, que no hay campos de formulario ni anotaciones interactivas y que se puede dibujar. Si algo falla, no se descarga nada.
- **Precio, que es real:** el texto deja de poder seleccionarse y buscarse, los enlaces y formularios dejan de funcionar, **se pierde la estructura de accesibilidad** y el archivo suele ocupar más. La interfaz exige confirmarlo explícitamente.
- **Diferencia con «Recortar PDF»:** recortar solo cambia el área visible y **conserva el contenido oculto dentro del archivo**. No sirve para ocultar información. Censurar sí.

#### Editar y anotar

- **Estado:** terminada y verificada.
- **Procesamiento local:** completo. PDF.js dibuja la vista previa y pdf-lib dibuja la capa.
- **Método:** añade una capa **encima** de las páginas. El documento original queda intacto por debajo: su texto sigue siendo texto seleccionable, sus enlaces siguen funcionando y su estructura de accesibilidad no se pierde.
- **Elementos:** texto, resaltado, rectángulo, elipse, línea, flecha y trazo a mano alzada. El motor admite además imágenes incrustadas, pero **eso todavía no está en la interfaz** y por tanto no se anuncia.
- **No modifica el texto original.** Corregir una palabra de un párrafo existente exigiría rehacer tipografía, interletraje y reflujo del párrafo con la tipografía exacta del documento. No se hace y la interfaz lo dice.
- **Coordenadas:** en fracciones de la página visible, con la conversión de páginas giradas compartida con la numeración y la marca de agua. Girar un elemento no lo desplaza: se recentra sobre su caja.
- **Tipografías:** las catorce estándar del PDF, sin descargar nada. Solo alfabeto latino.
- **Accesibilidad:** los elementos se arrastran con ratón o dedo **y** se mueven con las flechas del teclado, además de ajustarse con campos numéricos en porcentaje.
- **Idempotencia:** el documento se abre de nuevo al aplicar, así que aplicar dos veces la misma capa da el mismo resultado.

#### Firma visual

- **Estado:** terminada y verificada.
- **Procesamiento local:** completo, con pdf-lib.
- **Modos:** firma dibujada a mano alzada, o escrita y colocada en Times cursiva.
- **No es una firma digital.** No usa certificados, no prueba la identidad de quien firma, no detecta si el documento se modifica después y no tiene validez de firma electrónica cualificada. Cualquiera puede copiar la imagen y ponerla en otro documento. La interfaz lo advierte de forma destacada.
- **La firma no se guarda** en ningún sitio: vive en el estado de la página y desaparece al recargar.
- **Trazos:** se guardan en fracciones de la caja del elemento, así que la firma se escala sin recalcular puntos. Se descartan los puntos demasiado próximos al anterior y los trazos de un solo punto, que no dibujan nada.
- **Limitación:** el trazo no gira con el elemento; se documenta en lugar de hacerlo a medias.

### Documentación técnica

- [SEGURIDAD.md](SEGURIDAD.md): modelo de amenazas, limpieza de recursos y reporte de vulnerabilidades.
- [CIFRADO.md](CIFRADO.md): auditoría de qpdf, AES-256, contraseñas y verificación.
- [CENSURA.md](CENSURA.md): por qué una caja negra no basta, reconstrucción por rasterizado, qué demuestra la verificación y qué no.
- [EDICION.md](EDICION.md): el editor visual compartido, y las dos advertencias que no se pueden quitar.
- [PROGRESO_AUTONOMO.md](PROGRESO_AUTONOMO.md): estado final verificado de las fases.
- [PDFA.md](PDFA.md): investigación, mediciones y bloqueo técnico de PDF/A local.

---

## Fase 4 — Diagnóstico y conversión local

Es la **última fase** del proyecto y está cerrada: cinco herramientas están
terminadas y PDF/A queda bloqueada de forma documentada, sin publicarse.

Todo lo implementado se ejecuta en el navegador, con las mismas reglas que el
resto: procesamiento local, Web Workers, WebAssembly cuando hace falta y
recursos servidos desde el propio sitio.

| Herramienta | Estado | Orden | Procesamiento | Dependencias | Nota |
| ----------- | ------ | ----- | ------------- | ------------ | ---- |
| Reparar PDF | **Terminada** | 0 | WebAssembly | `qpdf` | Ya terminada, antes de fijar este orden. |
| Comprimir PDF | **Terminada** | 1 | WebAssembly y navegador | `qpdf`, `pdf-lib`, `canvas` | Recomprime las imágenes JPEG **sin rasterizar el documento**: el texto sobrevive. Tres perfiles, borrado opcional de metadatos, progreso por imagen y cancelación. Solo toca JPEG; las imágenes en Flate las recomprime qpdf sin pérdida. Si no reduce, no entrega nada. |
| Comparar PDF | **Terminada** | 2 | Navegador | `pdfjs-dist`, `pdf-lib` | Compara texto, píxeles, medidas, giros y metadatos. Vista lado a lado y superpuesta con opacidad, umbral configurable, navegación entre diferencias e informe HTML autónomo. **Una diferencia visual no implica una diferencia de contenido**, y se dice. |
| PDF a Markdown | **Terminada** | 3 | Navegador | `pdfjs-dist` | Extracción secuencial por rangos, estructura aproximada, edición, copia y descarga. Las columnas y tablas complejas siguen siendo una limitación. |
| OCR local | **Terminada** | 4 | WebAssembly | Tesseract.js 7 | JPEG, PNG, WebP y PDF escaneado; `spa`, `eng` y ambos; recursos locales, progreso, cancelación, TXT y Markdown. Sin PDF buscable no verificable. |
| PDF/A local | **Bloqueada; no disponible** | 5 | — | — | Ghostscript WASM puede cubrir parte de la conversión, pero no hay un validador PDF/A real para navegador. veraPDF requiere Java. La investigación completa está en [PDFA.md](PDFA.md) y la herramienta **no aparece en el catálogo**. |

### El criterio para PDF/A

Se anota aquí porque es la herramienta con más riesgo de convertirse en una promesa vacía. Solo puede marcarse como terminada si:

- Convierte de verdad a un perfil PDF/A definido.
- Incrusta lo que el perfil exige, incluidas las tipografías.
- Usa un perfil ICC apropiado.
- Gestiona los metadatos XMP.
- **Valida el resultado con un validador real ejecutado localmente.**
- Produce un informe de conformidad.

No basta con cambiar los metadatos, subir la versión del PDF ni añadir una
etiqueta que diga «PDF/A». La investigación no encontró una integración local
que cumpla todos los puntos: los puertos de Ghostscript a WebAssembly no
validan y veraPDF solo se distribuye para Java. El bloqueo, las licencias y los
tamaños medidos están en [PDFA.md](PDFA.md); la herramienta no se ofrece.

---
### Detalle de las herramientas terminadas

#### PDF a Markdown

- **Estado:** terminada y verificada con PDF.js real.
- **Procesamiento local:** completo, sin dependencias nuevas, servicios externos ni modelos generativos.
- **Método:** `getTextContent()` aporta texto, coordenadas y tamaños de fuente; `getAnnotations()` aporta los enlaces. Las páginas se procesan en orden y se limpian una a una.
- **Estructura aproximada:** encabezados por tamaño relativo, párrafos por distancia vertical, listas por prefijo y tablas sencillas por columnas alineadas.
- **Opciones:** todas las páginas, pares, impares o rangos; separadores de página; conservación opcional de saltos de línea.
- **Salida:** vista previa editable, copia al portapapeles y `free-pdf.md` en UTF-8.
- **Sin texto:** detecta documentos sin capa de texto y remite a OCR.
- **Limitaciones:** no promete reconstruir correctamente columnas ni tablas complejas.
- **Documentación:** [MARKDOWN.md](MARKDOWN.md).

#### OCR local

- **Estado:** terminada y verificada con el motor WebAssembly real.
- **Motor:** Tesseract.js 7.0.0, Apache-2.0, con `spa` y `eng`.
- **Privacidad:** trabajador, núcleos y modelos bajo `/free-pdf/ocr/`; sin CDN, telemetría ni almacenamiento en IndexedDB.
- **Entradas:** JPEG, PNG, WebP y páginas PDF dibujadas por PDF.js.
- **Flujo:** secuencial, con avance general y por página; el trabajador se destruye al terminar, cancelar, fallar o salir.
- **Salidas:** vista editable, TXT y Markdown UTF-8.
- **No disponible:** PDF buscable, porque todavía no hay una verificación suficiente de la alineación de la capa de texto.
- **Documentación:** [OCR.md](OCR.md).

#### Reparar PDF

- **Estado:** terminada y verificada con el motor real.
- **Procesamiento local:** completo, en el **mismo Web Worker** que ya usaban «Proteger PDF» y «Desbloquear PDF». No hubo que traer ningún motor nuevo.
- **Método:** qpdf lee el documento y lo vuelve a escribir entero, con una tabla de referencias cruzadas nueva y los objetos renumerados. No existe una opción `--repair`: la reparación es el efecto de reescribir con un motor tolerante.
- **Diagnóstico:** `--check` recorre el archivo y describe lo que encuentra; los hallazgos se clasifican en español y **el mensaje de qpdf se muestra sin traducir**, porque es la información más precisa que hay.
- **Niveles:** conservadora (`--stream-data=preserve`, recomendada para un archivo dañado) y completa (`--object-streams=generate`, archivo menor pero reescribe más).
- **Verificación:** el resultado se vuelve a diagnosticar y contar en una instancia nueva del motor. **Si se queda sin páginas, no se entrega**: un documento vacío no es una reparación.
- **Lo que no hace, medido y no supuesto:** este build de qpdf **no reconstruye una tabla de referencias destruida**. Con `startxref` borrado, su desplazamiento falseado o las entradas corrompidas, termina con código 2 y no escribe nada. Sí recupera un archivo con bytes de basura antes de la cabecera, que es la corrupción más habitual en la práctica.
- **Honestidad del diagnóstico:** «sin problemas» significa que *qpdf* no encontró errores, no que todos los lectores acepten el archivo. El caso de la basura al principio se diagnostica como intacto y aun así repararlo sirve, y la interfaz lo dice.
- **Cifrado:** un documento protegido no se puede reparar sin la contraseña. Se detecta y se remite a «Desbloquear PDF».
- **Documentación:** [REPARACION.md](REPARACION.md), con la tabla de lo comprobado contra el motor.

#### Comprimir PDF

- **Estado:** terminada y verificada.
- **Procesamiento local:** completo. Las imágenes con `canvas` en el hilo principal; la estructura con qpdf en su Web Worker.
- **Hace dos cosas, en este orden:** primero recomprime las imágenes JPEG con pdf-lib y `canvas`; después optimiza la estructura con qpdf. Al revés, qpdf dejaría flujos de objetos que pdf-lib tendría que rehacer.
- **No rasteriza el documento.** Sustituye los flujos de imagen uno por uno con la API de bajo nivel de pdf-lib, así que el texto sigue siendo texto seleccionable, los vectores siguen siendo vectores y las tipografías siguen incrustadas. Hay una prueba que comprueba que Helvetica sigue en el resultado.
- **Medido:** un documento de 162 KB con una imagen de 400 × 400 bajó a 12,7 KB —un 92,2 %— y conservó el texto.
- **Lo que qpdf no hace, y por eso existe la parte de imágenes:** con un PDF cuyos 90 de 93 KB eran un JPEG, qpdf solo consiguió un 1,5 % y el `DCTDecode` salió intacto. Está comprobado con el motor real.
- **Tres perfiles:** ligera (2200 px, calidad 90 %), equilibrada (1600 px, 78 %) y alta (1100 px, 60 %). Se limita el **lado en píxeles** y no la densidad, porque el documento no dice a qué tamaño se dibuja cada imagen. La proporción se conserva siempre.
- **Solo se tocan las imágenes JPEG.** Las `FlateDecode` guardan píxeles cuya interpretación depende del documento y recodificarlas podría cambiar los colores; qpdf ya las recomprime sin pérdida.
- **Imágenes que se conservan:** las que no son JPEG, las de menos de 4 KB, las que el navegador no puede descodificar, y las que al recomprimirse no bajan al menos un 5 %.
- **Metadatos:** borrado opcional, con la lista de lo que hay **a la vista antes de decidir**. No es compresión sino privacidad, y se dice así. Las fechas quedan en un instante neutro, no en la de hoy.
- **Secuencial, con progreso y cancelación:** una imagen a la vez, porque una fotografía descodificada ocupa decenas de megabytes. Cuatro etapas: analizar, imágenes, estructura y comprobar.
- **La regla de entrega:** si el resultado no es más pequeño —umbral de medio por ciento— **no se descarga nada** y se muestra el mensaje exacto «No se pudo reducir el tamaño con este método local. El documento puede estar ya optimizado.» Se dan las tres cifras de todos modos: original, final y diferencia en bytes y en porcentaje.
- **El original nunca se modifica.**
- **Opciones de qpdf descartadas por medición:** `--linearize` agranda el archivo un 96,9 % y `--normalize-content=y` un 472 %. Dos pruebas fallarían si alguien las reintroduce.
- **Limitaciones:** la transparencia se pierde en las imágenes recomprimidas, porque el JPEG no tiene canal alfa y se pinta un fondo blanco. No se tocan las tipografías ni el espacio de color.
- **Documentación:** [COMPRESION.md](COMPRESION.md).


---

## Alcance descartado: lo que Free PDF no va a ser

Esta sección se conserva a propósito, aunque describa algo que ya no se va a hacer. Durante un tiempo la hoja de ruta previó dos fases más —conversiones de Office y funciones asistidas por modelos de lenguaje—, y quien lea el historial del repositorio se encontrará con ellas. Borrarlas sin explicación dejaría esas decisiones sin rastro.

**Descartado de forma definitiva:**

| Lo que se preveía | Por qué queda fuera |
| ----------------- | ------------------- |
| Conversiones de Word, Excel y PowerPoint | Hacerlas con fidelidad razonable exige LibreOffice, y eso exige un servidor. |
| Arquitectura autohospedada con Docker | Era la vía propuesta para lo anterior. Sin conversiones de Office no tiene objeto. |
| API de servidor | Free PDF no tiene backend, y no va a tenerlo. |
| Resumir y traducir con modelos de lenguaje | Exigiría o un modelo enorme en el navegador o una API externa. Lo segundo contradice el principio de que ningún documento sale del dispositivo. |
| Firma electrónica con participantes | Exige cuentas, correo electrónico y almacenamiento remoto. Nada de eso encaja en una aplicación estática. |
| Flujos de trabajo y procesamiento por lotes en servidor | Igual que lo anterior. |

**Lo que Free PDF es, y con eso se queda:** una aplicación web estática, publicada en GitHub Pages, que se ejecuta por completo en el navegador. Sin backend, sin Docker, sin cuentas, sin base de datos y sin subir documentos a ningún sitio.

Esta decisión no es una limitación que haya que superar más adelante: es lo que hace que la promesa de privacidad se pueda sostener sin pedir que nadie se fíe de nosotros.

---

## Compromisos que no cambian entre fases

- **Ningún documento saldrá del navegador.** No hay servidor propio ni de terceros al que enviarlos.
- **No habrá backend.** Si una herramienta no se puede hacer en el navegador, no se hace: no se añade un servidor para conseguirlo. Es la regla que descartó las conversiones de Office.
- No se añadirá telemetría, analítica, publicidad ni rastreo.
- No se guardará nada de forma persistente: ni `localStorage`, ni `sessionStorage`, ni `IndexedDB`, ni cookies.
- Los recursos que los motores necesiten se servirán **desde el propio sitio**, nunca desde una red de distribución de terceros. Esas peticiones traen archivos estáticos y jamás contenido de la persona.
- Todo el código seguirá siendo libre, bajo la licencia GNU AGPL-3.0.

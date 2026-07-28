# Hoja de ruta de Free PDF

Este documento recoge las seis fases previstas del proyecto y el estado real de cada herramienta.

## Cómo leer esta hoja de ruta

**Estado**

| Valor | Significado |
| ----- | ----------- |
| Terminada | Implementada, probada y verificada. Se puede usar. |
| En desarrollo | Hay código, pero todavía no cumple todos sus requisitos. |
| Pendiente | Sin empezar. |

**Prioridad**

`Alta` es lo siguiente que se abordará; `Media` viene después; `Baja` queda para cuando el resto esté consolidado.

**Procesamiento**

| Valor | Significado |
| ----- | ----------- |
| Navegador | JavaScript puro en el navegador. Es la opción preferente. |
| WebAssembly | Necesita un módulo WebAssembly, que también se ejecuta en el navegador. |
| Servidor autohospedable | No es viable en el navegador. Requeriría un componente opcional que cada persona despliegue por su cuenta. Nunca será un servicio de terceros. |

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

**Estado de la fase: pendiente.**

| Herramienta | Estado | Prioridad | Procesamiento | Dependencias previstas | Limitaciones conocidas |
| ----------- | ------ | --------- | ------------- | ---------------------- | ---------------------- |
| Imágenes a PDF | Pendiente | Alta | Navegador | `pdf-lib` | `pdf-lib` incrusta JPEG y PNG; otros formatos habría que convertirlos antes con un canvas. |
| PDF a imágenes | Pendiente | Alta | Navegador | `pdfjs-dist`, `fflate` | Dibujar muchas páginas a resolución alta consume bastante memoria; conviene procesarlas por lotes. |
| Números de página | Pendiente | Media | Navegador | `pdf-lib` | Las tipografías estándar de `pdf-lib` no cubren todos los alfabetos; para otros haría falta incrustar una tipografía. |
| Marca de agua | Pendiente | Media | Navegador | `pdf-lib` | La transparencia real exige estados gráficos extendidos, que hay que construir a mano. |
| Recortar PDF | Pendiente | Media | Navegador | `pdf-lib`, `pdfjs-dist` | Se ajustan las cajas de la página; el contenido sobrante sigue existiendo en el archivo aunque no se vea. |
| Escanear a PDF | Pendiente | Baja | Navegador | `pdf-lib` y la API de captura del navegador | Necesita permiso de cámara y solo funciona en contextos seguros. Sin corrección de perspectiva en una primera versión. |

---

## Fase 3 — Seguridad y edición

**Estado de la fase: pendiente.**

| Herramienta | Estado | Prioridad | Procesamiento | Dependencias previstas | Limitaciones conocidas |
| ----------- | ------ | --------- | ------------- | ---------------------- | ---------------------- |
| Proteger con contraseña | Pendiente | Alta | WebAssembly | Biblioteca de cifrado PDF, probablemente `qpdf` compilado a WebAssembly | `pdf-lib` no sabe cifrar, así que hace falta otro motor. |
| Desbloquear | Pendiente | Alta | WebAssembly | La misma que la anterior | Solo con la contraseña correcta. No se implementará ninguna forma de saltarse la protección. |
| Censurar permanentemente | Pendiente | Alta | Navegador y WebAssembly | `pdfjs-dist`, `pdf-lib` | Censurar de verdad exige eliminar el contenido subyacente, no solo taparlo. Es delicado y necesita verificación cuidadosa. |
| Editar y anotar | Pendiente | Media | Navegador | `pdfjs-dist`, `pdf-lib` | Editar texto ya existente en un PDF es muy limitado por diseño del formato. |
| Formularios | Pendiente | Media | Navegador | `pdf-lib` | `pdf-lib` cubre los formularios AcroForm; los formularios XFA quedan fuera. |
| Firma visual | Pendiente | Media | Navegador | `pdf-lib` | Es una firma dibujada, sin validez criptográfica. La firma digital con certificado corresponde a la fase 6. |

---

## Fase 4 — Procesamiento avanzado

**Estado de la fase: pendiente.**

| Herramienta | Estado | Prioridad | Procesamiento | Dependencias previstas | Limitaciones conocidas |
| ----------- | ------ | --------- | ------------- | ---------------------- | ---------------------- |
| Comprimir | Pendiente | Alta | WebAssembly | `qpdf` o `Ghostscript` compilados a WebAssembly | Recomprimir imágenes con calidad requiere un motor pesado. |
| OCR | Pendiente | Alta | WebAssembly | `tesseract.js` | Los modelos de idioma pesan varios megabytes y habría que empaquetarlos para no depender de una CDN. |
| Reparar | Pendiente | Media | WebAssembly | `qpdf` compilado a WebAssembly | No todos los documentos dañados se pueden recuperar. |
| Comparar | Pendiente | Media | Navegador | `pdfjs-dist` | La comparación visual es viable; la comparación semántica del texto es mucho más difícil. |
| PDF/A | Pendiente | Baja | WebAssembly | `Ghostscript` o `veraPDF` | La conformidad real con PDF/A exige incrustar tipografías y perfiles de color. |
| Extraer a Markdown | Pendiente | Media | Navegador | `pdfjs-dist` | El PDF no guarda estructura semántica, así que los encabezados y las tablas hay que deducirlos. |

---

## Fase 5 — Conversiones Office

**Estado de la fase: pendiente.**

Esta es la fase más difícil de mantener dentro del navegador. Las conversiones de ida (Office a PDF) son abordables; las de vuelta (PDF a Office) no lo son con fidelidad.

| Herramienta | Estado | Prioridad | Procesamiento | Dependencias previstas | Limitaciones conocidas |
| ----------- | ------ | --------- | ------------- | ---------------------- | ---------------------- |
| Word a PDF | Pendiente | Media | Navegador o servidor autohospedable | `mammoth` más `pdf-lib`, o LibreOffice autohospedado | En el navegador solo se conseguiría una fidelidad aproximada. |
| Excel a PDF | Pendiente | Media | Navegador o servidor autohospedable | `sheetjs` más `pdf-lib`, o LibreOffice autohospedado | Sin fórmulas ni gráficos en una primera versión. |
| PowerPoint a PDF | Pendiente | Baja | Servidor autohospedable | LibreOffice autohospedado | Las animaciones y las plantillas complejas no son reproducibles en el navegador. |
| PDF a Word | Pendiente | Baja | Servidor autohospedable | LibreOffice autohospedado | Reconstruir un documento editable desde un PDF nunca es fiel. |
| PDF a Excel | Pendiente | Baja | Servidor autohospedable | LibreOffice autohospedado, detección de tablas | Depende por completo de acertar con la estructura de las tablas. |
| PDF a PowerPoint | Pendiente | Baja | Servidor autohospedable | LibreOffice autohospedado | Igual que PDF a Word, pero además con la maquetación de las diapositivas. |
| Edición autohospedable cuando sea necesaria | Pendiente | Baja | Servidor autohospedable | Contenedor opcional documentado | Sería siempre opcional y desplegado por cada persona. La aplicación publicada en GitHub Pages seguirá sin backend. |

---

## Fase 6 — Productividad e inteligencia artificial

**Estado de la fase: pendiente.**

| Herramienta | Estado | Prioridad | Procesamiento | Dependencias previstas | Limitaciones conocidas |
| ----------- | ------ | --------- | ------------- | ---------------------- | ---------------------- |
| Flujos de trabajo | Pendiente | Media | Navegador | Ninguna nueva | Encadenar herramientas de la fase 1 sin descargar los resultados intermedios. |
| Procesamiento por lotes | Pendiente | Media | Navegador | `fflate` | El límite lo pone la memoria del navegador; habría que procesar en tandas. |
| Resumir | Pendiente | Baja | WebAssembly | Modelo de lenguaje pequeño ejecutado en el navegador | Los modelos que caben en el navegador pesan cientos de megabytes y dan resultados modestos. Usar un servicio externo está descartado: rompería la privacidad por diseño. |
| Traducir | Pendiente | Baja | WebAssembly | Modelos de traducción locales | La misma restricción de tamaño y calidad. |
| Firma electrónica con varios participantes | Pendiente | Baja | Servidor autohospedable | Componente opcional | Coordinar a varias personas exige un servidor. Sería siempre opcional y autohospedado. |

---

## Compromisos que no cambian entre fases

- Ninguna herramienta enviará documentos a un servidor de terceros.
- No se añadirá telemetría, analítica, publicidad ni rastreo.
- Si una herramienta necesita un componente de servidor, será opcional, autohospedable y estará documentado como tal. La aplicación publicada en GitHub Pages seguirá funcionando sin backend.
- Todo el código seguirá siendo libre, bajo la licencia GNU AGPL-3.0.

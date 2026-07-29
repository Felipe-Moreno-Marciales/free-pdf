# Free PDF

Aplicación web libre y de código abierto para trabajar con archivos PDF **sin salir del navegador**.

Free PDF no tiene servidor propio, no necesita registro y no envía tus documentos a ningún sitio: todo el procesamiento se ejecuta en tu equipo, con las capacidades del propio navegador.

## Qué es Free PDF, y qué ha decidido no ser

Es una **aplicación web estática** publicada en GitHub Pages. Eso no es un detalle de despliegue: es la decisión que define el proyecto.

**Lo que hay:** procesamiento local en el navegador, Web Workers, WebAssembly, [PDF.js](https://mozilla.github.io/pdf.js/), [pdf-lib](https://pdf-lib.js.org/), [qpdf](https://github.com/qpdf/qpdf) compilado a WebAssembly, y código libre que puedes revisar entero.

**Lo que deliberadamente no hay, y no va a haber:**

- Sin backend, sin API de servidor, sin base de datos.
- Sin cuentas, sin registro, sin correo electrónico.
- Sin conversiones de Word, Excel ni PowerPoint. Hacerlas con fidelidad razonable exige LibreOffice, y eso exige un servidor.
- Sin inteligencia artificial generativa ni modelos de lenguaje. Resumir o traducir exigiría o un modelo enorme descargado en tu navegador, o enviar tu documento a una API externa. Lo segundo rompería lo único que este proyecto promete.
- Sin firma con participantes, sin almacenamiento remoto, sin Docker.

Si una función no se puede hacer en tu navegador, **no se hace**. No se añade un servidor para conseguirla. Es lo que permite que la privacidad sea una consecuencia de la arquitectura y no una promesa que haya que creerse.

## Principios de privacidad

La privacidad no es una promesa: es una consecuencia de cómo está construida la aplicación.

- Los documentos y las imágenes se leen en memoria con las API del navegador (`File`, `Blob`, `ArrayBuffer`, `createImageBitmap` y `canvas`) y se procesan con [pdf-lib](https://pdf-lib.js.org/) y [PDF.js](https://mozilla.github.io/pdf.js/).
- **Ningún archivo se sube a un servidor.** No hay backend ni ninguna petición de red que transporte tus documentos. El único `fetch` propio pertenece al service worker y solo recupera archivos estáticos de Free PDF desde el mismo origen.
- Ningún documento, imagen, resultado, contraseña ni preferencia se guarda en `localStorage`, `sessionStorage`, `IndexedDB`, cookies o `Cache Storage`: al recargar la página, esos datos desaparecen. La PWA usa `Cache Storage` exclusivamente para el código y los motores estáticos de la aplicación.
- Todos los recursos que PDF.js y OCR necesitan —trabajadores, WebAssembly, tablas, tipografías, perfiles de color y modelos de idioma— se distribuyen **dentro del propio sitio**. No se usa ninguna red de distribución de contenidos (CDN) ni ningún servicio de terceros. Ver [Recursos locales de PDF.js](#recursos-locales-de-pdfjs) y [docs/OCR.md](docs/OCR.md).
- La cámara solo se enciende después de que la pulses tú, y sus fotografías no salen del dispositivo.
- No hay telemetría, analítica, publicidad ni rastreo de ningún tipo.
- Al ser software libre, puedes revisar el código y comprobarlo por ti mismo.

Las únicas descargas que realiza la aplicación son sus propios archivos
estáticos. En producción, el service worker prepara aproximadamente 23 MiB para
que las 23 herramientas puedan funcionar sin conexión; ningún archivo de la
persona forma parte de esa caché.

## Instalación como aplicación

Free PDF es una aplicación web progresiva. En un navegador compatible se puede
usar la opción **Instalar aplicación** o **Añadir a la pantalla de inicio**. Una
vez que termina la preparación inicial, la interfaz, las herramientas, PDF.js,
qpdf y OCR quedan disponibles sin conexión.

La aplicación instalada mantiene exactamente el mismo modelo de privacidad: los
documentos siguen viviendo únicamente en memoria. La caché persistente contiene
solo los 283 recursos públicos de Free PDF y se renueva de forma versionada en
cada publicación. Los detalles técnicos y el proceso de actualización están en
[docs/PWA.md](docs/PWA.md).

## Herramientas disponibles

### Fase 1 — Organización

**Completa.** Las seis herramientas están implementadas, probadas y funcionan por completo en el navegador.

| Herramienta | Qué hace | Resultado |
| ----------- | -------- | --------- |
| **Unir PDF** | Combina varios documentos en uno solo, con la lista reordenable. | `free-pdf-unido.pdf` |
| **Dividir PDF** | Separa un documento por rangos de páginas o página a página. | `free-pdf-dividido.zip` |
| **Extraer páginas** | Reúne las páginas elegidas en un documento nuevo. | `free-pdf-paginas-extraidas.pdf` |
| **Eliminar páginas** | Quita las páginas marcadas y conserva el resto. | `free-pdf-paginas-eliminadas.pdf` |
| **Organizar páginas** | Cambia el orden de las páginas con botones o arrastrando. | `free-pdf-organizado.pdf` |
| **Rotar páginas** | Gira las páginas elegidas en cuartos de vuelta o media vuelta. | `free-pdf-rotado.pdf` |

### Fase 2 — Creación y personalización

**Completa.** Las seis herramientas están implementadas y probadas.

| Herramienta | Qué hace | Resultado |
| ----------- | -------- | --------- |
| **Imágenes a PDF** | Convierte varias imágenes en un PDF, con una página por imagen, orden y giro configurables. | `free-pdf-imagenes.pdf` |
| **PDF a imágenes** | Guarda las páginas elegidas como PNG o JPEG, con tres resoluciones. | Una imagen suelta, o `free-pdf-imagenes.zip` |
| **Numerar páginas** | Añade números de página con texto, posición y apariencia configurables. | `free-pdf-numerado.pdf` |
| **Marca de agua** | Superpone un texto o una imagen, una sola vez o en mosaico. | `free-pdf-marca-de-agua.pdf` |
| **Recortar PDF** | Ajusta el área visible de las páginas indicando cuánto quitar por cada lado. | `free-pdf-recortado.pdf` |
| **Escanear a PDF** | Crea un PDF con la cámara o con fotografías, con recorte y filtros. | `free-pdf-escaneado.pdf` |

Las herramientas que trabajan con páginas muestran miniaturas reales, dibujadas con PDF.js y cargadas de forma diferida a medida que se acercan a la pantalla.

### Fase 3 — Seguridad y edición

**Completa.** Las seis herramientas están implementadas y verificadas.

| Herramienta | Estado | Qué hace | Resultado |
| ----------- | ------ | -------- | --------- |
| **Proteger PDF** | Terminada | Cifra el documento con AES de 256 bits y graba los permisos elegidos. | `free-pdf-protegido.pdf` |
| **Desbloquear PDF** | Terminada | Quita la contraseña de un documento protegido, con esa contraseña. | `free-pdf-desbloqueado.pdf` |
| **Formularios PDF** | Terminada | Inspecciona, rellena, crea y aplana campos de formulario. | `free-pdf-formulario.pdf` |
| **Censurar permanentemente** | Terminada | Elimina contenido de verdad reconstruyendo el documento como imágenes. | `free-pdf-censurado.pdf` |
| **Editar y anotar** | Terminada | Añade texto, formas y resaltados **encima** de las páginas. | `free-pdf-editado.pdf` |
| **Firma visual** | Terminada | Coloca una firma dibujada a mano o escrita en cursiva. | `free-pdf-firmado.pdf` |

El cifrado usa [qpdf](https://github.com/qpdf/qpdf) 12.2.0 compilado a WebAssembly, ejecutándose en un Web Worker dentro de tu navegador. Los detalles están en [docs/CIFRADO.md](docs/CIFRADO.md).

**Sobre la censura, que conviene no malinterpretar:** no dibuja una caja negra encima. Rasteriza todas las páginas, pinta las zonas sobre los píxeles y construye un documento nuevo, sin los flujos de contenido originales. Después vuelve a abrir el resultado y comprueba que no queda texto extraíble; si la comprobación falla, no se descarga nada. El precio es real: el texto deja de poder seleccionarse y la estructura de accesibilidad se pierde. Está explicado en [docs/CENSURA.md](docs/CENSURA.md), incluida la diferencia con «Recortar PDF», que **no** sirve para ocultar información.

**Dos aclaraciones que no se pueden quitar,** porque el nombre de las herramientas se presta a entender de más:

- **«Editar y anotar» no modifica el texto original del PDF.** Añade una capa encima, y el documento original queda intacto por debajo: su texto sigue siendo texto y su accesibilidad no se pierde. Corregir una palabra de un párrafo existente exigiría rehacer tipografía, interletraje y reflujo, y no se hace.
- **«Firma visual» no es una firma digital.** Es un dibujo. No usa certificados, no prueba la identidad de nadie, no detecta modificaciones posteriores y no tiene validez de firma electrónica cualificada. Vale lo que vale una firma en un papel escaneado. La firma con certificado exigiría decidir dónde viven las claves privadas y queda **fuera del alcance** del proyecto.

Los detalles de las dos están en [docs/EDICION.md](docs/EDICION.md).

### Fase 4 — Diagnóstico y conversión

**Cerrada.** Cinco herramientas están implementadas y verificadas. PDF/A no se
publica porque no existe una ruta verificable que convierta y valide localmente
en el navegador; el bloqueo técnico está documentado. Esta es la última fase
del proyecto.

| Herramienta | Estado | Qué hace | Resultado |
| ----------- | ------ | -------- | --------- |
| **Reparar PDF** | Terminada | Comprueba el estado de un documento y lo reescribe con una estructura limpia. | `free-pdf-reparado.pdf` |
| **Comprimir PDF** | Terminada | Recomprime las imágenes y reorganiza la estructura. El texto no se toca. | `free-pdf-comprimido.pdf` |
| **PDF a Markdown** | Terminada | Extrae la capa de texto y reconstruye de forma aproximada encabezados, párrafos, listas, enlaces y tablas sencillas. | `free-pdf.md` |
| **Comparar PDF** | Terminada | Señala las diferencias de texto, apariencia, medidas y metadatos. | `free-pdf-informe-comparacion.html` |
| **OCR local** | Terminada | Reconoce texto impreso en imágenes y PDF escaneados, en español, inglés o ambos. | `free-pdf-ocr.txt` o `free-pdf-ocr.md` |
| PDF/A | **Bloqueada; no disponible** | No se publica sin conversión y validación PDF/A reales en el navegador. | — |

**Sobre la reparación, siendo exactos:** qpdf lee el documento y lo vuelve a escribir entero. Recupera un archivo con bytes de basura antes de la cabecera —la corrupción más habitual en la práctica—, pero **no reconstruye una tabla de referencias destruida**: en ese caso termina sin escribir nada y se te dice que no hay nada que recuperar, en lugar de entregarte un archivo vacío. Tampoco inventa las páginas que falten. Todo esto está **medido contra el motor real**, no supuesto, y la tabla de lo comprobado está en [docs/REPARACION.md](docs/REPARACION.md).

**Sobre la compresión, siendo exactos:** hace **dos cosas**. Recomprime las imágenes JPEG —lo que de verdad reduce un PDF de fotografías, y sí pierde calidad— y reorganiza la estructura del archivo con qpdf, que no pierde nada. **No rasteriza el documento**: el texto sigue siendo texto seleccionable y las tipografías siguen incrustadas, y hay una prueba que lo comprueba. Tres perfiles, borrado opcional de metadatos, progreso por imagen y cancelación. **Si no consigue reducir el archivo, no descarga nada** y te dice el porcentaje real de todos modos. Tu original nunca se modifica. Los detalles y las cifras medidas están en [docs/COMPRESION.md](docs/COMPRESION.md).

El estado completo de las cuatro fases está documentado en [docs/HOJA_DE_RUTA.md](docs/HOJA_DE_RUTA.md).

**Sobre Markdown, siendo exactos:** el PDF no contiene párrafos ni tablas semánticas, sino fragmentos dibujados en posiciones. La estructura se deduce con tamaños de fuente y coordenadas, por lo que las columnas y las tablas complejas pueden quedar desordenadas. El resultado se puede revisar y editar antes de copiarlo o descargarlo. Si el documento no tiene capa de texto, se detecta y se remite a OCR. Los detalles están en [docs/MARKDOWN.md](docs/MARKDOWN.md).

**Sobre OCR, siendo exactos:** Tesseract.js 7 trabaja en un Web Worker con los modelos locales de español e inglés. Las imágenes y páginas se procesan de una en una, con progreso, cancelación y vista editable. El reconocimiento puede cometer errores y consume tiempo y memoria; no se ofrece PDF buscable porque la alineación de una capa de texto no se puede verificar todavía. Auditoría, tamaños y límites: [docs/OCR.md](docs/OCR.md).

**Sobre PDF/A, siendo exactos:** se encontraron puertos de Ghostscript a
WebAssembly capaces de intentar PDF/A-1/2/3 nivel b, pero ninguno incorpora un
validador PDF/A real. veraPDF sí valida e informa todos los perfiles, pero su
distribución oficial necesita Java y no se puede ejecutar en GitHub Pages.
Combinar una conversión sin validador con `qpdf --check` tampoco demuestra
conformidad con ISO 19005. No hay tarjeta ni descarga que finja lo contrario.
Versiones, licencias, tamaños y motivos de descarte:
[docs/PDFA.md](docs/PDFA.md).

## Seguridad

Hay dos documentos dedicados:

- **[docs/SEGURIDAD.md](docs/SEGURIDAD.md)**: modelo de amenazas, de qué protege la aplicación y de qué no, limpieza de recursos y cómo informar de una vulnerabilidad.
- **[docs/CIFRADO.md](docs/CIFRADO.md)**: cómo funciona el cifrado, por qué no se usa pdf-lib para ello, la auditoría de qpdf y cómo se tratan las contraseñas.

Lo esencial:

- El documento se cifra con **AES de 256 bits**. No se ofrece RC4 ni claves cortas, y no se usa `--allow-insecure`.
- **Las contraseñas no se guardan.** Viven en memoria mientras se usan y se borran en cuanto la operación termina. No aparecen en registros, ni en mensajes de error, ni en nombres de archivo.
- Al descifrar, la contraseña viaja en un archivo del sistema virtual y **no en los argumentos**. Al cifrar sí va en los argumentos, porque qpdf no admite otra forma; ocurre dentro del Web Worker y la salida del motor se intercepta y se depura.
- **Los permisos PDF no son una barrera técnica**: dependen de que el lector decida respetarlos. Lo único que protege de verdad es la contraseña de apertura.
- Nada se entrega sin verificarlo: se comprueba que el documento quedó cifrado, que la contraseña lo abre y que conserva sus páginas. Si la comprobación falla, no se descarga nada.
- **El recorte no elimina el contenido oculto.** Sirve para ajustar encuadres, no para ocultar información confidencial.
- El Web Worker de qpdf se **destruye** al salir de la herramienta, y su sistema de archivos virtual se limpia en cada operación.

### Detalles comunes

- Solo se aceptan los formatos indicados: se comprueban la extensión y el tipo MIME cuando el navegador lo informa.
- Se rechazan los archivos vacíos, los duplicados exactos y los documentos cifrados o dañados, siempre con un aviso que indica el archivo concreto.
- Los rangos de páginas admiten páginas sueltas y rangos combinados: `1-3, 5, 8-10`. Los espacios se ignoran.
- No se pueden lanzar dos operaciones a la vez, y los controles incompatibles se deshabilitan mientras se procesa.
- Cada resultado se descarga automáticamente y queda además un botón visible para repetir la descarga.
- Las conversiones largas informan del progreso página a página y se pueden cancelar entre páginas.

## Formatos compatibles

### Documentos

- **PDF** sin cifrar, para todas las herramientas que parten de un documento.

### Imágenes de entrada

Se han comprobado cuatro formatos, que son los únicos que se anuncian:

| Formato | Extensiones | Cómo se incrusta en el PDF |
| ------- | ----------- | -------------------------- |
| JPEG | `.jpg`, `.jpeg` | Directamente, sin volver a comprimir, si no se le aplica giro, recorte ni filtro. |
| PNG | `.png` | Directamente, conservando la transparencia, en las mismas condiciones. |
| WebP | `.webp` | Se descodifica con el navegador, se dibuja en un `canvas` y se convierte **localmente** a PNG. |

Cualquier otro formato se rechaza con un aviso. No se anuncia compatibilidad con formatos que no se hayan probado.

### Imágenes de salida

- **PNG**: sin pérdidas, mejor para texto y líneas.
- **JPEG**: archivos más pequeños, con calidad configurable entre el 30 % y el 100 %.

## Uso de la cámara

La herramienta **Escanear a PDF** puede usar la cámara del dispositivo. Funciona así:

- La cámara **no se enciende al abrir la herramienta**. Hay que pulsar «Encender la cámara»; solo entonces se pide el permiso al navegador.
- Se prefiere la cámara trasera, que es la útil para fotografiar un documento. Si hay varias, se puede elegir cuál usar.
- Al cambiar de cámara se detiene la anterior. Al apagarla, al empezar de nuevo o al salir de la herramienta se detienen todas sus pistas, que es lo que apaga de verdad la cámara y hace desaparecer el indicador del navegador.
- Se usan exclusivamente API nativas: `navigator.mediaDevices.getUserMedia`, `MediaStream`, un elemento `<video>` y un `canvas`. **No interviene ningún servicio de cámara externo.**
- Nunca se pide el micrófono.
- Las fotografías viven solo en memoria: al recargar la página desaparecen.

Si la cámara no está disponible se explica el motivo con un mensaje concreto —permiso denegado, sin cámara, ocupada por otra aplicación o contexto no seguro— y siempre queda la alternativa de cargar fotografías desde el dispositivo.

> **La cámara exige un contexto seguro.** Los navegadores solo permiten `getUserMedia` en páginas servidas por HTTPS o en `localhost`. GitHub Pages sirve por HTTPS, así que la versión publicada funciona.

## Recursos locales de PDF.js

PDF.js necesita varios archivos auxiliares para representar bien los documentos complejos. Por omisión los busca en una CDN, lo que está descartado en este proyecto. En su lugar, el complemento de Vite [`compilacion/recursosPdfJs.ts`](compilacion/recursosPdfJs.ts) los toma del paquete `pdfjs-dist` instalado y los publica bajo `<base>pdfjs/`, es decir, `/free-pdf/pdfjs/` en la versión publicada.

| Recurso | Para qué sirve | Archivos | Tamaño |
| ------- | -------------- | -------- | ------ |
| `pdfjs/cmaps/` | Tablas de caracteres de los alfabetos no latinos (chino, japonés, coreano…). | 169 | 1,11 MiB |
| `pdfjs/standard_fonts/` | Las tipografías estándar del formato PDF, para los documentos que no las incrustan. | 16 | 0,74 MiB |
| `pdfjs/wasm/` | Descodificadores de JBIG2 y JPEG 2000 y gestión de color, con sus alternativas sin WebAssembly. | 11 | 1,01 MiB |
| `pdfjs/iccs/` | Perfil de color predeterminado. | 2 | 15 KiB |

El worker de PDF.js se empaqueta como un recurso más del proyecto, con el resto de los archivos de `assets/`.

Estas peticiones:

- **van al mismo origen** que la aplicación y respetan la ruta base `/free-pdf/`;
- **no contienen ningún dato tuyo**: solo traen tablas, tipografías y descodificadores;
- **no son una subida de archivos**: tu documento nunca sale del navegador;
- en producción quedan además preparadas por la PWA para que el documento pueda
  procesarse sin conexión.

Los recursos OCR siguen el mismo principio. El trabajador, los tres núcleos LSTM posibles y los modelos comprimidos `spa` y `eng` se publican bajo `/free-pdf/ocr/`. Suman 16,08 MiB y la PWA los prepara para uso sin conexión. La compilación elimina las reservas de CDN de Tesseract y la herramienta desactiva su caché de IndexedDB para los datos de trabajo.

Se excluye a propósito `quickjs-eval`, casi medio megabyte destinado a ejecutar el JavaScript incrustado en algunos PDF. Esa capacidad no se activa nunca, así que no se distribuye.

El flujo de integración continua comprueba en cada compilación que las cuatro carpetas existen y que ningún archivo del sitio referencia una CDN conocida.

## Tecnologías

- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/) en modo estricto, sin `any`
- [Vite](https://vite.dev/) como herramienta de compilación
- [Oxlint](https://oxc.rs/) para el análisis estático
- [Vitest](https://vitest.dev/) para las pruebas automatizadas
- [pdf-lib](https://pdf-lib.js.org/) para crear y modificar documentos
- [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) para dibujar páginas y miniaturas
- [fflate](https://github.com/101arrowz/fflate) para generar los ZIP
- [Tesseract.js](https://github.com/naptha/tesseract.js) 7 para OCR local en español e inglés
- [Testing Library](https://testing-library.com/) y [jsdom](https://github.com/jsdom/jsdom) para las pruebas de interfaz
- CSS propio, sin frameworks, e iconos SVG propios
- [pnpm](https://pnpm.io/) como gestor de paquetes

El tratamiento de imágenes —descodificar, girar, recortar, filtrar y convertir— se hace con el `canvas` del navegador. **No se usa ninguna biblioteca de edición de imágenes.**

## Requisitos locales

- **Node.js** 20.19 o superior (o 22.12 o superior). La integración continua usa Node 24.
- **pnpm** 11.9 o superior. La versión exacta está fijada en el campo `packageManager` de `package.json`.

> pnpm es el gestor de paquetes obligatorio del proyecto. No uses `npm` ni `yarn`: generarían archivos de bloqueo incompatibles.

## Instalación

```bash
git clone https://github.com/Felipe-Moreno-Marciales/free-pdf.git
cd free-pdf
pnpm install
```

## Desarrollo local

```bash
pnpm dev
```

Vite abre un servidor de desarrollo con recarga en caliente. La ruta base es `/free-pdf/`, la misma que en producción, y los recursos de PDF.js se sirven desde `node_modules` mediante el complemento propio, así que el comportamiento coincide con el de la versión publicada.

> La cámara no funcionará en `http://` salvo en `localhost`. Si accedes al servidor de desarrollo desde otro dispositivo de la red, «Escanear a PDF» solo podrá cargar fotografías desde archivos.

## Pruebas

```bash
pnpm pruebas          # ejecuta las pruebas una vez
pnpm pruebas:vigilar  # las repite al guardar cambios
```

Las pruebas viven en [src/pruebas/](src/pruebas/) y se reparten en dos proyectos con entornos distintos:

- **`logica`** (archivos `.prueba.ts`, entorno Node): lógica pura y procesamiento con pdf-lib. Cubre la validación de archivos, los rangos de páginas, la geometría de las páginas, los filtros de imagen, los recortes, la conversión de unidades, la colocación de contenido en páginas rotadas, los nombres de archivo, la creación de ZIP, la cancelación y las doce operaciones sobre documentos.
- **`interfaz`** (archivos `.prueba.tsx`, entorno `jsdom`): componentes de React. Cubre la apertura de una herramienta desde el catálogo, la navegación por hash, los mensajes ante un archivo inválido, el cambio de las opciones principales, el restablecimiento y la navegación con los controles accesibles.

Los materiales de prueba se generan en el momento, así que el repositorio no guarda archivos binarios:

- Los **PDF** se crean con pdf-lib. A cada página se le da un ancho distinto y creciente, que funciona como etiqueta: al leer los anchos del documento resultante se comprueba de qué páginas originales proviene y en qué orden.
- Los **PNG** se construyen byte a byte, con su firma, su cabecera, sus píxeles comprimidos con `zlib` y sus sumas de comprobación CRC-32. Son válidos y pdf-lib los descodifica de verdad.
- Los **JPEG** llevan una estructura de marcadores válida pero no datos de imagen reales, que es exactamente lo que pdf-lib inspecciona para incrustarlos. Sirven para comprobar la incrustación y la geometría, no el aspecto visual.

Donde el entorno de pruebas no puede hacer el trabajo real, la pieza que lo necesita se recibe desde fuera en lugar de simularse por dentro:

- **PDF a imágenes** recibe un *adaptador de dibujado*. En el navegador lo implementa PDF.js con un `canvas`; en las pruebas se pasa uno que devuelve bytes conocidos. Así se comprueban la selección, los nombres, el orden, el progreso, la cancelación y el contenido del ZIP sin dar por hecho que PDF.js ha dibujado nada.
- **Imágenes a PDF** y **Escanear a PDF** reciben un *adaptador de imágenes* con la misma idea, que además registra qué giro, qué recorte y qué filtros se le pidieron para cada imagen.
- La lógica de la **cámara** —traducir los errores, elegir la cámara trasera y detener las pistas— son funciones independientes que se comprueban con flujos simulados. **No se necesita una cámara física.**
- **OCR local** sí tiene una prueba integral adicional: crea un PDF escaneado, PDF.js lo representa en un lienzo nativo de pruebas y Tesseract reconoce los píxeles reales. Ese lienzo es solo una dependencia de desarrollo y no entra en la aplicación.

## Compilación

```bash
pnpm build    # comprueba los tipos y genera dist/
pnpm preview  # sirve localmente la versión ya compilada
```

La compilación copia además los recursos auxiliares de PDF.js en `dist/pdfjs/` y muestra en la consola cuántos archivos y cuántos megabytes ocupa cada carpeta.

## Despliegue

El flujo de trabajo [.github/workflows/desplegar.yml](.github/workflows/desplegar.yml) valida y publica el proyecto:

- Se ejecuta en cada `push` a `development` y a `main`, en los Pull Requests hacia `main` y de forma manual con `workflow_dispatch`.
- Cada validación ejecuta, en este orden: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm pruebas` y `pnpm build`.
- Comprueba que la compilación use la ruta base `/free-pdf/`, obligatoria para GitHub Pages.
- Comprueba que los recursos locales de PDF.js estén presentes y que ningún archivo referencie una CDN conocida.
- Publica la carpeta `dist` en GitHub Pages **únicamente** en los `push` a `main`. La rama `development` nunca despliega.

Para que el despliegue funcione hay que abrir **Settings → Pages** en el repositorio y elegir **GitHub Actions** como origen (*Source*). No se necesita ningún secreto ni token adicional.

### Ramas

- `development`: rama de trabajo. Todo el desarrollo entra aquí.
- `main`: versiones estables. Es la única rama que despliega.

## Arquitectura

El código fuente está escrito en español, salvo los nombres impuestos por las tecnologías utilizadas.

```
compilacion/            Complemento de Vite que publica los recursos de PDF.js
src/
├── componentes/        Componentes visuales reutilizables
├── funcionalidades/    Una carpeta por herramienta
│   ├── unir-pdf/
│   ├── dividir-pdf/
│   ├── extraer-paginas/
│   ├── eliminar-paginas/
│   ├── organizar-paginas/
│   ├── rotar-paginas/
│   ├── imagenes-a-pdf/
│   ├── pdf-a-imagenes/
│   ├── numerar-paginas/
│   ├── marca-de-agua/
│   ├── recortar-pdf/
│   └── escanear-a-pdf/
├── ganchos/            Estado compartido (hooks de React)
├── herramientas/       Catálogo de herramientas, categorías y tipos
├── imagenes/           Lógica de imágenes: validar, descodificar, dibujar, convertir
├── pdf/                Lógica PDF: cargar, guardar, colocar, recursos, miniaturas
├── pruebas/            Pruebas automatizadas
└── utilidades/         Rangos, unidades, tamaños, descargas, ZIP, listas, errores
```

La separación es deliberada:

- **`pdf/`** no sabe nada de React. Concentra la carga con pdf-lib, el guardado, el dibujado con PDF.js, las direcciones de sus recursos locales, la colocación de contenido sobre páginas rotadas, la interpretación de colores, la cancelación y la liberación de recursos.
- **`imagenes/`** tampoco sabe nada de React. Valida, descodifica con las API del navegador, calcula la geometría de la página, recorta, aplica filtros, convierte a PNG o JPEG y libera la memoria.
- **`utilidades/`** son funciones puras: rangos de páginas, conversión de unidades, formato de tamaños, nombres de archivo, ZIP, operaciones sobre listas y tratamiento de errores.
- **`ganchos/`** contiene el estado compartido: `useDocumentoPdf` carga un documento y libera el anterior, `useSeleccionPaginas` y `useSeleccionImagenes` gestionan las selecciones, `useProcesoPdf` ejecuta y descarga, `useProcesoCancelable` añade progreso y cancelación, y `useHerramientaPaginas` reúne varios.
- **`funcionalidades/`** tiene, por herramienta, su lógica de negocio (un módulo sin React y probado), su gancho de estado y su interfaz.
- **`componentes/`** son piezas visuales sin lógica de negocio, compartidas entre herramientas.

Cada herramienta se carga de forma diferida, así que la página inicial no descarga ni pdf-lib, ni PDF.js, ni la lógica de la cámara. La navegación usa el hash de la dirección (`#/marca-de-agua`), lo que permite compartir enlaces directos y usar los botones de atrás y adelante sin necesitar un enrutador ni configurar redirecciones en el servidor.

### Geometría y páginas rotadas

Una página PDF puede llevar una rotación propia que el visor aplica al mostrarla, mientras que sus coordenadas internas no cambian. Numerar, poner una marca de agua y recortar razonan sobre **lo que se ve** y traducen después a las coordenadas del documento, en [`src/pdf/posicionarEnPagina.ts`](src/pdf/posicionarEnPagina.ts). Por eso «abajo a la derecha» es siempre abajo a la derecha para quien mira el documento, y «recortar 10 mm por arriba» quita siempre el borde de arriba, incluso en las páginas apaisadas.

### Liberación de recursos

- Los documentos de PDF.js y su worker se liberan al cambiar de documento y al salir de la herramienta.
- Los `canvas` se vacían al desmontarse, porque una miniatura grande puede ocupar varios megabytes.
- Las imágenes descodificadas se cierran en cuanto se han dibujado.
- Las URL temporales se revocan siempre, también después de cada descarga.
- Los dibujados pendientes se cancelan con `AbortController`.
- Las pistas de la cámara se detienen al cambiar de cámara, al apagarla, al restablecer y al desmontar el componente.
- Las imágenes y las páginas se procesan **de una en una**, para no mantener varias descodificaciones grandes en memoria al mismo tiempo.

## Accesibilidad

- HTML semántico y un enlace para saltar al contenido principal.
- Todos los botones tienen un nombre accesible que incluye la página, el archivo o la imagen a la que afectan.
- Las zonas de arrastrar y soltar se pueden usar con el teclado, mediante un `input` de archivos real.
- Las miniaturas de página son botones con `aria-pressed`, acompañados de texto que indica el número de página, su posición actual, su rotación y si está marcada. El `canvas` se marca como decorativo y toda su información se facilita como texto.
- El arrastre para reordenar es siempre un añadido: hay botones equivalentes —anterior, siguiente, al principio y al final— y todo se puede manejar con el teclado.
- Los grupos de opciones son campos `radio` nativos dentro de un `fieldset`, así que el navegador aporta el agrupamiento y la navegación con las flechas.
- Los controles deslizantes muestran su valor en texto y lo declaran en `aria-valuetext`.
- El selector de posición es una cuadrícula de campos `radio` con el nombre completo de cada posición, y además indica en texto la que está elegida.
- El selector de color ofrece la paleta del navegador y un campo de texto, para que no dependa del ratón.
- El vídeo de la cámara lleva una descripción, y su estado se anuncia en una región activa.
- Los mensajes de estado, de progreso y de error se anuncian con `aria-live`; el progreso se facilita también como texto, no solo como barra.
- La herramienta abierta se marca con `aria-current` en el catálogo.
- Los estados no se comunican solo con el color: siempre hay texto y, además, un icono o una marca. Las categorías del catálogo se distinguen por su encabezado, no solo por su franja de color.
- Se respeta `prefers-reduced-motion` y se admiten los temas claro y oscuro.
- El diseño está pensado primero para móvil y funciona también en escritorio.

## Limitaciones conocidas

### Generales

- **Documentos cifrados.** Se detectan y se avisa, pero no se pueden procesar. No se pide la contraseña.
- **Memoria.** Todo ocurre en memoria. Un documento de cientos de megabytes, muchos documentos grandes a la vez o fotografías de muchos megapíxeles pueden agotarla; el fallo se captura y se muestra como aviso sin bloquear la aplicación. Las herramientas avisan cuando la selección es grande.
- **Miniaturas.** Se dibujan de forma diferida, pero un documento con muchísimas páginas tarda en mostrarlas todas. No hay límite artificial de páginas.
- **Arrastre táctil.** El reordenado por arrastre usa la API nativa de HTML, que los navegadores móviles no implementan. En pantallas táctiles se usan los botones de movimiento, que cubren la misma funcionalidad.
- **Metadatos al dividir.** Se copian el título, el autor, el asunto y las palabras clave. El resto de metadatos los regenera pdf-lib.

### Imágenes a PDF

- **Tamaño «original».** Los píxeles se interpretan a 96 por pulgada, la densidad de referencia de la web. Una fotografía de muchos megapíxeles produce, por tanto, una página muy grande.
- **Modo «cubrir».** Para rellenar la página sin deformar la imagen hay que descartar parte de ella. El recorte se aplica a la propia imagen, centrado, así que los márgenes se respetan y el documento no guarda píxeles que nunca se van a ver.
- **Reencodificación.** Un JPEG o un PNG sin giro, recorte ni filtro se incrusta con sus bytes originales. En cuanto se le aplica alguna transformación pasa por un `canvas`, lo que implica volver a comprimirlo.
- **WebP.** Se convierte a PNG en el navegador. Los navegadores muy antiguos que no descodifican WebP mostrarán un aviso de que la imagen no se pudo leer.

### PDF a imágenes

- **Memoria y tiempo.** Una página A4 a la resolución más alta ocupa más de treinta megabytes mientras se dibuja. Con muchas páginas conviene bajar la resolución o convertir por tandas; la herramienta avisa.
- **Límite del `canvas`.** Los navegadores limitan el área de un `canvas`. Si una página resulta demasiado grande para la resolución elegida se avisa y se pide bajarla, en lugar de generar una imagen en blanco.
- **Cancelación.** Se puede cancelar **entre páginas**, no en mitad del dibujado de una.

### Numerar páginas

- **Tipografías.** Se usa Helvetica, una de las catorce tipografías estándar que pdf-lib trae consigo. No se descarga ninguna tipografía. Eso cubre el español completo —tildes, eñes y signos de apertura— pero **no** los alfabetos griego, cirílico o asiático ni los emoticonos: si el texto lleva un carácter no admitido se avisa antes de generar nada.
- **Marcadores.** Los únicos admitidos son `{pagina}` y `{total}`. Cualquier otro se rechaza indicando cuál.
- **Regla del total.** La primera página del documento recibe el número inicial y a partir de ahí se cuenta de uno en uno, se numere o no. `{total}` es el número que le corresponde a la última página: con un documento de 10 páginas y el número inicial 5, `{total}` vale 14.

### Marca de agua

- **Tipografías.** La misma limitación que la numeración.
- **Mosaico.** Se limita el número de copias por página; si la marca es diminuta y la separación nula, se avisa en lugar de generar un documento enorme e inservible.
- **Vista previa.** Es una aproximación sobre una página A4 vertical: representa la posición, la escala, el giro, el color y la opacidad, pero no el contenido real del documento ni el tamaño concreto de cada página.

### Recortar PDF

- **El recorte no elimina el contenido oculto.** Se ajusta la caja de recorte —el `CropBox` del formato PDF—, que es la que los visores usan para decidir qué se muestra. La caja de medios se deja intacta, así que **el contenido que queda fuera sigue estando dentro del archivo**: no se ve, pero alguien podría recuperarlo ampliando de nuevo la caja o leyendo el documento con herramientas de bajo nivel.

  Esta herramienta sirve para ajustar encuadres y márgenes, y **no** para ocultar información confidencial. Para eliminar contenido de verdad está disponible la herramienta «Censurar permanentemente».
- **Recorte visual.** El rectángulo de recorte se ajusta con campos numéricos, no arrastrando. Es deliberado: unos controles numéricos funcionan con el teclado y con lector de pantalla, y no exigen añadir ninguna dependencia.
- **Recortes sucesivos.** Un recorte nuevo se mide sobre el área ya visible, no sobre la página completa.

### Escanear a PDF

- **No añade reconocimiento de texto al PDF creado.** La herramienta crea páginas a partir de fotografías: el resultado es un documento con imágenes, **no un texto que se pueda buscar o copiar**. Para extraer el texto se puede usar después «OCR local»; no se ofrece un PDF buscable porque su capa de texto alineada no está verificada.
- **No hay detección automática de bordes.** El recorte de cada captura es el que se indique a mano, con campos numéricos en porcentaje.
- **No hay corrección de perspectiva.** Una fotografía tomada en ángulo saldrá en ángulo.
- **Permiso de cámara.** Es siempre explícito y se puede denegar; en ese caso se explica y se ofrece cargar fotografías desde el dispositivo.
- **Disponibilidad de cámaras.** Depende del navegador y del dispositivo. Puede no haber ninguna, puede haber solo una —sin posibilidad de cambiar— y las etiquetas de los dispositivos solo están disponibles después de conceder el permiso.
- **Contexto seguro.** `getUserMedia` solo funciona por HTTPS o en `localhost`.
- **Fotografías de alta resolución.** Consumen bastante memoria al descodificarse y al filtrarse. Se procesan de una en una para reducir el riesgo.

## Cómo contribuir

1. Trabaja siempre sobre la rama `development`. La rama `main` se reserva para versiones estables.
2. Usa **exclusivamente pnpm**.
3. Antes de proponer cambios, ejecuta las tres validaciones y corrige lo que falle:

   ```bash
   pnpm lint
   pnpm pruebas
   pnpm build
   ```

4. Respeta las convenciones del proyecto:
   - **Todo el código en español**: carpetas, archivos, componentes, funciones, variables, constantes, tipos, comentarios, mensajes de error, clases CSS y variables CSS. Solo permanece en inglés lo impuesto desde fuera (la API de JavaScript, React, el DOM, HTML, CSS, ARIA, las bibliotecas externas y los nombres de archivo técnicos).
   - **TypeScript estricto y sin `any`.**
   - **Sin frameworks CSS** ni bibliotecas de iconos: CSS propio con variables y SVG propios.
   - **Sin dependencias innecesarias.** Justifica cualquier dependencia nueva y documenta la decisión.
   - **Sin backend, sin peticiones de red para procesar documentos, sin telemetría y sin almacenamiento persistente.**
   - Los componentes visuales van en `componentes/`, la lógica de negocio en `funcionalidades/<herramienta>/`, `pdf/` o `imagenes/`, y las funciones puras en `utilidades/`. No concentres lógica en `Aplicacion.tsx`.
   - Cuando algo necesite el navegador —un `canvas`, PDF.js o la cámara—, recíbelo como adaptador para que la lógica siga siendo comprobable.
5. Añade pruebas para toda la lógica nueva. Genera los materiales de prueba dentro de la propia prueba; no añadas archivos binarios al repositorio.
6. Cuida la accesibilidad: nombre accesible en cada control, navegación con teclado, foco visible, `aria-live` para los mensajes dinámicos y estados que no dependan solo del color.
7. No afirmes en la documentación capacidades que no estén realmente implementadas y probadas.

## Licencia

Free PDF es software libre, distribuido bajo la licencia [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) (AGPL-3.0). El texto completo está en el archivo [LICENSE](LICENSE).

Esto significa que cualquiera puede usar, estudiar, modificar y compartir el programa, y que cualquier versión modificada que se ofrezca como servicio en red debe publicar también su código fuente.

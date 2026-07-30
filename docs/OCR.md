# OCR local

«OCR local» reconoce texto impreso en imágenes JPEG, PNG y WebP y en páginas de PDF escaneados. El documento o la imagen nunca se envían a un servicio: PDF.js dibuja cada página y Tesseract.js reconoce sus píxeles en un Web Worker.

## Auditoría del motor

### Motor elegido

- **Tesseract.js 7.0.0**, publicado el 15 de diciembre de 2025 y mantenido activamente. Es un envoltorio WebAssembly del motor Tesseract y su licencia es Apache-2.0.
- **tesseract.js-core 7.0.0**, también Apache-2.0.
- Modelos `spa` y `eng` de `@tesseract.js-data`, en su variante LSTM `4.0.0_best_int`. Los paquetes se publican como MIT y los datos proceden del proyecto tessdata de Tesseract, licenciado bajo Apache-2.0.

Fuentes primarias: [repositorio y alcance de Tesseract.js](https://github.com/naptha/tesseract.js), [versión 7.0.0](https://github.com/naptha/tesseract.js/releases/tag/v7.0.0), [instalación local](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md), [API de trabajadores](https://github.com/naptha/tesseract.js/blob/master/docs/api.md) y [licencia de tessdata](https://github.com/tesseract-ocr/tessdata).

### Tamaño medido

La compilación publica seis archivos bajo `/free-pdf/ocr/`, con **16,08 MiB** en total:

| Recurso | Cantidad | Tamaño aproximado |
| ------- | -------- | ----------------- |
| Trabajador de Tesseract.js | 1 | 109 KiB |
| Núcleos LSTM normal, SIMD y SIMD relajado | 3 | 11,15 MiB |
| Español comprimido | 1 | 2,00 MiB |
| Inglés comprimido | 1 | 2,82 MiB |

El navegador elige un solo núcleo. Los recursos no forman parte del paquete inicial: la interfaz OCR tiene su propio fragmento diferido y Tesseract se importa al iniciar el reconocimiento.

### Red, telemetría y almacenamiento

Tesseract.js usa por omisión jsDelivr para el trabajador, el núcleo y los idiomas. Free PDF no usa esos valores:

- `workerPath`, `corePath` y `langPath` se fijan bajo `/free-pdf/ocr/`;
- `compilacion/recursosOcr.ts` copia los seis recursos al resultado de Vite;
- la ruta base de GitHub Pages `/free-pdf/` se conserva;
- el complemento sustituye también las reservas de CDN que trae la dependencia, de modo que una regresión falle contra el mismo origen en lugar de llamar fuera;
- `cacheMethod: 'none'` impide leer o escribir los idiomas en IndexedDB;
- no hay telemetría, analítica ni código de seguimiento;
- la auditoría del resultado compilado no encuentra `cdn.jsdelivr.net` ni `tessdata.projectnaptha.com`.

El paquete declara un script de instalación para Open Collective. pnpm lo bloqueó y no se autorizó: no es necesario para compilar ni ejecutar el motor.

### Compatibilidad

- Tesseract.js soporta navegadores con WebAssembly y ejecuta el motor dentro de un Web Worker.
- Vite 8 compila la importación diferida.
- los recursos estáticos funcionan con GitHub Pages y la ruta `/free-pdf/`;
- español, inglés y `spa+eng` se inicializan con los mismos archivos locales;
- la cancelación destruye el trabajador, que es la única cancelación real que ofrece Tesseract.js;
- el trabajador también se destruye al terminar, fallar o salir de la herramienta.

## Procesamiento

Las imágenes se reconocen de una en una. JPEG y PNG se entregan al motor como bytes locales; WebP se descodifica con el navegador y se convierte a PNG en un `canvas`, que se vacía al terminar.

Para un PDF, se abre un único documento con PDF.js, se dibuja cada página a escala 2,5, se reconoce y se vacía el lienzo antes de avanzar. La página de PDF.js se limpia tras renderizar y el documento y su trabajador se destruyen en `finally`.

La interfaz informa el avance general y el de la página actual, permite cancelar y ofrece una vista previa editable. Las salidas son `free-pdf-ocr.txt` y `free-pdf-ocr.md`, ambas UTF-8.

## Límites honestos

- El OCR puede confundir letras incluso con imágenes nítidas. Es especialmente sensible a poca resolución, inclinación, ruido, columnas, tablas y tipografías decorativas.
- Está orientado a texto impreso. Tesseract no promete reconocer escritura manuscrita.
- Dos idiomas consumen más memoria y tardan más en inicializarse.
- Un PDF largo requiere dibujar y reconocer cada página.
- **No se genera PDF buscable.** Tesseract puede devolver cajas, pero Free PDF no tiene una verificación suficiente de la alineación, rotación, tamaño y orden de una capa de texto. Ofrecerlo sin esa prueba sería engañoso.

## Pruebas

`src/pruebas/ocrLocal.prueba.ts` arranca el motor WebAssembly real con los
modelos locales y reconoce imágenes BMP generadas dentro de la prueba: texto
español, inglés, combinación y una imagen en blanco. También cubre progreso,
cancelación, destrucción, rutas locales, ausencia de CDN y exportaciones
TXT/Markdown.

La prueba integral de PDF genera un documento escaneado mínimo cuya página solo
contiene una imagen, lo abre y representa con PDF.js, convierte el lienzo a PNG
y entrega esos píxeles al motor Tesseract real. `@napi-rs/canvas` aporta el
lienzo únicamente al entorno Node de pruebas; es una dependencia de desarrollo
y no entra en la aplicación. La tipografía mínima permite comprobar incluso un
error OCR real y conocido —«HOLA» puede reconocerse como «AULA»— sin fingir
precisión perfecta. No se afirma una prueba manual de navegador.

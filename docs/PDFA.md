# PDF/A local: bloqueo técnico documentado

Free PDF **no ofrece una herramienta PDF/A**. La investigación cerrada el 29 de
julio de 2026 no encontró una integración abierta que reúna las dos capacidades
obligatorias dentro de un navegador estático:

1. convertir un PDF arbitrario a un perfil PDF/A concreto, gestionando XMP,
   perfil ICC, fuentes y características incompatibles; y
2. validar el archivo resultante con un validador PDF/A real, generar su informe
   y rechazar la descarga si no es conforme.

Hay motores que cubren una de esas mitades, pero no ambas. Un archivo que solo
declare ser PDF/A no es necesariamente conforme. Por eso no se añadió una
tarjeta, una ruta, una descarga ni un estado «experimental» al catálogo.

## Criterio aplicado

La candidata tenía que funcionar con estas condiciones simultáneas:

- aplicación estática en GitHub Pages, bajo `/free-pdf/`;
- ejecución completa en el navegador, sin Java instalado, backend ni
  contenedor;
- documento y resultado siempre locales;
- recursos servidos desde el mismo origen, sin CDN;
- perfil soportado identificado;
- XMP, ICC, fuentes y características prohibidas tratados de forma real;
- validación independiente contra las reglas del perfil;
- informe legible de conformidad;
- rechazo de cualquier resultado no conforme;
- pruebas con documentos mínimos conformes y no conformes.

Cambiar la versión del PDF, añadir `pdfaid:part`, copiar un perfil ICC o
reescribir la estructura no satisface el criterio por separado.

## Resultado de la investigación

Los tamaños de paquetes npm son los valores `dist.unpackedSize` consultados en
el registro el 29 de julio de 2026. Miden el paquete desempaquetado, no el
fragmento final comprimido. El tamaño de veraPDF corresponde a su instalador
oficial estable.

| Solución | Versión y licencia | Tamaño medido | Qué resuelve | Motivo de descarte |
| -------- | ------------------ | ------------- | ------------- | ------------------ |
| [veraPDF](https://github.com/veraPDF/veraPDF-library/releases/tag/v1.30.2) | 1.30.2 · GPL-3.0+ o MPL-2.0+ | 31,40 MB, instalador | Es el validador real: implementa perfiles PDF/A-1, 2, 3 y 4 y produce informes. | La distribución oficial es una aplicación y biblioteca Java. No se encontró una compilación oficial para navegador o WebAssembly. Un GitHub Pages estático no puede ejecutar su JAR. |
| [Ghostscript](https://ghostscript.readthedocs.io/en/latest/VectorDevices.html#creating-a-pdf-a-document) | 10.08.0 · AGPL-3.0 o licencia comercial | Sin paquete oficial de navegador | `pdfwrite` puede crear PDF/A-1, PDF/A-2 y PDF/A-3, únicamente nivel b. Exige `PDFA_def.ps`, un perfil ICC y una estrategia de color. | El programa oficial es nativo y **no valida** PDF/A. Incluso una conversión que termine sin error debe comprobarse después con otro motor. |
| [`@okathira/ghostpdl-wasm`](https://github.com/okathira-dev/ghostpdl-wasm) | 1.1.0 · AGPL-3.0-or-later | 14,89 MiB · 6 archivos | Expone `callMain` y el sistema de archivos de Emscripten; permite ejecutar `pdfwrite` en navegador. | No incluye un validador PDF/A ni genera un informe de conformidad. Habría que añadir y mantener por separado `PDFA_def.ps`, ICC y fuentes, y aun así no se podría aceptar el resultado. |
| [`@bentopdf/gs-wasm`](https://github.com/alam00000/bentopdf-gs-wasm) | 0.1.1 · AGPL-3.0-only | 14,89 MiB · 10 archivos | Puerto reciente de Ghostscript a WebAssembly. | Su API documenta la carga del motor, no una canalización PDF/A comprobada. No incorpora veraPDF ni otro validador real, informe o rechazo por no conformidad. |
| [`@jspawn/ghostscript-wasm`](https://www.npmjs.com/package/@jspawn/ghostscript-wasm) | 0.0.2 · AGPL-3.0 | 15,56 MiB · 7 archivos | Ghostscript compilado a WebAssembly. | La última publicación tiene cuatro años, la API es anterior a 1.0 y tampoco aporta validación PDF/A. Añade más riesgo de mantenimiento sin cerrar el requisito central. |
| [`pdfnative`](https://github.com/Nizoka/pdfnative) | 1.6.0 · MIT | 81,71 MiB · 76 archivos | Genera documentos nuevos que declaran PDF/A-1b, 2b, 2u o 3b, con XMP, OutputIntent y fuentes. Sus muestras se validan en CI con veraPDF. | Es un generador, no una conversión general y reparadora de PDF arbitrarios. Su propia guía requiere veraPDF instalado fuera del navegador para validar. No puede emitir aquí un informe real para cada archivo del usuario. |
| [`@bentopdf/pymupdf-wasm`](https://www.npmjs.com/package/@bentopdf/pymupdf-wasm) | 0.11.16 · AGPL-3.0-only | 53,67 MiB · 24 archivos | Manipulación y representación de PDF en navegador. | No documenta conversión PDF/A ni un validador de conformidad. Su apoyo opcional de Ghostscript para color vuelve al mismo bloqueo. |
| [`@neslinesli93/qpdf-wasm`](https://github.com/neslinesli93/qpdf-wasm) | paquete 0.3.0, qpdf 12.2.0 · ISC | 1,32 MiB · 5 archivos | Ya integrado en Free PDF para estructura, cifrado, diagnóstico y reescritura. | qpdf indica expresamente que no sabe generar PDF/A. `--check` comprueba sintaxis y estructura, no las reglas de ISO 19005; un resultado correcto para qpdf puede seguir sin ser PDF/A. |
| [`pdf-lib`](https://pdf-lib.js.org/) | 1.17.1 · MIT | 18,56 MiB · 1647 archivos | Ya integrado para crear y modificar objetos PDF, metadatos y fuentes. | No implementa conversión ni validación PDF/A. Construir XMP y OutputIntent manualmente seguiría sin demostrar fuentes, color, acciones y demás reglas del perfil. |

### Por qué Ghostscript más qpdf tampoco basta

Ghostscript es la opción de conversión más cercana. Su documentación limita la
salida a PDF/A-1/2/3 nivel b y exige configurar color, `PDFA_def.ps` e ICC.
qpdf podría comprobar después que el resultado tiene una estructura PDF
legible, pero su documentación advierte que no genera PDF/A y que `--check`
puede aceptar archivos con construcciones no conformes. Esa pareja no valida
ISO 19005.

### Por qué no se usa el demostrador web de veraPDF

Un demostrador o API alojada implicaría enviar el documento a otro servidor.
Eso viola el alcance de Free PDF aunque el servicio use veraPDF internamente.
Incorporar un backend propio tendría el mismo problema arquitectónico.

### Por qué no se implementa un validador parcial

Comprobar solo la presencia de XMP, una etiqueta `pdfaid`, un OutputIntent o
fuentes aparentemente incrustadas produciría falsos positivos. veraPDF aplica
perfiles formales con todas las reglas de cada parte y nivel. Una comprobación
doméstica parcial no es un «validador PDF/A real» y no puede justificar una
descarga marcada como conforme.

## Qué tendría que cambiar para reabrir la herramienta

La evaluación puede repetirse si aparece una de estas opciones mantenidas:

- una distribución oficial o reproducible de veraPDF para WebAssembly,
  ejecutable en un Web Worker y sin peticiones externas;
- otro validador abierto de alcance equivalente, con perfiles completos,
  corpus de pruebas e informe local;
- una biblioteca de navegador que convierta PDF arbitrarios, valide con un
  motor independiente y permita rechazar el resultado.

Antes de publicar habría que medir sus artefactos, alojarlos bajo
`/free-pdf/`, ejecutar corpus conformes y no conformes, probar cancelación y
destrucción del trabajador, y confirmar que el resultado compilado no contiene
CDN ni solicitudes externas.

## Estado final

- PDF/A **no está terminada**.
- PDF/A **no está disponible ni registrada**.
- No se instaló ninguna de las dependencias investigadas.
- No existe una interfaz que pueda confundirse con una conversión funcional.
- La fase queda cerrada con un bloqueo técnico explícito, tal como permite el
  alcance definitivo del proyecto.

## Fuentes primarias

- [Perfiles y modelo de validación de veraPDF](https://docs.verapdf.org/validation/)
- [Perfiles disponibles en la CLI de veraPDF](https://docs.verapdf.org/cli/validation/)
- [Distribuciones Java de veraPDF](https://verapdf.org/software/)
- [Instalador estable veraPDF 1.30.2](https://software.verapdf.org/rel/1.30/)
- [Creación de PDF/A con Ghostscript](https://ghostscript.readthedocs.io/en/latest/VectorDevices.html#creating-a-pdf-a-document)
- [Alcance de `qpdf --check`](https://qpdf.readthedocs.io/en/12.0/cli.html#pdf-inspection)


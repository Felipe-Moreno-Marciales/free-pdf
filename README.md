# Free PDF

Aplicación web libre y de código abierto para trabajar con archivos PDF **sin salir del navegador**.

Free PDF no tiene servidor propio, no necesita registro y no envía tus documentos a ningún sitio: todo el procesamiento se ejecuta en tu equipo, con las capacidades del propio navegador.

## Principios de privacidad

La privacidad no es una promesa: es una consecuencia de cómo está construida la aplicación.

- Los documentos se leen en memoria con las API del navegador (`File` y `ArrayBuffer`) y se procesan con [pdf-lib](https://pdf-lib.js.org/) y [PDF.js](https://mozilla.github.io/pdf.js/).
- **Ningún archivo se sube a un servidor.** No hay backend ni ninguna petición de red que transporte tus documentos. El código no contiene `fetch`, `XMLHttpRequest` ni `WebSocket`.
- No se guarda nada en `localStorage`, `sessionStorage`, `IndexedDB` ni cookies: al recargar la página, todo desaparece.
- El worker de PDF.js se empaqueta con el proyecto, no se descarga de ninguna CDN. Además se desactivan sus descargas auxiliares de tipografías, tablas de caracteres y módulos WebAssembly, para que no realice ninguna petición.
- No hay telemetría, analítica, publicidad ni rastreo de ningún tipo.
- Al ser software libre, puedes revisar el código y comprobarlo por ti mismo.

Las únicas descargas que realiza la aplicación son sus propios archivos estáticos, y solo los que hacen falta: los motores PDF se traen la primera vez que abres una herramienta que los necesita.

## Herramientas disponibles

**Fase 1 — Organización: completa.** Las seis herramientas están implementadas, probadas y funcionan por completo en el navegador.

| Herramienta | Qué hace | Resultado |
| ----------- | -------- | --------- |
| **Unir PDF** | Combina varios documentos en uno solo, con la lista reordenable. | `free-pdf-unido.pdf` |
| **Dividir PDF** | Separa un documento por rangos de páginas o página a página. | `free-pdf-dividido.zip` |
| **Extraer páginas** | Reúne las páginas elegidas en un documento nuevo. | `free-pdf-paginas-extraidas.pdf` |
| **Eliminar páginas** | Quita las páginas marcadas y conserva el resto. | `free-pdf-paginas-eliminadas.pdf` |
| **Organizar páginas** | Cambia el orden de las páginas con botones o arrastrando. | `free-pdf-organizado.pdf` |
| **Rotar páginas** | Gira las páginas elegidas en cuartos de vuelta o media vuelta. | `free-pdf-rotado.pdf` |

Las herramientas que trabajan con páginas muestran miniaturas reales de cada página, dibujadas con PDF.js y cargadas de forma diferida a medida que se acercan a la pantalla.

Las demás fases previstas están documentadas en [docs/HOJA_DE_RUTA.md](docs/HOJA_DE_RUTA.md). Ninguna de sus herramientas está implementada todavía.

### Detalles comunes

- Solo se aceptan archivos PDF: se comprueban la extensión y el tipo MIME cuando el navegador lo informa.
- Se rechazan los archivos vacíos, los duplicados exactos y los documentos cifrados o dañados, siempre con un aviso que indica el archivo concreto.
- Los rangos de páginas admiten páginas sueltas y rangos combinados: `1-3, 5, 8-10`. Los espacios se ignoran.
- No se pueden lanzar dos operaciones a la vez, y los controles incompatibles se deshabilitan mientras se procesa.
- Cada resultado se descarga automáticamente y queda además un botón visible para repetir la descarga.

## Tecnologías

- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/) en modo estricto, sin `any`
- [Vite](https://vite.dev/) como herramienta de compilación
- [Oxlint](https://oxc.rs/) para el análisis estático
- [Vitest](https://vitest.dev/) para las pruebas automatizadas
- [pdf-lib](https://pdf-lib.js.org/) para crear y modificar documentos
- [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`) para dibujar las miniaturas
- [fflate](https://github.com/101arrowz/fflate) para generar los ZIP
- CSS propio, sin frameworks, e iconos SVG propios
- [pnpm](https://pnpm.io/) como gestor de paquetes

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

Vite abre un servidor de desarrollo con recarga en caliente. La ruta base es `/free-pdf/`, la misma que en producción.

## Pruebas

```bash
pnpm pruebas          # ejecuta las pruebas una vez
pnpm pruebas:vigilar  # las repite al guardar cambios
```

Las pruebas viven en [src/pruebas/](src/pruebas/) y cubren la lógica pura y el procesamiento con pdf-lib: validación de archivos, interpretación de rangos y las seis operaciones sobre documentos.

Los documentos PDF de prueba se generan con pdf-lib dentro de las propias pruebas, así que el repositorio no guarda archivos binarios. A cada página se le da un ancho distinto y creciente, que funciona como etiqueta: al leer los anchos del documento resultante se comprueba de qué páginas originales proviene y en qué orden.

## Compilación

```bash
pnpm build    # comprueba los tipos y genera dist/
pnpm preview  # sirve localmente la versión ya compilada
```

## Despliegue

El flujo de trabajo [.github/workflows/desplegar.yml](.github/workflows/desplegar.yml) valida y publica el proyecto:

- Se ejecuta en cada `push` a `development` y a `main`, en los Pull Requests hacia `main` y de forma manual con `workflow_dispatch`.
- Cada validación ejecuta, en este orden: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm pruebas` y `pnpm build`.
- Comprueba que la compilación use la ruta base `/free-pdf/`, obligatoria para GitHub Pages.
- Publica la carpeta `dist` en GitHub Pages **únicamente** en los `push` a `main`. La rama `development` nunca despliega.

Para que el despliegue funcione hay que abrir **Settings → Pages** en el repositorio y elegir **GitHub Actions** como origen (*Source*). No se necesita ningún secreto ni token adicional.

### Ramas

- `development`: rama de trabajo. Todo el desarrollo entra aquí.
- `main`: versiones estables. Es la única rama que despliega.

## Arquitectura

El código fuente está escrito en español, salvo los nombres impuestos por las tecnologías utilizadas.

```
src/
├── componentes/        Componentes visuales reutilizables
├── funcionalidades/    Una carpeta por herramienta
│   ├── unir-pdf/
│   ├── dividir-pdf/
│   ├── extraer-paginas/
│   ├── eliminar-paginas/
│   ├── organizar-paginas/
│   └── rotar-paginas/
├── ganchos/            Estado compartido (hooks de React)
├── herramientas/       Catálogo de herramientas y sus tipos
├── pdf/                Lógica PDF: cargar, guardar, miniaturas, validar
├── pruebas/            Pruebas automatizadas
└── utilidades/         Rangos, tamaños, descargas, ZIP, errores
```

La separación es deliberada:

- **`pdf/`** no sabe nada de React. Concentra la carga con pdf-lib, el guardado, el dibujado de miniaturas con PDF.js, la liberación de recursos y la validación.
- **`utilidades/`** son funciones puras: interpretación de rangos, formato de tamaños, nombres de archivo, ZIP y tratamiento de errores.
- **`ganchos/`** contiene el estado compartido: `useDocumentoPdf` carga un documento y libera el anterior, `useSeleccionPaginas` gestiona la selección, `useProcesoPdf` ejecuta y descarga, y `useHerramientaPaginas` reúne los tres.
- **`funcionalidades/`** tiene, por herramienta, su lógica de negocio (un módulo sin React y probado), su gancho de estado y su interfaz.
- **`componentes/`** son piezas visuales sin lógica de negocio, compartidas entre herramientas.

Cada herramienta se carga de forma diferida, así que la página inicial no descarga ni pdf-lib ni PDF.js. La navegación usa el hash de la dirección (`#/dividir`), lo que permite compartir enlaces directos y usar los botones de atrás y adelante sin necesitar un enrutador ni configurar redirecciones en el servidor.

## Accesibilidad

- HTML semántico y un enlace para saltar al contenido principal.
- Todos los botones tienen un nombre accesible que incluye la página o el archivo al que afectan.
- La zona de arrastrar y soltar se puede usar con el teclado.
- Las miniaturas son botones con `aria-pressed`, acompañados de texto que indica el número de página, su posición actual, su rotación y si está marcada. El `canvas` se marca como decorativo.
- El arrastre para reordenar es un añadido: siempre hay botones equivalentes y todo se puede manejar con el teclado.
- Los mensajes de estado y de error se anuncian con `aria-live`.
- Los estados no se comunican solo con el color: siempre hay texto y, además, un icono o una marca.
- Se respeta `prefers-reduced-motion` y se admiten los temas claro y oscuro.
- El diseño está pensado primero para móvil y funciona también en escritorio.

## Limitaciones conocidas

- **Documentos cifrados.** Se detectan y se avisa, pero no se pueden procesar. No se pide la contraseña.
- **Memoria.** Todo ocurre en memoria. Un documento de cientos de megabytes, o muchos documentos grandes a la vez, pueden agotarla; el fallo se captura y se muestra como aviso sin bloquear la aplicación.
- **Miniaturas.** Se dibujan de forma diferida, pero un documento con muchísimas páginas tarda en mostrarlas todas. No hay límite artificial de páginas.
- **Arrastre táctil.** El reordenado por arrastre usa la API nativa de HTML, que los navegadores móviles no implementan. En pantallas táctiles se usan los botones de movimiento, que cubren la misma funcionalidad.
- **Imágenes JPEG 2000.** Se desactiva el WebAssembly de PDF.js para garantizar que no realiza peticiones de red, así que las páginas con imágenes en ese formato poco común pueden verse incompletas en la miniatura. El documento generado no se ve afectado: las páginas se copian tal cual.
- **Metadatos al dividir.** Se copian el título, el autor, el asunto y las palabras clave. El resto de metadatos los regenera pdf-lib.
- **Sin pruebas de interfaz.** Las pruebas cubren la lógica y el procesamiento. Los componentes de React no tienen pruebas todavía.

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
   - **Sin dependencias innecesarias.** Justifica cualquier dependencia nueva.
   - **Sin backend, sin peticiones de red para procesar documentos, sin telemetría y sin almacenamiento persistente.**
   - Los componentes visuales van en `componentes/`, la lógica de negocio en `funcionalidades/<herramienta>/` o en `pdf/`, y las funciones puras en `utilidades/`. No concentres lógica en `Aplicacion.tsx`.
5. Añade pruebas para toda la lógica nueva. Genera los PDF de prueba con pdf-lib dentro de la propia prueba; no añadas archivos binarios al repositorio.
6. Cuida la accesibilidad: nombre accesible en cada control, navegación con teclado, foco visible, `aria-live` para los mensajes dinámicos y estados que no dependan solo del color.

## Licencia

Free PDF es software libre, distribuido bajo la licencia [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) (AGPL-3.0). El texto completo está en el archivo [LICENSE](LICENSE).

Esto significa que cualquiera puede usar, estudiar, modificar y compartir el programa, y que cualquier versión modificada que se ofrezca como servicio en red debe publicar también su código fuente.

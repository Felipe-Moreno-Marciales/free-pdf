# Free PDF

Aplicación web libre y de código abierto para trabajar con archivos PDF **sin salir del navegador**.

Free PDF no tiene servidor propio, no necesita registro y no envía tus documentos a ningún sitio: todo el procesamiento se ejecuta en tu equipo, con las capacidades del propio navegador.

## Estado actual

El proyecto está en sus primeras fases. Ahora mismo hay **una única herramienta disponible**:

| Herramienta | Estado |
| ----------- | ------ |
| Unir PDF    | Disponible |

No hay ninguna otra herramienta implementada todavía.

### Unir PDF

Combina varios documentos en un único archivo PDF.

- Selección de varios archivos a la vez, con el ratón o con el teclado.
- Zona para arrastrar y soltar documentos.
- Posibilidad de añadir más archivos después de la primera selección.
- Lista con el nombre y el tamaño legible de cada archivo.
- Reordenación de la lista: el orden de la lista es el orden final de las páginas.
- Eliminación de archivos individuales y vaciado completo de la selección.
- Número total de archivos y tamaño total de la selección.
- Se exigen al menos dos archivos para poder unir.
- Solo se aceptan archivos PDF: se comprueban la extensión y el tipo MIME.
- Se descartan los archivos vacíos y los duplicados exactos.
- Avisos claros si un documento está dañado, cifrado o no se puede procesar.
- El resultado se descarga como `free-pdf-unido.pdf`, de forma automática y con un botón para repetir la descarga.

## Privacidad

La privacidad no es una promesa: es una consecuencia de cómo está construida la aplicación.

- Los documentos se leen en memoria con las API del navegador (`File` y `ArrayBuffer`) y se procesan con [pdf-lib](https://pdf-lib.js.org/).
- **Ningún archivo se sube a un servidor.** No hay backend ni ninguna petición de red que transporte tus documentos.
- No se guarda nada en `localStorage` ni en `sessionStorage`: al recargar la página, la selección desaparece.
- No hay telemetría, analítica, publicidad ni rastreo de ningún tipo.
- Al ser software libre, puedes revisar el código y comprobarlo por ti mismo.

La única descarga que realiza la aplicación es la de sus propios archivos estáticos, incluida la biblioteca pdf-lib, que se carga de forma diferida la primera vez que unes documentos.

## Tecnologías

- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/) en modo estricto
- [Vite](https://vite.dev/) como herramienta de compilación
- [Oxlint](https://oxc.rs/) para el análisis estático
- [pdf-lib](https://pdf-lib.js.org/) para manipular documentos PDF
- CSS propio, sin frameworks
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

## Comandos

| Comando | Descripción |
| ------- | ----------- |
| `pnpm dev` | Arranca el servidor de desarrollo con recarga en caliente. |
| `pnpm lint` | Analiza el código con Oxlint. |
| `pnpm build` | Comprueba los tipos y genera la versión de producción en `dist`. |
| `pnpm preview` | Sirve localmente la versión ya compilada. |

## Estructura del proyecto

El código fuente está escrito en español, salvo los nombres impuestos por las tecnologías utilizadas.

```
src/
├── componentes/                 Componentes visuales reutilizables
│   ├── AvisoPrivacidad.tsx
│   ├── Encabezado.tsx
│   ├── Iconos.tsx               Iconos SVG propios
│   ├── ListaArchivosPdf.tsx
│   ├── PiePagina.tsx
│   ├── Presentacion.tsx
│   └── ZonaArrastrePdf.tsx
├── funcionalidades/
│   └── unir-pdf/                Herramienta «Unir PDF»
│       ├── HerramientaUnirPdf.tsx   Interfaz de la herramienta
│       ├── seleccion.ts             Lógica pura de la selección de archivos
│       ├── tipos.ts                 Tipos de la funcionalidad
│       ├── unirPdf.ts               Unión de documentos con pdf-lib
│       └── useUnirPdf.ts            Estado y acciones de la herramienta
├── utilidades/
│   ├── descargarArchivo.ts      Descarga de un Blob en el navegador
│   ├── errores.ts               Tratamiento seguro de errores desconocidos
│   ├── formatearTamano.ts       Tamaños legibles en español
│   └── validacionArchivos.ts    Comprobación de que un archivo es un PDF
├── Aplicacion.tsx               Estructura general de la página
├── aplicacion.css               Estilos de la interfaz
├── constantes.ts                Nombre del proyecto, licencia y repositorio
├── estilos-globales.css         Variables de diseño y estilos base
└── principal.tsx                Punto de entrada
```

La lógica de negocio se mantiene separada de los componentes visuales: `unirPdf.ts` y `seleccion.ts` son módulos sin dependencias de React y pueden probarse por separado.

## Accesibilidad

- HTML semántico y un enlace para saltar al contenido principal.
- Todos los botones tienen un nombre accesible que incluye el archivo al que afectan.
- La zona de arrastrar y soltar se puede usar con el teclado.
- Foco visible en todos los elementos interactivos.
- Los mensajes de estado y de error se anuncian con `aria-live`.
- Los estados no se comunican solo con el color: siempre hay texto y un icono.
- Se respeta `prefers-reduced-motion` y se admiten los temas claro y oscuro.
- El diseño está pensado primero para móvil y funciona también en escritorio.

## Integración continua y despliegue

El flujo de trabajo [.github/workflows/desplegar.yml](.github/workflows/desplegar.yml) valida y publica el proyecto:

- Se ejecuta en cada `push` a `development` y a `main`, en los Pull Requests hacia `main` y de forma manual con `workflow_dispatch`.
- Instala las dependencias con `pnpm install --frozen-lockfile`, analiza el código con `pnpm lint` y compila con `pnpm build`.
- Comprueba que la compilación use la ruta base `/free-pdf/`, obligatoria para GitHub Pages.
- Publica la carpeta `dist` en GitHub Pages **únicamente** en los `push` a `main`. La rama `development` nunca despliega.

### Configuración necesaria en GitHub

Para que el despliegue funcione hay que abrir **Settings → Pages** en el repositorio y elegir **GitHub Actions** como origen (*Source*). No se necesita ningún secreto ni token adicional.

## Ramas

- `development`: rama de trabajo. Todo el desarrollo entra aquí.
- `main`: versiones estables. Es la única rama que despliega a GitHub Pages.

## Licencia

Free PDF es software libre, distribuido bajo la licencia [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) (AGPL-3.0). El texto completo está en el archivo [LICENSE](LICENSE).

Esto significa que cualquiera puede usar, estudiar, modificar y compartir el programa, y que cualquier versión modificada que se ofrezca como servicio en red debe publicar también su código fuente.

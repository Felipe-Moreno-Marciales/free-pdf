/**
 * Direcciones de los recursos auxiliares de PDF.js.
 *
 * Los archivos los publica el complemento de Vite `recursosPdfJs` bajo
 * `<base>pdfjs/`, tomándolos del paquete `pdfjs-dist` instalado. Todas estas
 * direcciones apuntan al mismo origen que la aplicación, respetan la ruta base
 * de GitHub Pages —`/free-pdf/`— y no llevan ningún dato de la persona: son
 * tablas de caracteres, tipografías y descodificadores.
 *
 * No se usa ninguna CDN ni ningún servicio de terceros.
 */

/** Carpeta pública bajo la que se sirven los recursos. */
const CARPETA = 'pdfjs'

/**
 * Ruta base de la aplicación.
 *
 * Vite la sustituye al compilar: `/free-pdf/` en la versión publicada y `/`
 * cuando se ejecuta en local. Siempre termina en barra.
 */
function leerRutaBase(): string {
  const base = import.meta.env.BASE_URL

  if (typeof base !== 'string' || base === '') {
    return '/'
  }

  return base.endsWith('/') ? base : `${base}/`
}

/** Dirección de la carpeta de recursos. */
export const URL_RECURSOS_PDFJS = `${leerRutaBase()}${CARPETA}/`

/** Tablas de caracteres de los alfabetos que no son latinos. */
export const URL_CMAPS = `${URL_RECURSOS_PDFJS}cmaps/`

/** Tipografías estándar del formato PDF. */
export const URL_TIPOGRAFIAS_ESTANDAR = `${URL_RECURSOS_PDFJS}standard_fonts/`

/** Módulos WebAssembly que descodifican JBIG2 y JPEG 2000. */
export const URL_WASM = `${URL_RECURSOS_PDFJS}wasm/`

/** Perfiles de color predeterminados. */
export const URL_PERFILES_COLOR = `${URL_RECURSOS_PDFJS}iccs/`

/** Opciones de PDF.js relacionadas con los recursos auxiliares. */
export interface OpcionesRecursosPdfJs {
  /** Carpeta de las tablas de caracteres. */
  readonly cMapUrl: string
  /** Las tablas se distribuyen en formato binario compacto. */
  readonly cMapPacked: true
  /** Carpeta de las tipografías estándar. */
  readonly standardFontDataUrl: string
  /** Carpeta de los módulos WebAssembly. */
  readonly wasmUrl: string
  /** Carpeta de los perfiles de color. */
  readonly iccUrl: string
  /** Se permite WebAssembly, ya que los módulos se sirven en local. */
  readonly useWasm: true
  /**
   * Se aprovechan las tipografías del sistema cuando existen y se recurre a las
   * tipografías estándar incluidas cuando no.
   */
  readonly useSystemFonts: true
}

/**
 * Devuelve las opciones con las que se abre cualquier documento.
 *
 * Al servir estos recursos desde la propia aplicación se mejora la
 * representación de las tipografías, de los alfabetos asiáticos, de las imágenes
 * JPEG 2000 y JBIG2 y de los perfiles de color, sin ceder nada en privacidad:
 * las peticiones son del mismo origen y no contienen el documento.
 */
export function opcionesRecursosPdfJs(): OpcionesRecursosPdfJs {
  return {
    cMapUrl: URL_CMAPS,
    cMapPacked: true,
    standardFontDataUrl: URL_TIPOGRAFIAS_ESTANDAR,
    wasmUrl: URL_WASM,
    iccUrl: URL_PERFILES_COLOR,
    useWasm: true,
    useSystemFonts: true,
  }
}

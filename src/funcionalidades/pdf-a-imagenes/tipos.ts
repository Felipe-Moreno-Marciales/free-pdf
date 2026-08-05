import type { FormatoImagenPdf } from '../../imagenes/tipos'

/**
 * Resolución con la que se dibujan las páginas.
 *
 * Los nombres son comprensibles a propósito: hablar de «alta» dice más que
 * hablar de una escala de 3. La escala real de cada opción está documentada en
 * `ESCALAS_RESOLUCION`.
 */
export type ClaveResolucion = 'estandar' | 'alta' | 'muy-alta'

/** Configuración de la conversión. */
export interface ConfiguracionPdfAImagenes {
  /** Formato de las imágenes generadas. */
  readonly formato: FormatoImagenPdf
  /** Calidad del JPEG, en porcentaje. Se ignora con PNG. */
  readonly calidadPorcentaje: number
  /** Resolución elegida. */
  readonly resolucion: ClaveResolucion
}

/** Página ya convertida en imagen. */
export interface ImagenGenerada {
  /** Número de página dentro del documento, empezando en 1. */
  readonly numeroPagina: number
  /** Nombre con el que se guardará. */
  readonly nombreArchivo: string
  /** Contenido de la imagen. */
  readonly bytes: Uint8Array
  /** Ancho en píxeles. */
  readonly ancho: number
  /** Alto en píxeles. */
  readonly alto: number
}

/** Resumen de una de las imágenes generadas. */
export interface ResumenImagenGenerada {
  readonly numeroPagina: number
  readonly nombreArchivo: string
  readonly tamano: number
  readonly ancho: number
  readonly alto: number
}

/** Resultado de la conversión, listo para descargar. */
export interface ResultadoImagenes {
  /** Contenido que se descarga: la imagen suelta o el paquete ZIP. */
  readonly blob: Blob
  /** Nombre con el que se descarga. */
  readonly nombreArchivo: string
  /** Tamaño de la descarga en bytes. */
  readonly tamano: number
  /** Imágenes generadas, en el orden de las páginas. */
  readonly imagenes: readonly ResumenImagenGenerada[]
  /** `true` cuando la descarga es un ZIP con varias imágenes. */
  readonly esPaquete: boolean
}

/** Petición de dibujado de una página concreta. */
export interface PeticionRenderizado {
  /** Número de página dentro del documento, empezando en 1. */
  readonly numeroPagina: number
  /** Escala respecto al tamaño natural de la página. */
  readonly escala: number
  /** Formato en el que hay que devolver los bytes. */
  readonly formato: FormatoImagenPdf
  /** Calidad del JPEG, entre 0 y 1. */
  readonly calidad: number
  /** Señal con la que se puede interrumpir el dibujado. */
  readonly senal: AbortSignal | undefined
}

/** Página ya dibujada y convertida en bytes. */
export interface PaginaRenderizada {
  readonly bytes: Uint8Array
  readonly ancho: number
  readonly alto: number
}

/**
 * Adaptador que dibuja una página y devuelve sus bytes.
 *
 * Dibujar una página requiere PDF.js y un `canvas`, que solo existen en el
 * navegador. Al recibir el adaptador desde fuera se puede probar toda la lógica
 * —selección, nombres, orden, progreso, cancelación y creación del ZIP— sin
 * simular que PDF.js ha dibujado nada: en las pruebas se pasa un adaptador que
 * devuelve bytes conocidos, y en el navegador el que dibuja de verdad.
 *
 * Devuelve `null` cuando el dibujado se interrumpe.
 */
export type RenderizadorPagina = (
  peticion: PeticionRenderizado,
) => Promise<PaginaRenderizada | null>

/** Datos necesarios para convertir páginas en imágenes. */
export interface PeticionPdfAImagenes {
  /** Números de página que hay que convertir, empezando en 1. */
  readonly numerosPagina: readonly number[]
  /** Nombre del documento de origen, del que se derivan los nombres. */
  readonly nombreDocumento: string
  /** Configuración de la conversión. */
  readonly configuracion: ConfiguracionPdfAImagenes
}

/** Opciones de ejecución de la conversión. */
export interface OpcionesConversion {
  /** Adaptador que dibuja cada página. */
  readonly renderizador: RenderizadorPagina
  /** Señal con la que se puede cancelar entre páginas. */
  readonly senal?: AbortSignal
  /** Se llama al terminar cada página. */
  readonly alProgreso?: (completadas: number, total: number) => void
}

import type { FormatoImagenPdf } from '../../imagenes/tipos'

/**
 * Tipos de la censura permanente.
 *
 * La diferencia con «Recortar PDF» es esencial: recortar cambia el área visible y
 * el contenido sigue dentro del archivo; censurar **reconstruye el documento a
 * partir de píxeles**, así que lo que se tapa deja de existir en el resultado.
 */

/** Perfil de calidad del rasterizado. */
export type PerfilCalidad = 'ligera' | 'equilibrada' | 'alta'

/**
 * Zona que se va a censurar.
 *
 * Se guarda en fracciones del ancho y del alto de la página visible, entre 0 y 1.
 * Guardarla así —y no en píxeles de pantalla— es lo que permite dibujarla igual a
 * cualquier escala y a cualquier resolución de salida.
 */
export interface ZonaCensura {
  /** Identificador estable dentro de la sesión. */
  readonly id: string
  /** Página a la que pertenece, empezando en 1. */
  readonly pagina: number
  /** Fracción desde el borde izquierdo. */
  readonly izquierda: number
  /** Fracción desde el borde superior. */
  readonly superior: number
  /** Fracción del ancho que ocupa. */
  readonly ancho: number
  /** Fracción del alto que ocupa. */
  readonly alto: number
  /** Cómo se creó la zona, solo informativo. */
  readonly origen: 'manual' | 'busqueda'
  /** Texto que originó la zona, cuando viene de una búsqueda. */
  readonly textoEncontrado?: string
}

/** Apariencia con la que se pintan las zonas censuradas. */
export interface AparienciaCensura {
  /** Color de relleno, en notación hexadecimal. */
  readonly color: string
  /** Texto que se escribe encima, o cadena vacía para no escribir nada. */
  readonly texto: string
}

/** Configuración completa de la censura. */
export interface ConfiguracionCensura {
  /** Perfil de calidad del rasterizado. */
  readonly calidad: PerfilCalidad
  /** Apariencia de las zonas. */
  readonly apariencia: AparienciaCensura
  /** Formato de las imágenes que se incrustan. */
  readonly formato: FormatoImagenPdf
}

/** Medidas de una página, en puntos PDF y ya aplicada su rotación. */
export interface MedidasPaginaCensura {
  /** Ancho visible, en puntos. */
  readonly ancho: number
  /** Alto visible, en puntos. */
  readonly alto: number
}

/** Página ya rasterizada con sus zonas pintadas. */
export interface PaginaCensurada {
  /** Bytes de la imagen. */
  readonly bytes: Uint8Array
  /** Ancho en píxeles. */
  readonly ancho: number
  /** Alto en píxeles. */
  readonly alto: number
}

/** Petición de rasterizado de una página concreta. */
export interface PeticionRasterizado {
  /** Página que hay que dibujar, empezando en 1. */
  readonly numeroPagina: number
  /** Escala respecto al tamaño natural de la página. */
  readonly escala: number
  /** Zonas que hay que pintar sobre los píxeles de esa página. */
  readonly zonas: readonly ZonaCensura[]
  /** Apariencia de las zonas. */
  readonly apariencia: AparienciaCensura
  /** Formato en el que se devuelven los bytes. */
  readonly formato: FormatoImagenPdf
  /** Calidad del JPEG, entre 0 y 1. */
  readonly calidad: number
  /** Señal con la que se puede interrumpir. */
  readonly senal: AbortSignal | undefined
}

/**
 * Adaptador que dibuja las páginas y pinta las zonas sobre los píxeles.
 *
 * Rasterizar exige PDF.js y un `canvas`, que solo existen en el navegador. Al
 * recibirlo desde fuera se puede comprobar todo lo demás —el orden de las páginas,
 * las medidas, la reconstrucción del documento, la verificación y la cancelación—
 * sin dar por hecho que se ha dibujado nada.
 *
 * Devuelve `null` cuando la operación se interrumpe.
 */
export interface AdaptadorCensura {
  /** Número de páginas del documento. */
  readonly numeroPaginas: number
  /** Medidas visibles de cada página, en puntos. */
  readonly medirPaginas: () => Promise<readonly MedidasPaginaCensura[]>
  /** Dibuja una página con sus zonas ya pintadas. */
  readonly rasterizar: (
    peticion: PeticionRasterizado,
  ) => Promise<PaginaCensurada | null>
}

/** Resultado de verificar el documento censurado. */
export interface VerificacionCensura {
  /** `true` cuando todas las comprobaciones pasan. */
  readonly correcta: boolean
  /** Número de páginas del resultado. */
  readonly numeroPaginas: number
  /** `true` cuando no queda texto extraíble. */
  readonly sinTextoExtraible: boolean
  /** `true` cuando no queda ningún campo de formulario. */
  readonly sinFormularios: boolean
  /** `true` cuando no queda ninguna anotación interactiva. */
  readonly sinAnotaciones: boolean
  /** Explicación del primer problema encontrado, o `null`. */
  readonly mensaje: string | null
}

/**
 * Comprobador del documento resultante.
 *
 * Necesita PDF.js para extraer el texto, así que también se recibe desde fuera.
 */
export type ComprobadorCensura = (
  contenido: Uint8Array,
  paginasEsperadas: number,
) => Promise<VerificacionCensura>

/** Datos necesarios para censurar un documento. */
export interface PeticionCensura {
  /** Zonas que se van a censurar, de todas las páginas. */
  readonly zonas: readonly ZonaCensura[]
  /** Configuración de la censura. */
  readonly configuracion: ConfiguracionCensura
}

/** Opciones de ejecución de la censura. */
export interface OpcionesCensura {
  /** Adaptador que rasteriza las páginas. */
  readonly adaptador: AdaptadorCensura
  /** Comprobador del resultado. */
  readonly comprobador: ComprobadorCensura
  /** Señal con la que se puede cancelar entre páginas. */
  readonly senal?: AbortSignal
  /** Se llama al terminar cada página. */
  readonly alProgreso?: (completadas: number, total: number) => void
}

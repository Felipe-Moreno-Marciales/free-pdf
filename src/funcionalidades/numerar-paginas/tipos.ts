import type { AlcancePaginas } from '../../pdf/paginasAfectadas'
import type { PosicionEnPagina } from '../../pdf/posicionarEnPagina'
import type { ClavePlantilla } from './plantillaNumeracion'

/** Apariencia del texto de la numeración. */
export interface AparienciaNumeracion {
  /** Tamaño de la tipografía, en puntos. */
  readonly tamanoFuente: number
  /** Color del texto, en notación hexadecimal. */
  readonly color: string
  /** Opacidad, en porcentaje. */
  readonly opacidadPorcentaje: number
  /** Separación respecto a los bordes izquierdo y derecho, en milímetros. */
  readonly margenHorizontalMm: number
  /** Separación respecto a los bordes superior e inferior, en milímetros. */
  readonly margenVerticalMm: number
}

/** Configuración completa de la numeración. */
export interface ConfiguracionNumeracion {
  /** Plantilla elegida. */
  readonly plantilla: ClavePlantilla
  /** Texto propio, que solo se usa con la plantilla `personalizada`. */
  readonly plantillaPropia: string
  /** Número que se asigna a la primera página del documento. */
  readonly numeroInicial: number
  /** Páginas en las que se escribe el número. */
  readonly alcance: AlcancePaginas
  /** Expresión de rangos, que solo se usa con el alcance `rango`. */
  readonly expresion: string
  /** Posición dentro de la página. */
  readonly posicion: PosicionEnPagina
  /** Apariencia del texto. */
  readonly apariencia: AparienciaNumeracion
}

/** Datos necesarios para numerar un documento. */
export interface PeticionNumeracion {
  /** Archivo original. */
  readonly archivo: File
  /** Configuración de la numeración. */
  readonly configuracion: ConfiguracionNumeracion
}

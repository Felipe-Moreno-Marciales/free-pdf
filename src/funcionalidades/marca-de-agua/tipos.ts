import type { FormatoImagen } from '../../imagenes/tipos'
import type { AlcancePaginas } from '../../pdf/paginasAfectadas'
import type { PosicionEnPagina } from '../../pdf/posicionarEnPagina'

/** Clase de marca de agua. */
export type TipoMarca = 'texto' | 'imagen'

/** Forma en la que la marca se reparte por la página. */
export type ModoRepeticion = 'unica' | 'mosaico'

/** Ajustes de una marca de agua de texto. */
export interface MarcaTexto {
  /** Texto que se escribe. */
  readonly texto: string
  /** Tamaño de la tipografía, en puntos. */
  readonly tamanoFuente: number
  /** Color del texto, en notación hexadecimal. */
  readonly color: string
}

/** Ajustes de una marca de agua de imagen. */
export interface MarcaImagen {
  /** Ancho de la marca, como porcentaje del ancho visible de la página. */
  readonly escalaPorcentaje: number
}

/** Imagen elegida como marca de agua. */
export interface ImagenMarca {
  /** Contenido de la imagen. */
  readonly contenido: File
  /** Nombre visible. */
  readonly nombre: string
  /** Formato detectado. */
  readonly formato: FormatoImagen
  /** Tamaño en bytes. */
  readonly tamano: number
}

/** Configuración completa de la marca de agua. */
export interface ConfiguracionMarcaDeAgua {
  /** Clase de marca. */
  readonly tipo: TipoMarca
  /** Ajustes de la marca de texto. */
  readonly texto: MarcaTexto
  /** Ajustes de la marca de imagen. */
  readonly imagen: MarcaImagen
  /** Opacidad, en porcentaje. Se aplica a las dos clases de marca. */
  readonly opacidadPorcentaje: number
  /** Giro de la marca, en grados y en sentido contrario a las agujas del reloj. */
  readonly rotacionGrados: number
  /** Posición dentro de la página; solo se usa en el modo `unica`. */
  readonly posicion: PosicionEnPagina
  /** Forma en la que la marca se reparte. */
  readonly modo: ModoRepeticion
  /** Separación horizontal entre copias del mosaico, en milímetros. */
  readonly separacionHorizontalMm: number
  /** Separación vertical entre copias del mosaico, en milímetros. */
  readonly separacionVerticalMm: number
  /** Margen respecto a los bordes, en milímetros. */
  readonly margenMm: number
  /** Páginas a las que se aplica la marca. */
  readonly alcance: AlcancePaginas
  /** Expresión de rangos, que solo se usa con el alcance `rango`. */
  readonly expresion: string
}

/** Datos necesarios para aplicar la marca de agua. */
export interface PeticionMarcaDeAgua {
  /** Archivo original. */
  readonly archivo: File
  /** Configuración de la marca. */
  readonly configuracion: ConfiguracionMarcaDeAgua
  /** Imagen de la marca, obligatoria cuando el tipo es `imagen`. */
  readonly imagenMarca: ImagenMarca | null
}

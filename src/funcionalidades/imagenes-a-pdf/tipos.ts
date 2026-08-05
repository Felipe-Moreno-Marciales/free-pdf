import type { PreparadorImagen } from '../../imagenes/normalizarImagen'
import type {
  AjustesImagen,
  ConfiguracionPaginaImagen,
  DimensionesImagen,
  FormatoImagen,
  RecorteRelativo,
} from '../../imagenes/tipos'
import type { GradosRotacion } from '../../pdf/tipos'

/** Imagen que se convertirá en una página del documento. */
export interface EntradaImagen {
  /** Identificador estable, para los mensajes y el progreso. */
  readonly id: string
  /** Nombre visible del archivo. */
  readonly nombre: string
  /** Contenido de la imagen. */
  readonly contenido: Blob
  /** Formato del contenido. */
  readonly formato: FormatoImagen
  /** Giro que hay que aplicar. */
  readonly rotacion: GradosRotacion
  /** Medidas ya conocidas, o `null` si hay que leerlas. */
  readonly dimensiones: DimensionesImagen | null
  /** Recorte que la persona ha ajustado, sobre la imagen ya girada. */
  readonly recorte?: RecorteRelativo | null
  /** Ajustes de color, o `null` si la imagen se usa tal cual. */
  readonly ajustes?: AjustesImagen | null
}

/**
 * Piezas que dependen del navegador y que el procesamiento recibe desde fuera.
 *
 * Separarlas permite probar toda la geometría y la generación del documento sin
 * un `canvas`: en las pruebas se pasa un adaptador que trabaja solo con bytes, y
 * en el navegador se usa `ADAPTADOR_NAVEGADOR`, que descodifica de verdad.
 */
export interface AdaptadorImagenes {
  /** Lee las medidas de una imagen. */
  readonly medir: (entrada: EntradaImagen) => Promise<DimensionesImagen>
  /** Convierte una imagen en bytes listos para incrustar. */
  readonly preparar: PreparadorImagen
}

/** Datos necesarios para crear un documento a partir de imágenes. */
export interface PeticionImagenesAPdf {
  /** Imágenes en el orden en el que se convertirán en páginas. */
  readonly imagenes: readonly EntradaImagen[]
  /** Configuración de las páginas. */
  readonly configuracion: ConfiguracionPaginaImagen
  /** Nombre del documento resultante. */
  readonly nombreArchivo?: string
}

/** Opciones de ejecución del procesamiento. */
export interface OpcionesProcesoImagenes {
  /** Adaptador que descodifica y convierte las imágenes. */
  readonly adaptador?: AdaptadorImagenes
  /** Señal con la que se puede cancelar entre imágenes. */
  readonly senal?: AbortSignal
  /** Se llama al terminar cada imagen. */
  readonly alProgreso?: (procesadas: number, total: number) => void
}

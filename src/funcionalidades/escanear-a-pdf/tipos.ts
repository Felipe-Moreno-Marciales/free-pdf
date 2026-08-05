import type {
  AjustesImagen,
  ConfiguracionPaginaImagen,
  DimensionesImagen,
  FormatoImagen,
  RecorteRelativo,
} from '../../imagenes/tipos'
import type { GradosRotacion } from '../../pdf/tipos'

/** Procedencia de una captura. */
export type OrigenCaptura = 'camara' | 'archivo'

/**
 * Captura que se convertirá en una página del documento.
 *
 * El contenido es un `Blob` que vive únicamente en memoria: no se guarda en
 * `localStorage`, `sessionStorage`, `IndexedDB` ni cookies, así que al recargar la
 * página las capturas desaparecen.
 */
export interface CapturaEscaneada {
  /** Identificador estable dentro de la sesión. */
  readonly id: string
  /** Nombre visible de la captura. */
  readonly nombre: string
  /** Contenido de la imagen. */
  readonly contenido: Blob
  /** Formato del contenido. */
  readonly formato: FormatoImagen
  /** Procedencia de la captura. */
  readonly origen: OrigenCaptura
  /** Tamaño en bytes. */
  readonly tamano: number
  /** Giro que se aplica, en grados. */
  readonly rotacion: GradosRotacion
  /** Recorte sobre la imagen ya girada, o `null` si se conserva completa. */
  readonly recorte: RecorteRelativo | null
  /** Ajustes de color que se aplican. */
  readonly ajustes: AjustesImagen
  /** Medidas leídas al descodificarla, o `null` si todavía no se conocen. */
  readonly dimensiones: DimensionesImagen | null
}

/** Datos necesarios para crear el documento escaneado. */
export interface PeticionEscaneo {
  /** Capturas en el orden en el que se convertirán en páginas. */
  readonly capturas: readonly CapturaEscaneada[]
  /** Configuración de las páginas. */
  readonly configuracion: ConfiguracionPaginaImagen
}

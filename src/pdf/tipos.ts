/** Archivo PDF que la persona ha seleccionado. */
export interface PdfSeleccionado {
  /** Identificador estable derivado de nombre, tamaño y fecha de modificación. */
  readonly id: string
  /** Archivo original facilitado por el navegador. */
  readonly archivo: File
  /** Nombre visible del archivo. */
  readonly nombre: string
  /** Tamaño en bytes. */
  readonly tamano: number
}

/** Rotación admitida por un documento PDF, en grados. */
export type GradosRotacion = 0 | 90 | 180 | 270

/** Sentido en el que se aplica un giro de 90 grados. */
export type SentidoGiro = 'izquierda' | 'derecha'

/** Estados por los que pasa una herramienta de la Fase 1. */
export type EstadoHerramienta =
  | 'sin-archivo'
  | 'cargando-documento'
  | 'renderizando-miniaturas'
  | 'preparado'
  | 'procesando'
  | 'completado'
  | 'error'

/** Motivo por el que se descarta un archivo al seleccionarlo. */
export type MotivoDescarte = 'no-es-pdf' | 'vacio' | 'duplicado'

/** Archivo descartado junto con el motivo del descarte. */
export interface ArchivoDescartado {
  readonly nombre: string
  readonly motivo: MotivoDescarte
}

/** Documento generado por una herramienta, listo para descargar. */
export interface ResultadoDocumento {
  /** Contenido del documento resultante. */
  readonly blob: Blob
  /** Nombre con el que se descarga. */
  readonly nombreArchivo: string
  /** Número total de páginas del documento resultante. */
  readonly numeroPaginas: number
  /** Tamaño del documento resultante en bytes. */
  readonly tamano: number
}

/** Resumen de uno de los documentos incluidos en un paquete ZIP. */
export interface ResumenDocumento {
  readonly nombreArchivo: string
  readonly numeroPaginas: number
  readonly tamano: number
}

/** Conjunto de documentos generados y empaquetados en un único ZIP. */
export interface ResultadoPaquete {
  /** Contenido del ZIP. */
  readonly blob: Blob
  /** Nombre con el que se descarga el ZIP. */
  readonly nombreArchivo: string
  /** Tamaño del ZIP en bytes. */
  readonly tamano: number
  /** Documentos incluidos, en el orden en que se generaron. */
  readonly documentos: readonly ResumenDocumento[]
}

/** Página tal y como se muestra en la cuadrícula de miniaturas. */
export interface PaginaCuadricula {
  /** Índice de la página en el documento original, empezando en 0. */
  readonly indiceOriginal: number
  /** Rotación adicional que la herramienta aplica sobre la original. */
  readonly rotacion: GradosRotacion
  /** `true` si la página está marcada. */
  readonly seleccionada: boolean
}

/** Archivo PDF que forma parte de la selección actual. */
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

/** Estado del proceso de unión. */
export type EstadoUnion = 'inactivo' | 'uniendo' | 'completado' | 'error'

/** Motivo por el que un archivo se descarta al añadirlo a la selección. */
export type MotivoDescarte = 'no-es-pdf' | 'vacio' | 'duplicado'

/** Archivo descartado junto con el motivo del descarte. */
export interface ArchivoDescartado {
  readonly nombre: string
  readonly motivo: MotivoDescarte
}

/** Dirección en la que se desplaza un archivo dentro de la lista. */
export type DireccionMovimiento = 'arriba' | 'abajo'

/** Documento resultante de una unión correcta. */
export interface ResultadoUnion {
  /** Contenido del PDF unido, listo para descargar. */
  readonly blob: Blob
  /** Nombre con el que se descarga el documento. */
  readonly nombreArchivo: string
  /** Número total de páginas del documento resultante. */
  readonly numeroPaginas: number
  /** Tamaño del documento resultante en bytes. */
  readonly tamano: number
}

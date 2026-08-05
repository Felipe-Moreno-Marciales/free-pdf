/** Unidad en la que se escriben los márgenes del recorte. */
export type UnidadRecorte = 'milimetros' | 'puntos'

/** Márgenes que se descartan por cada lado. */
export interface MargenesRecorte {
  /** Margen superior. */
  readonly superior: number
  /** Margen derecho. */
  readonly derecho: number
  /** Margen inferior. */
  readonly inferior: number
  /** Margen izquierdo. */
  readonly izquierdo: number
}

/** Páginas a las que se aplica el recorte. */
export type AlcanceRecorte = 'referencia' | 'seleccionadas' | 'todas'

/** Configuración completa del recorte. */
export interface ConfiguracionRecorte {
  /** Márgenes, expresados en la unidad elegida. */
  readonly margenes: MargenesRecorte
  /** Unidad en la que están escritos los márgenes. */
  readonly unidad: UnidadRecorte
  /** Páginas a las que se aplica. */
  readonly alcance: AlcanceRecorte
}

/** Medidas de una página, en puntos PDF. */
export interface MedidasRecorte {
  readonly ancho: number
  readonly alto: number
}

/** Rectángulo en coordenadas PDF. */
export interface RectanguloPdf {
  readonly x: number
  readonly y: number
  readonly ancho: number
  readonly alto: number
}

/** Datos necesarios para recortar un documento. */
export interface PeticionRecorte {
  /** Archivo original. */
  readonly archivo: File
  /** Configuración del recorte. */
  readonly configuracion: ConfiguracionRecorte
  /** Índice de la página de referencia, empezando en 0. */
  readonly indiceReferencia: number
  /** Índices marcados en la cuadrícula, empezando en 0. */
  readonly indicesSeleccionados: readonly number[]
}

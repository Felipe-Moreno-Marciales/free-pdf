/** Fragmento de texto situado en las coordenadas de una página PDF. */
export interface FragmentoTextoPdf {
  readonly texto: string
  readonly x: number
  readonly y: number
  readonly ancho: number
  readonly alto: number
  readonly tamanoFuente: number
  readonly nombreFuente: string
  readonly finLinea: boolean
  readonly enlace: string | null
}

/** Texto extraído de una página, antes de deducir su estructura. */
export interface PaginaTextoPdf {
  /** Número visible de la página, empezando en uno. */
  readonly numero: number
  readonly ancho: number
  readonly alto: number
  readonly fragmentos: readonly FragmentoTextoPdf[]
}

/** Parte de una línea, con un enlace opcional. */
export interface TramoTexto {
  readonly texto: string
  readonly enlace: string | null
}

/** Bloques aproximados que se pueden representar en Markdown. */
export type BloqueDocumento =
  | {
      readonly tipo: 'encabezado'
      readonly nivel: 1 | 2 | 3
      readonly tramos: readonly TramoTexto[]
    }
  | {
      readonly tipo: 'parrafo'
      readonly lineas: readonly (readonly TramoTexto[])[]
    }
  | {
      readonly tipo: 'lista'
      readonly ordenada: boolean
      readonly elementos: readonly (readonly TramoTexto[])[]
    }
  | {
      readonly tipo: 'cita'
      readonly lineas: readonly (readonly TramoTexto[])[]
    }
  | {
      readonly tipo: 'tabla'
      readonly filas: readonly (readonly (readonly TramoTexto[])[])[]
    }

/** Estructura aproximada deducida para una página. */
export interface PaginaEstructurada {
  readonly numero: number
  readonly bloques: readonly BloqueDocumento[]
}

/** Resultado completo de extraer y estructurar las páginas elegidas. */
export interface DocumentoEstructurado {
  readonly paginas: readonly PaginaEstructurada[]
  readonly contieneTexto: boolean
}

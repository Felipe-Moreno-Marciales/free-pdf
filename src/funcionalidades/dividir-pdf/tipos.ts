/** Forma en la que se divide el documento. */
export type ModoDivision = 'rangos' | 'cada-pagina'

/** Grupo de páginas que se convertirá en un documento independiente. */
export interface GrupoPrevisto {
  /** Nombre con el que aparecerá dentro del ZIP. */
  readonly nombreArchivo: string
  /** Índices de las páginas que contendrá, empezando en 0. */
  readonly indices: readonly number[]
  /** Descripción legible del grupo, por ejemplo «Páginas 1 a 3». */
  readonly descripcion: string
}

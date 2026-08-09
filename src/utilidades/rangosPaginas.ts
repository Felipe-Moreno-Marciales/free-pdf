/**
 * Interpretación de expresiones de páginas escritas por la persona.
 *
 * Las expresiones admitidas combinan páginas sueltas y rangos separados por
 * comas: `1`, `1-3`, `1,3,5`, `1-3,5,8-10`. Los espacios se ignoran, así que
 * `1 - 3 , 5` equivale a `1-3,5`.
 *
 * Este módulo es puro: no depende de React ni del navegador, de modo que se
 * puede probar por separado.
 */

/** Error de interpretación con un mensaje ya redactado en español. */
export class ErrorRangoPaginas extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorRangoPaginas'
  }
}

/** Grupo de páginas escrito por la persona, tal y como lo escribió. */
export interface GrupoPaginas {
  /** Primera página del grupo, empezando en 1. */
  readonly primeraPagina: number
  /** Última página del grupo, empezando en 1. */
  readonly ultimaPagina: number
  /** Índices internos del grupo, empezando en 0, en orden ascendente. */
  readonly indices: readonly number[]
}

/** Resultado de interpretar una expresión de páginas. */
export interface RangosInterpretados {
  /**
   * Grupos en el mismo orden en que se escribieron.
   * `1-3,5` produce dos grupos y `5,1-3` produce los mismos dos grupos
   * invertidos, porque cada grupo genera un documento independiente.
   */
  readonly grupos: readonly GrupoPaginas[]
  /**
   * Todos los índices implicados, empezando en 0, sin duplicados y en orden
   * ascendente. Este es el orden que se usa para seleccionar páginas, donde lo
   * escrito solo indica qué páginas participan, no en qué orden.
   */
  readonly indices: readonly number[]
}

/** Reconoce una página suelta, por ejemplo `7`. */
const PAGINA_SUELTA = /^\d+$/

/** Reconoce un rango de páginas, por ejemplo `2-9`. */
const RANGO = /^(\d+)-(\d+)$/

/**
 * Interpreta una expresión de páginas.
 *
 * @param expresion Texto escrito por la persona.
 * @param totalPaginas Número de páginas del documento.
 * @throws {ErrorRangoPaginas} Si la sintaxis es inválida o alguna página no existe.
 */
export function interpretarRangos(
  expresion: string,
  totalPaginas: number,
): RangosInterpretados {
  if (!Number.isInteger(totalPaginas) || totalPaginas < 1) {
    throw new ErrorRangoPaginas(
      'Todavía no hay un documento cargado con páginas que seleccionar.',
    )
  }

  const limpia = expresion.trim()
  if (limpia === '') {
    throw new ErrorRangoPaginas(
      'Escribe al menos una página o un rango, por ejemplo 1-3, 5 u 8-10.',
    )
  }

  const segmentos = limpia.split(',')
  const grupos: GrupoPaginas[] = []
  const indicesVistos = new Set<number>()

  for (const segmentoOriginal of segmentos) {
    // Se admiten espacios en cualquier posición: «1 - 3» equivale a «1-3».
    const segmento = segmentoOriginal.replace(/\s+/g, '')

    if (segmento === '') {
      throw new ErrorRangoPaginas(
        'Hay una coma sin páginas a su lado. Escribe las páginas separadas por comas, por ejemplo 1-3,5.',
      )
    }

    const grupo = interpretarSegmento(segmento, totalPaginas)
    grupos.push(grupo)

    for (const indice of grupo.indices) {
      indicesVistos.add(indice)
    }
  }

  return {
    grupos,
    indices: [...indicesVistos].sort((primero, segundo) => primero - segundo),
  }
}

/**
 * Interpreta una expresión y devuelve solo los índices implicados.
 * Es la forma habitual de seleccionar páginas dentro de una herramienta.
 */
export function interpretarRangosComoIndices(
  expresion: string,
  totalPaginas: number,
): readonly number[] {
  return interpretarRangos(expresion, totalPaginas).indices
}

/** Interpreta un único segmento, que puede ser una página suelta o un rango. */
function interpretarSegmento(
  segmento: string,
  totalPaginas: number,
): GrupoPaginas {
  if (PAGINA_SUELTA.test(segmento)) {
    const pagina = Number.parseInt(segmento, 10)
    validarPagina(pagina, totalPaginas, segmento)

    return {
      primeraPagina: pagina,
      ultimaPagina: pagina,
      indices: [pagina - 1],
    }
  }

  const coincidencia = RANGO.exec(segmento)
  if (coincidencia === null) {
    throw new ErrorRangoPaginas(
      `«${segmento}» no es una página ni un rango válido. Usa números y guiones, por ejemplo 1-3, 5 u 8-10.`,
    )
  }

  const primera = Number.parseInt(coincidencia[1], 10)
  const ultima = Number.parseInt(coincidencia[2], 10)

  validarPagina(primera, totalPaginas, segmento)
  validarPagina(ultima, totalPaginas, segmento)

  if (primera > ultima) {
    throw new ErrorRangoPaginas(
      `El rango «${segmento}» está invertido. Escribe primero la página menor, por ejemplo ${ultima}-${primera}.`,
    )
  }

  const indices: number[] = []
  for (let pagina = primera; pagina <= ultima; pagina += 1) {
    indices.push(pagina - 1)
  }

  return { primeraPagina: primera, ultimaPagina: ultima, indices }
}

/** Comprueba que una página exista dentro del documento. */
function validarPagina(
  pagina: number,
  totalPaginas: number,
  segmento: string,
): void {
  if (pagina === 0) {
    throw new ErrorRangoPaginas(
      `En «${segmento}» aparece la página 0. Las páginas se numeran desde 1.`,
    )
  }

  if (pagina > totalPaginas) {
    throw new ErrorRangoPaginas(
      `La página ${pagina} no existe: el documento tiene ${totalPaginas} ${
        totalPaginas === 1 ? 'página' : 'páginas'
      }.`,
    )
  }
}

/**
 * Describe un grupo de páginas en español, para nombres de archivo y avisos.
 * Devuelve `pagina-5` para una página suelta y `paginas-1-3` para un rango.
 */
export function describirGrupo(grupo: GrupoPaginas): string {
  return grupo.primeraPagina === grupo.ultimaPagina
    ? `pagina-${grupo.primeraPagina}`
    : `paginas-${grupo.primeraPagina}-${grupo.ultimaPagina}`
}

/**
 * Resume una lista de índices como texto legible de páginas.
 * Los índices consecutivos se agrupan: `[0,1,2,4]` produce `1-3, 5`.
 */
export function resumirIndicesComoTexto(
  indices: readonly number[],
): string {
  if (indices.length === 0) {
    return ''
  }

  const ordenados = [...new Set(indices)].sort(
    (primero, segundo) => primero - segundo,
  )
  const tramos: string[] = []
  let inicio = ordenados[0]
  let anterior = ordenados[0]

  for (const indice of ordenados.slice(1)) {
    if (indice === anterior + 1) {
      anterior = indice
      continue
    }

    tramos.push(formatearTramo(inicio, anterior))
    inicio = indice
    anterior = indice
  }

  tramos.push(formatearTramo(inicio, anterior))

  return tramos.join(', ')
}

/** Da formato a un tramo de índices consecutivos usando números de página. */
function formatearTramo(indiceInicio: number, indiceFin: number): string {
  return indiceInicio === indiceFin
    ? `${indiceInicio + 1}`
    : `${indiceInicio + 1}-${indiceFin + 1}`
}

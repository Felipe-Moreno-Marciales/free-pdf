import {
  ErrorRangoPaginas,
  interpretarRangosComoIndices,
} from '../utilidades/rangosPaginas'

/**
 * Selección de las páginas a las que afecta una operación.
 *
 * Numerar páginas, la marca de agua y el recorte comparten las mismas cuatro
 * formas de elegir páginas, así que la lógica se escribe una sola vez. Los
 * rangos se interpretan con la utilidad compartida de la Fase 1.
 *
 * Este módulo es puro.
 */

/** Forma de elegir a qué páginas afecta la operación. */
export type AlcancePaginas = 'todas' | 'pares' | 'impares' | 'rango'

/** Nombre visible de cada alcance. */
const NOMBRE_ALCANCE: Readonly<Record<AlcancePaginas, string>> = {
  todas: 'Todas las páginas',
  pares: 'Páginas pares',
  impares: 'Páginas impares',
  rango: 'Rango personalizado',
}

/** Devuelve el nombre visible de un alcance. */
export function describirAlcance(alcance: AlcancePaginas): string {
  return NOMBRE_ALCANCE[alcance]
}

/**
 * Calcula los índices de las páginas afectadas, empezando en 0.
 *
 * «Pares» e «impares» se refieren al número de página que ve la persona, no al
 * índice interno: la página 1 es impar y la 2 es par.
 *
 * @throws {ErrorRangoPaginas} Si el alcance es `rango` y la expresión no es válida.
 */
export function calcularIndicesAfectados(
  alcance: AlcancePaginas,
  totalPaginas: number,
  expresion: string,
): readonly number[] {
  if (!Number.isInteger(totalPaginas) || totalPaginas < 1) {
    return []
  }

  switch (alcance) {
    case 'todas':
      return Array.from({ length: totalPaginas }, (_, indice) => indice)
    case 'pares':
      return filtrarPorParidad(totalPaginas, 'pares')
    case 'impares':
      return filtrarPorParidad(totalPaginas, 'impares')
    case 'rango':
      return interpretarRangosComoIndices(expresion, totalPaginas)
  }
}

/** Devuelve los índices de las páginas pares o impares del documento. */
function filtrarPorParidad(
  totalPaginas: number,
  paridad: 'pares' | 'impares',
): readonly number[] {
  const indices: number[] = []
  const restoBuscado = paridad === 'pares' ? 0 : 1

  for (let numero = 1; numero <= totalPaginas; numero += 1) {
    if (numero % 2 === restoBuscado) {
      indices.push(numero - 1)
    }
  }

  return indices
}

/**
 * Calcula los índices afectados sin lanzar errores.
 *
 * La interfaz la usa para la vista previa, donde una expresión a medio escribir
 * no debe producir ningún mensaje alarmante.
 */
export interface ResultadoAlcance {
  /** Índices afectados, o lista vacía si la expresión no es válida. */
  readonly indices: readonly number[]
  /** Mensaje de error de la expresión, o `null`. */
  readonly mensajeError: string | null
}

/** Interpreta el alcance devolviendo el error en lugar de lanzarlo. */
export function interpretarAlcance(
  alcance: AlcancePaginas,
  totalPaginas: number,
  expresion: string,
): ResultadoAlcance {
  if (alcance === 'rango' && expresion.trim() === '') {
    return { indices: [], mensajeError: null }
  }

  try {
    return {
      indices: calcularIndicesAfectados(alcance, totalPaginas, expresion),
      mensajeError: null,
    }
  } catch (error) {
    return {
      indices: [],
      mensajeError:
        error instanceof ErrorRangoPaginas
          ? error.message
          : 'No se pudo interpretar la lista de páginas.',
    }
  }
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ErrorRangoPaginas,
  interpretarRangosComoIndices,
  resumirIndicesComoTexto,
} from '../utilidades/rangosPaginas'

/** Texto de reserva cuando la interpretación falla sin mensaje aprovechable. */
const ERROR_RANGOS = 'No se pudo interpretar la lista de páginas.'

/** Estado y acciones de la selección de páginas de un documento. */
export interface ControladorSeleccionPaginas {
  /** Índices seleccionados, empezando en 0. */
  readonly seleccionadas: ReadonlySet<number>
  /** Número de páginas seleccionadas. */
  readonly numeroSeleccionadas: number
  /** Índices seleccionados en orden ascendente. */
  readonly indicesOrdenados: readonly number[]
  /** Resumen legible de la selección, por ejemplo `1-3, 5`. */
  readonly resumen: string
  /** Marca o desmarca una página. */
  readonly alternarPagina: (indice: number) => void
  /** Marca todas las páginas. */
  readonly seleccionarTodas: () => void
  /** Desmarca todas las páginas. */
  readonly limpiarSeleccion: () => void
  /** Invierte la selección actual. */
  readonly invertirSeleccion: () => void
  /**
   * Selecciona las páginas indicadas en una expresión de rangos.
   * Devuelve un mensaje de error en español, o `null` si todo fue bien.
   */
  readonly aplicarRangos: (expresion: string) => string | null
}

/**
 * Concentra la selección de páginas compartida por varias herramientas.
 *
 * La selección se vacía automáticamente cuando cambia el documento, de modo
 * que nunca quedan páginas marcadas de un archivo anterior.
 */
export function useSeleccionPaginas(
  numeroPaginas: number,
  idDocumento: string | null,
): ControladorSeleccionPaginas {
  const [seleccionadas, establecerSeleccionadas] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  )

  // Al cambiar de documento se descarta la selección anterior.
  useEffect(() => {
    establecerSeleccionadas(new Set<number>())
  }, [idDocumento, numeroPaginas])

  const alternarPagina = useCallback((indice: number): void => {
    establecerSeleccionadas((actuales) => {
      const siguientes = new Set(actuales)

      if (siguientes.has(indice)) {
        siguientes.delete(indice)
      } else {
        siguientes.add(indice)
      }

      return siguientes
    })
  }, [])

  const seleccionarTodas = useCallback((): void => {
    establecerSeleccionadas(
      new Set(Array.from({ length: numeroPaginas }, (_, indice) => indice)),
    )
  }, [numeroPaginas])

  const limpiarSeleccion = useCallback((): void => {
    establecerSeleccionadas(new Set<number>())
  }, [])

  const invertirSeleccion = useCallback((): void => {
    establecerSeleccionadas((actuales) => {
      const siguientes = new Set<number>()

      for (let indice = 0; indice < numeroPaginas; indice += 1) {
        if (!actuales.has(indice)) {
          siguientes.add(indice)
        }
      }

      return siguientes
    })
  }, [numeroPaginas])

  const aplicarRangos = useCallback(
    (expresion: string): string | null => {
      try {
        const indices = interpretarRangosComoIndices(expresion, numeroPaginas)
        establecerSeleccionadas(new Set(indices))
        return null
      } catch (error) {
        return error instanceof ErrorRangoPaginas ? error.message : ERROR_RANGOS
      }
    },
    [numeroPaginas],
  )

  const indicesOrdenados = useMemo(
    () => [...seleccionadas].sort((primero, segundo) => primero - segundo),
    [seleccionadas],
  )

  const resumen = useMemo(
    () => resumirIndicesComoTexto(indicesOrdenados),
    [indicesOrdenados],
  )

  return {
    seleccionadas,
    numeroSeleccionadas: seleccionadas.size,
    indicesOrdenados,
    resumen,
    alternarPagina,
    seleccionarTodas,
    limpiarSeleccion,
    invertirSeleccion,
    aplicarRangos,
  }
}

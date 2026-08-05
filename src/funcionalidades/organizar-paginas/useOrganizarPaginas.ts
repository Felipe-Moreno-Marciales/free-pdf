import { useCallback, useEffect, useState } from 'react'
import {
  useHerramientaPaginas,
  type ControladorHerramientaPaginas,
} from '../../ganchos/useHerramientaPaginas'
import type { PaginaCuadricula, ResultadoDocumento } from '../../pdf/tipos'
import {
  agruparSeleccionadas,
  crearOrdenInicial,
  estaOrdenAlterado,
  moverAlFinal,
  moverAlInicio,
  moverAPosicion,
  moverDerecha,
  moverIzquierda,
} from './ordenPaginas'
import { organizarPaginas } from './organizarPaginas'

/** Estado y acciones de la herramienta de organización. */
export interface ControladorOrganizarPaginas
  extends ControladorHerramientaPaginas<ResultadoDocumento> {
  /** Páginas en el orden actual. */
  readonly paginas: readonly PaginaCuadricula[]
  /** `true` si el orden actual difiere del original. */
  readonly ordenAlterado: boolean
  /** `true` cuando se puede generar el documento reorganizado. */
  readonly puedeOrganizar: boolean
  /** Mueve una página una posición hacia la izquierda. */
  readonly moverIzquierdaEn: (posicion: number) => void
  /** Mueve una página una posición hacia la derecha. */
  readonly moverDerechaEn: (posicion: number) => void
  /** Lleva una página al principio del documento. */
  readonly llevarAlInicio: (posicion: number) => void
  /** Lleva una página al final del documento. */
  readonly llevarAlFinal: (posicion: number) => void
  /** Reordena arrastrando una miniatura de una posición a otra. */
  readonly reordenarArrastrando: (
    posicionOrigen: number,
    posicionDestino: number,
  ) => void
  /** Agrupa las páginas marcadas al principio o al final. */
  readonly agruparMarcadas: (destino: 'inicio' | 'final') => void
  /** Devuelve las páginas a su orden original. */
  readonly restablecerOrden: () => void
  /** Genera el documento con el orden actual. */
  readonly organizar: () => void
}

/** Concentra el estado de la herramienta para organizar páginas. */
export function useOrganizarPaginas(): ControladorOrganizarPaginas {
  const base = useHerramientaPaginas<ResultadoDocumento>()
  const cargado = base.documento.documento
  const idDocumento = cargado?.seleccionado.id ?? null
  const numeroPaginas = cargado?.numeroPaginas ?? 0

  const [orden, establecerOrden] = useState<readonly number[]>([])

  // Al cambiar de documento se parte del orden original del nuevo.
  useEffect(() => {
    establecerOrden(crearOrdenInicial(numeroPaginas))
  }, [idDocumento, numeroPaginas])

  const paginas: readonly PaginaCuadricula[] = orden.map((indiceOriginal) => ({
    indiceOriginal,
    rotacion: 0,
    seleccionada: base.seleccion.seleccionadas.has(indiceOriginal),
  }))

  const cambiarOrden = useCallback(
    (calcular: (actual: readonly number[]) => readonly number[]): void => {
      establecerOrden(calcular)
      base.proceso.limpiarResultado()
    },
    [base.proceso],
  )

  const moverIzquierdaEn = useCallback(
    (posicion: number): void => {
      cambiarOrden((actual) => moverIzquierda(actual, posicion))
    },
    [cambiarOrden],
  )

  const moverDerechaEn = useCallback(
    (posicion: number): void => {
      cambiarOrden((actual) => moverDerecha(actual, posicion))
    },
    [cambiarOrden],
  )

  const llevarAlInicio = useCallback(
    (posicion: number): void => {
      cambiarOrden((actual) => moverAlInicio(actual, posicion))
    },
    [cambiarOrden],
  )

  const llevarAlFinal = useCallback(
    (posicion: number): void => {
      cambiarOrden((actual) => moverAlFinal(actual, posicion))
    },
    [cambiarOrden],
  )

  const reordenarArrastrando = useCallback(
    (posicionOrigen: number, posicionDestino: number): void => {
      cambiarOrden((actual) =>
        moverAPosicion(actual, posicionOrigen, posicionDestino),
      )
    },
    [cambiarOrden],
  )

  const agruparMarcadas = useCallback(
    (destino: 'inicio' | 'final'): void => {
      cambiarOrden((actual) =>
        agruparSeleccionadas(actual, base.seleccion.seleccionadas, destino),
      )
    },
    [cambiarOrden, base.seleccion.seleccionadas],
  )

  const restablecerOrden = useCallback((): void => {
    cambiarOrden(() => crearOrdenInicial(numeroPaginas))
  }, [cambiarOrden, numeroPaginas])

  const ordenAlterado = estaOrdenAlterado(orden)
  const puedeOrganizar = cargado !== null && !base.bloqueado && ordenAlterado

  const organizar = useCallback((): void => {
    if (cargado === null || !ordenAlterado) {
      return
    }

    base.proceso.ejecutar(() =>
      organizarPaginas({ archivo: cargado.seleccionado.archivo, orden }),
    )
  }, [cargado, ordenAlterado, orden, base.proceso])

  return {
    ...base,
    paginas,
    ordenAlterado,
    puedeOrganizar,
    moverIzquierdaEn,
    moverDerechaEn,
    llevarAlInicio,
    llevarAlFinal,
    reordenarArrastrando,
    agruparMarcadas,
    restablecerOrden,
    organizar,
  }
}

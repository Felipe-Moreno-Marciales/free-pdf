import { useCallback, useEffect, useState } from 'react'
import {
  useHerramientaPaginas,
  type ControladorHerramientaPaginas,
} from '../../ganchos/useHerramientaPaginas'
import { MEDIA_VUELTA, gradosDelGiro } from '../../pdf/rotaciones'
import type {
  GradosRotacion,
  PaginaCuadricula,
  ResultadoDocumento,
  SentidoGiro,
} from '../../pdf/tipos'
import { aplicarGiro, rotarPaginas } from './rotarPaginas'

/** Estado y acciones de la herramienta de rotación. */
export interface ControladorRotarPaginas
  extends ControladorHerramientaPaginas<ResultadoDocumento> {
  /** Páginas con la rotación que se les ha aplicado. */
  readonly paginas: readonly PaginaCuadricula[]
  /** Número de páginas que tienen alguna rotación pendiente. */
  readonly numeroRotadas: number
  /** `true` cuando hay rotaciones que aplicar y ningún proceso en curso. */
  readonly puedeRotar: boolean
  /** Gira un cuarto de vuelta las páginas marcadas. */
  readonly girarSeleccionadas: (sentido: SentidoGiro) => void
  /** Gira media vuelta las páginas marcadas. */
  readonly girarMediaVuelta: () => void
  /** Devuelve todas las páginas a su rotación original. */
  readonly restablecerRotaciones: () => void
  /** Genera el documento con las rotaciones aplicadas. */
  readonly rotar: () => void
}

/** Concentra el estado de la herramienta para rotar páginas. */
export function useRotarPaginas(): ControladorRotarPaginas {
  const base = useHerramientaPaginas<ResultadoDocumento>()
  const cargado = base.documento.documento
  const idDocumento = cargado?.seleccionado.id ?? null

  const [rotaciones, establecerRotaciones] = useState<
    ReadonlyMap<number, GradosRotacion>
  >(() => new Map())

  // Al cambiar de documento se descartan las rotaciones del anterior.
  useEffect(() => {
    establecerRotaciones(new Map())
  }, [idDocumento])

  const paginas: readonly PaginaCuadricula[] =
    cargado === null
      ? []
      : Array.from({ length: cargado.numeroPaginas }, (_, indice) => ({
          indiceOriginal: indice,
          rotacion: rotaciones.get(indice) ?? 0,
          seleccionada: base.seleccion.seleccionadas.has(indice),
        }))

  const girar = useCallback(
    (grados: number): void => {
      const indices = base.seleccion.indicesOrdenados
      if (indices.length === 0) {
        return
      }

      establecerRotaciones((actuales) => aplicarGiro(actuales, indices, grados))
      base.proceso.limpiarResultado()
    },
    [base.seleccion, base.proceso],
  )

  const girarSeleccionadas = useCallback(
    (sentido: SentidoGiro): void => {
      girar(gradosDelGiro(sentido))
    },
    [girar],
  )

  const girarMediaVuelta = useCallback((): void => {
    girar(MEDIA_VUELTA)
  }, [girar])

  const restablecerRotaciones = useCallback((): void => {
    establecerRotaciones(new Map())
    base.proceso.limpiarResultado()
  }, [base.proceso])

  const numeroRotadas = rotaciones.size
  const puedeRotar = cargado !== null && !base.bloqueado && numeroRotadas > 0

  const rotar = useCallback((): void => {
    if (cargado === null || rotaciones.size === 0) {
      return
    }

    base.proceso.ejecutar(() =>
      rotarPaginas({
        archivo: cargado.seleccionado.archivo,
        rotaciones,
      }),
    )
  }, [cargado, rotaciones, base.proceso])

  return {
    ...base,
    paginas,
    numeroRotadas,
    puedeRotar,
    girarSeleccionadas,
    girarMediaVuelta,
    restablecerRotaciones,
    rotar,
  }
}

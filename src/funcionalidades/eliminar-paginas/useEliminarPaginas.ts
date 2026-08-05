import { useCallback } from 'react'
import {
  useHerramientaPaginas,
  type ControladorHerramientaPaginas,
} from '../../ganchos/useHerramientaPaginas'
import type { PaginaCuadricula, ResultadoDocumento } from '../../pdf/tipos'
import { eliminarPaginas } from './eliminarPaginas'

/** Estado y acciones de la herramienta de eliminación. */
export interface ControladorEliminarPaginas
  extends ControladorHerramientaPaginas<ResultadoDocumento> {
  /** Páginas tal y como deben mostrarse en la cuadrícula. */
  readonly paginas: readonly PaginaCuadricula[]
  /** Número de páginas que se eliminarán. */
  readonly numeroAEliminar: number
  /** Número de páginas que permanecerán en el documento. */
  readonly numeroRestantes: number
  /** `true` si se han marcado todas las páginas, lo que no está permitido. */
  readonly seEliminarianTodas: boolean
  /** `true` cuando la operación es posible. */
  readonly puedeEliminar: boolean
  /** Genera el documento sin las páginas marcadas. */
  readonly eliminar: () => void
}

/** Concentra el estado de la herramienta para eliminar páginas. */
export function useEliminarPaginas(): ControladorEliminarPaginas {
  const base = useHerramientaPaginas<ResultadoDocumento>()
  const cargado = base.documento.documento

  const total = cargado?.numeroPaginas ?? 0
  const numeroAEliminar = base.seleccion.numeroSeleccionadas
  const numeroRestantes = total - numeroAEliminar
  const seEliminarianTodas = total > 0 && numeroRestantes === 0

  const paginas: readonly PaginaCuadricula[] =
    cargado === null
      ? []
      : Array.from({ length: total }, (_, indice) => ({
          indiceOriginal: indice,
          rotacion: 0,
          seleccionada: base.seleccion.seleccionadas.has(indice),
        }))

  const puedeEliminar =
    cargado !== null &&
    !base.bloqueado &&
    numeroAEliminar > 0 &&
    !seEliminarianTodas

  const eliminar = useCallback((): void => {
    if (cargado === null || numeroAEliminar === 0 || seEliminarianTodas) {
      return
    }

    base.proceso.ejecutar(() =>
      eliminarPaginas({
        archivo: cargado.seleccionado.archivo,
        indicesAEliminar: base.seleccion.indicesOrdenados,
      }),
    )
  }, [
    cargado,
    numeroAEliminar,
    seEliminarianTodas,
    base.proceso,
    base.seleccion,
  ])

  return {
    ...base,
    paginas,
    numeroAEliminar,
    numeroRestantes,
    seEliminarianTodas,
    puedeEliminar,
    eliminar,
  }
}

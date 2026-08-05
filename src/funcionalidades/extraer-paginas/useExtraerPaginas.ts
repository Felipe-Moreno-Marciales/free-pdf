import { useCallback } from 'react'
import {
  useHerramientaPaginas,
  type ControladorHerramientaPaginas,
} from '../../ganchos/useHerramientaPaginas'
import type { PaginaCuadricula, ResultadoDocumento } from '../../pdf/tipos'
import { extraerPaginas } from './extraerPaginas'

/** Estado y acciones de la herramienta de extracción. */
export interface ControladorExtraerPaginas
  extends ControladorHerramientaPaginas<ResultadoDocumento> {
  /** Páginas tal y como deben mostrarse en la cuadrícula. */
  readonly paginas: readonly PaginaCuadricula[]
  /** `true` cuando hay páginas marcadas y ningún proceso en curso. */
  readonly puedeExtraer: boolean
  /** Genera el documento con las páginas marcadas. */
  readonly extraer: () => void
}

/** Concentra el estado de la herramienta para extraer páginas. */
export function useExtraerPaginas(): ControladorExtraerPaginas {
  const base = useHerramientaPaginas<ResultadoDocumento>()
  const cargado = base.documento.documento

  const paginas: readonly PaginaCuadricula[] =
    cargado === null
      ? []
      : Array.from({ length: cargado.numeroPaginas }, (_, indice) => ({
          indiceOriginal: indice,
          rotacion: 0,
          seleccionada: base.seleccion.seleccionadas.has(indice),
        }))

  const puedeExtraer =
    cargado !== null && !base.bloqueado && base.seleccion.numeroSeleccionadas > 0

  const extraer = useCallback((): void => {
    if (cargado === null || base.seleccion.numeroSeleccionadas === 0) {
      return
    }

    base.proceso.ejecutar(() =>
      extraerPaginas({
        archivo: cargado.seleccionado.archivo,
        indices: base.seleccion.indicesOrdenados,
      }),
    )
  }, [cargado, base.proceso, base.seleccion])

  return { ...base, paginas, puedeExtraer, extraer }
}

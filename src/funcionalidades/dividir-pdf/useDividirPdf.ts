import { useCallback, useMemo, useState } from 'react'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import { useProcesoPdf } from '../../ganchos/useProcesoPdf'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta, ResultadoPaquete } from '../../pdf/tipos'
import { ErrorRangoPaginas } from '../../utilidades/rangosPaginas'
import { dividirPdf } from './dividirPdf'
import { calcularGruposPrevistos } from './interpretarRangos'
import type { GrupoPrevisto, ModoDivision } from './tipos'

/** Previsualización de los documentos que producirá la división. */
interface Previsualizacion {
  /** Grupos calculados, o lista vacía si la expresión no es válida. */
  readonly grupos: readonly GrupoPrevisto[]
  /** Mensaje de error de la expresión, o `null`. */
  readonly mensajeError: string | null
}

/** Estado y acciones de la herramienta de división. */
export interface ControladorDividirPdf {
  readonly documento: ControladorDocumentoPdf
  readonly estado: EstadoHerramienta
  readonly modo: ModoDivision
  readonly expresion: string
  readonly grupos: readonly GrupoPrevisto[]
  readonly mensajeRangos: string | null
  readonly procesando: boolean
  readonly resultado: ResultadoPaquete | null
  readonly mensajeError: string | null
  readonly puedeDividir: boolean
  readonly establecerModo: (modo: ModoDivision) => void
  readonly establecerExpresion: (expresion: string) => void
  readonly dividir: () => void
  readonly descargarResultado: () => void
}

/**
 * Concentra el estado de la herramienta de división.
 *
 * La previsualización se calcula con la misma función pura que usa el
 * procesamiento, así que lo que se muestra coincide siempre con lo que se
 * genera.
 */
export function useDividirPdf(): ControladorDividirPdf {
  const documento = useDocumentoPdf()
  const proceso = useProcesoPdf<ResultadoPaquete>()
  const [modo, establecerModoInterno] = useState<ModoDivision>('rangos')
  const [expresion, establecerExpresionInterna] = useState('')

  const cargado = documento.documento

  const previsualizacion = useMemo<Previsualizacion>(() => {
    if (cargado === null) {
      return { grupos: [], mensajeError: null }
    }

    if (modo === 'rangos' && expresion.trim() === '') {
      return { grupos: [], mensajeError: null }
    }

    try {
      return {
        grupos: calcularGruposPrevistos(
          modo,
          expresion,
          cargado.seleccionado.nombre,
          cargado.numeroPaginas,
        ),
        mensajeError: null,
      }
    } catch (error) {
      return {
        grupos: [],
        mensajeError:
          error instanceof ErrorRangoPaginas
            ? error.message
            : 'No se pudo interpretar la lista de páginas.',
      }
    }
  }, [cargado, modo, expresion])

  const establecerModo = useCallback(
    (siguiente: ModoDivision): void => {
      establecerModoInterno(siguiente)
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const establecerExpresion = useCallback(
    (siguiente: string): void => {
      establecerExpresionInterna(siguiente)
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const puedeDividir =
    cargado !== null &&
    !proceso.procesando &&
    !documento.cargando &&
    previsualizacion.grupos.length > 0

  const dividir = useCallback((): void => {
    if (cargado === null || !puedeDividir) {
      return
    }

    proceso.ejecutar(() =>
      dividirPdf({
        archivo: cargado.seleccionado.archivo,
        totalPaginas: cargado.numeroPaginas,
        modo,
        expresion,
      }),
    )
  }, [cargado, puedeDividir, proceso, modo, expresion])

  const estado = calcularEstadoHerramienta({
    hayDocumento: cargado !== null,
    cargando: documento.cargando,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError:
      documento.mensajeError !== null || proceso.mensajeError !== null,
  })

  return {
    documento,
    estado,
    modo,
    expresion,
    grupos: previsualizacion.grupos,
    mensajeRangos: previsualizacion.mensajeError,
    procesando: proceso.procesando,
    resultado: proceso.resultado,
    mensajeError: documento.mensajeError ?? proceso.mensajeError,
    puedeDividir,
    establecerModo,
    establecerExpresion,
    dividir,
    descargarResultado: proceso.descargarResultado,
  }
}

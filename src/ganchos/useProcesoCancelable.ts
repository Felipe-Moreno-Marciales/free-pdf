import { useCallback, useEffect, useRef, useState } from 'react'
import { esCancelacion } from '../pdf/cancelacion'
import { descargarBlob } from '../utilidades/descargarArchivo'
import { obtenerMensajeError } from '../utilidades/errores'
import type { ResultadoDescargable } from './useProcesoPdf'

/** Texto de reserva cuando el fallo no aporta ningún mensaje aprovechable. */
const ERROR_INESPERADO =
  'No se pudo completar la operación por un error inesperado. Vuelve a intentarlo.'

/** Avance de una operación que se puede seguir paso a paso. */
export interface ProgresoProceso {
  /** Pasos ya terminados. */
  readonly completados: number
  /** Pasos totales previstos. */
  readonly total: number
}

/** Función con la que la operación comunica su avance. */
export type InformarProgreso = (completados: number, total: number) => void

/** Estado y acciones de una operación larga que se puede cancelar. */
export interface ControladorProcesoCancelable<
  Resultado extends ResultadoDescargable,
> {
  /** `true` mientras la operación está en curso. */
  readonly procesando: boolean
  /** Avance actual, o `null` si todavía no se ha informado de ninguno. */
  readonly progreso: ProgresoProceso | null
  /** Resultado de la última operación correcta, o `null`. */
  readonly resultado: Resultado | null
  /** Mensaje de error de la última operación, o `null`. */
  readonly mensajeError: string | null
  /** `true` cuando la última operación se canceló a petición de la persona. */
  readonly cancelado: boolean
  /** Lanza la operación, salvo que ya haya otra en curso. */
  readonly ejecutar: (
    operacion: (
      senal: AbortSignal,
      informarProgreso: InformarProgreso,
    ) => Promise<Resultado>,
  ) => void
  /** Pide que la operación se interrumpa en el siguiente paso. */
  readonly cancelar: () => void
  /** Vuelve a descargar el resultado de la última operación. */
  readonly descargarResultado: () => void
  /** Descarta el resultado, el error y la cancelación anteriores. */
  readonly limpiarResultado: () => void
}

/**
 * Concentra el patrón de las operaciones largas que se pueden interrumpir.
 *
 * Se apoya en `AbortController`, la API estándar del navegador. La cancelación no
 * se trata como un error: se distingue con `cancelado` y se anuncia con su propio
 * mensaje, porque interrumpir a propósito no es un fallo.
 *
 * El controlador se aborta también al desmontar la herramienta, de modo que un
 * proceso a medias no sigue consumiendo memoria después de salir.
 */
export function useProcesoCancelable<
  Resultado extends ResultadoDescargable,
>(): ControladorProcesoCancelable<Resultado> {
  const [procesando, establecerProcesando] = useState(false)
  const [progreso, establecerProgreso] = useState<ProgresoProceso | null>(null)
  const [resultado, establecerResultado] = useState<Resultado | null>(null)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const [cancelado, establecerCancelado] = useState(false)

  const refEnEjecucion = useRef(false)
  const refControlador = useRef<AbortController | null>(null)

  // Interrumpe el proceso pendiente al desmontar la herramienta.
  useEffect(() => {
    return () => {
      refControlador.current?.abort()
      refControlador.current = null
    }
  }, [])

  const limpiarResultado = useCallback((): void => {
    establecerResultado(null)
    establecerMensajeError(null)
    establecerCancelado(false)
    establecerProgreso(null)
  }, [])

  const cancelar = useCallback((): void => {
    refControlador.current?.abort()
  }, [])

  const ejecutar = useCallback(
    (
      operacion: (
        senal: AbortSignal,
        informarProgreso: InformarProgreso,
      ) => Promise<Resultado>,
    ): void => {
      if (refEnEjecucion.current) {
        return
      }

      const controlador = new AbortController()
      refControlador.current = controlador
      refEnEjecucion.current = true

      establecerProcesando(true)
      establecerResultado(null)
      establecerMensajeError(null)
      establecerCancelado(false)
      establecerProgreso(null)

      const informarProgreso: InformarProgreso = (completados, total) => {
        establecerProgreso({ completados, total })
      }

      const envolver = async (): Promise<void> => {
        try {
          const generado = await operacion(controlador.signal, informarProgreso)

          if (controlador.signal.aborted) {
            establecerCancelado(true)
            return
          }

          establecerResultado(generado)

          // La descarga se inicia sola; el botón permite repetirla si el
          // navegador la bloquea o si se cierra por error. Un resultado sin
          // archivo no se descarga: es un desenlace válido, no un fallo.
          if (generado.blob !== null) {
            descargarBlob(generado.blob, generado.nombreArchivo)
          }
        } catch (error) {
          if (esCancelacion(error) || controlador.signal.aborted) {
            establecerCancelado(true)
            return
          }

          establecerMensajeError(obtenerMensajeError(error, ERROR_INESPERADO))
        } finally {
          refEnEjecucion.current = false
          if (refControlador.current === controlador) {
            refControlador.current = null
          }
          establecerProcesando(false)
        }
      }

      void envolver()
    },
    [],
  )

  const descargarResultado = useCallback((): void => {
    if (resultado === null || resultado.blob === null) {
      return
    }

    descargarBlob(resultado.blob, resultado.nombreArchivo)
  }, [resultado])

  return {
    procesando,
    progreso,
    resultado,
    mensajeError,
    cancelado,
    ejecutar,
    cancelar,
    descargarResultado,
    limpiarResultado,
  }
}

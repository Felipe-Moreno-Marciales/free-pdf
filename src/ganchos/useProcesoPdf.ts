import { useCallback, useRef, useState } from 'react'
import { descargarBlob } from '../utilidades/descargarArchivo'
import { obtenerMensajeError } from '../utilidades/errores'

/** Texto de reserva cuando el fallo no aporta ningún mensaje aprovechable. */
const ERROR_INESPERADO =
  'No se pudo completar la operación por un error inesperado. Vuelve a intentarlo.'

/**
 * Resultado mínimo que toda operación debe producir para poder descargarse.
 *
 * `blob` puede ser `null`, y eso no es un error: hay operaciones cuyo desenlace
 * correcto es **no entregar ningún archivo**. La compresión es el caso claro —si el
 * resultado no es más pequeño, entregarlo sería hacer creer que se ha ganado algo—,
 * y el gancho respeta esa decisión en lugar de descargar de todos modos.
 */
export interface ResultadoDescargable {
  readonly blob: Blob | null
  readonly nombreArchivo: string
}

/** Estado y acciones de una operación que genera un archivo descargable. */
export interface ControladorProcesoPdf<Resultado extends ResultadoDescargable> {
  /** `true` mientras la operación está en curso. */
  readonly procesando: boolean
  /** Resultado de la última operación correcta, o `null`. */
  readonly resultado: Resultado | null
  /** Mensaje de error de la última operación, o `null`. */
  readonly mensajeError: string | null
  /** Lanza la operación, salvo que ya haya otra en curso. */
  readonly ejecutar: (operacion: () => Promise<Resultado>) => void
  /** Vuelve a descargar el resultado de la última operación. */
  readonly descargarResultado: () => void
  /** Descarta el resultado y el error anteriores. */
  readonly limpiarResultado: () => void
}

/**
 * Concentra el patrón común a todas las herramientas: ejecutar una operación,
 * mostrar su estado, descargar el archivo generado y permitir repetir la
 * descarga.
 *
 * Una referencia impide que se lancen dos operaciones a la vez aunque se
 * active el botón dos veces antes de que React vuelva a renderizar.
 */
export function useProcesoPdf<
  Resultado extends ResultadoDescargable,
>(): ControladorProcesoPdf<Resultado> {
  const [procesando, establecerProcesando] = useState(false)
  const [resultado, establecerResultado] = useState<Resultado | null>(null)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const refEnEjecucion = useRef(false)

  const limpiarResultado = useCallback((): void => {
    establecerResultado(null)
    establecerMensajeError(null)
  }, [])

  const ejecutar = useCallback(
    (operacion: () => Promise<Resultado>): void => {
      if (refEnEjecucion.current) {
        return
      }

      refEnEjecucion.current = true
      establecerProcesando(true)
      establecerResultado(null)
      establecerMensajeError(null)

      const envolver = async (): Promise<void> => {
        try {
          const generado = await operacion()
          establecerResultado(generado)

          // La descarga se inicia sola; el botón permite repetirla si el
          // navegador la bloquea o si se cierra por error. Un resultado sin
          // archivo no se descarga: es un desenlace válido, no un fallo.
          if (generado.blob !== null) {
            descargarBlob(generado.blob, generado.nombreArchivo)
          }
        } catch (error) {
          establecerMensajeError(obtenerMensajeError(error, ERROR_INESPERADO))
        } finally {
          refEnEjecucion.current = false
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
    resultado,
    mensajeError,
    ejecutar,
    descargarResultado,
    limpiarResultado,
  }
}

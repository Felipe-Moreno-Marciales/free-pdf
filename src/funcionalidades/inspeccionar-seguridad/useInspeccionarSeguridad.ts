import { useCallback, useEffect, useRef, useState } from 'react'
import { useProcesadorQpdf } from '../../ganchos/useProcesadorQpdf'
import type { PdfSeleccionado } from '../../pdf/tipos'
import { validarArchivoPdf } from '../../pdf/validarDocumentoPdf'
import type { InformeSeguridadPdf } from '../../seguridad/inspeccion/tipos'
import { ErrorQpdf } from '../../seguridad/qpdf/erroresQpdf'
import { obtenerMensajeError } from '../../utilidades/errores'
import { construirIdArchivo } from '../../utilidades/validacionArchivos'

/** Etapa visible del análisis de seguridad. */
export type EstadoInspeccionSeguridad =
  | 'sin-archivo'
  | 'analizando'
  | 'completado'
  | 'cifrado'
  | 'fallido'

/** Estado y acciones de la herramienta «Inspector de seguridad PDF». */
export interface ControladorInspeccionSeguridad {
  readonly documento: PdfSeleccionado | null
  readonly informe: InformeSeguridadPdf | null
  readonly estado: EstadoInspeccionSeguridad
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  readonly mensajeAviso: string | null
  readonly seleccionarArchivos: (archivos: readonly File[]) => void
  readonly restablecer: () => void
}

const ERROR_INESPERADO =
  'No se pudo analizar la estructura del documento. Comprueba que sea un PDF válido y vuelve a intentarlo.'

/**
 * Concentra el ciclo de vida de la inspección local.
 *
 * Cada selección inicia el análisis automáticamente. El número de generación
 * evita que una respuesta antigua vuelva a poblar la interfaz después de
 * restablecerla, y destruir el procesador elimina además el Worker y su memoria.
 */
export function useInspeccionarSeguridad(): ControladorInspeccionSeguridad {
  const procesador = useProcesadorQpdf()
  const generacion = useRef(0)
  const [documento, establecerDocumento] = useState<PdfSeleccionado | null>(null)
  const [informe, establecerInforme] = useState<InformeSeguridadPdf | null>(null)
  const [estado, establecerEstado] =
    useState<EstadoInspeccionSeguridad>('sin-archivo')
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const [mensajeAviso, establecerMensajeAviso] = useState<string | null>(null)

  // Invalida cualquier continuación asíncrona antes de que el gancho compartido
  // destruya el Worker al abandonar la herramienta.
  useEffect(() => {
    return () => {
      generacion.current += 1
    }
  }, [])

  const seleccionarArchivos = useCallback(
    (archivos: readonly File[]): void => {
      const primero = archivos[0]

      if (primero === undefined) {
        return
      }

      const validacion = validarArchivoPdf(primero)

      if (!validacion.valido) {
        establecerMensajeError(validacion.mensaje)
        return
      }

      const operacion = generacion.current + 1
      generacion.current = operacion

      establecerDocumento({
        id: construirIdArchivo(primero),
        archivo: primero,
        nombre: primero.name,
        tamano: primero.size,
      })
      establecerInforme(null)
      establecerEstado('analizando')
      establecerMensajeError(null)
      establecerMensajeAviso(
        archivos.length > 1
          ? 'Solo se analiza un documento a la vez, así que se ha tomado el primero.'
          : null,
      )

      const analizar = async (): Promise<void> => {
        try {
          const bytes = await primero.arrayBuffer()

          // Leer un archivo grande también es asíncrono. Si se restableció o se
          // abandonó la herramienta durante esa lectura, no se debe crear un
          // Worker nuevo para una operación que ya fue cancelada.
          if (generacion.current !== operacion) {
            return
          }

          const contenido = new Uint8Array(bytes)
          const resultado = await procesador
            .obtener()
            .analizarSeguridad(contenido)

          if (generacion.current !== operacion) {
            return
          }

          establecerInforme(resultado)
          establecerEstado('completado')
        } catch (error) {
          if (generacion.current !== operacion) {
            return
          }

          establecerInforme(null)

          if (error instanceof ErrorQpdf && error.codigo === 'ya-esta-cifrado') {
            establecerEstado('cifrado')
            establecerMensajeError(null)
            return
          }

          establecerEstado('fallido')
          establecerMensajeError(obtenerMensajeError(error, ERROR_INESPERADO))
        }
      }

      void analizar()
    },
    [procesador],
  )

  const restablecer = useCallback((): void => {
    generacion.current += 1
    procesador.destruir()
    establecerDocumento(null)
    establecerInforme(null)
    establecerEstado('sin-archivo')
    establecerMensajeError(null)
    establecerMensajeAviso(null)
  }, [procesador])

  return {
    documento,
    informe,
    estado,
    bloqueado: estado === 'analizando',
    mensajeError,
    mensajeAviso,
    seleccionarArchivos,
    restablecer,
  }
}

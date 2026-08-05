import { useCallback, useEffect, useRef, useState } from 'react'
import { liberarDocumentoPdf } from '../pdf/liberarDocumentoPdf'
import {
  abrirDocumentoPdfJs,
  type DocumentoPdfJs,
} from '../pdf/renderizarMiniaturaPdf'
import type { PdfSeleccionado } from '../pdf/tipos'
import { validarArchivoPdf } from '../pdf/validarDocumentoPdf'
import { obtenerMensajeError } from '../utilidades/errores'
import { construirIdArchivo } from '../utilidades/validacionArchivos'

/** Texto de reserva cuando el fallo al abrir no aporta ningún mensaje. */
const ERROR_AL_ABRIR =
  'No se pudo abrir el documento. Comprueba que sea un PDF válido y vuelve a intentarlo.'

/** Documento cargado y listo para trabajar con sus páginas. */
export interface DocumentoCargado {
  /** Archivo del que proviene el documento. */
  readonly seleccionado: PdfSeleccionado
  /** Documento abierto con PDF.js, para dibujar las miniaturas. */
  readonly abierto: DocumentoPdfJs
  /** Número de páginas del documento. */
  readonly numeroPaginas: number
}

/** Estado y acciones de la carga de un único documento. */
export interface ControladorDocumentoPdf {
  /** Documento actualmente cargado, o `null` si no hay ninguno. */
  readonly documento: DocumentoCargado | null
  /** `true` mientras se está abriendo un documento. */
  readonly cargando: boolean
  /** Mensaje de error de la carga, o `null`. */
  readonly mensajeError: string | null
  /** Aviso informativo sobre la última selección, o `null`. */
  readonly mensajeAviso: string | null
  /** Abre el primer PDF válido de la lista y reemplaza el documento actual. */
  readonly seleccionarArchivos: (archivos: readonly File[]) => void
  /** Cierra el documento actual y vuelve al estado inicial. */
  readonly restablecer: () => void
}

/**
 * Carga un único documento PDF y se encarga de liberar el anterior.
 *
 * Se guarda el objeto `File` en lugar de sus bytes: así el contenido se vuelve
 * a leer solo cuando hace falta y no se conservan varios `ArrayBuffer` grandes
 * en memoria. El documento no se guarda en `localStorage`, `sessionStorage`,
 * `IndexedDB` ni cookies: vive únicamente mientras la página está abierta.
 */
export function useDocumentoPdf(): ControladorDocumentoPdf {
  const [documento, establecerDocumento] = useState<DocumentoCargado | null>(null)
  const [cargando, establecerCargando] = useState(false)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const [mensajeAviso, establecerMensajeAviso] = useState<string | null>(null)

  // Documento abierto pendiente de liberar.
  const refAbierto = useRef<DocumentoPdfJs | null>(null)
  // Identifica cada carga para poder descartar las que quedan obsoletas.
  const refCargaActual = useRef(0)

  // Libera el documento al desmontar la herramienta.
  useEffect(() => {
    return () => {
      refCargaActual.current += 1
      const abierto = refAbierto.current
      refAbierto.current = null
      void liberarDocumentoPdf(abierto)
    }
  }, [])

  const restablecer = useCallback((): void => {
    refCargaActual.current += 1
    const abierto = refAbierto.current
    refAbierto.current = null

    establecerDocumento(null)
    establecerCargando(false)
    establecerMensajeError(null)
    establecerMensajeAviso(null)

    void liberarDocumentoPdf(abierto)
  }, [])

  const seleccionarArchivos = useCallback((archivos: readonly File[]): void => {
    const primero = archivos[0]
    if (primero === undefined) {
      return
    }

    const validacion = validarArchivoPdf(primero)
    if (!validacion.valido) {
      establecerMensajeError(validacion.mensaje)
      return
    }

    const numeroCarga = refCargaActual.current + 1
    refCargaActual.current = numeroCarga

    establecerCargando(true)
    establecerMensajeError(null)
    establecerMensajeAviso(
      archivos.length > 1
        ? `Estas herramientas trabajan con un documento a la vez, así que solo se abrió «${primero.name}».`
        : null,
    )

    const ejecutar = async (): Promise<void> => {
      // Se libera el documento anterior antes de abrir el nuevo, para no
      // mantener dos documentos en memoria al mismo tiempo.
      const anterior = refAbierto.current
      refAbierto.current = null
      establecerDocumento(null)
      await liberarDocumentoPdf(anterior)

      try {
        const abierto = await abrirDocumentoPdfJs(primero)

        if (refCargaActual.current !== numeroCarga) {
          await liberarDocumentoPdf(abierto)
          return
        }

        refAbierto.current = abierto
        establecerDocumento({
          seleccionado: {
            id: construirIdArchivo(primero),
            archivo: primero,
            nombre: primero.name,
            tamano: primero.size,
          },
          abierto,
          numeroPaginas: abierto.numeroPaginas,
        })
      } catch (error) {
        if (refCargaActual.current !== numeroCarga) {
          return
        }

        establecerMensajeError(obtenerMensajeError(error, ERROR_AL_ABRIR))
      } finally {
        if (refCargaActual.current === numeroCarga) {
          establecerCargando(false)
        }
      }
    }

    void ejecutar()
  }, [])

  return {
    documento,
    cargando,
    mensajeError,
    mensajeAviso,
    seleccionarArchivos,
    restablecer,
  }
}

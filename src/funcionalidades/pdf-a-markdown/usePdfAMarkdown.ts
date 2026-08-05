import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deducirEstructura } from '../../extraccion/deducirEstructura'
import {
  crearArchivoMarkdown,
  generarMarkdown,
} from '../../extraccion/generarMarkdown'
import { extraerTextoPdf } from '../../extraccion/textoPdf'
import type { DocumentoEstructurado } from '../../extraccion/tipos'
import { esCancelacion } from '../../pdf/cancelacion'
import {
  interpretarAlcance,
  type AlcancePaginas,
} from '../../pdf/paginasAfectadas'
import { descargarBlob } from '../../utilidades/descargarArchivo'
import { obtenerMensajeError } from '../../utilidades/errores'
import type { DocumentoCargado } from '../../ganchos/useDocumentoPdf'

export interface ProgresoMarkdown {
  readonly completadas: number
  readonly total: number
  readonly pagina: number
}

/** Estado y acciones de la conversión editable a Markdown. */
export interface ControladorPdfAMarkdown {
  readonly alcance: AlcancePaginas
  readonly expresion: string
  readonly indices: readonly number[]
  readonly mensajeRango: string | null
  readonly conservarSaltosLinea: boolean
  readonly separadoresPagina: boolean
  readonly procesando: boolean
  readonly progreso: ProgresoMarkdown | null
  readonly contenido: string
  readonly contieneTexto: boolean | null
  readonly cancelado: boolean
  readonly mensajeError: string | null
  readonly puedeConvertir: boolean
  readonly cambiarAlcance: (alcance: AlcancePaginas) => void
  readonly cambiarExpresion: (expresion: string) => void
  readonly cambiarSaltosLinea: (conservar: boolean) => void
  readonly cambiarSeparadores: (conservar: boolean) => void
  readonly cambiarContenido: (contenido: string) => void
  readonly convertir: () => void
  readonly cancelar: () => void
  readonly copiar: () => Promise<boolean>
  readonly descargar: () => void
  readonly limpiar: () => void
}

export function usePdfAMarkdown(
  documento: DocumentoCargado | null,
): ControladorPdfAMarkdown {
  const [alcance, establecerAlcance] = useState<AlcancePaginas>('todas')
  const [expresion, establecerExpresion] = useState('')
  const [conservarSaltos, establecerConservarSaltos] = useState(false)
  const [separadores, establecerSeparadores] = useState(true)
  const [procesando, establecerProcesando] = useState(false)
  const [progreso, establecerProgreso] = useState<ProgresoMarkdown | null>(null)
  const [estructura, establecerEstructura] =
    useState<DocumentoEstructurado | null>(null)
  const [contenido, establecerContenido] = useState('')
  const [cancelado, establecerCancelado] = useState(false)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const refControlador = useRef<AbortController | null>(null)

  const seleccion = useMemo(
    () =>
      interpretarAlcance(
        alcance,
        documento?.numeroPaginas ?? 0,
        expresion,
      ),
    [alcance, documento?.numeroPaginas, expresion],
  )

  const regenerar = useCallback(
    (
      siguiente: DocumentoEstructurado,
      saltos = conservarSaltos,
      paginas = separadores,
    ): void => {
      establecerContenido(
        generarMarkdown(siguiente, {
          conservarSaltosLinea: saltos,
          separadoresPagina: paginas,
        }),
      )
    },
    [conservarSaltos, separadores],
  )

  useEffect(() => {
    return () => refControlador.current?.abort()
  }, [])

  useEffect(() => {
    refControlador.current?.abort()
    establecerEstructura(null)
    establecerContenido('')
    establecerProgreso(null)
    establecerCancelado(false)
    establecerMensajeError(null)
    establecerAlcance('todas')
    establecerExpresion('')
  }, [documento?.seleccionado.id])

  const cambiarSaltosLinea = useCallback(
    (conservar: boolean): void => {
      establecerConservarSaltos(conservar)
      if (estructura !== null) regenerar(estructura, conservar, separadores)
    },
    [estructura, regenerar, separadores],
  )

  const cambiarSeparadores = useCallback(
    (conservar: boolean): void => {
      establecerSeparadores(conservar)
      if (estructura !== null) regenerar(estructura, conservarSaltos, conservar)
    },
    [conservarSaltos, estructura, regenerar],
  )

  const cancelar = useCallback((): void => refControlador.current?.abort(), [])

  const convertir = useCallback((): void => {
    if (
      documento === null ||
      procesando ||
      seleccion.indices.length === 0 ||
      seleccion.mensajeError !== null
    ) {
      return
    }

    const controlador = new AbortController()
    refControlador.current = controlador
    establecerProcesando(true)
    establecerProgreso(null)
    establecerEstructura(null)
    establecerContenido('')
    establecerCancelado(false)
    establecerMensajeError(null)

    void (async () => {
      try {
        const paginas = await extraerTextoPdf(
          documento.abierto.documento,
          seleccion.indices,
          {
            senal: controlador.signal,
            alProgreso: establecerProgreso,
          },
        )
        const siguiente = deducirEstructura(paginas)
        establecerEstructura(siguiente)
        regenerar(siguiente)
      } catch (error) {
        if (esCancelacion(error) || controlador.signal.aborted) {
          establecerCancelado(true)
        } else {
          establecerMensajeError(
            obtenerMensajeError(
              error,
              'No se pudo extraer el texto del documento.',
            ),
          )
        }
      } finally {
        if (refControlador.current === controlador) {
          refControlador.current = null
        }
        establecerProcesando(false)
      }
    })()
  }, [documento, procesando, regenerar, seleccion])

  const copiar = useCallback(async (): Promise<boolean> => {
    if (contenido === '' || navigator.clipboard === undefined) return false
    try {
      await navigator.clipboard.writeText(contenido)
      return true
    } catch {
      return false
    }
  }, [contenido])

  const descargar = useCallback((): void => {
    if (contenido === '') return
    descargarBlob(crearArchivoMarkdown(contenido), 'free-pdf.md')
  }, [contenido])

  const limpiar = useCallback((): void => {
    refControlador.current?.abort()
    establecerEstructura(null)
    establecerContenido('')
    establecerProgreso(null)
    establecerCancelado(false)
    establecerMensajeError(null)
  }, [])

  return {
    alcance,
    expresion,
    indices: seleccion.indices,
    mensajeRango: seleccion.mensajeError,
    conservarSaltosLinea: conservarSaltos,
    separadoresPagina: separadores,
    procesando,
    progreso,
    contenido,
    contieneTexto: estructura?.contieneTexto ?? null,
    cancelado,
    mensajeError,
    puedeConvertir:
      documento !== null &&
      !procesando &&
      seleccion.indices.length > 0 &&
      seleccion.mensajeError === null,
    cambiarAlcance: establecerAlcance,
    cambiarExpresion: establecerExpresion,
    cambiarSaltosLinea,
    cambiarSeparadores,
    cambiarContenido: establecerContenido,
    convertir,
    cancelar,
    copiar,
    descargar,
    limpiar,
  }
}

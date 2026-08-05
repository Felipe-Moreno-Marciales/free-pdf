import { useCallback, useEffect, useRef, useState } from 'react'
import { validarArchivoImagen } from '../../imagenes/validarImagen'
import { esCancelacion } from '../../pdf/cancelacion'
import type { IdiomaOcr } from '../../ocr/motorOcr'
import {
  procesarOcr,
  type ProgresoOcr,
  type ResultadoOcr,
} from '../../ocr/procesarOcr'
import { descargarBlob } from '../../utilidades/descargarArchivo'
import { obtenerMensajeError } from '../../utilidades/errores'
import { construirIdArchivo, esArchivoPdf } from '../../utilidades/validacionArchivos'
import { validarArchivoPdf } from '../../pdf/validarDocumentoPdf'

export interface ControladorOcrLocal {
  readonly archivos: readonly File[]
  readonly idioma: IdiomaOcr
  readonly procesando: boolean
  readonly progreso: ProgresoOcr | null
  readonly resultado: ResultadoOcr | null
  readonly contenido: string
  readonly cancelado: boolean
  readonly mensajeError: string | null
  readonly mensajeAviso: string | null
  readonly seleccionar: (archivos: readonly File[]) => void
  readonly quitar: (indice: number) => void
  readonly cambiarIdioma: (idioma: IdiomaOcr) => void
  readonly cambiarContenido: (contenido: string) => void
  readonly reconocer: () => void
  readonly cancelar: () => void
  readonly descargarTxt: () => void
  readonly descargarMarkdown: () => void
  readonly restablecer: () => void
}

function validarSeleccion(archivos: readonly File[]): {
  readonly validos: readonly File[]
  readonly aviso: string | null
} {
  const validos: File[] = []
  const errores: string[] = []

  for (const archivo of archivos) {
    if (esArchivoPdf(archivo)) {
      const validacion = validarArchivoPdf(archivo)
      if (validacion.valido) validos.push(archivo)
      else if (validacion.mensaje !== null) errores.push(validacion.mensaje)
      continue
    }
    const validacion = validarArchivoImagen(archivo)
    if (validacion.valido) validos.push(archivo)
    else if (validacion.mensaje !== null) errores.push(validacion.mensaje)
  }

  const pdf = validos.find(esArchivoPdf)
  if (pdf !== undefined) {
    return {
      validos: [pdf],
      aviso:
        validos.length > 1
          ? `Se abrió solo «${pdf.name}»: un PDF se procesa solo para controlar el consumo de memoria.`
          : errores[0] ?? null,
    }
  }

  const sinDuplicados = validos.filter(
    (archivo, indice, todos) =>
      todos.findIndex(
        (candidato) =>
          construirIdArchivo(candidato) === construirIdArchivo(archivo),
      ) === indice,
  )
  const omitidos = validos.length - sinDuplicados.length

  return {
    validos: sinDuplicados,
    aviso:
      errores[0] ??
      (omitidos > 0
        ? `Se omitieron ${omitidos} ${
            omitidos === 1 ? 'imagen duplicada' : 'imágenes duplicadas'
          }.`
        : null),
  }
}

/** Estado de la herramienta OCR y destrucción al salir. */
export function useOcrLocal(): ControladorOcrLocal {
  const [archivos, establecerArchivos] = useState<readonly File[]>([])
  const [idioma, establecerIdioma] = useState<IdiomaOcr>('espanol')
  const [procesando, establecerProcesando] = useState(false)
  const [progreso, establecerProgreso] = useState<ProgresoOcr | null>(null)
  const [resultado, establecerResultado] = useState<ResultadoOcr | null>(null)
  const [contenido, establecerContenido] = useState('')
  const [cancelado, establecerCancelado] = useState(false)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const [mensajeAviso, establecerMensajeAviso] = useState<string | null>(null)
  const refControlador = useRef<AbortController | null>(null)

  useEffect(() => () => refControlador.current?.abort(), [])

  const limpiarResultado = useCallback((): void => {
    establecerResultado(null)
    establecerContenido('')
    establecerProgreso(null)
    establecerCancelado(false)
    establecerMensajeError(null)
  }, [])

  const seleccionar = useCallback(
    (nuevos: readonly File[]): void => {
      const seleccion = validarSeleccion([...archivos, ...nuevos])
      establecerArchivos(seleccion.validos)
      establecerMensajeAviso(seleccion.aviso)
      limpiarResultado()
    },
    [archivos, limpiarResultado],
  )

  const quitar = useCallback(
    (indice: number): void => {
      establecerArchivos((actuales) =>
        actuales.filter((_archivo, posicion) => posicion !== indice),
      )
      limpiarResultado()
    },
    [limpiarResultado],
  )

  const cancelar = useCallback((): void => refControlador.current?.abort(), [])

  const reconocer = useCallback((): void => {
    if (archivos.length === 0 || procesando) return
    const controlador = new AbortController()
    refControlador.current = controlador
    establecerProcesando(true)
    establecerProgreso(null)
    establecerResultado(null)
    establecerContenido('')
    establecerCancelado(false)
    establecerMensajeError(null)
    establecerMensajeAviso(null)

    void (async () => {
      try {
        const siguiente = await procesarOcr(
          archivos,
          idioma,
          controlador.signal,
          establecerProgreso,
        )
        establecerResultado(siguiente)
        establecerContenido(siguiente.texto)
      } catch (error) {
        if (esCancelacion(error) || controlador.signal.aborted) {
          establecerCancelado(true)
        } else {
          establecerMensajeError(
            obtenerMensajeError(
              error,
              'No se pudo reconocer el texto. Comprueba los archivos y vuelve a intentarlo.',
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
  }, [archivos, idioma, procesando])

  const descargarTxt = useCallback((): void => {
    if (resultado === null) return
    descargarBlob(
      new Blob([`${contenido.trim()}\n`], {
        type: 'text/plain;charset=utf-8',
      }),
      'free-pdf-ocr.txt',
    )
  }, [contenido, resultado])

  const descargarMarkdown = useCallback((): void => {
    if (resultado === null) return
    descargarBlob(
      new Blob([`# Texto reconocido\n\n${contenido.trim()}\n`], {
        type: 'text/markdown;charset=utf-8',
      }),
      'free-pdf-ocr.md',
    )
  }, [contenido, resultado])

  const restablecer = useCallback((): void => {
    refControlador.current?.abort()
    establecerArchivos([])
    establecerIdioma('espanol')
    establecerProcesando(false)
    establecerMensajeAviso(null)
    limpiarResultado()
  }, [limpiarResultado])

  return {
    archivos,
    idioma,
    procesando,
    progreso,
    resultado,
    contenido,
    cancelado,
    mensajeError,
    mensajeAviso,
    seleccionar,
    quitar,
    cambiarIdioma: (siguiente) => {
      establecerIdioma(siguiente)
      limpiarResultado()
    },
    cambiarContenido: establecerContenido,
    reconocer,
    cancelar,
    descargarTxt,
    descargarMarkdown,
    restablecer,
  }
}

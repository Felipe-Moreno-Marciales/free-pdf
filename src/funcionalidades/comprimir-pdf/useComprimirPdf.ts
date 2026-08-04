import { useCallback, useEffect, useState } from 'react'
import { crearAdaptadorNavegador } from '../../compresion/adaptadorNavegador'
import {
  comprimirDocumento,
  type ProgresoCompresion,
  type ResultadoCompresion,
} from '../../compresion/comprimirDocumento'
import type { PerfilCompresion } from '../../compresion/imagenesPdf'
import {
  describirMetadatos,
  hayMetadatos,
  leerMetadatos,
  type MetadatosDocumento,
} from '../../compresion/metadatosPdf'
import { useProcesadorQpdf } from '../../ganchos/useProcesadorQpdf'
import { cargarPdfLib } from '../../pdf/cargarDocumentoPdf'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta, PdfSeleccionado } from '../../pdf/tipos'
import { validarArchivoPdf } from '../../pdf/validarDocumentoPdf'
import { descargarBlob } from '../../utilidades/descargarArchivo'
import { obtenerMensajeError } from '../../utilidades/errores'
import { construirIdArchivo } from '../../utilidades/validacionArchivos'

/** Estado y acciones de la herramienta «Comprimir PDF». */
export interface ControladorComprimirPdf {
  readonly documento: PdfSeleccionado | null
  readonly perfil: PerfilCompresion
  readonly borrarMetadatos: boolean
  /** Metadatos del documento cargado, o `null` si todavía no se han leído. */
  readonly metadatos: MetadatosDocumento | null
  /** Filas de metadatos para mostrarlas. */
  readonly filasMetadatos: readonly {
    readonly clave: string
    readonly valor: string
  }[]
  readonly procesando: boolean
  readonly progreso: ProgresoCompresion | null
  readonly resultado: ResultadoCompresion | null
  readonly cancelado: boolean
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  readonly mensajeAviso: string | null
  readonly puedeComprimir: boolean
  /** `true` cuando hay un archivo que se puede descargar. */
  readonly hayDescarga: boolean
  readonly seleccionarArchivos: (archivos: readonly File[]) => void
  readonly cambiarPerfil: (perfil: PerfilCompresion) => void
  readonly cambiarBorrarMetadatos: (borrar: boolean) => void
  readonly comprimir: () => void
  readonly cancelar: () => void
  readonly descargar: () => void
  readonly restablecer: () => void
}

/**
 * Concentra el estado de la herramienta «Comprimir PDF».
 *
 * No usa el gancho genérico de proceso porque esta herramienta necesita dos cosas que
 * aquel no da: **progreso por etapas** —analizar, imágenes, estructura, comprobar— y
 * **cancelación**, además de un desenlace en el que legítimamente no hay archivo que
 * descargar.
 *
 * Los metadatos se leen al cargar el documento, para poder mostrar exactamente qué se
 * borraría antes de decidirlo. Nadie debería aceptar borrar algo sin ver qué es.
 */
export function useComprimirPdf(): ControladorComprimirPdf {
  const procesador = useProcesadorQpdf()

  const [documento, establecerDocumento] = useState<PdfSeleccionado | null>(null)
  const [perfil, establecerPerfil] = useState<PerfilCompresion>('equilibrada')
  const [borrar, establecerBorrar] = useState(false)
  const [metadatos, establecerMetadatos] = useState<MetadatosDocumento | null>(
    null,
  )
  const [procesando, establecerProcesando] = useState(false)
  const [progreso, establecerProgreso] = useState<ProgresoCompresion | null>(
    null,
  )
  const [resultado, establecerResultado] = useState<ResultadoCompresion | null>(
    null,
  )
  const [cancelado, establecerCancelado] = useState(false)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const [mensajeAviso, establecerMensajeAviso] = useState<string | null>(null)
  const [controlador, establecerControlador] =
    useState<AbortController | null>(null)

  // El trabajador de qpdf se destruye al salir de la herramienta.
  useEffect(() => procesador.destruir, [procesador])

  const seleccionarArchivos = useCallback(
    (archivos: readonly File[]): void => {
      const primero = archivos[0]

      if (primero === undefined) {
        return
      }

      const validacion = validarArchivoPdf(primero)

      if (!validacion.valido) {
        establecerMensajeError(validacion.motivo)
        return
      }

      establecerMensajeError(null)
      establecerMensajeAviso(
        archivos.length > 1
          ? 'Solo se comprime un documento a la vez, así que se ha tomado el primero.'
          : null,
      )
      establecerResultado(null)
      establecerCancelado(false)
      establecerProgreso(null)
      establecerMetadatos(null)

      establecerDocumento({
        id: construirIdArchivo(primero),
        archivo: primero,
        nombre: primero.name,
        tamano: primero.size,
      })

      // Los metadatos se leen aparte para poder enseñarlos antes de decidir.
      void (async () => {
        try {
          const pdfLib = await cargarPdfLib()
          const abierto = await pdfLib.PDFDocument.load(
            new Uint8Array(await primero.arrayBuffer()),
            { ignoreEncryption: false },
          )

          establecerMetadatos(leerMetadatos(abierto))
        } catch {
          // No poder leerlos no impide comprimir; simplemente no se ofrece borrarlos.
          establecerMetadatos(null)
        }
      })()
    },
    [],
  )

  const cambiarPerfil = useCallback((siguiente: PerfilCompresion): void => {
    establecerPerfil(siguiente)
    establecerResultado(null)
  }, [])

  const cambiarBorrarMetadatos = useCallback((siguiente: boolean): void => {
    establecerBorrar(siguiente)
    establecerResultado(null)
  }, [])

  const cancelar = useCallback((): void => {
    controlador?.abort()
  }, [controlador])

  const comprimir = useCallback((): void => {
    if (documento === null || procesando) {
      return
    }

    const propio = new AbortController()

    establecerControlador(propio)
    establecerProcesando(true)
    establecerResultado(null)
    establecerCancelado(false)
    establecerMensajeError(null)
    establecerProgreso(null)

    void (async () => {
      try {
        const generado = await comprimirDocumento(
          {
            archivo: documento.archivo,
            perfil,
            borrarMetadatos: borrar,
          },
          {
            procesador: procesador.obtener(),
            adaptador: crearAdaptadorNavegador(),
            senal: propio.signal,
            alProgreso: establecerProgreso,
          },
        )

        establecerResultado(generado)

        // La descarga solo se lanza si de verdad hay un archivo más pequeño.
        if (generado.blob !== null) {
          descargarBlob(generado.blob, generado.nombreArchivo)
        }
      } catch (error) {
        if (propio.signal.aborted) {
          establecerCancelado(true)
        } else {
          establecerMensajeError(
            obtenerMensajeError(
              error,
              'No se pudo comprimir el documento. Vuelve a intentarlo.',
            ),
          )
        }
      } finally {
        establecerProcesando(false)
        establecerProgreso(null)
        establecerControlador(null)
      }
    })()
  }, [borrar, documento, perfil, procesador, procesando])

  const descargar = useCallback((): void => {
    if (resultado?.blob === null || resultado === null) {
      return
    }

    descargarBlob(resultado.blob, resultado.nombreArchivo)
  }, [resultado])

  const restablecer = useCallback((): void => {
    controlador?.abort()
    establecerDocumento(null)
    establecerPerfil('equilibrada')
    establecerBorrar(false)
    establecerMetadatos(null)
    establecerResultado(null)
    establecerProgreso(null)
    establecerCancelado(false)
    establecerMensajeError(null)
    establecerMensajeAviso(null)
  }, [controlador])

  const estado = calcularEstadoHerramienta({
    hayDocumento: documento !== null,
    cargando: false,
    procesando,
    hayResultado: resultado !== null,
    hayError: mensajeError !== null,
  })

  return {
    documento,
    perfil,
    borrarMetadatos: borrar,
    metadatos,
    filasMetadatos: metadatos === null ? [] : describirMetadatos(metadatos),
    procesando,
    progreso,
    resultado,
    cancelado,
    estado,
    bloqueado: procesando,
    mensajeError,
    mensajeAviso,
    puedeComprimir: documento !== null && !procesando,
    hayDescarga: resultado?.blob !== null && resultado !== null,
    seleccionarArchivos,
    cambiarPerfil,
    cambiarBorrarMetadatos,
    comprimir,
    cancelar,
    descargar,
    restablecer,
  }
}

/** `true` cuando merece la pena ofrecer el borrado de metadatos. */
export function convieneOfrecerBorrado(
  metadatos: MetadatosDocumento | null,
): boolean {
  return metadatos !== null && hayMetadatos(metadatos)
}

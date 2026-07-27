import { useCallback, useRef, useState } from 'react'
import { descargarBlob } from '../../utilidades/descargarArchivo'
import { obtenerMensajeError } from '../../utilidades/errores'
import { MINIMO_ARCHIVOS_PARA_UNIR, unirArchivosPdf } from './unirPdf'
import {
  anadirArchivosASeleccion,
  calcularTamanoTotal,
  describirDescartes,
  eliminarArchivoDeSeleccion,
  moverArchivoEnSeleccion,
} from './seleccion'
import type {
  ArchivoDescartado,
  DireccionMovimiento,
  EstadoUnion,
  PdfSeleccionado,
  ResultadoUnion,
} from './tipos'

/** Texto de reserva cuando el error no aporta ningún mensaje aprovechable. */
const ERROR_INESPERADO =
  'No se pudo completar la unión por un error inesperado. Vuelve a intentarlo.'

/** Estado y acciones de la herramienta de unión de PDF. */
export interface ControladorUnirPdf {
  /** Archivos seleccionados, en el orden en que se unirán. */
  readonly archivos: readonly PdfSeleccionado[]
  /** Tamaño total de la selección en bytes. */
  readonly tamanoTotal: number
  /** Estado del proceso de unión. */
  readonly estado: EstadoUnion
  /** `true` mientras se está uniendo. */
  readonly estaUniendo: boolean
  /** `true` cuando hay archivos suficientes y no hay una unión en curso. */
  readonly puedeUnir: boolean
  /** Mensaje de error para la interfaz, o `null` si no hay error. */
  readonly mensajeError: string | null
  /** Aviso informativo sobre la última selección, o `null`. */
  readonly mensajeAviso: string | null
  /** Documento resultante de la última unión correcta, o `null`. */
  readonly resultado: ResultadoUnion | null
  /** Añade archivos al final de la selección. */
  readonly anadirArchivos: (entrantes: readonly File[]) => void
  /** Mueve un archivo una posición hacia arriba o hacia abajo. */
  readonly moverArchivo: (id: string, direccion: DireccionMovimiento) => void
  /** Quita un archivo de la selección. */
  readonly eliminarArchivo: (id: string) => void
  /** Vacía la selección completa. */
  readonly limpiarSeleccion: () => void
  /** Inicia la unión de los archivos seleccionados. */
  readonly unir: () => void
  /** Vuelve a descargar el resultado de la última unión. */
  readonly descargarResultado: () => void
}

/**
 * Concentra el estado de la herramienta de unión.
 *
 * La lógica de negocio vive en `unirPdf.ts` y `seleccion.ts`; aquí solo se
 * coordinan los cambios de estado y los mensajes que verá la persona que usa
 * la aplicación. Los documentos se mantienen únicamente en memoria: no se
 * guarda nada en `localStorage` ni en `sessionStorage`.
 */
export function useUnirPdf(): ControladorUnirPdf {
  const [archivos, establecerArchivos] = useState<readonly PdfSeleccionado[]>([])
  const [estado, establecerEstado] = useState<EstadoUnion>('inactivo')
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const [mensajeAviso, establecerMensajeAviso] = useState<string | null>(null)
  const [resultado, establecerResultado] = useState<ResultadoUnion | null>(null)

  // Impide que se lancen dos uniones a la vez aunque se active el botón dos
  // veces antes de que React vuelva a renderizar.
  const refEnEjecucion = useRef(false)

  const estaUniendo = estado === 'uniendo'
  const puedeUnir = !estaUniendo && archivos.length >= MINIMO_ARCHIVOS_PARA_UNIR

  /** Descarta el resultado anterior porque la selección ha cambiado. */
  const descartarResultado = useCallback((): void => {
    establecerEstado('inactivo')
    establecerMensajeError(null)
    establecerResultado(null)
  }, [])

  const anadirArchivos = useCallback(
    (entrantes: readonly File[]): void => {
      if (refEnEjecucion.current || entrantes.length === 0) {
        return
      }

      const actualizacion = anadirArchivosASeleccion(archivos, entrantes)
      establecerArchivos(actualizacion.archivos)
      establecerMensajeAviso(
        construirAvisoSeleccion(
          actualizacion.numeroAnadidos,
          actualizacion.descartados,
        ),
      )
      descartarResultado()
    },
    [archivos, descartarResultado],
  )

  const moverArchivo = useCallback(
    (id: string, direccion: DireccionMovimiento): void => {
      if (refEnEjecucion.current) {
        return
      }

      establecerArchivos((actual) =>
        moverArchivoEnSeleccion(actual, id, direccion),
      )
      establecerMensajeAviso(null)
      descartarResultado()
    },
    [descartarResultado],
  )

  const eliminarArchivo = useCallback(
    (id: string): void => {
      if (refEnEjecucion.current) {
        return
      }

      establecerArchivos((actual) => eliminarArchivoDeSeleccion(actual, id))
      establecerMensajeAviso(null)
      descartarResultado()
    },
    [descartarResultado],
  )

  const limpiarSeleccion = useCallback((): void => {
    if (refEnEjecucion.current) {
      return
    }

    establecerArchivos([])
    establecerMensajeAviso('Se vació la selección de archivos.')
    descartarResultado()
  }, [descartarResultado])

  const unir = useCallback((): void => {
    if (refEnEjecucion.current || archivos.length < MINIMO_ARCHIVOS_PARA_UNIR) {
      return
    }

    refEnEjecucion.current = true
    establecerEstado('uniendo')
    establecerMensajeError(null)
    establecerMensajeAviso(null)
    establecerResultado(null)

    const ejecutar = async (): Promise<void> => {
      try {
        const unido = await unirArchivosPdf(archivos)
        establecerResultado(unido)
        establecerEstado('completado')
        // La descarga se inicia sola; el botón permite repetirla si el
        // navegador la bloquea o si se cierra por error.
        descargarBlob(unido.blob, unido.nombreArchivo)
      } catch (error) {
        establecerMensajeError(obtenerMensajeError(error, ERROR_INESPERADO))
        establecerEstado('error')
      } finally {
        refEnEjecucion.current = false
      }
    }

    void ejecutar()
  }, [archivos])

  const descargarResultado = useCallback((): void => {
    if (resultado === null) {
      return
    }

    descargarBlob(resultado.blob, resultado.nombreArchivo)
  }, [resultado])

  return {
    archivos,
    tamanoTotal: calcularTamanoTotal(archivos),
    estado,
    estaUniendo,
    puedeUnir,
    mensajeError,
    mensajeAviso,
    resultado,
    anadirArchivos,
    moverArchivo,
    eliminarArchivo,
    limpiarSeleccion,
    unir,
    descargarResultado,
  }
}

/** Redacta el aviso que resume la última incorporación de archivos. */
function construirAvisoSeleccion(
  numeroAnadidos: number,
  descartados: readonly ArchivoDescartado[],
): string | null {
  const avisoDescartes = describirDescartes(descartados)

  if (numeroAnadidos === 0) {
    return avisoDescartes ?? 'No se añadió ningún archivo nuevo.'
  }

  const avisoAnadidos =
    numeroAnadidos === 1
      ? 'Se añadió 1 archivo PDF.'
      : `Se añadieron ${numeroAnadidos} archivos PDF.`

  return avisoDescartes === null
    ? avisoAnadidos
    : `${avisoAnadidos} ${avisoDescartes}`
}

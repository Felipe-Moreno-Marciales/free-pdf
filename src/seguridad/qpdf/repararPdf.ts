import { crearBlobPdf } from '../../pdf/guardarDocumentoPdf'
import type { ProcesadorQpdf } from './crearProcesadorQpdf'
import {
  explicarResultado,
  NOMBRE_REPARADO,
  type DiagnosticoPdf,
  type NivelReparacion,
  type ResumenReparacion,
} from './reparacionPdf'

/**
 * Operación de alto nivel de la herramienta «Reparar PDF».
 *
 * Aquí se junta lo que el trabajador devuelve con lo que la interfaz necesita. La
 * decisión de si una reparación sirve la toma el trabajador, que es quien tiene los
 * datos; esta capa solo prepara el archivo para descargarlo y redacta el resumen.
 */

/** Resultado de diagnosticar un documento, listo para mostrarlo. */
export interface DiagnosticoDocumento {
  readonly diagnostico: DiagnosticoPdf
  /** Páginas contadas, o `null` si el archivo no permitió contarlas. */
  readonly numeroPaginas: number | null
}

/** Resultado de reparar, listo para descargarlo. */
export interface ResultadoReparacion {
  readonly blob: Blob
  readonly nombreArchivo: string
  readonly tamano: number
  /** Tamaño del archivo original, para poder comparar. */
  readonly tamanoOriginal: number
  readonly numeroPaginas: number
  readonly resumen: ResumenReparacion
  /** Explicación en prosa del desenlace, incluidas las pérdidas. */
  readonly explicacion: string
}

/** Comprueba el estado de un documento sin modificarlo. */
export async function diagnosticarPdf(
  procesador: ProcesadorQpdf,
  archivo: File,
): Promise<DiagnosticoDocumento> {
  const contenido = new Uint8Array(await archivo.arrayBuffer())

  return await procesador.diagnosticar(contenido)
}

/**
 * Repara un documento y devuelve el resultado.
 *
 * No se comprueba aquí si la reparación mereció la pena: eso ya lo decidió el
 * trabajador, que rechaza entregar un documento sin páginas. Repetir la comprobación
 * en dos sitios acabaría con las dos versiones divergiendo.
 */
export async function repararPdf(
  procesador: ProcesadorQpdf,
  archivo: File,
  nivel: NivelReparacion,
): Promise<ResultadoReparacion> {
  const tamanoOriginal = archivo.size
  const contenido = new Uint8Array(await archivo.arrayBuffer())

  const { contenido: reparado, resumen } = await procesador.reparar(
    contenido,
    nivel,
  )

  return {
    blob: crearBlobPdf(reparado),
    nombreArchivo: NOMBRE_REPARADO,
    tamano: reparado.byteLength,
    tamanoOriginal,
    numeroPaginas: resumen.paginasDespues,
    resumen,
    explicacion: explicarResultado(resumen),
  }
}

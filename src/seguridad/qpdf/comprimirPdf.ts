import { crearBlobPdf } from '../../pdf/guardarDocumentoPdf'
import {
  detectarImagenesIntocables,
  explicarCompresion,
  NOMBRE_COMPRIMIDO,
  seEntregaElComprimido,
  type PerfilCompresion,
  type ResumenCompresion,
} from './compresionPdf'
import type { ProcesadorQpdf } from './crearProcesadorQpdf'

/**
 * Operación de alto nivel de la herramienta «Comprimir PDF».
 *
 * **El original nunca se modifica.** Se lee, se manda una copia de sus bytes al
 * trabajador y el archivo que la persona eligió sigue exactamente igual en su
 * dispositivo. Esta herramienta solo puede producir un archivo nuevo.
 */

/** Resultado de comprimir, listo para la interfaz. */
export interface ResultadoCompresion {
  /**
   * Documento comprimido, o `null` cuando no se entrega.
   *
   * Es `null` si el resultado no era menor. No es un fallo: es el desenlace correcto
   * de un documento ya optimizado, y el resumen dice cuál fue.
   */
  readonly blob: Blob | null
  readonly nombreArchivo: string
  readonly tamano: number
  readonly resumen: ResumenCompresion
  /** Explicación en español del desenlace, que es el texto principal. */
  readonly explicacion: string
}

/** Comprime un documento sin tocar el original. */
export async function comprimirPdf(
  procesador: ProcesadorQpdf,
  archivo: File,
  perfil: PerfilCompresion,
): Promise<ResultadoCompresion> {
  const contenido = new Uint8Array(await archivo.arrayBuffer())

  const { contenido: comprimido, resumen } = await procesador.comprimir(
    contenido,
    perfil,
  )

  return {
    blob: comprimido === null ? null : crearBlobPdf(comprimido),
    nombreArchivo: NOMBRE_COMPRIMIDO,
    tamano: resumen.tamanoResultante,
    resumen,
    explicacion: explicarCompresion(resumen),
  }
}

/** `true` cuando el resultado se puede descargar. */
export function hayDescarga(resultado: ResultadoCompresion): boolean {
  return resultado.blob !== null && seEntregaElComprimido(resultado.resumen.desenlace)
}

/**
 * Comprueba si un documento tiene imágenes que la compresión no va a tocar.
 *
 * Se hace **antes** de comprimir, para poder avisar de antemano. Quien tiene un PDF de
 * veinte megabytes de fotografías merece saber que esta herramienta no es la que va a
 * resolverlo, en lugar de descubrirlo tras esperar y ver un 1 %.
 */
export async function tieneImagenesIntocables(archivo: File): Promise<boolean> {
  // Solo se lee el principio: los diccionarios de imagen aparecen repartidos por el
  // documento y no hace falta traer cien megabytes a memoria para encontrar uno.
  const trozo = archivo.slice(0, Math.min(archivo.size, 1_048_576))

  return detectarImagenesIntocables(new Uint8Array(await trozo.arrayBuffer()))
}

import { esArchivoPdf } from '../utilidades/validacionArchivos'
import type { MotivoDescarte } from './tipos'

/** Resultado de comprobar si un archivo se puede abrir como documento PDF. */
export interface ResultadoValidacion {
  /** `true` cuando el archivo se puede procesar. */
  readonly valido: boolean
  /** Motivo del rechazo, o `null` si el archivo es válido. */
  readonly motivo: MotivoDescarte | null
  /** Mensaje en español listo para mostrar, o `null` si el archivo es válido. */
  readonly mensaje: string | null
}

/** Resultado reutilizable para los archivos que sí son válidos. */
const VALIDO: ResultadoValidacion = { valido: true, motivo: null, mensaje: null }

/**
 * Comprueba que un archivo se pueda tratar como documento PDF.
 *
 * Se exige la extensión `.pdf`, un tipo MIME compatible cuando el navegador lo
 * informa, y que el archivo no esté vacío. No se lee el contenido: eso ocurre
 * más adelante, al abrirlo con pdf-lib o con PDF.js.
 */
export function validarArchivoPdf(archivo: File): ResultadoValidacion {
  if (!esArchivoPdf(archivo)) {
    return {
      valido: false,
      motivo: 'no-es-pdf',
      mensaje: `«${archivo.name}» no es un archivo PDF. Solo se aceptan archivos con extensión .pdf.`,
    }
  }

  if (archivo.size === 0) {
    return {
      valido: false,
      motivo: 'vacio',
      mensaje: `«${archivo.name}» está vacío, así que no se puede procesar.`,
    }
  }

  return VALIDO
}

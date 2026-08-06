import { liberarLienzo } from '../pdf/liberarDocumentoPdf'
import type { ImagenDescodificada } from './tipos'

/**
 * Liberación de la memoria que ocupan las imágenes.
 *
 * Una fotografía de doce megapíxeles ocupa unos cuarenta y ocho megabytes
 * mientras está descodificada, así que se libera en cuanto deja de hacer falta
 * en lugar de esperar al recolector de basura.
 *
 * `liberarLienzo` se reexporta desde el módulo de PDF, donde ya existía, para
 * que el código de imágenes no necesite conocer esa ruta.
 */
export { liberarLienzo }

/** Libera una imagen descodificada, ignorando los fallos. */
export function liberarImagenDescodificada(
  imagen: ImagenDescodificada | null,
): void {
  if (imagen === null) {
    return
  }

  try {
    imagen.liberar()
  } catch {
    // La imagen ya estaba liberada; no hay nada que corregir.
  }
}

/** Revoca una URL temporal creada con `URL.createObjectURL`. */
export function liberarUrlTemporal(url: string | null): void {
  if (url === null || url === '') {
    return
  }

  try {
    URL.revokeObjectURL(url)
  } catch {
    // La URL ya estaba revocada.
  }
}

/** Revoca varias URL temporales de una vez. */
export function liberarUrlesTemporales(
  urles: Iterable<string | null>,
): void {
  for (const url of urles) {
    liberarUrlTemporal(url)
  }
}

/** Vacía varios lienzos de una vez. */
export function liberarLienzos(
  lienzos: Iterable<HTMLCanvasElement | null>,
): void {
  for (const lienzo of lienzos) {
    if (lienzo !== null) {
      liberarLienzo(lienzo)
    }
  }
}

import type { DocumentoPdfJs } from './renderizarMiniaturaPdf'

/**
 * Libera un documento de PDF.js y el worker que lo atendía.
 *
 * Se llama al reemplazar el documento actual y al desmontar la herramienta, de
 * modo que no queden documentos anteriores ocupando memoria. Los fallos se
 * ignoran a propósito: si el documento ya estaba liberado no hay nada que
 * corregir y no debe interrumpirse la interfaz.
 */
export async function liberarDocumentoPdf(
  abierto: DocumentoPdfJs | null,
): Promise<void> {
  if (abierto === null) {
    return
  }

  try {
    await abierto.liberar()
  } catch {
    // El documento ya estaba liberado.
  }
}

/**
 * Vacía un `canvas` para que el navegador pueda recuperar su memoria.
 *
 * Una miniatura grande puede ocupar varios megabytes, así que el lienzo se
 * reduce a cero cuando la miniatura deja de mostrarse.
 */
export function liberarLienzo(lienzo: HTMLCanvasElement): void {
  lienzo.width = 0
  lienzo.height = 0
}

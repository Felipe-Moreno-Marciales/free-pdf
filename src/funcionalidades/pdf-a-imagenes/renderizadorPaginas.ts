import type { PDFDocumentProxy } from 'pdfjs-dist'
import { lienzoABytes } from '../../imagenes/convertirCanvas'
import { liberarLienzo } from '../../imagenes/liberarImagen'
import { renderizarPaginaAEscala } from '../../pdf/renderizarPaginaCompleta'
import type { RenderizadorPagina } from './tipos'

/**
 * Adaptador que dibuja las páginas de verdad, con PDF.js y un `canvas`.
 *
 * Se crea a partir del documento ya abierto, así que no vuelve a leer el archivo
 * en cada página. El lienzo se vacía en cuanto se tienen los bytes: una página a
 * resolución muy alta ocupa decenas de megabytes y no puede quedarse esperando al
 * recolector de basura mientras se dibuja la siguiente.
 */
export function crearRenderizadorNavegador(
  documento: PDFDocumentProxy,
): RenderizadorPagina {
  return async (peticion) => {
    const senal = peticion.senal ?? new AbortController().signal

    const dibujada = await renderizarPaginaAEscala(
      documento,
      peticion.numeroPagina,
      peticion.escala,
      senal,
    )

    if (dibujada === null) {
      return null
    }

    try {
      const bytes = await lienzoABytes(
        dibujada.lienzo,
        peticion.formato,
        peticion.calidad,
      )

      return { bytes, ancho: dibujada.ancho, alto: dibujada.alto }
    } finally {
      liberarLienzo(dibujada.lienzo)
    }
  }
}

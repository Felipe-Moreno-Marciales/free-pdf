import type { PDFDocumentProxy } from 'pdfjs-dist'
import { crearLienzo, obtenerContexto } from '../imagenes/dibujarImagen'
import { liberarLienzo } from './liberarDocumentoPdf'
import { ErrorPdf } from './erroresPdf'

/**
 * Dibujado de una página completa a la escala que se pida.
 *
 * Es lo que necesita «PDF a imágenes»: mientras las miniaturas se ajustan a un
 * ancho fijo, aquí manda la resolución elegida. Se separa de las miniaturas
 * porque el consumo de memoria es muy distinto: una página A4 a la resolución más
 * alta ocupa más de cincuenta megabytes mientras se dibuja.
 */

/**
 * Número máximo de píxeles que se permite dibujar de una vez.
 *
 * Los navegadores limitan el área de un `canvas` —en torno a los 268 millones de
 * píxeles en los de escritorio y bastante menos en los móviles—, y superarlo
 * hace que el lienzo se quede en blanco sin avisar. Se comprueba antes y se
 * avisa con un mensaje comprensible.
 */
export const PIXELES_MAXIMOS_LIENZO = 40_000_000

/** Página ya dibujada, lista para convertirse en imagen. */
export interface PaginaDibujada {
  /** Lienzo con la página. Hay que vaciarlo al terminar. */
  readonly lienzo: HTMLCanvasElement
  /** Ancho en píxeles. */
  readonly ancho: number
  /** Alto en píxeles. */
  readonly alto: number
}

/**
 * Dibuja una página en un lienzo nuevo a la escala indicada.
 *
 * La escala se aplica sobre el tamaño natural de la página, donde 1 equivale a
 * 72 píxeles por pulgada. Se respeta la rotación que el propio documento declara.
 *
 * Devuelve `null` si la señal se cancela, de modo que la cancelación no se trata
 * como un error. Los recursos internos de la página se liberan siempre.
 */
export async function renderizarPaginaAEscala(
  documento: PDFDocumentProxy,
  numeroPagina: number,
  escala: number,
  senal: AbortSignal,
): Promise<PaginaDibujada | null> {
  if (senal.aborted) {
    return null
  }

  const pagina = await documento.getPage(numeroPagina)
  let lienzo: HTMLCanvasElement | null = null

  try {
    const vista = pagina.getViewport({ scale: escala })
    const ancho = Math.max(1, Math.round(vista.width))
    const alto = Math.max(1, Math.round(vista.height))

    if (ancho * alto > PIXELES_MAXIMOS_LIENZO) {
      throw new ErrorPdf(
        `La página ${numeroPagina} es demasiado grande para esta resolución. Elige una resolución menor.`,
      )
    }

    if (senal.aborted) {
      return null
    }

    lienzo = crearLienzo(ancho, alto)

    // Las páginas PDF no tienen fondo propio: si no se pinta, un PNG saldría
    // transparente y un JPEG con el fondo en negro. Se rellena de blanco, que es
    // lo que se ve al imprimir.
    const contexto = obtenerContexto(lienzo)
    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, ancho, alto)

    const tarea = pagina.render({ canvas: lienzo, viewport: vista })
    const cancelar = (): void => {
      tarea.cancel()
    }
    senal.addEventListener('abort', cancelar, { once: true })

    try {
      await tarea.promise
    } finally {
      senal.removeEventListener('abort', cancelar)
    }

    if (senal.aborted) {
      liberarLienzo(lienzo)
      return null
    }

    const dibujada: PaginaDibujada = { lienzo, ancho, alto }
    lienzo = null

    return dibujada
  } catch (error) {
    if (senal.aborted) {
      return null
    }

    if (error instanceof ErrorPdf) {
      throw error
    }

    throw new ErrorPdf(
      `No se pudo convertir la página ${numeroPagina} en imagen.`,
      { cause: error },
    )
  } finally {
    if (lienzo !== null) {
      liberarLienzo(lienzo)
    }
    await pagina.cleanup()
  }
}

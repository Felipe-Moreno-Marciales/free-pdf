import type { PDFDocumentProxy } from 'pdfjs-dist'
import { lienzoABytes } from '../../imagenes/convertirCanvas'
import { obtenerContexto } from '../../imagenes/dibujarImagen'
import { liberarLienzo } from '../../imagenes/liberarImagen'
import { interpretarColorConReserva, NEGRO } from '../../pdf/colores'
import { renderizarPaginaAEscala } from '../../pdf/renderizarPaginaCompleta'
import { calcularRectanguloPixeles } from './coordenadasCensura'
import type {
  AdaptadorCensura,
  AparienciaCensura,
  MedidasPaginaCensura,
  ZonaCensura,
} from './tipos'

/**
 * Adaptador de censura que trabaja de verdad, con PDF.js y un `canvas`.
 *
 * Aquí ocurre la parte que da sentido a toda la herramienta: la página se dibuja
 * como imagen y las zonas censuradas se pintan **sobre esos píxeles**. A partir de
 * ese momento, lo que había debajo ya no existe en la imagen resultante, y es esa
 * imagen —no el contenido original— la que se incrusta en el documento nuevo.
 */

/** Proporción del alto de la zona que ocupa el texto «CENSURADO». */
const PROPORCION_TEXTO = 0.6

/** Tamaño mínimo del texto de la zona, en píxeles. */
const TAMANO_MINIMO_TEXTO = 8

/**
 * Pinta las zonas censuradas sobre el lienzo.
 *
 * Se rellena el rectángulo por completo y, si se pidió, se escribe el texto encima.
 * El texto forma parte de los píxeles: no es una capa aparte que se pueda quitar.
 */
export function pintarZonas(
  contexto: CanvasRenderingContext2D,
  zonas: readonly ZonaCensura[],
  apariencia: AparienciaCensura,
  anchoPixeles: number,
  altoPixeles: number,
): void {
  const color = interpretarColorConReserva(apariencia.color, NEGRO)
  const relleno = `rgb(${Math.round(color.rojo * 255)} ${Math.round(
    color.verde * 255,
  )} ${Math.round(color.azul * 255)})`

  // El texto se escribe en el color opuesto para que se lea sobre el relleno.
  const luminancia = color.rojo * 0.2126 + color.verde * 0.7152 + color.azul * 0.0722
  const colorTexto = luminancia > 0.5 ? '#000000' : '#ffffff'

  const texto = apariencia.texto.trim()

  for (const zona of zonas) {
    const rectangulo = calcularRectanguloPixeles(
      zona,
      anchoPixeles,
      altoPixeles,
    )

    contexto.fillStyle = relleno
    contexto.fillRect(
      rectangulo.x,
      rectangulo.y,
      rectangulo.ancho,
      rectangulo.alto,
    )

    if (texto === '') {
      continue
    }

    const tamano = Math.max(
      TAMANO_MINIMO_TEXTO,
      Math.floor(rectangulo.alto * PROPORCION_TEXTO),
    )

    contexto.save()
    // El texto se recorta al rectángulo para que no se salga de la zona.
    contexto.beginPath()
    contexto.rect(rectangulo.x, rectangulo.y, rectangulo.ancho, rectangulo.alto)
    contexto.clip()

    contexto.fillStyle = colorTexto
    contexto.font = `bold ${tamano}px sans-serif`
    contexto.textAlign = 'center'
    contexto.textBaseline = 'middle'
    contexto.fillText(
      texto,
      rectangulo.x + rectangulo.ancho / 2,
      rectangulo.y + rectangulo.alto / 2,
    )
    contexto.restore()
  }
}

/** Lee las medidas visibles de todas las páginas de un documento de PDF.js. */
export async function medirPaginasVisibles(
  documento: PDFDocumentProxy,
): Promise<readonly MedidasPaginaCensura[]> {
  const medidas: MedidasPaginaCensura[] = []

  for (let numero = 1; numero <= documento.numPages; numero += 1) {
    const pagina = await documento.getPage(numero)

    try {
      // La vista con escala 1 ya tiene la rotación de la página aplicada, así que
      // estas medidas son las que se ven, no las internas del documento.
      const vista = pagina.getViewport({ scale: 1 })
      medidas.push({ ancho: vista.width, alto: vista.height })
    } finally {
      await pagina.cleanup()
    }
  }

  return medidas
}

/**
 * Crea el adaptador que rasteriza y censura de verdad.
 *
 * El lienzo se vacía en cuanto se tienen los bytes: una página a 300 puntos por
 * pulgada ocupa decenas de megabytes y no puede quedarse esperando al recolector de
 * basura mientras se procesa la siguiente.
 */
export function crearAdaptadorNavegador(
  documento: PDFDocumentProxy,
): AdaptadorCensura {
  return {
    numeroPaginas: documento.numPages,

    medirPaginas: async () => await medirPaginasVisibles(documento),

    rasterizar: async (peticion) => {
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
        const contexto = obtenerContexto(dibujada.lienzo)

        pintarZonas(
          contexto,
          peticion.zonas,
          peticion.apariencia,
          dibujada.ancho,
          dibujada.alto,
        )

        const bytes = await lienzoABytes(
          dibujada.lienzo,
          peticion.formato,
          peticion.calidad,
        )

        return { bytes, ancho: dibujada.ancho, alto: dibujada.alto }
      } finally {
        liberarLienzo(dibujada.lienzo)
      }
    },
  }
}

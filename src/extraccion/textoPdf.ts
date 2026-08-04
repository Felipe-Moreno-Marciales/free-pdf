import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from 'pdfjs-dist'
import { cederElControl, comprobarCancelacion } from '../pdf/cancelacion'
import type { FragmentoTextoPdf, PaginaTextoPdf } from './tipos'

/** Avance comunicado después de terminar cada página. */
export interface ProgresoExtraccion {
  readonly completadas: number
  readonly total: number
  readonly pagina: number
}

/** Opciones de la extracción secuencial. */
export interface OpcionesExtraccion {
  readonly senal?: AbortSignal
  readonly alProgreso?: (progreso: ProgresoExtraccion) => void
}

interface AnotacionEnlace {
  readonly rectangulo: readonly [number, number, number, number]
  readonly url: string
}

/** Elemento textual de la unión que devuelve PDF.js. */
type ElementoTexto = Extract<
  Awaited<ReturnType<PDFPageProxy['getTextContent']>>['items'][number],
  { readonly str: string }
>

/** `true` para los elementos de contenido que realmente contienen texto. */
function esElementoTexto(elemento: unknown): elemento is ElementoTexto {
  return (
    typeof elemento === 'object' &&
    elemento !== null &&
    'str' in elemento &&
    typeof elemento.str === 'string'
  )
}

/** Normaliza las anotaciones de enlace útiles de PDF.js. */
async function extraerEnlaces(
  pagina: PDFPageProxy,
): Promise<readonly AnotacionEnlace[]> {
  const anotaciones = await pagina.getAnnotations({ intent: 'display' })
  const enlaces: AnotacionEnlace[] = []

  for (const anotacion of anotaciones) {
    if (
      anotacion.subtype !== 'Link' ||
      !Array.isArray(anotacion.rect) ||
      anotacion.rect.length !== 4
    ) {
      continue
    }

    const url =
      typeof anotacion.url === 'string'
        ? anotacion.url
        : typeof anotacion.unsafeUrl === 'string'
          ? anotacion.unsafeUrl
          : null

    if (url === null || url.trim() === '') {
      continue
    }

    enlaces.push({
      rectangulo: [
        Number(anotacion.rect[0]),
        Number(anotacion.rect[1]),
        Number(anotacion.rect[2]),
        Number(anotacion.rect[3]),
      ],
      url,
    })
  }

  return enlaces
}

/** Devuelve el enlace cuyo rectángulo se cruza con el fragmento. */
function buscarEnlace(
  fragmento: Omit<FragmentoTextoPdf, 'enlace'>,
  enlaces: readonly AnotacionEnlace[],
): string | null {
  const izquierda = fragmento.x
  const derecha = fragmento.x + Math.max(fragmento.ancho, 1)
  const abajo = fragmento.y
  const arriba = fragmento.y + Math.max(fragmento.alto, 1)

  const encontrado = enlaces.find(({ rectangulo }) => {
    const [x1, y1, x2, y2] = rectangulo
    return derecha >= x1 && izquierda <= x2 && arriba >= y1 && abajo <= y2
  })

  return encontrado?.url ?? null
}

/** Extrae una página y libera inmediatamente sus recursos internos. */
async function extraerPagina(
  documento: PDFDocumentProxy,
  numero: number,
  senal?: AbortSignal,
): Promise<PaginaTextoPdf> {
  comprobarCancelacion(senal)
  const pagina = await documento.getPage(numero)

  try {
    const [contenido, enlaces] = await Promise.all([
      pagina.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false,
      }),
      extraerEnlaces(pagina),
    ])
    comprobarCancelacion(senal)

    const vista = pagina.getViewport({ scale: 1 })
    const fragmentos: FragmentoTextoPdf[] = []

    for (const elemento of contenido.items) {
      if (!esElementoTexto(elemento) || elemento.str.trim() === '') {
        continue
      }

      const transformacion = elemento.transform
      const tamanoFuente = Math.max(
        Math.hypot(transformacion[2], transformacion[3]),
        Math.hypot(transformacion[0], transformacion[1]),
        1,
      )
      const base = {
        texto: elemento.str,
        x: transformacion[4],
        y: transformacion[5],
        ancho: Math.max(0, elemento.width),
        alto: Math.max(tamanoFuente, elemento.height),
        tamanoFuente,
        nombreFuente: elemento.fontName,
        finLinea: elemento.hasEOL,
      }

      fragmentos.push({ ...base, enlace: buscarEnlace(base, enlaces) })
    }

    return {
      numero,
      ancho: vista.width,
      alto: vista.height,
      fragmentos,
    }
  } finally {
    await pagina.cleanup()
  }
}

/**
 * Extrae las páginas indicadas en orden ascendente y de una en una.
 *
 * Nunca mantiene dos páginas activas a la vez. La señal se comprueba antes y
 * después de cada operación costosa, y se cede el hilo entre páginas.
 */
export async function extraerTextoPdf(
  documento: PDFDocumentProxy,
  indices: readonly number[],
  opciones: OpcionesExtraccion = {},
): Promise<readonly PaginaTextoPdf[]> {
  const paginas: PaginaTextoPdf[] = []
  const ordenados = [...new Set(indices)].sort((a, b) => a - b)

  for (const [posicion, indice] of ordenados.entries()) {
    comprobarCancelacion(opciones.senal)
    const pagina = await extraerPagina(documento, indice + 1, opciones.senal)
    paginas.push(pagina)
    opciones.alProgreso?.({
      completadas: posicion + 1,
      total: ordenados.length,
      pagina: indice + 1,
    })
    await cederElControl()
  }

  return paginas
}

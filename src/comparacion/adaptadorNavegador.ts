import type { PDFDocumentProxy } from 'pdfjs-dist'
import { cargarPdfLib } from '../pdf/cargarDocumentoPdf'
import { liberarLienzo } from '../pdf/liberarDocumentoPdf'
import { opcionesRecursosPdfJs } from '../pdf/recursosPdfJs'
import { cargarPdfJs } from '../pdf/renderizarMiniaturaPdf'
import { normalizarRotacion } from '../pdf/rotaciones'
import type { GradosRotacion } from '../pdf/tipos'
import type { PixelesPagina } from './compararContenido'
import type { DocumentoComparable } from './compararDocumentos'

/**
 * Adaptador que lee y dibuja documentos con PDF.js y pdf-lib.
 *
 * Es la parte de la comparación que necesita un navegador. Todo lo demás —comparar
 * texto, comparar píxeles, emparejar páginas y decidir estados— vive en módulos puros
 * que se prueban sin él.
 *
 * **Liberación de recursos.** Cada lienzo se libera en cuanto se han extraído sus
 * píxeles, y cada página de PDF.js se limpia después de usarla. Comparar dos
 * documentos de cien páginas sin hacerlo agotaría la memoria del navegador.
 */

/** Documento abierto, con lo necesario para cerrarlo después. */
export interface DocumentoAbierto {
  readonly comparable: DocumentoComparable
  /** Cierra el documento y libera todo lo que ocupaba. */
  readonly cerrar: () => Promise<void>
}

/** Abre un documento y lo prepara para compararlo. */
export async function abrirParaComparar(
  archivo: File,
): Promise<DocumentoAbierto> {
  const contenido = new Uint8Array(await archivo.arrayBuffer())

  const pdfjs = await cargarPdfJs()

  // PDF.js transfiere los bytes al trabajador, así que recibe su propia copia y
  // pdf-lib se queda con la otra.
  const copiaPdfJs = new Uint8Array(contenido.byteLength)
  copiaPdfJs.set(contenido)

  const tarea = pdfjs.getDocument({
    data: copiaPdfJs,
    ...opcionesRecursosPdfJs(),
  })

  const documento = await tarea.promise

  return {
    comparable: {
      nombre: archivo.name,
      numeroPaginas: documento.numPages,
      geometria: async (numero) => await leerGeometria(documento, numero),
      texto: async (numero) => await leerTexto(documento, numero),
      pixeles: async (numero, ancho, alto) =>
        await dibujar(documento, numero, ancho, alto),
      metadatos: async () => await leerMetadatos(contenido),
      liberar: () => undefined,
    },
    cerrar: async () => {
      await tarea.destroy().catch(() => undefined)
    },
  }
}

/** Lee las medidas y el giro de una página. */
async function leerGeometria(
  documento: PDFDocumentProxy,
  numero: number,
): Promise<{
  readonly ancho: number
  readonly alto: number
  readonly rotacion: GradosRotacion
}> {
  const pagina = await documento.getPage(numero)

  try {
    // La vista a escala 1 da las medidas en puntos, ya con el giro aplicado.
    const vista = pagina.getViewport({ scale: 1 })

    return {
      ancho: vista.width,
      alto: vista.height,
      rotacion: normalizarRotacion(pagina.rotate as GradosRotacion),
    }
  } finally {
    await pagina.cleanup()
  }
}

/** Extrae el texto de una página. */
async function leerTexto(
  documento: PDFDocumentProxy,
  numero: number,
): Promise<string> {
  const pagina = await documento.getPage(numero)

  try {
    const contenido = await pagina.getTextContent()
    const partes: string[] = []

    for (const elemento of contenido.items) {
      if ('str' in elemento && typeof elemento.str === 'string') {
        partes.push(elemento.str)
      }
    }

    return partes.join(' ')
  } catch {
    // Una página que no da texto no es un error: puede ser un escaneado.
    return ''
  } finally {
    await pagina.cleanup()
  }
}

/**
 * Dibuja una página a las medidas exactas indicadas y devuelve sus píxeles.
 *
 * Las medidas vienen impuestas por quien llama porque las dos versiones de la misma
 * página tienen que dibujarse igual para poder compararlas píxel a píxel.
 */
async function dibujar(
  documento: PDFDocumentProxy,
  numero: number,
  ancho: number,
  alto: number,
): Promise<PixelesPagina | null> {
  const pagina = await documento.getPage(numero)
  const lienzo = document.createElement('canvas')

  try {
    const natural = pagina.getViewport({ scale: 1 })
    const escala = ancho / Math.max(1, natural.width)
    const vista = pagina.getViewport({ scale: escala })

    lienzo.width = ancho
    lienzo.height = alto

    const contexto = lienzo.getContext('2d', { willReadFrequently: true })

    if (contexto === null) {
      return null
    }

    // Fondo blanco: una página sin fondo se dibujaría sobre píxeles transparentes y
    // dos páginas en blanco podrían parecer distintas por el canal alfa.
    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, ancho, alto)

    await pagina.render({ canvas: lienzo, canvasContext: contexto, viewport: vista })
      .promise

    const imagen = contexto.getImageData(0, 0, ancho, alto)

    return { datos: imagen.data, ancho, alto }
  } catch {
    return null
  } finally {
    liberarLienzo(lienzo)
    await pagina.cleanup()
  }
}

/**
 * Lee los metadatos con pdf-lib.
 *
 * Se usa pdf-lib y no PDF.js porque su API de metadatos es directa y ya está integrada
 * en el proyecto. Cada lectura va protegida: un documento con una fecha mal escrita no
 * debe impedir leer el autor.
 */
async function leerMetadatos(
  contenido: Uint8Array,
): Promise<ReadonlyMap<string, string>> {
  const metadatos = new Map<string, string>()

  try {
    const pdfLib = await cargarPdfLib()
    const copia = new Uint8Array(contenido.byteLength)
    copia.set(contenido)

    const documento = await pdfLib.PDFDocument.load(copia, {
      ignoreEncryption: false,
    })

    const leer = (clave: string, obtener: () => string | undefined): void => {
      try {
        metadatos.set(clave, obtener() ?? '')
      } catch {
        metadatos.set(clave, '')
      }
    }

    leer('titulo', () => documento.getTitle())
    leer('autor', () => documento.getAuthor())
    leer('asunto', () => documento.getSubject())
    leer('palabrasClave', () => documento.getKeywords())
    leer('creador', () => documento.getCreator())
    leer('productor', () => documento.getProducer())
  } catch {
    // Si el documento no se puede abrir con pdf-lib, se compara sin metadatos.
  }

  return metadatos
}

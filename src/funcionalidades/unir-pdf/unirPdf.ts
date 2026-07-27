import type { PDFDocument, PDFPage } from 'pdf-lib'
import type { PdfSeleccionado, ResultadoUnion } from './tipos'

/** Módulo pdf-lib tal y como se obtiene al cargarlo de forma diferida. */
type ModuloPdfLib = typeof import('pdf-lib')

/** Número mínimo de archivos necesarios para poder unir. */
export const MINIMO_ARCHIVOS_PARA_UNIR = 2

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_ARCHIVO_UNIDO = 'free-pdf-unido.pdf'

/**
 * Error de la herramienta de unión.
 *
 * Su mensaje ya está redactado en español y puede mostrarse tal cual en la
 * interfaz. El error original se conserva en `cause` para depuración.
 */
export class ErrorUnionPdf extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones)
    this.name = 'ErrorUnionPdf'
  }
}

/**
 * Une varios documentos PDF en uno solo respetando el orden recibido.
 *
 * Todo el proceso ocurre en el navegador con pdf-lib: los archivos se leen en
 * memoria y en ningún momento se envían a un servidor.
 */
export async function unirArchivosPdf(
  archivos: readonly PdfSeleccionado[],
): Promise<ResultadoUnion> {
  try {
    return await ejecutarUnion(archivos)
  } catch (error) {
    if (error instanceof ErrorUnionPdf) {
      throw error
    }

    // Cualquier fallo imprevisto (por ejemplo, falta de memoria con documentos
    // muy grandes) se traduce a un mensaje en español.
    throw new ErrorUnionPdf(
      'No se pudo completar la unión. Prueba con menos archivos o con documentos más pequeños.',
      { cause: error },
    )
  }
}

/**
 * Carga pdf-lib solo cuando hace falta.
 *
 * La biblioteca pesa varios cientos de kilobytes, así que se deja fuera del
 * paquete inicial y se descarga la primera vez que se une un documento.
 */
async function cargarPdfLib(): Promise<ModuloPdfLib> {
  try {
    return await import('pdf-lib')
  } catch (error) {
    throw new ErrorUnionPdf(
      'No se pudieron cargar los componentes necesarios para unir PDF. Comprueba tu conexión y recarga la página.',
      { cause: error },
    )
  }
}

/** Realiza la unión propiamente dicha. */
async function ejecutarUnion(
  archivos: readonly PdfSeleccionado[],
): Promise<ResultadoUnion> {
  if (archivos.length < MINIMO_ARCHIVOS_PARA_UNIR) {
    throw new ErrorUnionPdf(
      `Selecciona al menos ${MINIMO_ARCHIVOS_PARA_UNIR} archivos PDF para poder unirlos.`,
    )
  }

  const pdfLib = await cargarPdfLib()
  const documentoUnido = await pdfLib.PDFDocument.create()

  for (const seleccionado of archivos) {
    const documentoOrigen = await cargarDocumentoPdf(pdfLib, seleccionado)
    const indicesPaginas = documentoOrigen.getPageIndices()

    if (indicesPaginas.length === 0) {
      throw new ErrorUnionPdf(
        `El archivo «${seleccionado.nombre}» no contiene ninguna página.`,
      )
    }

    const paginasCopiadas = await copiarTodasLasPaginas(
      documentoUnido,
      documentoOrigen,
      indicesPaginas,
      seleccionado.nombre,
    )

    for (const pagina of paginasCopiadas) {
      documentoUnido.addPage(pagina)
    }
  }

  const bytesUnidos = await documentoUnido.save()

  return {
    blob: crearBlobPdf(bytesUnidos),
    nombreArchivo: NOMBRE_ARCHIVO_UNIDO,
    numeroPaginas: documentoUnido.getPageCount(),
    tamano: bytesUnidos.byteLength,
  }
}

/** Lee el archivo completo en memoria como `ArrayBuffer`. */
async function leerArchivoComoArrayBuffer(
  seleccionado: PdfSeleccionado,
): Promise<ArrayBuffer> {
  try {
    return await seleccionado.archivo.arrayBuffer()
  } catch (error) {
    throw new ErrorUnionPdf(
      `No se pudo leer «${seleccionado.nombre}». Comprueba que el archivo siga disponible en tu dispositivo.`,
      { cause: error },
    )
  }
}

/** Carga un documento con pdf-lib y traduce los fallos a mensajes en español. */
async function cargarDocumentoPdf(
  pdfLib: ModuloPdfLib,
  seleccionado: PdfSeleccionado,
): Promise<PDFDocument> {
  const contenido = await leerArchivoComoArrayBuffer(seleccionado)

  try {
    return await pdfLib.PDFDocument.load(contenido, { ignoreEncryption: false })
  } catch (error) {
    if (error instanceof pdfLib.EncryptedPDFError) {
      throw new ErrorUnionPdf(
        `El archivo «${seleccionado.nombre}» está cifrado o protegido con contraseña, así que no se puede unir.`,
        { cause: error },
      )
    }

    throw new ErrorUnionPdf(
      `El archivo «${seleccionado.nombre}» está dañado o no es un PDF válido, así que no se puede procesar.`,
      { cause: error },
    )
  }
}

/** Copia al documento destino las páginas indicadas del documento de origen. */
async function copiarTodasLasPaginas(
  destino: PDFDocument,
  origen: PDFDocument,
  indicesPaginas: number[],
  nombreArchivo: string,
): Promise<PDFPage[]> {
  try {
    return await destino.copyPages(origen, indicesPaginas)
  } catch (error) {
    throw new ErrorUnionPdf(
      `No se pudieron copiar las páginas de «${nombreArchivo}». El documento puede estar dañado.`,
      { cause: error },
    )
  }
}

/**
 * Crea el `Blob` del PDF resultante.
 *
 * Los bytes se copian a un `ArrayBuffer` propio para no depender del búfer
 * interno que devuelve pdf-lib.
 */
function crearBlobPdf(bytes: Uint8Array): Blob {
  const contenido = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(contenido).set(bytes)

  return new Blob([contenido], { type: 'application/pdf' })
}

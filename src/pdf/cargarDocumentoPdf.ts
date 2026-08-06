import type { PDFDocument, PDFPage } from 'pdf-lib'
import { ErrorPdf } from './erroresPdf'

/** Módulo pdf-lib tal y como se obtiene al cargarlo de forma diferida. */
export type ModuloPdfLib = typeof import('pdf-lib')

/** Módulo pdf-lib ya cargado, para no volver a descargarlo. */
let moduloEnMemoria: ModuloPdfLib | null = null

/**
 * Carga pdf-lib solo cuando hace falta.
 *
 * La biblioteca pesa varios cientos de kilobytes, así que se deja fuera del
 * paquete inicial y se descarga la primera vez que se procesa un documento.
 */
export async function cargarPdfLib(): Promise<ModuloPdfLib> {
  if (moduloEnMemoria !== null) {
    return moduloEnMemoria
  }

  try {
    const modulo = await import('pdf-lib')
    moduloEnMemoria = modulo
    return modulo
  } catch (error) {
    throw new ErrorPdf(
      'No se pudieron cargar los componentes necesarios para procesar PDF. Comprueba tu conexión y recarga la página.',
      { cause: error },
    )
  }
}

/** Lee el archivo completo en memoria como `ArrayBuffer`. */
export async function leerContenidoArchivo(
  archivo: File,
  nombreVisible: string,
): Promise<ArrayBuffer> {
  try {
    return await archivo.arrayBuffer()
  } catch (error) {
    throw new ErrorPdf(
      `No se pudo leer «${nombreVisible}». Comprueba que el archivo siga disponible en tu dispositivo.`,
      { cause: error },
    )
  }
}

/**
 * Abre un documento con pdf-lib y traduce los fallos a mensajes en español.
 *
 * No se usa `ignoreEncryption: true`: los documentos cifrados se rechazan con
 * un aviso claro en lugar de producir resultados inválidos en silencio.
 */
export async function abrirDocumento(
  pdfLib: ModuloPdfLib,
  contenido: ArrayBuffer,
  nombreVisible: string,
): Promise<PDFDocument> {
  let documento: PDFDocument

  try {
    documento = await pdfLib.PDFDocument.load(contenido, {
      ignoreEncryption: false,
    })
  } catch (error) {
    if (error instanceof pdfLib.EncryptedPDFError) {
      throw new ErrorPdf(
        `El archivo «${nombreVisible}» está cifrado o protegido con contraseña, así que no se puede procesar.`,
        { cause: error },
      )
    }

    throw new ErrorPdf(
      `El archivo «${nombreVisible}» está dañado o no es un PDF válido, así que no se puede procesar.`,
      { cause: error },
    )
  }

  if (documento.getPageCount() === 0) {
    throw new ErrorPdf(
      `El archivo «${nombreVisible}» no contiene ninguna página.`,
    )
  }

  return documento
}

/** Documento abierto con pdf-lib junto al módulo con el que se abrió. */
export interface DocumentoPdfLib {
  readonly pdfLib: ModuloPdfLib
  readonly documento: PDFDocument
  readonly numeroPaginas: number
}

/** Carga pdf-lib, lee el archivo y abre el documento en un solo paso. */
export async function abrirDocumentoDesdeArchivo(
  archivo: File,
  nombreVisible = archivo.name,
): Promise<DocumentoPdfLib> {
  const pdfLib = await cargarPdfLib()
  const contenido = await leerContenidoArchivo(archivo, nombreVisible)
  const documento = await abrirDocumento(pdfLib, contenido, nombreVisible)

  return { pdfLib, documento, numeroPaginas: documento.getPageCount() }
}

/** Copia al documento destino las páginas indicadas del documento de origen. */
export async function copiarPaginas(
  destino: PDFDocument,
  origen: PDFDocument,
  indicesPaginas: readonly number[],
  nombreVisible: string,
): Promise<PDFPage[]> {
  try {
    return await destino.copyPages(origen, [...indicesPaginas])
  } catch (error) {
    throw new ErrorPdf(
      `No se pudieron copiar las páginas de «${nombreVisible}». El documento puede estar dañado.`,
      { cause: error },
    )
  }
}

/**
 * Copia las páginas indicadas al documento destino y las añade al final,
 * respetando el orden recibido.
 */
export async function copiarYAnadirPaginas(
  destino: PDFDocument,
  origen: PDFDocument,
  indicesPaginas: readonly number[],
  nombreVisible: string,
): Promise<void> {
  const paginas = await copiarPaginas(destino, origen, indicesPaginas, nombreVisible)

  for (const pagina of paginas) {
    destino.addPage(pagina)
  }
}

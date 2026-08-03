import {
  abrirDocumentoDesdeArchivo,
  cargarPdfLib,
  copiarYAnadirPaginas,
} from '../../pdf/cargarDocumentoPdf'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import type { PdfSeleccionado } from '../../pdf/tipos'
import type { ResultadoUnion } from './tipos'

/** Número mínimo de archivos necesarios para poder unir. */
export const MINIMO_ARCHIVOS_PARA_UNIR = 2

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_ARCHIVO_UNIDO = 'free-pdf-unido.pdf'

/**
 * Une varios documentos PDF en uno solo respetando el orden recibido.
 *
 * Todo el proceso ocurre en el navegador con pdf-lib: los archivos se leen en
 * memoria y en ningún momento se envían a un servidor. Los documentos cifrados
 * y los dañados se detectan al abrirlos y se avisa indicando el archivo
 * concreto que causa el problema.
 */
export async function unirArchivosPdf(
  archivos: readonly PdfSeleccionado[],
): Promise<ResultadoUnion> {
  try {
    return await ejecutarUnion(archivos)
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudo completar la unión. Prueba con menos archivos o con documentos más pequeños.',
    )
  }
}

/** Realiza la unión propiamente dicha. */
async function ejecutarUnion(
  archivos: readonly PdfSeleccionado[],
): Promise<ResultadoUnion> {
  if (archivos.length < MINIMO_ARCHIVOS_PARA_UNIR) {
    throw new ErrorPdf(
      `Selecciona al menos ${MINIMO_ARCHIVOS_PARA_UNIR} archivos PDF para poder unirlos.`,
    )
  }

  const pdfLib = await cargarPdfLib()
  const documentoUnido = await pdfLib.PDFDocument.create()

  for (const seleccionado of archivos) {
    const { documento: origen } = await abrirDocumentoDesdeArchivo(
      seleccionado.archivo,
      seleccionado.nombre,
    )

    await copiarYAnadirPaginas(
      documentoUnido,
      origen,
      origen.getPageIndices(),
      seleccionado.nombre,
    )
  }

  return await guardarComoResultado(documentoUnido, NOMBRE_ARCHIVO_UNIDO)
}

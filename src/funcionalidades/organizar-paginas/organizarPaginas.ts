import {
  abrirDocumentoDesdeArchivo,
  copiarYAnadirPaginas,
} from '../../pdf/cargarDocumentoPdf'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import type { ResultadoDocumento } from '../../pdf/tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_ORGANIZADO = 'free-pdf-organizado.pdf'

/** Datos necesarios para reorganizar un documento. */
export interface PeticionOrganizacion {
  /** Archivo original. */
  readonly archivo: File
  /** Índices originales en el orden final deseado, empezando en 0. */
  readonly orden: readonly number[]
}

/**
 * Genera un documento con las páginas en el orden indicado.
 *
 * El orden recibido debe contener exactamente una vez cada página del
 * documento: así se garantiza que reorganizar no pierde ni duplica contenido.
 */
export async function organizarPaginas(
  peticion: PeticionOrganizacion,
): Promise<ResultadoDocumento> {
  try {
    return await ejecutarOrganizacion(peticion)
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudo reorganizar el documento. Prueba con un documento más pequeño.',
    )
  }
}

/** Realiza la reorganización propiamente dicha. */
async function ejecutarOrganizacion(
  peticion: PeticionOrganizacion,
): Promise<ResultadoDocumento> {
  const { pdfLib, documento: origen, numeroPaginas } =
    await abrirDocumentoDesdeArchivo(peticion.archivo)

  validarOrden(peticion.orden, numeroPaginas)

  const destino = await pdfLib.PDFDocument.create()
  await copiarYAnadirPaginas(
    destino,
    origen,
    peticion.orden,
    peticion.archivo.name,
  )

  return await guardarComoResultado(destino, NOMBRE_ORGANIZADO)
}

/** Comprueba que el orden sea una permutación completa del documento. */
function validarOrden(orden: readonly number[], numeroPaginas: number): void {
  if (orden.length !== numeroPaginas) {
    throw new ErrorPdf(
      'El orden indicado no coincide con el número de páginas del documento. Vuelve a cargarlo e inténtalo de nuevo.',
    )
  }

  const vistos = new Set(orden)
  if (vistos.size !== numeroPaginas) {
    throw new ErrorPdf(
      'El orden indicado repite o se salta alguna página. Restablece el orden e inténtalo de nuevo.',
    )
  }

  for (const indice of orden) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= numeroPaginas) {
      throw new ErrorPdf(
        'El orden indicado contiene una página que no existe en el documento.',
      )
    }
  }
}

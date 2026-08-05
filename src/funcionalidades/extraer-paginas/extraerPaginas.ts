import {
  abrirDocumentoDesdeArchivo,
  copiarYAnadirPaginas,
} from '../../pdf/cargarDocumentoPdf'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import type { ResultadoDocumento } from '../../pdf/tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_PAGINAS_EXTRAIDAS = 'free-pdf-paginas-extraidas.pdf'

/** Datos necesarios para extraer páginas. */
export interface PeticionExtraccion {
  /** Archivo original. */
  readonly archivo: File
  /** Índices de las páginas que se van a extraer, empezando en 0. */
  readonly indices: readonly number[]
}

/**
 * Reúne las páginas elegidas en un documento nuevo.
 *
 * Las páginas se copian respetando el orden original del documento, sin
 * importar en qué orden se marcaron. Todo el proceso ocurre en el navegador con
 * pdf-lib.
 */
export async function extraerPaginas(
  peticion: PeticionExtraccion,
): Promise<ResultadoDocumento> {
  try {
    return await ejecutarExtraccion(peticion)
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudieron extraer las páginas. Prueba con menos páginas o con un documento más pequeño.',
    )
  }
}

/** Realiza la extracción propiamente dicha. */
async function ejecutarExtraccion(
  peticion: PeticionExtraccion,
): Promise<ResultadoDocumento> {
  const { pdfLib, documento: origen, numeroPaginas } =
    await abrirDocumentoDesdeArchivo(peticion.archivo)

  const indices = normalizarIndices(peticion.indices, numeroPaginas)

  if (indices.length === 0) {
    throw new ErrorPdf('Selecciona al menos una página para extraerla.')
  }

  const destino = await pdfLib.PDFDocument.create()
  await copiarYAnadirPaginas(destino, origen, indices, peticion.archivo.name)

  return await guardarComoResultado(destino, NOMBRE_PAGINAS_EXTRAIDAS)
}

/**
 * Deja los índices sin duplicados, en orden ascendente y dentro del documento.
 *
 * El orden ascendente es intencionado: extraer conserva el orden original del
 * documento. Reordenar páginas es tarea de la herramienta de organización.
 */
function normalizarIndices(
  indices: readonly number[],
  numeroPaginas: number,
): readonly number[] {
  return [...new Set(indices)]
    .filter((indice) => Number.isInteger(indice) && indice >= 0 && indice < numeroPaginas)
    .sort((primero, segundo) => primero - segundo)
}

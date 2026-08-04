import {
  abrirDocumentoDesdeArchivo,
  copiarYAnadirPaginas,
} from '../../pdf/cargarDocumentoPdf'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import type { ResultadoDocumento } from '../../pdf/tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_PAGINAS_ELIMINADAS = 'free-pdf-paginas-eliminadas.pdf'

/** Datos necesarios para eliminar páginas. */
export interface PeticionEliminacion {
  /** Archivo original. */
  readonly archivo: File
  /** Índices de las páginas que se van a eliminar, empezando en 0. */
  readonly indicesAEliminar: readonly number[]
}

/**
 * Genera un documento nuevo sin las páginas marcadas.
 *
 * Las páginas que se conservan mantienen el orden original. Nunca se pueden
 * eliminar todas: un PDF sin páginas no es un documento válido.
 */
export async function eliminarPaginas(
  peticion: PeticionEliminacion,
): Promise<ResultadoDocumento> {
  try {
    return await ejecutarEliminacion(peticion)
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudieron eliminar las páginas. Prueba con un documento más pequeño.',
    )
  }
}

/** Realiza la eliminación propiamente dicha. */
async function ejecutarEliminacion(
  peticion: PeticionEliminacion,
): Promise<ResultadoDocumento> {
  const { pdfLib, documento: origen, numeroPaginas } =
    await abrirDocumentoDesdeArchivo(peticion.archivo)

  const indicesConservados = calcularIndicesConservados(
    peticion.indicesAEliminar,
    numeroPaginas,
  )

  if (indicesConservados.length === numeroPaginas) {
    throw new ErrorPdf('Selecciona al menos una página para eliminarla.')
  }

  if (indicesConservados.length === 0) {
    throw new ErrorPdf(
      'No se pueden eliminar todas las páginas: el documento resultante quedaría vacío. Deja al menos una página sin marcar.',
    )
  }

  const destino = await pdfLib.PDFDocument.create()
  await copiarYAnadirPaginas(
    destino,
    origen,
    indicesConservados,
    peticion.archivo.name,
  )

  return await guardarComoResultado(destino, NOMBRE_PAGINAS_ELIMINADAS)
}

/**
 * Calcula qué páginas se conservan, en orden ascendente.
 *
 * Es una función pura, así que la interfaz puede usarla para adelantar cuántas
 * páginas quedarán antes de procesar nada.
 */
export function calcularIndicesConservados(
  indicesAEliminar: readonly number[],
  numeroPaginas: number,
): readonly number[] {
  const aEliminar = new Set(indicesAEliminar)
  const conservados: number[] = []

  for (let indice = 0; indice < numeroPaginas; indice += 1) {
    if (!aEliminar.has(indice)) {
      conservados.push(indice)
    }
  }

  return conservados
}

import { abrirDocumentoDesdeArchivo } from '../../pdf/cargarDocumentoPdf'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import { normalizarRotacion, sumarRotacion } from '../../pdf/rotaciones'
import type { GradosRotacion, ResultadoDocumento } from '../../pdf/tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_ROTADO = 'free-pdf-rotado.pdf'

/** Datos necesarios para rotar páginas. */
export interface PeticionRotacion {
  /** Archivo original. */
  readonly archivo: File
  /**
   * Rotación adicional de cada página, indexada por su posición original
   * empezando en 0. Las páginas que no aparecen se dejan como estaban.
   */
  readonly rotaciones: ReadonlyMap<number, GradosRotacion>
}

/**
 * Aplica las rotaciones indicadas y genera el documento resultante.
 *
 * La rotación es acumulativa sobre la que el documento ya declaraba: si una
 * página venía girada 90 grados y se le añaden otros 90, el resultado son 180.
 * Todos los ángulos se normalizan a 0, 90, 180 o 270, los únicos que pdf-lib
 * admite. El orden de las páginas no se altera.
 */
export async function rotarPaginas(
  peticion: PeticionRotacion,
): Promise<ResultadoDocumento> {
  try {
    return await ejecutarRotacion(peticion)
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudieron rotar las páginas. Prueba con un documento más pequeño.',
    )
  }
}

/** Realiza la rotación propiamente dicha. */
async function ejecutarRotacion(
  peticion: PeticionRotacion,
): Promise<ResultadoDocumento> {
  const hayCambios = [...peticion.rotaciones.values()].some(
    (rotacion) => normalizarRotacion(rotacion) !== 0,
  )

  if (!hayCambios) {
    throw new ErrorPdf(
      'Todavía no has girado ninguna página. Selecciona al menos una y aplica un giro.',
    )
  }

  const { pdfLib, documento } = await abrirDocumentoDesdeArchivo(
    peticion.archivo,
  )

  const paginas = documento.getPages()

  paginas.forEach((pagina, indice) => {
    const adicional = peticion.rotaciones.get(indice) ?? 0
    if (adicional === 0) {
      return
    }

    const rotacionFinal = normalizarRotacion(
      pagina.getRotation().angle + adicional,
    )
    pagina.setRotation(pdfLib.degrees(rotacionFinal))
  })

  return await guardarComoResultado(documento, NOMBRE_ROTADO)
}

/**
 * Calcula el mapa de rotaciones resultante de girar las páginas indicadas.
 *
 * Es una función pura: la interfaz la usa para saber cómo debe mostrar cada
 * miniatura y el procesamiento la respeta tal cual. Las páginas que quedan sin
 * rotación se eliminan del mapa para no arrastrar entradas inútiles.
 */
export function aplicarGiro(
  rotaciones: ReadonlyMap<number, GradosRotacion>,
  indices: readonly number[],
  grados: number,
): ReadonlyMap<number, GradosRotacion> {
  const siguientes = new Map(rotaciones)

  for (const indice of indices) {
    const actual = siguientes.get(indice) ?? 0
    const resultado = sumarRotacion(actual, grados)

    if (resultado === 0) {
      siguientes.delete(indice)
    } else {
      siguientes.set(indice, resultado)
    }
  }

  return siguientes
}

import { abrirDocumentoDesdeArchivo } from '../../pdf/cargarDocumentoPdf'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import type { CajaPagina } from '../../pdf/posicionarEnPagina'
import { normalizarRotacion } from '../../pdf/rotaciones'
import type { ResultadoDocumento } from '../../pdf/tipos'
import {
  calcularCajaRecorte,
  convertirMargenesAPuntos,
  noRecortaNada,
  validarRecorte,
} from './coordenadasRecorte'
import type { AlcanceRecorte, PeticionRecorte } from './tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_RECORTADO = 'free-pdf-recortado.pdf'

/**
 * Calcula qué páginas recibirán el recorte.
 *
 * Es una función pura, así que la interfaz puede mostrar el mismo recuento que
 * después se aplica.
 */
export function calcularIndicesRecorte(
  alcance: AlcanceRecorte,
  numeroPaginas: number,
  indiceReferencia: number,
  indicesSeleccionados: readonly number[],
): readonly number[] {
  if (!Number.isInteger(numeroPaginas) || numeroPaginas < 1) {
    return []
  }

  switch (alcance) {
    case 'todas':
      return Array.from({ length: numeroPaginas }, (_, indice) => indice)
    case 'seleccionadas':
      return [...indicesSeleccionados]
        .filter((indice) => indice >= 0 && indice < numeroPaginas)
        .sort((primero, segundo) => primero - segundo)
    case 'referencia':
      return indiceReferencia >= 0 && indiceReferencia < numeroPaginas
        ? [indiceReferencia]
        : []
  }
}

/**
 * Cambia el área visible de las páginas elegidas.
 *
 * El recorte se aplica ajustando la caja de recorte —el `CropBox` del formato
 * PDF—, que es la que los visores y las impresoras usan para decidir qué parte de
 * la página se muestra. La caja de medios, `MediaBox`, se deja intacta.
 *
 * Esto tiene una consecuencia importante que conviene tener presente: **el
 * contenido que queda fuera del área visible sigue estando dentro del archivo**.
 * No se ve, pero alguien podría recuperarlo ampliando de nuevo la caja o leyendo
 * el documento con herramientas de bajo nivel. Por eso esta herramienta sirve
 * para ajustar márgenes y encuadres, y **no** para ocultar información
 * confidencial. Eliminar contenido de verdad corresponderá a la herramienta de
 * censura permanente, prevista para una fase posterior.
 *
 * Las páginas que no entran en el alcance elegido no se modifican en absoluto.
 */
export async function recortarPdf(
  peticion: PeticionRecorte,
): Promise<ResultadoDocumento> {
  try {
    return await ejecutar(peticion)
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudo recortar el documento. Prueba con un documento más pequeño.',
    )
  }
}

/** Realiza el recorte propiamente dicho. */
async function ejecutar(
  peticion: PeticionRecorte,
): Promise<ResultadoDocumento> {
  const { configuracion } = peticion

  if (noRecortaNada(configuracion.margenes)) {
    throw new ErrorPdf(
      'Todavía no has indicado ningún margen que recortar. Escribe al menos un margen mayor que cero.',
    )
  }

  const { documento } = await abrirDocumentoDesdeArchivo(peticion.archivo)
  const numeroPaginas = documento.getPageCount()

  const indices = calcularIndicesRecorte(
    configuracion.alcance,
    numeroPaginas,
    peticion.indiceReferencia,
    peticion.indicesSeleccionados,
  )

  if (indices.length === 0) {
    throw new ErrorPdf(
      'No hay ninguna página seleccionada a la que aplicar el recorte.',
    )
  }

  const margenesPuntos = convertirMargenesAPuntos(
    configuracion.margenes,
    configuracion.unidad,
  )
  const paginas = documento.getPages()

  for (const indice of indices) {
    const pagina = paginas[indice]
    if (pagina === undefined) {
      continue
    }

    // Se parte de la caja de recorte actual, no de la de medios: si la página ya
    // venía recortada, lo que se ve es esa caja y es sobre ella sobre la que hay
    // que medir los márgenes nuevos.
    const actual = pagina.getCropBox()
    const caja: CajaPagina = {
      x: actual.x,
      y: actual.y,
      ancho: actual.width,
      alto: actual.height,
    }
    const rotacion = normalizarRotacion(pagina.getRotation().angle)

    const validacion = validarRecorte(
      { ancho: caja.ancho, alto: caja.alto },
      margenesPuntos,
    )

    if (!validacion.valido) {
      throw new ErrorPdf(
        `No se puede recortar la página ${indice + 1}: ${
          validacion.mensaje ?? 'los márgenes no son válidos.'
        }`,
      )
    }

    const nueva = calcularCajaRecorte(caja, rotacion, margenesPuntos)
    pagina.setCropBox(nueva.x, nueva.y, nueva.ancho, nueva.alto)
  }

  return await guardarComoResultado(documento, NOMBRE_RECORTADO)
}

import { sonAjustesNeutros } from '../../imagenes/aplicarFiltrosImagen'
import { ErrorPdf } from '../../pdf/erroresPdf'
import type { ResultadoDocumento } from '../../pdf/tipos'
import { crearPdfDesdeImagenes } from '../imagenes-a-pdf/crearPdfDesdeImagenes'
import type {
  EntradaImagen,
  OpcionesProcesoImagenes,
} from '../imagenes-a-pdf/tipos'
import type { CapturaEscaneada, PeticionEscaneo } from './tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_ESCANEADO = 'free-pdf-escaneado.pdf'

/**
 * Crea un PDF a partir de las capturas, con una página por captura.
 *
 * Se reutiliza el procesamiento de «Imágenes a PDF»: es exactamente el mismo
 * problema —colocar imágenes en páginas respetando su proporción— con dos
 * añadidos, el recorte y los filtros de cada captura. Al compartir el
 * procesamiento se comparte también el cálculo de la página, así que las dos
 * herramientas se comportan igual.
 *
 * Las capturas se procesan de una en una para no mantener varias fotografías
 * descodificadas al mismo tiempo.
 */
export async function crearPdfEscaneado(
  peticion: PeticionEscaneo,
  opciones: OpcionesProcesoImagenes = {},
): Promise<ResultadoDocumento> {
  if (peticion.capturas.length === 0) {
    throw new ErrorPdf(
      'Toma al menos una fotografía o carga una imagen para crear el documento.',
    )
  }

  return await crearPdfDesdeImagenes(
    {
      imagenes: peticion.capturas.map(convertirEnEntrada),
      configuracion: peticion.configuracion,
      nombreArchivo: NOMBRE_ESCANEADO,
    },
    opciones,
  )
}

/**
 * Traduce una captura a la entrada que espera el procesamiento de imágenes.
 *
 * Los ajustes de color se omiten cuando no modifican nada, de modo que una
 * captura sin filtros pueda incrustarse tal cual y no tenga que pasar por un
 * `canvas`.
 */
export function convertirEnEntrada(captura: CapturaEscaneada): EntradaImagen {
  return {
    id: captura.id,
    nombre: captura.nombre,
    contenido: captura.contenido,
    formato: captura.formato,
    rotacion: captura.rotacion,
    dimensiones: captura.dimensiones,
    recorte: captura.recorte,
    ajustes: sonAjustesNeutros(captura.ajustes) ? null : captura.ajustes,
  }
}

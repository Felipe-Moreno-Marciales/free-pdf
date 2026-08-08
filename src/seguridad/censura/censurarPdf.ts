import { calidadDesdePorcentaje } from '../../imagenes/convertirCanvas'
import {
  cederElControl,
  comprobarCancelacion,
  esCancelacion,
  OperacionCancelada,
} from '../../pdf/cancelacion'
import { cargarPdfLib } from '../../pdf/cargarDocumentoPdf'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import type { ResultadoDocumento } from '../../pdf/tipos'
import { calcularEscala, zonasDePagina } from './coordenadasCensura'
import type {
  OpcionesCensura,
  PeticionCensura,
  VerificacionCensura,
} from './tipos'

/** Nombre predeterminado del documento censurado. */
export const NOMBRE_CENSURADO = 'free-pdf-censurado.pdf'

/** Calidad del JPEG con la que se incrustan las páginas rasterizadas. */
const CALIDAD_JPEG = 92

/** Resultado de censurar, con su verificación. */
export interface ResultadoCensura extends ResultadoDocumento {
  /** Verificación del documento generado. */
  readonly verificacion: VerificacionCensura
}

/**
 * Censura un documento reconstruyéndolo a partir de píxeles.
 *
 * Este es el punto importante de toda la herramienta, así que conviene ser preciso
 * sobre lo que hace y lo que no:
 *
 * **Lo que hace.** Dibuja cada página con PDF.js, pinta las zonas censuradas
 * directamente sobre los píxeles y crea un documento **nuevo** en el que cada página
 * es esa imagen. El documento nuevo se construye con `PDFDocument.create()`, así que
 * no se copia ningún flujo de contenido original, ni anotaciones, ni campos de
 * formulario, ni JavaScript, ni archivos adjuntos, ni capas opcionales. Los
 * metadatos se dejan vacíos a propósito.
 *
 * **Lo que se puede afirmar.** Que el documento resultante se construyó desde
 * píxeles y que los flujos originales no se copiaron. Eso es exactamente lo que está
 * implementado y se puede comprobar.
 *
 * **Lo que NO se afirma.** Que esto demuestre matemáticamente que ningún dato pueda
 * recuperarse. Es una afirmación distinta y más fuerte, y no se hace.
 *
 * **Consecuencias.** El texto deja de ser seleccionable, los enlaces dejan de ser
 * interactivos, los formularios dejan de ser editables, la estructura de
 * accesibilidad se pierde y el tamaño del archivo suele aumentar.
 */
export async function censurarPdf(
  peticion: PeticionCensura,
  opciones: OpcionesCensura,
): Promise<ResultadoCensura> {
  try {
    return await ejecutar(peticion, opciones)
  } catch (error) {
    if (esCancelacion(error)) {
      throw error
    }

    throw envolverErrorPdf(
      error,
      'No se pudo censurar el documento. Prueba con una calidad menor o con menos páginas.',
    )
  }
}

/** Realiza la censura propiamente dicha. */
async function ejecutar(
  peticion: PeticionCensura,
  opciones: OpcionesCensura,
): Promise<ResultadoCensura> {
  const { adaptador } = opciones
  const total = adaptador.numeroPaginas

  if (total === 0) {
    throw new ErrorPdf('El documento no contiene ninguna página.')
  }

  const utiles = peticion.zonas.filter((zona) => zona.pagina >= 1)
  if (utiles.length === 0) {
    throw new ErrorPdf(
      'Marca al menos una zona que censurar antes de generar el documento.',
    )
  }

  const medidas = await adaptador.medirPaginas()
  const escala = calcularEscala(peticion.configuracion.calidad)
  const calidad = calidadDesdePorcentaje(CALIDAD_JPEG)

  const pdfLib = await cargarPdfLib()
  const documento = await pdfLib.PDFDocument.create()

  // Los metadatos del original no se copian; se dejan explícitamente vacíos para no
  // arrastrar autor, título ni palabras clave al documento censurado.
  documento.setTitle('')
  documento.setAuthor('')
  documento.setSubject('')
  documento.setKeywords([])
  documento.setProducer('')
  documento.setCreator('')

  for (let numeroPagina = 1; numeroPagina <= total; numeroPagina += 1) {
    comprobarCancelacion(opciones.senal)

    const rasterizada = await adaptador.rasterizar({
      numeroPagina,
      escala,
      zonas: zonasDePagina(peticion.zonas, numeroPagina),
      apariencia: peticion.configuracion.apariencia,
      formato: peticion.configuracion.formato,
      calidad,
      senal: opciones.senal,
    })

    if (rasterizada === null) {
      throw new OperacionCancelada()
    }

    const incrustada =
      peticion.configuracion.formato === 'jpeg'
        ? await documento.embedJpg(rasterizada.bytes)
        : await documento.embedPng(rasterizada.bytes)

    // La página conserva las medidas visibles del original, así que el documento
    // censurado se imprime igual que el de partida.
    const medida = medidas[numeroPagina - 1] ?? {
      ancho: rasterizada.ancho,
      alto: rasterizada.alto,
    }

    const pagina = documento.addPage([medida.ancho, medida.alto])
    pagina.drawImage(incrustada, {
      x: 0,
      y: 0,
      width: medida.ancho,
      height: medida.alto,
    })

    opciones.alProgreso?.(numeroPagina, total)

    if (numeroPagina < total) {
      await cederElControl()
    }
  }

  comprobarCancelacion(opciones.senal)

  const resultado = await guardarComoResultado(documento, NOMBRE_CENSURADO)

  // --- Verificación: si no pasa, no se entrega el archivo. ---
  const bytes = new Uint8Array(await resultado.blob.arrayBuffer())
  const verificacion = await opciones.comprobador(bytes, total)

  if (!verificacion.correcta) {
    throw new ErrorPdf(
      verificacion.mensaje ??
        'La comprobación del documento censurado falló, así que no se entrega el archivo.',
    )
  }

  return { ...resultado, verificacion }
}

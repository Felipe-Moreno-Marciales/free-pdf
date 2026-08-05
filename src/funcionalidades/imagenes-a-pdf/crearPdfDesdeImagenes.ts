import type { PDFDocument, PDFImage } from 'pdf-lib'
import { calcularColocacion } from '../../imagenes/calcularAjusteImagen'
import { leerDimensiones } from '../../imagenes/cargarImagen'
import { ErrorImagen } from '../../imagenes/erroresImagen'
import { prepararImagenParaPdf } from '../../imagenes/normalizarImagen'
import { dimensionesTrasRotar } from '../../imagenes/orientacionImagen'
import {
  componerRecortes,
  dimensionesTrasRecortar,
} from '../../imagenes/recorteImagen'
import type {
  ImagenParaPdf,
  TransformacionImagen,
} from '../../imagenes/tipos'
import {
  cederElControl,
  comprobarCancelacion,
  esCancelacion,
} from '../../pdf/cancelacion'
import { cargarPdfLib, type ModuloPdfLib } from '../../pdf/cargarDocumentoPdf'
import {
  interpretarColorConReserva,
  BLANCO,
  type ColorRgb,
} from '../../pdf/colores'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import type { ResultadoDocumento } from '../../pdf/tipos'
import type {
  AdaptadorImagenes,
  EntradaImagen,
  OpcionesProcesoImagenes,
  PeticionImagenesAPdf,
} from './tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_IMAGENES_A_PDF = 'free-pdf-imagenes.pdf'

/** Número mínimo de imágenes para poder generar el documento. */
export const MINIMO_IMAGENES = 1

/**
 * Adaptador que usa el navegador de verdad.
 *
 * Descodifica con `createImageBitmap` y convierte con un `canvas`, así que solo
 * funciona en el navegador. Las pruebas pasan otro adaptador.
 */
export const ADAPTADOR_NAVEGADOR: AdaptadorImagenes = {
  medir: async (entrada) =>
    await leerDimensiones(entrada.contenido, entrada.nombre),
  preparar: prepararImagenParaPdf,
}

/**
 * Crea un documento PDF con una página por imagen.
 *
 * Las imágenes se procesan de una en una a propósito: descodificar varias
 * fotografías grandes al mismo tiempo puede agotar la memoria del navegador,
 * mientras que en serie solo hay una imagen descodificada en cada momento.
 *
 * Toda la conversión ocurre en el dispositivo: pdf-lib incrusta JPEG y PNG
 * directamente, y las imágenes WebP, giradas, recortadas o filtradas pasan antes
 * por un `canvas` del propio navegador.
 */
export async function crearPdfDesdeImagenes(
  peticion: PeticionImagenesAPdf,
  opciones: OpcionesProcesoImagenes = {},
): Promise<ResultadoDocumento> {
  try {
    return await ejecutar(peticion, opciones)
  } catch (error) {
    if (esCancelacion(error)) {
      throw error
    }

    if (error instanceof ErrorImagen) {
      // Los mensajes de las imágenes ya están redactados para la interfaz.
      throw new ErrorPdf(error.message, { cause: error })
    }

    throw envolverErrorPdf(
      error,
      'No se pudo crear el documento con las imágenes. Prueba con menos imágenes o con imágenes más pequeñas.',
    )
  }
}

/** Realiza la conversión propiamente dicha. */
async function ejecutar(
  peticion: PeticionImagenesAPdf,
  opciones: OpcionesProcesoImagenes,
): Promise<ResultadoDocumento> {
  if (peticion.imagenes.length < MINIMO_IMAGENES) {
    throw new ErrorPdf(
      'Añade al menos una imagen para poder crear el documento.',
    )
  }

  const adaptador = opciones.adaptador ?? ADAPTADOR_NAVEGADOR
  const pdfLib = await cargarPdfLib()
  const documento = await pdfLib.PDFDocument.create()
  const fondo = interpretarColorConReserva(
    peticion.configuracion.colorFondo,
    BLANCO,
  )

  const total = peticion.imagenes.length

  for (const [posicion, entrada] of peticion.imagenes.entries()) {
    comprobarCancelacion(opciones.senal)

    await anadirPagina(pdfLib, documento, entrada, peticion, adaptador, fondo)

    opciones.alProgreso?.(posicion + 1, total)

    // Se cede el control entre imágenes para que la interfaz siga respondiendo
    // y se pueda atender la cancelación.
    if (posicion + 1 < total) {
      await cederElControl()
    }
  }

  return await guardarComoResultado(
    documento,
    peticion.nombreArchivo ?? NOMBRE_IMAGENES_A_PDF,
  )
}

/** Añade al documento la página que corresponde a una imagen. */
async function anadirPagina(
  pdfLib: ModuloPdfLib,
  documento: PDFDocument,
  entrada: EntradaImagen,
  peticion: PeticionImagenesAPdf,
  adaptador: AdaptadorImagenes,
  fondo: ColorRgb,
): Promise<void> {
  const dimensionesOriginales =
    entrada.dimensiones ?? (await adaptador.medir(entrada))

  // Se razona siempre sobre la imagen tal y como se ve: primero el giro que la
  // persona aplicó y después su recorte.
  const dimensionesGiradas = dimensionesTrasRotar(
    dimensionesOriginales,
    entrada.rotacion,
  )
  const recorteManual = entrada.recorte ?? null
  const dimensionesVisibles = dimensionesTrasRecortar(
    dimensionesGiradas,
    recorteManual,
  )

  const colocacion = calcularColocacion(
    dimensionesVisibles,
    peticion.configuracion,
  )

  // El modo «cubrir» añade su propio recorte para igualar la proporción; se
  // compone con el que la persona hubiera ajustado.
  const transformacion: TransformacionImagen = {
    rotacion: entrada.rotacion,
    recorte: componerRecortes(recorteManual, colocacion.recorte),
    ajustes: entrada.ajustes ?? null,
  }

  const preparada = await adaptador.preparar({
    contenido: entrada.contenido,
    nombre: entrada.nombre,
    formato: entrada.formato,
    transformacion,
    dimensiones: dimensionesOriginales,
  })

  const incrustada = await incrustarImagen(documento, preparada, entrada.nombre)

  const pagina = documento.addPage([
    colocacion.pagina.ancho,
    colocacion.pagina.alto,
  ])

  // El fondo se dibuja siempre: así los márgenes tienen el color elegido y un
  // documento impreso no depende del color que ponga cada visor.
  pagina.drawRectangle({
    x: 0,
    y: 0,
    width: colocacion.pagina.ancho,
    height: colocacion.pagina.alto,
    color: pdfLib.rgb(fondo.rojo, fondo.verde, fondo.azul),
  })

  pagina.drawImage(incrustada, {
    x: colocacion.x,
    y: colocacion.y,
    width: colocacion.ancho,
    height: colocacion.alto,
  })
}

/**
 * Incrusta los bytes de una imagen en el documento.
 *
 * pdf-lib deduce las medidas de la propia imagen, así que aquí solo hay que
 * elegir el método según el formato y traducir cualquier fallo a un mensaje
 * comprensible.
 */
export async function incrustarImagen(
  documento: PDFDocument,
  imagen: ImagenParaPdf,
  nombreVisible: string,
): Promise<PDFImage> {
  try {
    return imagen.formato === 'jpeg'
      ? await documento.embedJpg(imagen.bytes)
      : await documento.embedPng(imagen.bytes)
  } catch (error) {
    throw new ErrorPdf(
      `No se pudo incrustar «${nombreVisible}» en el documento. La imagen puede estar dañada o usar una variante que no se admite.`,
      { cause: error },
    )
  }
}

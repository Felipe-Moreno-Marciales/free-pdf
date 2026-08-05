import type { PDFDocument, PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import {
  esFormatoIncrustable,
  prepararImagenParaPdf,
} from '../../imagenes/normalizarImagen'
import { TRANSFORMACION_NEUTRA } from '../../imagenes/dibujarImagen'
import { abrirDocumentoDesdeArchivo } from '../../pdf/cargarDocumentoPdf'
import { interpretarColorConReserva, NEGRO, type ColorRgb } from '../../pdf/colores'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import { calcularIndicesAfectados } from '../../pdf/paginasAfectadas'
import {
  calcularColocacionEnPagina,
  calcularColocacionesMosaico,
  calcularMedidasVisibles,
  type CajaPagina,
  type ColocacionEnPagina,
  type Medidas,
  type PeticionColocacion,
} from '../../pdf/posicionarEnPagina'
import { normalizarRotacion } from '../../pdf/rotaciones'
import { describirCaracterNoRepresentable } from '../../pdf/textoEstandar'
import type { ResultadoDocumento } from '../../pdf/tipos'
import { ErrorRangoPaginas } from '../../utilidades/rangosPaginas'
import { milimetrosAPuntos } from '../../utilidades/unidades'
import { limitar } from '../numerar-paginas/numerarPaginas'
import type { ConfiguracionMarcaDeAgua, PeticionMarcaDeAgua } from './tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_MARCA_DE_AGUA = 'free-pdf-marca-de-agua.pdf'

/** Longitud máxima del texto de la marca. */
export const LONGITUD_MAXIMA_TEXTO = 120

/** Tamaño mínimo admitido de la tipografía, en puntos. */
export const TAMANO_MINIMO = 8

/** Tamaño máximo admitido de la tipografía, en puntos. */
export const TAMANO_MAXIMO = 200

/** Opacidad mínima admitida, en porcentaje. */
export const OPACIDAD_MINIMA = 5

/** Opacidad máxima admitida, en porcentaje. */
export const OPACIDAD_MAXIMA = 100

/** Giro mínimo admitido, en grados. */
export const ROTACION_MINIMA = -180

/** Giro máximo admitido, en grados. */
export const ROTACION_MAXIMA = 180

/** Escala mínima de la marca de imagen, en porcentaje del ancho de la página. */
export const ESCALA_MINIMA = 5

/** Escala máxima de la marca de imagen, en porcentaje del ancho de la página. */
export const ESCALA_MAXIMA = 100

/** Separación mínima entre copias del mosaico, en milímetros. */
export const SEPARACION_MINIMA_MM = 0

/** Separación máxima entre copias del mosaico, en milímetros. */
export const SEPARACION_MAXIMA_MM = 200

/** Margen máximo respecto a los bordes, en milímetros. */
export const MARGEN_MAXIMO_MM = 100

/**
 * Número máximo de copias que se admiten por página en el modo mosaico.
 *
 * Con una marca pequeña y sin separación, una página podría llenarse con muchos
 * miles de copias: el documento resultante sería enorme y tardaría muchísimo en
 * abrirse. Se avisa antes en lugar de generarlo.
 */
export const MAXIMO_COPIAS_MOSAICO = 400

/**
 * Aplica una marca de agua de texto o de imagen a un documento.
 *
 * Las marcas de texto usan una de las tipografías estándar que pdf-lib trae
 * consigo, así que no se descarga ninguna tipografía. Las marcas de imagen se
 * incrustan una sola vez y se reutilizan en todas las páginas: así el documento
 * no crece con cada copia.
 *
 * Las páginas que no entran en el alcance elegido no se modifican en absoluto.
 */
export async function aplicarMarcaDeAgua(
  peticion: PeticionMarcaDeAgua,
): Promise<ResultadoDocumento> {
  try {
    return await ejecutar(peticion)
  } catch (error) {
    if (error instanceof ErrorRangoPaginas) {
      throw new ErrorPdf(error.message, { cause: error })
    }

    throw envolverErrorPdf(
      error,
      'No se pudo aplicar la marca de agua. Prueba con un documento más pequeño.',
    )
  }
}

/** Realiza la operación propiamente dicha. */
async function ejecutar(
  peticion: PeticionMarcaDeAgua,
): Promise<ResultadoDocumento> {
  const { configuracion } = peticion

  validarConfiguracion(peticion)

  const { pdfLib, documento } = await abrirDocumentoDesdeArchivo(
    peticion.archivo,
  )

  const numeroPaginas = documento.getPageCount()
  const indices = calcularIndicesAfectados(
    configuracion.alcance,
    numeroPaginas,
    configuracion.expresion,
  )

  if (indices.length === 0) {
    throw new ErrorPdf(
      'La selección de páginas no incluye ninguna página del documento.',
    )
  }

  const opacidad =
    limitar(configuracion.opacidadPorcentaje, OPACIDAD_MINIMA, OPACIDAD_MAXIMA) /
    100
  const rotacion = limitar(
    configuracion.rotacionGrados,
    ROTACION_MINIMA,
    ROTACION_MAXIMA,
  )
  const margen = milimetrosAPuntos(
    limitar(configuracion.margenMm, 0, MARGEN_MAXIMO_MM),
  )
  const separacionHorizontal = milimetrosAPuntos(
    limitar(
      configuracion.separacionHorizontalMm,
      SEPARACION_MINIMA_MM,
      SEPARACION_MAXIMA_MM,
    ),
  )
  const separacionVertical = milimetrosAPuntos(
    limitar(
      configuracion.separacionVerticalMm,
      SEPARACION_MINIMA_MM,
      SEPARACION_MAXIMA_MM,
    ),
  )

  const tipografia =
    configuracion.tipo === 'texto'
      ? await documento.embedFont(pdfLib.StandardFonts.Helvetica)
      : null

  const imagenIncrustada =
    configuracion.tipo === 'imagen'
      ? await incrustarMarca(documento, peticion)
      : null

  const color = interpretarColorConReserva(configuracion.texto.color, NEGRO)
  const tamano = limitar(
    configuracion.texto.tamanoFuente,
    TAMANO_MINIMO,
    TAMANO_MAXIMO,
  )
  const paginas = documento.getPages()

  for (const indice of indices) {
    const pagina = paginas[indice]
    if (pagina === undefined) {
      continue
    }

    const medidas = pagina.getMediaBox()
    const caja: CajaPagina = {
      x: medidas.x,
      y: medidas.y,
      ancho: medidas.width,
      alto: medidas.height,
    }
    const rotacionPagina = normalizarRotacion(pagina.getRotation().angle)
    const visibles = calcularMedidasVisibles(caja, rotacionPagina)

    const contenido =
      tipografia === null
        ? calcularMedidasImagen(imagenIncrustada, configuracion, visibles)
        : calcularMedidasTexto(tipografia, configuracion.texto.texto, tamano)

    const desplazamientoLocal =
      tipografia === null
        ? { x: 0, y: 0 }
        : { x: 0, y: calcularDescenso(tipografia, tamano) }

    const peticionColocacion: PeticionColocacion = {
      caja,
      rotacionPagina,
      posicion: configuracion.posicion,
      contenido,
      margenHorizontal: margen,
      margenVertical: margen,
      rotacionContenido: rotacion,
      desplazamientoLocal,
    }

    const colocaciones =
      configuracion.modo === 'mosaico'
        ? calcularColocacionesMosaico(
            peticionColocacion,
            separacionHorizontal,
            separacionVertical,
          )
        : [calcularColocacionEnPagina(peticionColocacion)]

    if (colocaciones.length > MAXIMO_COPIAS_MOSAICO) {
      throw new ErrorPdf(
        `El mosaico produciría ${colocaciones.length} copias en una sola página, demasiadas para generar un documento manejable. Aumenta la separación o el tamaño de la marca.`,
      )
    }

    for (const colocacion of colocaciones) {
      if (tipografia !== null) {
        dibujarTexto(pagina, {
          pdfLib,
          tipografia,
          texto: configuracion.texto.texto,
          tamano,
          color,
          opacidad,
          colocacion,
        })
        continue
      }

      if (imagenIncrustada !== null) {
        pagina.drawImage(imagenIncrustada, {
          x: colocacion.x,
          y: colocacion.y,
          width: contenido.ancho,
          height: contenido.alto,
          opacity: opacidad,
          rotate: pdfLib.degrees(colocacion.rotacionGrados),
        })
      }
    }
  }

  return await guardarComoResultado(documento, NOMBRE_MARCA_DE_AGUA)
}

/** Comprueba que la configuración se pueda aplicar. */
function validarConfiguracion(peticion: PeticionMarcaDeAgua): void {
  const { configuracion } = peticion

  if (configuracion.tipo === 'texto') {
    if (configuracion.texto.texto.trim() === '') {
      throw new ErrorPdf('Escribe el texto de la marca de agua.')
    }

    if (configuracion.texto.texto.length > LONGITUD_MAXIMA_TEXTO) {
      throw new ErrorPdf(
        `El texto de la marca no puede superar los ${LONGITUD_MAXIMA_TEXTO} caracteres.`,
      )
    }

    const aviso = describirCaracterNoRepresentable(configuracion.texto.texto)
    if (aviso !== null) {
      throw new ErrorPdf(aviso)
    }

    return
  }

  if (peticion.imagenMarca === null) {
    throw new ErrorPdf('Elige la imagen que quieres usar como marca de agua.')
  }
}

/**
 * Incrusta la imagen de la marca una sola vez en el documento.
 *
 * La marca nunca se gira ni se recorta —lo que gira es su colocación, ya en el
 * PDF—, así que las imágenes JPEG y PNG se incrustan con sus bytes originales, sin
 * volver a comprimirlas y sin necesidad de descodificarlas. Solo las WebP pasan
 * por un `canvas` del navegador, porque pdf-lib no las admite; esa conversión es
 * local y, por tanto, únicamente está disponible en el navegador.
 *
 * Al incrustarla una sola vez, repetirla en muchas páginas o en un mosaico apenas
 * aumenta el tamaño del documento.
 */
async function incrustarMarca(
  documento: PDFDocument,
  peticion: PeticionMarcaDeAgua,
): Promise<PDFImage> {
  const marca = peticion.imagenMarca
  if (marca === null) {
    throw new ErrorPdf('Elige la imagen que quieres usar como marca de agua.')
  }

  const bytes = esFormatoIncrustable(marca.formato)
    ? new Uint8Array(await marca.contenido.arrayBuffer())
    : (
        await prepararImagenParaPdf({
          contenido: marca.contenido,
          nombre: marca.nombre,
          formato: marca.formato,
          transformacion: TRANSFORMACION_NEUTRA,
          dimensiones: null,
          formatoSalida: 'png',
        })
      ).bytes

  const esJpeg = marca.formato === 'jpeg'

  try {
    return esJpeg
      ? await documento.embedJpg(bytes)
      : await documento.embedPng(bytes)
  } catch (error) {
    throw new ErrorPdf(
      `No se pudo usar «${marca.nombre}» como marca de agua. La imagen puede estar dañada o usar una variante que no se admite.`,
      { cause: error },
    )
  }
}

/** Medidas del texto de la marca, en puntos. */
function calcularMedidasTexto(
  tipografia: PDFFont,
  texto: string,
  tamano: number,
): Medidas {
  return {
    ancho: tipografia.widthOfTextAtSize(texto, tamano),
    alto: tipografia.heightAtSize(tamano),
  }
}

/** Altura de los rasgos descendentes de la tipografía. */
function calcularDescenso(tipografia: PDFFont, tamano: number): number {
  return Math.max(
    0,
    tipografia.heightAtSize(tamano) -
      tipografia.heightAtSize(tamano, { descender: false }),
  )
}

/**
 * Medidas de la marca de imagen, en puntos.
 *
 * La escala se expresa como porcentaje del ancho visible de la página, así que la
 * marca ocupa lo mismo en proporción en cualquier tamaño de página. La proporción
 * de la imagen se conserva.
 */
function calcularMedidasImagen(
  imagen: PDFImage | null,
  configuracion: ConfiguracionMarcaDeAgua,
  visibles: Medidas,
): Medidas {
  if (imagen === null || imagen.width === 0) {
    return { ancho: 1, alto: 1 }
  }

  const escala =
    limitar(configuracion.imagen.escalaPorcentaje, ESCALA_MINIMA, ESCALA_MAXIMA) /
    100
  const ancho = Math.max(1, visibles.ancho * escala)

  return { ancho, alto: ancho * (imagen.height / imagen.width) }
}

/** Datos necesarios para dibujar el texto de una copia de la marca. */
interface PeticionTexto {
  readonly pdfLib: typeof import('pdf-lib')
  readonly tipografia: PDFFont
  readonly texto: string
  readonly tamano: number
  readonly color: ColorRgb
  readonly opacidad: number
  readonly colocacion: ColocacionEnPagina
}

/** Dibuja una copia del texto de la marca. */
function dibujarTexto(pagina: PDFPage, peticion: PeticionTexto): void {
  const { pdfLib, colocacion } = peticion

  pagina.drawText(peticion.texto, {
    x: colocacion.x,
    y: colocacion.y,
    size: peticion.tamano,
    font: peticion.tipografia,
    color: pdfLib.rgb(
      peticion.color.rojo,
      peticion.color.verde,
      peticion.color.azul,
    ),
    opacity: peticion.opacidad,
    rotate: pdfLib.degrees(colocacion.rotacionGrados),
  })
}

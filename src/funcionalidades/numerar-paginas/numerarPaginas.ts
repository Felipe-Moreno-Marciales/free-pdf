import type { PDFFont, PDFPage } from 'pdf-lib'
import { abrirDocumentoDesdeArchivo } from '../../pdf/cargarDocumentoPdf'
import { interpretarColorConReserva, NEGRO } from '../../pdf/colores'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarComoResultado } from '../../pdf/guardarDocumentoPdf'
import { calcularIndicesAfectados } from '../../pdf/paginasAfectadas'
import {
  calcularColocacionEnPagina,
  type CajaPagina,
  type PosicionEnPagina,
} from '../../pdf/posicionarEnPagina'
import { normalizarRotacion } from '../../pdf/rotaciones'
import type { ResultadoDocumento } from '../../pdf/tipos'
import { limitar } from '../../utilidades/numeros'
import { ErrorRangoPaginas } from '../../utilidades/rangosPaginas'
import { milimetrosAPuntos } from '../../utilidades/unidades'
import {
  aplicarPlantilla,
  resolverPlantilla,
  validarPlantilla,
} from './plantillaNumeracion'
import type { PeticionNumeracion } from './tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_NUMERADO = 'free-pdf-numerado.pdf'

/** Tamaño mínimo admitido de la tipografía, en puntos. */
export const TAMANO_MINIMO = 6

/** Tamaño máximo admitido de la tipografía, en puntos. */
export const TAMANO_MAXIMO = 72

/** Número inicial mínimo admitido. */
export const NUMERO_INICIAL_MINIMO = 0

/** Número inicial máximo admitido. */
export const NUMERO_INICIAL_MAXIMO = 100_000

/** Opacidad mínima admitida, en porcentaje. */
export const OPACIDAD_MINIMA = 10

/** Opacidad máxima admitida, en porcentaje. */
export const OPACIDAD_MAXIMA = 100

/** Margen máximo admitido, en milímetros. */
export const MARGEN_MAXIMO_MM = 100

/**
 * Calcula el número que le corresponde a una página.
 *
 * La regla es sencilla y no depende de qué páginas lleven número visible: la
 * primera página del documento recibe el número inicial y a partir de ahí se
 * cuenta de uno en uno. Así, con el número inicial 5, la página 1 es la 5, la
 * página 2 es la 6, y así sucesivamente, aunque solo se numeren las impares.
 */
export function calcularNumeroDePagina(
  indicePagina: number,
  numeroInicial: number,
): number {
  return numeroInicial + indicePagina
}

/**
 * Calcula el valor del marcador `{total}`.
 *
 * Es el número más alto que llegará a escribirse, es decir, el que corresponde a
 * la última página del documento. Con un documento de 10 páginas y el número
 * inicial 5, `{total}` vale 14.
 */
export function calcularTotalNumerado(
  numeroPaginas: number,
  numeroInicial: number,
): number {
  return calcularNumeroDePagina(numeroPaginas - 1, numeroInicial)
}

/**
 * Limita un valor a un intervalo, descartando los valores no numéricos.
 * Se reexporta porque varias herramientas la importaban desde aquí.
 */
export { limitar }

/**
 * Añade la numeración a un documento y devuelve el resultado.
 *
 * Se usa una de las tipografías estándar que pdf-lib trae consigo, así que no se
 * descarga ninguna tipografía de ningún servidor.
 *
 * Las páginas que no entran en el alcance elegido no se tocan: conservan su
 * contenido, sus medidas y su rotación. Las que sí, reciben el texto colocado en
 * coordenadas visibles, de modo que en una página apaisada el número aparece
 * donde se espera y no girado.
 */
export async function numerarPaginas(
  peticion: PeticionNumeracion,
): Promise<ResultadoDocumento> {
  try {
    return await ejecutar(peticion)
  } catch (error) {
    if (error instanceof ErrorRangoPaginas) {
      throw new ErrorPdf(error.message, { cause: error })
    }

    throw envolverErrorPdf(
      error,
      'No se pudo numerar el documento. Prueba con un documento más pequeño.',
    )
  }
}

/** Realiza la numeración propiamente dicha. */
async function ejecutar(
  peticion: PeticionNumeracion,
): Promise<ResultadoDocumento> {
  const { configuracion } = peticion

  const plantilla = resolverPlantilla(
    configuracion.plantilla,
    configuracion.plantillaPropia,
  )
  const validacion = validarPlantilla(plantilla)

  if (!validacion.valida) {
    throw new ErrorPdf(
      validacion.mensaje ?? 'El texto de la numeración no es válido.',
    )
  }

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

  const tipografia = await documento.embedFont(pdfLib.StandardFonts.Helvetica)

  const numeroInicial = Math.trunc(
    limitar(
      configuracion.numeroInicial,
      NUMERO_INICIAL_MINIMO,
      NUMERO_INICIAL_MAXIMO,
    ),
  )
  const total = calcularTotalNumerado(numeroPaginas, numeroInicial)
  const tamano = limitar(
    configuracion.apariencia.tamanoFuente,
    TAMANO_MINIMO,
    TAMANO_MAXIMO,
  )
  const color = interpretarColorConReserva(
    configuracion.apariencia.color,
    NEGRO,
  )
  const opacidad =
    limitar(
      configuracion.apariencia.opacidadPorcentaje,
      OPACIDAD_MINIMA,
      OPACIDAD_MAXIMA,
    ) / 100
  const margenHorizontal = milimetrosAPuntos(
    limitar(configuracion.apariencia.margenHorizontalMm, 0, MARGEN_MAXIMO_MM),
  )
  const margenVertical = milimetrosAPuntos(
    limitar(configuracion.apariencia.margenVerticalMm, 0, MARGEN_MAXIMO_MM),
  )

  const paginas = documento.getPages()

  for (const indice of indices) {
    const pagina = paginas[indice]
    if (pagina === undefined) {
      continue
    }

    const texto = aplicarPlantilla(
      plantilla,
      calcularNumeroDePagina(indice, numeroInicial),
      total,
    )

    escribirTexto(pagina, {
      pdfLib,
      tipografia,
      texto,
      tamano,
      color,
      opacidad,
      posicion: configuracion.posicion,
      margenHorizontal,
      margenVertical,
    })
  }

  return await guardarComoResultado(documento, NOMBRE_NUMERADO)
}

/** Datos necesarios para escribir el texto en una página. */
interface PeticionEscritura {
  readonly pdfLib: typeof import('pdf-lib')
  readonly tipografia: PDFFont
  readonly texto: string
  readonly tamano: number
  readonly color: { readonly rojo: number; readonly verde: number; readonly azul: number }
  readonly opacidad: number
  readonly posicion: PosicionEnPagina
  readonly margenHorizontal: number
  readonly margenVertical: number
}

/**
 * Escribe el texto en la posición elegida de una página.
 *
 * pdf-lib coloca el texto por su línea base, mientras que la colocación se
 * razona con la caja completa del texto. La diferencia son los rasgos
 * descendentes, que se suman como desplazamiento vertical.
 */
function escribirTexto(pagina: PDFPage, peticion: PeticionEscritura): void {
  const {
    pdfLib,
    tipografia,
    texto,
    tamano,
    color,
    opacidad,
    posicion,
    margenHorizontal,
    margenVertical,
  } = peticion

  const anchoTexto = tipografia.widthOfTextAtSize(texto, tamano)
  const altoTexto = tipografia.heightAtSize(tamano)
  const altoSinDescendentes = tipografia.heightAtSize(tamano, {
    descender: false,
  })
  const descenso = Math.max(0, altoTexto - altoSinDescendentes)

  const medidas = pagina.getMediaBox()
  const caja: CajaPagina = {
    x: medidas.x,
    y: medidas.y,
    ancho: medidas.width,
    alto: medidas.height,
  }

  const colocacion = calcularColocacionEnPagina({
    caja,
    rotacionPagina: normalizarRotacion(pagina.getRotation().angle),
    posicion,
    contenido: { ancho: anchoTexto, alto: altoTexto },
    margenHorizontal,
    margenVertical,
    desplazamientoLocal: { x: 0, y: descenso },
  })

  pagina.drawText(texto, {
    x: colocacion.x,
    y: colocacion.y,
    size: tamano,
    font: tipografia,
    color: pdfLib.rgb(color.rojo, color.verde, color.azul),
    opacity: opacidad,
    rotate: pdfLib.degrees(colocacion.rotacionGrados),
  })
}

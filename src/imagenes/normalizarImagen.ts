import { descodificarImagen, leerDimensiones } from './cargarImagen'
import { CALIDAD_JPEG_PREDETERMINADA, lienzoABytes } from './convertirCanvas'
import { dibujarTransformada, esTransformacionNeutra } from './dibujarImagen'
import { ErrorImagen, envolverErrorImagen } from './erroresImagen'
import { liberarImagenDescodificada, liberarLienzo } from './liberarImagen'
import type {
  DimensionesImagen,
  FormatoImagen,
  FormatoImagenPdf,
  ImagenParaPdf,
  TransformacionImagen,
} from './tipos'

/**
 * Preparación de una imagen para incrustarla en un documento PDF.
 *
 * pdf-lib solo sabe incrustar JPEG y PNG. Para las imágenes que ya están en uno
 * de esos dos formatos y no llevan ninguna transformación se reutilizan sus
 * bytes tal cual, así que no pierden calidad ni se vuelven a comprimir. En los
 * demás casos —WebP, giros, recortes o filtros— se descodifica con el navegador,
 * se dibuja en un `canvas` y se convierte localmente a PNG o a JPEG.
 *
 * En ningún caso se recurre a un servicio externo: la conversión la hace el
 * propio navegador.
 */

/** Datos necesarios para preparar una imagen. */
export interface PeticionPreparacion {
  /** Contenido original de la imagen. */
  readonly contenido: Blob
  /** Nombre visible, solo para los mensajes de error. */
  readonly nombre: string
  /** Formato del contenido original. */
  readonly formato: FormatoImagen
  /** Giro, recorte y ajustes que hay que aplicar. */
  readonly transformacion: TransformacionImagen
  /** Medidas ya conocidas, para no descodificar la imagen solo por leerlas. */
  readonly dimensiones: DimensionesImagen | null
  /** Formato de salida; si no se indica, se elige según el de origen. */
  readonly formatoSalida?: FormatoImagenPdf
  /** Calidad del JPEG, entre 0 y 1. */
  readonly calidad?: number
}

/**
 * Función capaz de preparar una imagen.
 *
 * Se expone como tipo para que el procesamiento reciba el preparador desde
 * fuera: en el navegador se usa `prepararImagenParaPdf`, que necesita un
 * `canvas`, y en las pruebas se puede usar uno que trabaje solo con bytes.
 */
export type PreparadorImagen = (
  peticion: PeticionPreparacion,
) => Promise<ImagenParaPdf>

/**
 * Elige el formato de salida a partir del de origen.
 *
 * Las fotografías en JPEG se mantienen en JPEG, porque volver a comprimirlas
 * como PNG multiplicaría su tamaño. PNG y WebP pasan a PNG, que no tiene
 * pérdidas y conserva la transparencia.
 */
export function elegirFormatoSalida(
  formato: FormatoImagen,
): FormatoImagenPdf {
  return formato === 'jpeg' ? 'jpeg' : 'png'
}

/** `true` si pdf-lib puede incrustar ese formato sin convertirlo. */
export function esFormatoIncrustable(
  formato: FormatoImagen,
): formato is FormatoImagenPdf {
  return formato === 'jpeg' || formato === 'png'
}

/**
 * Prepara una imagen para incrustarla, usando el `canvas` del navegador.
 *
 * Devuelve los bytes junto con las medidas reales del resultado, que son las que
 * necesita el cálculo de la página.
 */
export async function prepararImagenParaPdf(
  peticion: PeticionPreparacion,
): Promise<ImagenParaPdf> {
  try {
    return await preparar(peticion)
  } catch (error) {
    throw envolverErrorImagen(
      error,
      `No se pudo preparar «${peticion.nombre}» para el documento.`,
    )
  }
}

/** Realiza la preparación propiamente dicha. */
async function preparar(peticion: PeticionPreparacion): Promise<ImagenParaPdf> {
  const sinCambios =
    esTransformacionNeutra(peticion.transformacion) &&
    esFormatoIncrustable(peticion.formato) &&
    peticion.formatoSalida === undefined

  if (sinCambios) {
    const dimensiones =
      peticion.dimensiones ??
      (await leerDimensiones(peticion.contenido, peticion.nombre))

    return {
      bytes: new Uint8Array(await peticion.contenido.arrayBuffer()),
      formato: peticion.formato,
      dimensiones,
    }
  }

  const formatoSalida =
    peticion.formatoSalida ?? elegirFormatoSalida(peticion.formato)
  const imagen = await descodificarImagen(peticion.contenido, peticion.nombre)

  let lienzo: HTMLCanvasElement | null = null

  try {
    lienzo = dibujarTransformada(imagen, peticion.transformacion)

    const bytes = await lienzoABytes(
      lienzo,
      formatoSalida,
      peticion.calidad ?? CALIDAD_JPEG_PREDETERMINADA,
    )

    if (bytes.byteLength === 0) {
      throw new ErrorImagen(
        `La conversión de «${peticion.nombre}» no produjo ningún contenido.`,
      )
    }

    return {
      bytes,
      formato: formatoSalida,
      dimensiones: { ancho: lienzo.width, alto: lienzo.height },
    }
  } finally {
    // Se libera antes de devolver el control, para no acumular dos copias de la
    // imagen en memoria mientras se procesa la siguiente.
    if (lienzo !== null) {
      liberarLienzo(lienzo)
    }
    liberarImagenDescodificada(imagen)
  }
}

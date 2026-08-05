import { calidadDesdePorcentaje } from '../../imagenes/convertirCanvas'
import {
  cederElControl,
  comprobarCancelacion,
  esCancelacion,
  OperacionCancelada,
} from '../../pdf/cancelacion'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import {
  crearBlobZip,
  type ArchivoParaZip,
} from '../../utilidades/descargarZip'
import {
  calcularAnchoNumero,
  construirNombreImagen,
  NOMBRE_ZIP_IMAGENES,
} from './nombresImagenes'
import type {
  ClaveResolucion,
  ImagenGenerada,
  OpcionesConversion,
  PeticionPdfAImagenes,
  ResultadoImagenes,
  ResumenImagenGenerada,
} from './tipos'

/**
 * Escala de cada resolución respecto al tamaño natural de la página.
 *
 * Una escala de 1 equivale a 72 píxeles por pulgada, la unidad del formato PDF.
 * De ahí salen las densidades aproximadas de cada opción:
 *
 * - `estandar`: escala 1,5 → unos 108 píxeles por pulgada. Suficiente para ver
 *   la página en pantalla. Una A4 sale de unos 893 × 1263 píxeles.
 * - `alta`: escala 3 → unos 216 píxeles por pulgada. Adecuada para imprimir o
 *   para leer texto pequeño. Una A4 sale de unos 1785 × 2526 píxeles.
 * - `muy-alta`: escala 4 → unos 288 píxeles por pulgada. Para ampliar detalles.
 *   Una A4 sale de unos 2381 × 3368 píxeles y ocupa unos 32 MB mientras se
 *   dibuja, así que conviene usarla con pocas páginas.
 */
export const ESCALAS_RESOLUCION: Readonly<Record<ClaveResolucion, number>> = {
  estandar: 1.5,
  alta: 3,
  'muy-alta': 4,
}

/** Nombre visible de cada resolución. */
const NOMBRE_RESOLUCION: Readonly<Record<ClaveResolucion, string>> = {
  estandar: 'Estándar',
  alta: 'Alta',
  'muy-alta': 'Muy alta',
}

/** Densidad aproximada de cada resolución, en píxeles por pulgada. */
const DENSIDAD_RESOLUCION: Readonly<Record<ClaveResolucion, number>> = {
  estandar: 108,
  alta: 216,
  'muy-alta': 288,
}

/** Devuelve el nombre visible de una resolución. */
export function describirResolucion(resolucion: ClaveResolucion): string {
  return NOMBRE_RESOLUCION[resolucion]
}

/** Describe la densidad aproximada de una resolución. */
export function describirDensidad(resolucion: ClaveResolucion): string {
  return `unos ${DENSIDAD_RESOLUCION[resolucion]} píxeles por pulgada`
}

/** Configuración con la que arranca la herramienta. */
export const CONFIGURACION_PREDETERMINADA = {
  formato: 'png',
  calidadPorcentaje: 85,
  resolucion: 'estandar',
} as const

/**
 * Convierte en imágenes las páginas indicadas de un documento.
 *
 * Las páginas se procesan de una en una y en el orden en el que llegan, que es
 * siempre el orden original del documento. Entre página y página se cede el
 * control al navegador: así la interfaz sigue respondiendo, el progreso se puede
 * anunciar y la cancelación surte efecto de inmediato.
 *
 * Con una sola página se devuelve la imagen suelta; con varias, un único ZIP. No
 * se lanzan varias descargas seguidas a propósito: los navegadores bloquean casi
 * todas menos la primera.
 */
export async function convertirPdfAImagenes(
  peticion: PeticionPdfAImagenes,
  opciones: OpcionesConversion,
): Promise<ResultadoImagenes> {
  try {
    return await ejecutar(peticion, opciones)
  } catch (error) {
    if (esCancelacion(error)) {
      throw error
    }

    throw envolverErrorPdf(
      error,
      'No se pudieron convertir las páginas en imágenes. Prueba con menos páginas o con una resolución menor.',
    )
  }
}

/** Realiza la conversión propiamente dicha. */
async function ejecutar(
  peticion: PeticionPdfAImagenes,
  opciones: OpcionesConversion,
): Promise<ResultadoImagenes> {
  if (peticion.numerosPagina.length === 0) {
    throw new ErrorPdf(
      'Selecciona al menos una página para convertirla en imagen.',
    )
  }

  const escala = ESCALAS_RESOLUCION[peticion.configuracion.resolucion]
  const calidad = calidadDesdePorcentaje(
    peticion.configuracion.calidadPorcentaje,
  )
  const anchoNumero = calcularAnchoNumero(peticion.numerosPagina)
  const total = peticion.numerosPagina.length

  const generadas: ImagenGenerada[] = []

  for (const [posicion, numeroPagina] of peticion.numerosPagina.entries()) {
    comprobarCancelacion(opciones.senal)

    const dibujada = await opciones.renderizador({
      numeroPagina,
      escala,
      formato: peticion.configuracion.formato,
      calidad,
      senal: opciones.senal,
    })

    // El adaptador devuelve `null` cuando lo han interrumpido a mitad.
    if (dibujada === null) {
      throw new OperacionCancelada()
    }

    generadas.push({
      numeroPagina,
      nombreArchivo: construirNombreImagen(
        peticion.nombreDocumento,
        numeroPagina,
        anchoNumero,
        peticion.configuracion.formato,
      ),
      bytes: dibujada.bytes,
      ancho: dibujada.ancho,
      alto: dibujada.alto,
    })

    opciones.alProgreso?.(posicion + 1, total)

    if (posicion + 1 < total) {
      await cederElControl()
    }
  }

  comprobarCancelacion(opciones.senal)

  return generadas.length === 1
    ? empaquetarImagenSuelta(generadas[0], peticion.configuracion.formato)
    : empaquetarEnZip(generadas)
}

/** Prepara una única imagen para descargarla directamente. */
function empaquetarImagenSuelta(
  imagen: ImagenGenerada,
  formato: 'png' | 'jpeg',
): ResultadoImagenes {
  const contenido = new ArrayBuffer(imagen.bytes.byteLength)
  new Uint8Array(contenido).set(imagen.bytes)

  const blob = new Blob([contenido], {
    type: formato === 'png' ? 'image/png' : 'image/jpeg',
  })

  return {
    blob,
    nombreArchivo: imagen.nombreArchivo,
    tamano: blob.size,
    imagenes: [resumir(imagen)],
    esPaquete: false,
  }
}

/** Reúne varias imágenes en un único ZIP. */
function empaquetarEnZip(
  imagenes: readonly ImagenGenerada[],
): ResultadoImagenes {
  const archivos: readonly ArchivoParaZip[] = imagenes.map((imagen) => ({
    nombreArchivo: imagen.nombreArchivo,
    contenido: imagen.bytes,
  }))

  const blob = crearBlobZip(archivos)

  return {
    blob,
    nombreArchivo: NOMBRE_ZIP_IMAGENES,
    tamano: blob.size,
    imagenes: imagenes.map(resumir),
    esPaquete: true,
  }
}

/** Reduce una imagen generada a su resumen. */
function resumir(imagen: ImagenGenerada): ResumenImagenGenerada {
  return {
    numeroPagina: imagen.numeroPagina,
    nombreArchivo: imagen.nombreArchivo,
    tamano: imagen.bytes.byteLength,
    ancho: imagen.ancho,
    alto: imagen.alto,
  }
}

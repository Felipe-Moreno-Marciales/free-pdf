import { normalizarRotacion } from '../pdf/rotaciones'
import type { GradosRotacion } from '../pdf/tipos'
import { aplicarAjustes, sonAjustesNeutros } from './aplicarFiltrosImagen'
import { ErrorImagen } from './erroresImagen'
import { elGiroIntercambiaEjes } from './orientacionImagen'
import {
  calcularAreaRecorte,
  convertirRecorteAlOrigen,
  esRecorteCompleto,
} from './recorteImagen'
import type {
  DimensionesImagen,
  ImagenDescodificada,
  TransformacionImagen,
} from './tipos'

/**
 * Dibujado de imágenes en un `canvas`.
 *
 * El `canvas` del navegador es la única herramienta que hace falta para girar,
 * recortar y filtrar imágenes, así que no se añade ninguna biblioteca de
 * edición. Todo ocurre en el dispositivo.
 */

/** Transformación que no modifica la imagen. */
export const TRANSFORMACION_NEUTRA: TransformacionImagen = {
  rotacion: 0,
  recorte: null,
  ajustes: null,
}

/** Crea un `canvas` con las medidas indicadas. */
export function crearLienzo(ancho: number, alto: number): HTMLCanvasElement {
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.max(1, Math.round(ancho))
  lienzo.height = Math.max(1, Math.round(alto))

  return lienzo
}

/** Obtiene el contexto de dibujo de un `canvas` o falla con un mensaje claro. */
export function obtenerContexto(
  lienzo: HTMLCanvasElement,
): CanvasRenderingContext2D {
  // `willReadFrequently` avisa al navegador de que se van a leer los píxeles,
  // lo que evita que mantenga la imagen únicamente en la tarjeta gráfica.
  const contexto = lienzo.getContext('2d', { willReadFrequently: true })

  if (contexto === null) {
    throw new ErrorImagen(
      'Este navegador no permitió preparar el lienzo necesario para procesar la imagen.',
    )
  }

  return contexto
}

/** `true` cuando la transformación deja la imagen exactamente como estaba. */
export function esTransformacionNeutra(
  transformacion: TransformacionImagen,
): boolean {
  return (
    normalizarRotacion(transformacion.rotacion) === 0 &&
    esRecorteCompleto(transformacion.recorte) &&
    sonAjustesNeutros(transformacion.ajustes)
  )
}

/**
 * Medidas que tendrá el resultado de aplicar una transformación.
 *
 * El recorte se expresa siempre sobre la imagen tal y como se ve, es decir, ya
 * girada, porque es lo que la persona tiene delante cuando lo ajusta.
 */
export function calcularMedidasTransformadas(
  dimensiones: DimensionesImagen,
  transformacion: TransformacionImagen,
): DimensionesImagen {
  const area = calcularAreaRecorte(
    dimensiones,
    convertirRecorteAlOrigen(transformacion.recorte, transformacion.rotacion),
  )

  if (elGiroIntercambiaEjes(transformacion.rotacion)) {
    return { ancho: area.alto, alto: area.ancho }
  }

  return { ancho: area.ancho, alto: area.alto }
}

/** Opciones adicionales del dibujado. */
export interface OpcionesDibujo {
  /** Ancho máximo del resultado, en píxeles. Reduce la imagen si hace falta. */
  readonly anchoMaximo?: number
}

/**
 * Dibuja una imagen en un `canvas` nuevo aplicando recorte, giro y filtros.
 *
 * El orden es siempre el mismo: se copia el área conservada, se gira y por
 * último se ajustan los píxeles. Quien reciba el `canvas` debe vaciarlo con
 * `liberarLienzo` cuando termine.
 */
export function dibujarTransformada(
  imagen: ImagenDescodificada,
  transformacion: TransformacionImagen,
  opciones: OpcionesDibujo = {},
): HTMLCanvasElement {
  const rotacion = normalizarRotacion(transformacion.rotacion)
  const area = calcularAreaRecorte(
    imagen.dimensiones,
    convertirRecorteAlOrigen(transformacion.recorte, rotacion),
  )

  // La reducción se aplica sobre el área ya recortada, así que una miniatura
  // nunca descodifica más píxeles de los que va a mostrar.
  const escala = calcularEscala(area.ancho, opciones.anchoMaximo)
  const anchoDestino = Math.max(1, Math.round(area.ancho * escala))
  const altoDestino = Math.max(1, Math.round(area.alto * escala))

  const intercambia = elGiroIntercambiaEjes(rotacion)
  const lienzo = crearLienzo(
    intercambia ? altoDestino : anchoDestino,
    intercambia ? anchoDestino : altoDestino,
  )
  const contexto = obtenerContexto(lienzo)

  contexto.imageSmoothingEnabled = true
  contexto.imageSmoothingQuality = 'high'

  contexto.save()
  aplicarGiroAlContexto(contexto, rotacion, anchoDestino, altoDestino)
  contexto.drawImage(
    imagen.fuente,
    area.x,
    area.y,
    area.ancho,
    area.alto,
    0,
    0,
    anchoDestino,
    altoDestino,
  )
  contexto.restore()

  if (!sonAjustesNeutros(transformacion.ajustes)) {
    aplicarAjustesAlLienzo(contexto, lienzo, transformacion)
  }

  return lienzo
}

/** Calcula el factor de reducción necesario para respetar el ancho máximo. */
function calcularEscala(
  anchoOriginal: number,
  anchoMaximo: number | undefined,
): number {
  if (
    anchoMaximo === undefined ||
    !Number.isFinite(anchoMaximo) ||
    anchoMaximo <= 0 ||
    anchoOriginal <= anchoMaximo
  ) {
    return 1
  }

  return anchoMaximo / anchoOriginal
}

/**
 * Coloca el sistema de coordenadas para dibujar la imagen girada.
 *
 * Se traslada el origen a la esquina que corresponde a cada giro y después se
 * rota, de modo que la imagen se dibuje siempre en el rectángulo `(0, 0)` con
 * las medidas sin girar.
 */
function aplicarGiroAlContexto(
  contexto: CanvasRenderingContext2D,
  rotacion: GradosRotacion,
  ancho: number,
  alto: number,
): void {
  const cuartoDeVuelta = Math.PI / 2

  switch (rotacion) {
    case 90:
      contexto.translate(alto, 0)
      contexto.rotate(cuartoDeVuelta)
      break
    case 180:
      contexto.translate(ancho, alto)
      contexto.rotate(cuartoDeVuelta * 2)
      break
    case 270:
      contexto.translate(0, ancho)
      contexto.rotate(cuartoDeVuelta * 3)
      break
    case 0:
      break
  }
}

/** Lee los píxeles del lienzo, les aplica los ajustes y los vuelve a escribir. */
function aplicarAjustesAlLienzo(
  contexto: CanvasRenderingContext2D,
  lienzo: HTMLCanvasElement,
  transformacion: TransformacionImagen,
): void {
  if (transformacion.ajustes === null) {
    return
  }

  let datos: ImageData

  try {
    datos = contexto.getImageData(0, 0, lienzo.width, lienzo.height)
  } catch (error) {
    throw new ErrorImagen(
      'No se pudieron leer los píxeles de la imagen para aplicarle los ajustes.',
      { cause: error },
    )
  }

  aplicarAjustes(datos.data, transformacion.ajustes)
  contexto.putImageData(datos, 0, 0)
}

/**
 * Dibuja una imagen ya descodificada como miniatura de un ancho concreto.
 *
 * Se reutiliza el `canvas` que se le pase, que es el que ya está en el
 * documento, en lugar de crear uno nuevo en cada dibujado.
 */
export function dibujarMiniatura(
  lienzoDestino: HTMLCanvasElement,
  imagen: ImagenDescodificada,
  transformacion: TransformacionImagen,
  anchoMaximo: number,
): DimensionesImagen {
  const temporal = dibujarTransformada(imagen, transformacion, { anchoMaximo })

  lienzoDestino.width = temporal.width
  lienzoDestino.height = temporal.height

  const contexto = obtenerContexto(lienzoDestino)
  contexto.drawImage(temporal, 0, 0)

  // El lienzo temporal se vacía enseguida: una fotografía grande ocupa varios
  // megabytes y no hace falta esperar a que el recolector de basura actúe.
  temporal.width = 0
  temporal.height = 0

  return { ancho: lienzoDestino.width, alto: lienzoDestino.height }
}

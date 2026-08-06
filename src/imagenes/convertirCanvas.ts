import { ErrorImagen } from './erroresImagen'
import type { FormatoImagenPdf } from './tipos'

/**
 * Conversión de un `canvas` a bytes de imagen.
 *
 * La conversión la hace el propio navegador con `toBlob`, así que no se necesita
 * ningún codificador adicional ni ningún servicio externo. Cuando `toBlob` no
 * está disponible se recurre a `toDataURL`, que existe en todos los navegadores
 * aunque consuma algo más de memoria.
 */

/** Tipo MIME de cada formato de salida. */
export const TIPOS_MIME_SALIDA: Readonly<Record<FormatoImagenPdf, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
}

/** Extensión de archivo de cada formato de salida. */
export const EXTENSIONES_SALIDA: Readonly<Record<FormatoImagenPdf, string>> = {
  png: '.png',
  jpeg: '.jpg',
}

/** Nombre visible de cada formato de salida. */
const NOMBRE_SALIDA: Readonly<Record<FormatoImagenPdf, string>> = {
  png: 'PNG',
  jpeg: 'JPEG',
}

/** Calidad predeterminada del JPEG, entre 0 y 1. */
export const CALIDAD_JPEG_PREDETERMINADA = 0.85

/** Calidad mínima admitida del JPEG, en porcentaje. */
export const CALIDAD_MINIMA_PORCENTAJE = 30

/** Calidad máxima admitida del JPEG, en porcentaje. */
export const CALIDAD_MAXIMA_PORCENTAJE = 100

/** Devuelve el nombre visible de un formato de salida. */
export function describirFormatoSalida(formato: FormatoImagenPdf): string {
  return NOMBRE_SALIDA[formato]
}

/** Devuelve la extensión de archivo de un formato de salida. */
export function extensionDeFormato(formato: FormatoImagenPdf): string {
  return EXTENSIONES_SALIDA[formato]
}

/** Limita una calidad en porcentaje al rango admitido. */
export function limitarCalidadPorcentaje(porcentaje: number): number {
  if (!Number.isFinite(porcentaje)) {
    return Math.round(CALIDAD_JPEG_PREDETERMINADA * 100)
  }

  return Math.min(
    CALIDAD_MAXIMA_PORCENTAJE,
    Math.max(CALIDAD_MINIMA_PORCENTAJE, Math.round(porcentaje)),
  )
}

/** Convierte una calidad en porcentaje al valor de 0 a 1 que espera `toBlob`. */
export function calidadDesdePorcentaje(porcentaje: number): number {
  return limitarCalidadPorcentaje(porcentaje) / 100
}

/**
 * Convierte un `canvas` en un `Blob` con el formato indicado.
 *
 * La calidad solo se tiene en cuenta con JPEG; el PNG no tiene pérdidas, así que
 * el navegador la ignora.
 */
export function lienzoABlob(
  lienzo: HTMLCanvasElement,
  formato: FormatoImagenPdf,
  calidad = CALIDAD_JPEG_PREDETERMINADA,
): Promise<Blob> {
  const tipoMime = TIPOS_MIME_SALIDA[formato]

  if (typeof lienzo.toBlob !== 'function') {
    return Promise.resolve(convertirConUrlDeDatos(lienzo, tipoMime, calidad))
  }

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) => {
        if (blob === null) {
          rechazar(
            new ErrorImagen(
              `Este navegador no pudo convertir la imagen a ${describirFormatoSalida(
                formato,
              )}.`,
            ),
          )
          return
        }

        resolver(blob)
      },
      tipoMime,
      calidad,
    )
  })
}

/** Convierte un `canvas` en los bytes de una imagen. */
export async function lienzoABytes(
  lienzo: HTMLCanvasElement,
  formato: FormatoImagenPdf,
  calidad = CALIDAD_JPEG_PREDETERMINADA,
): Promise<Uint8Array> {
  const blob = await lienzoABlob(lienzo, formato, calidad)

  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Alternativa basada en `toDataURL` para los navegadores sin `toBlob`.
 *
 * Se descodifica el texto en base64 a mano porque `atob` está disponible en
 * todas partes y no requiere ninguna petición.
 */
function convertirConUrlDeDatos(
  lienzo: HTMLCanvasElement,
  tipoMime: string,
  calidad: number,
): Blob {
  let url: string

  try {
    url = lienzo.toDataURL(tipoMime, calidad)
  } catch (error) {
    throw new ErrorImagen(
      'Este navegador no pudo convertir la imagen a un formato que se pueda guardar.',
      { cause: error },
    )
  }

  const separador = url.indexOf(',')
  if (separador === -1) {
    throw new ErrorImagen('La conversión de la imagen devolvió un valor vacío.')
  }

  const contenido = atob(url.slice(separador + 1))
  const bytes = new Uint8Array(contenido.length)

  for (let posicion = 0; posicion < contenido.length; posicion += 1) {
    bytes[posicion] = contenido.charCodeAt(posicion)
  }

  return new Blob([bytes], { type: tipoMime })
}

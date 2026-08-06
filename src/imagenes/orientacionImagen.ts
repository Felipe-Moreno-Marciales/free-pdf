import { normalizarRotacion } from '../pdf/rotaciones'
import type { GradosRotacion } from '../pdf/tipos'
import type { DimensionesImagen } from './tipos'

/**
 * Orientación declarada por la propia imagen y giros aplicados por la persona.
 *
 * Muchas fotografías guardan en sus metadatos EXIF la orientación con la que se
 * tomaron. No se interpretan esos metadatos a mano: se le pide al navegador que
 * los aplique al descodificar, que es la única forma fiable y además no
 * requiere ninguna dependencia.
 */

/**
 * Valor que le indica al navegador que respete la orientación de la imagen.
 *
 * Lo admiten `createImageBitmap` en los navegadores actuales. Cuando no está
 * disponible se recurre a un elemento `<img>`, que aplica la orientación por
 * su cuenta desde hace años.
 */
export const ORIENTACION_DESDE_IMAGEN = 'from-image'

/** Opciones de descodificación que respetan la orientación declarada. */
export function opcionesOrientacion(): ImageBitmapOptions {
  return { imageOrientation: ORIENTACION_DESDE_IMAGEN }
}

/**
 * Comprueba si el navegador ofrece `createImageBitmap`.
 *
 * Cuando no existe se usa la alternativa basada en `<img>`, así que la
 * herramienta funciona igual aunque con un consumo de memoria algo mayor.
 */
export function admiteMapaDeBits(): boolean {
  return typeof createImageBitmap === 'function'
}

/**
 * Devuelve las medidas que tendrá una imagen después de girarla.
 *
 * Con un cuarto o tres cuartos de vuelta el ancho y el alto se intercambian;
 * con media vuelta se conservan.
 */
export function dimensionesTrasRotar(
  dimensiones: DimensionesImagen,
  rotacion: GradosRotacion,
): DimensionesImagen {
  const normalizada = normalizarRotacion(rotacion)

  if (normalizada === 90 || normalizada === 270) {
    return { ancho: dimensiones.alto, alto: dimensiones.ancho }
  }

  return dimensiones
}

/** `true` si el giro intercambia el ancho y el alto de la imagen. */
export function elGiroIntercambiaEjes(rotacion: GradosRotacion): boolean {
  const normalizada = normalizarRotacion(rotacion)

  return normalizada === 90 || normalizada === 270
}

/** Describe las medidas de una imagen en español, para los textos accesibles. */
export function describirDimensiones(
  dimensiones: DimensionesImagen | null,
): string {
  if (dimensiones === null) {
    return 'medidas desconocidas'
  }

  return `${dimensiones.ancho} × ${dimensiones.alto} píxeles`
}

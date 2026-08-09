/**
 * Conversión entre las unidades que intervienen en un documento PDF.
 *
 * El formato PDF mide en puntos tipográficos: una pulgada equivale a 72
 * puntos, sin depender de la pantalla ni de la impresora. Las personas, en
 * cambio, piensan en milímetros, así que las herramientas piden milímetros y
 * convierten aquí.
 *
 * Este módulo es puro: no depende de React ni del navegador.
 */

/** Puntos PDF que ocupa una pulgada. */
export const PUNTOS_POR_PULGADA = 72

/** Milímetros que ocupa una pulgada. */
export const MILIMETROS_POR_PULGADA = 25.4

/**
 * Densidad con la que se interpretan los píxeles de una imagen.
 *
 * Se usan 96 píxeles por pulgada, la densidad de referencia de la web, así que
 * una imagen de 96 píxeles de ancho ocupa una pulgada de papel. Es la
 * conversión que aplica el tamaño de página «original»: una fotografía de
 * muchos megapíxeles produce, por tanto, una página muy grande.
 */
export const PIXELES_POR_PULGADA = 96

/** Convierte milímetros a puntos PDF. */
export function milimetrosAPuntos(milimetros: number): number {
  if (!Number.isFinite(milimetros)) {
    return 0
  }

  return (milimetros * PUNTOS_POR_PULGADA) / MILIMETROS_POR_PULGADA
}

/** Convierte puntos PDF a milímetros. */
export function puntosAMilimetros(puntos: number): number {
  if (!Number.isFinite(puntos)) {
    return 0
  }

  return (puntos * MILIMETROS_POR_PULGADA) / PUNTOS_POR_PULGADA
}

/** Convierte píxeles de imagen a puntos PDF, a 96 píxeles por pulgada. */
export function pixelesAPuntos(pixeles: number): number {
  if (!Number.isFinite(pixeles)) {
    return 0
  }

  return (pixeles * PUNTOS_POR_PULGADA) / PIXELES_POR_PULGADA
}

/** Redondea un valor a un número concreto de decimales. */
export function redondearDecimales(valor: number, decimales: number): number {
  if (!Number.isFinite(valor)) {
    return 0
  }

  const factor = 10 ** decimales

  return Math.round(valor * factor) / factor
}

/**
 * Da formato a una medida en milímetros para mostrarla en la interfaz.
 * Se usa la coma como separador decimal, como corresponde en español.
 */
export function formatearMilimetros(milimetros: number): string {
  return `${redondearDecimales(milimetros, 1).toLocaleString('es-ES', {
    maximumFractionDigits: 1,
  })} mm`
}

/** Da formato a una medida en puntos PDF para mostrarla en la interfaz. */
export function formatearPuntos(puntos: number): string {
  return `${redondearDecimales(puntos, 1).toLocaleString('es-ES', {
    maximumFractionDigits: 1,
  })} pt`
}

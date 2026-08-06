/**
 * Interpretación de los colores que se escriben en la interfaz.
 *
 * El control `<input type="color">` del navegador siempre devuelve la forma
 * `#rrggbb`, pero el campo de texto que lo acompaña admite además la forma
 * abreviada `#rgb` y tolera que falte la almohadilla. Todo se normaliza aquí, de
 * modo que pdf-lib reciba siempre componentes entre 0 y 1.
 *
 * Este módulo es puro y no depende de pdf-lib.
 */

/** Color con sus componentes entre 0 y 1, como los espera pdf-lib. */
export interface ColorRgb {
  /** Componente rojo, entre 0 y 1. */
  readonly rojo: number
  /** Componente verde, entre 0 y 1. */
  readonly verde: number
  /** Componente azul, entre 0 y 1. */
  readonly azul: number
}

/** Blanco, el color de fondo predeterminado. */
export const BLANCO: ColorRgb = { rojo: 1, verde: 1, azul: 1 }

/** Negro, el color predeterminado del texto. */
export const NEGRO: ColorRgb = { rojo: 0, verde: 0, azul: 0 }

/** Valor máximo de un componente en notación hexadecimal. */
const MAXIMO = 255

/** Reconoce la forma abreviada, por ejemplo `#f0a`. */
const ABREVIADO = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i

/** Reconoce la forma completa, por ejemplo `#ff00aa`. */
const COMPLETO = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

/**
 * Interpreta un color escrito en notación hexadecimal.
 * Devuelve `null` cuando el texto no es un color válido.
 */
export function interpretarColor(texto: string): ColorRgb | null {
  const limpio = texto.trim()

  const abreviado = ABREVIADO.exec(limpio)
  if (abreviado !== null) {
    return {
      rojo: Number.parseInt(`${abreviado[1]}${abreviado[1]}`, 16) / MAXIMO,
      verde: Number.parseInt(`${abreviado[2]}${abreviado[2]}`, 16) / MAXIMO,
      azul: Number.parseInt(`${abreviado[3]}${abreviado[3]}`, 16) / MAXIMO,
    }
  }

  const completo = COMPLETO.exec(limpio)
  if (completo !== null) {
    return {
      rojo: Number.parseInt(completo[1], 16) / MAXIMO,
      verde: Number.parseInt(completo[2], 16) / MAXIMO,
      azul: Number.parseInt(completo[3], 16) / MAXIMO,
    }
  }

  return null
}

/** `true` cuando el texto es un color hexadecimal válido. */
export function esColorValido(texto: string): boolean {
  return interpretarColor(texto) !== null
}

/**
 * Normaliza un color a la forma `#rrggbb` en minúsculas.
 * Devuelve `null` cuando el texto no es un color válido.
 */
export function normalizarColor(texto: string): string | null {
  const color = interpretarColor(texto)

  if (color === null) {
    return null
  }

  return `#${componenteHexadecimal(color.rojo)}${componenteHexadecimal(
    color.verde,
  )}${componenteHexadecimal(color.azul)}`
}

/** Convierte un componente de 0 a 1 en dos dígitos hexadecimales. */
function componenteHexadecimal(valor: number): string {
  const entero = Math.min(MAXIMO, Math.max(0, Math.round(valor * MAXIMO)))

  return entero.toString(16).padStart(2, '0')
}

/**
 * Interpreta un color y recurre a una alternativa si el texto no es válido.
 * Así el procesamiento nunca falla por un color mal escrito.
 */
export function interpretarColorConReserva(
  texto: string,
  reserva: ColorRgb,
): ColorRgb {
  return interpretarColor(texto) ?? reserva
}

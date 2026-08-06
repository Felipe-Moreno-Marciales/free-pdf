/**
 * Comprobación del texto que se puede escribir con las tipografías estándar.
 *
 * pdf-lib incluye las catorce tipografías estándar del formato PDF, que no hay
 * que descargar de ningún sitio. En cambio solo pueden representar los caracteres
 * de la codificación WinAnsi: cubren el español completo —tildes, eñes, signos de
 * apertura y comillas—, pero no los alfabetos griego, cirílico o asiático ni los
 * emoticonos.
 *
 * Si se intenta escribir un carácter que no cubren, pdf-lib falla. Aquí se
 * comprueba antes, de modo que la interfaz pueda avisar con un mensaje claro en
 * lugar de dejar que el proceso se rompa. Incrustar otra tipografía queda fuera
 * de esta fase, porque obligaría a distribuir archivos de tipografía completos.
 *
 * Este módulo es puro y no depende de pdf-lib.
 */

/** Nombre de la tipografía estándar que se usa. */
export const NOMBRE_TIPOGRAFIA = 'Helvetica'

/**
 * Caracteres que WinAnsi cubre por encima del intervalo latino.
 *
 * Son los que la codificación coloca entre 0x80 y 0x9F: el símbolo del euro, las
 * comillas tipográficas, las rayas, los puntos suspensivos y algunas letras de
 * otras lenguas europeas.
 */
const CARACTERES_ADICIONALES = new Set([
  '€', // €
  '‚', // ‚
  'ƒ', // ƒ
  '„', // „
  '…', // …
  '†', // †
  '‡', // ‡
  'ˆ', // ˆ
  '‰', // ‰
  'Š', // Š
  '‹', // ‹
  'Œ', // Œ
  'Ž', // Ž
  '‘', // ‘
  '’', // ’
  '“', // “
  '”', // ”
  '•', // •
  '–', // –
  '—', // —
  '˜', // ˜
  '™', // ™
  'š', // š
  '›', // ›
  'œ', // œ
  'ž', // ž
  'Ÿ', // Ÿ
])

/** `true` si el carácter se puede escribir con una tipografía estándar. */
export function esCaracterRepresentable(caracter: string): boolean {
  const codigo = caracter.codePointAt(0)

  if (codigo === undefined) {
    return false
  }

  // Intervalo imprimible del ASCII.
  if (codigo >= 0x20 && codigo <= 0x7e) {
    return true
  }

  // Suplemento latino 1, que incluye todas las letras acentuadas del español.
  if (codigo >= 0xa0 && codigo <= 0xff) {
    return true
  }

  return CARACTERES_ADICIONALES.has(caracter)
}

/**
 * Devuelve el primer carácter que no se puede representar, o `null` si todos
 * se pueden.
 */
export function encontrarCaracterNoRepresentable(
  texto: string,
): string | null {
  // Se recorre con `for…of` para tratar correctamente los caracteres formados
  // por más de una unidad de código, como los emoticonos.
  for (const caracter of texto) {
    if (!esCaracterRepresentable(caracter)) {
      return caracter
    }
  }

  return null
}

/** `true` cuando todo el texto se puede escribir con una tipografía estándar. */
export function esTextoRepresentable(texto: string): boolean {
  return encontrarCaracterNoRepresentable(texto) === null
}

/**
 * Redacta el aviso que corresponde a un texto con caracteres no admitidos.
 * Devuelve `null` cuando el texto se puede escribir sin problemas.
 */
export function describirCaracterNoRepresentable(
  texto: string,
): string | null {
  const caracter = encontrarCaracterNoRepresentable(texto)

  if (caracter === null) {
    return null
  }

  return `El carácter «${caracter}» no se puede escribir con la tipografía ${NOMBRE_TIPOGRAFIA}, que es la que el formato PDF incluye de serie. Quítalo o sustitúyelo: se admiten las letras y los signos del español, incluidos los acentos y la eñe.`
}

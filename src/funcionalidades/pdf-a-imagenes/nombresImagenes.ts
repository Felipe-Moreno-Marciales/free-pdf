import { extensionDeFormato } from '../../imagenes/convertirCanvas'
import type { FormatoImagenPdf } from '../../imagenes/tipos'
import { normalizarNombreBase } from '../../utilidades/nombresArchivo'

/**
 * Nombres de los archivos de imagen que produce la conversión.
 *
 * Este módulo es puro, así que se puede comprobar por separado que los nombres
 * quedan ordenados y sin caracteres problemáticos.
 */

/**
 * Número mínimo de dígitos del número de página.
 *
 * Se usan siempre al menos tres —`pagina-001`— para que el orden alfabético con
 * el que los sistemas de archivos y los programas de compresión muestran el
 * contenido coincida con el orden de las páginas.
 */
export const DIGITOS_MINIMOS = 3

/** Nombre del paquete que agrupa varias imágenes. */
export const NOMBRE_ZIP_IMAGENES = 'free-pdf-imagenes.zip'

/** Rellena un número con ceros a la izquierda hasta el ancho indicado. */
export function rellenarConCeros(numero: number, ancho: number): string {
  return String(Math.max(0, Math.trunc(numero))).padStart(ancho, '0')
}

/**
 * Calcula cuántos dígitos hay que usar para una lista de páginas.
 *
 * Se toma el número mayor, no la cantidad de páginas: si se convierten las
 * páginas 5 y 120, hacen falta tres dígitos aunque solo sean dos imágenes.
 */
export function calcularAnchoNumero(
  numerosPagina: readonly number[],
): number {
  const mayor = numerosPagina.reduce(
    (maximo, numero) => Math.max(maximo, numero),
    0,
  )

  return Math.max(DIGITOS_MINIMOS, String(mayor).length)
}

/**
 * Construye el nombre de la imagen de una página.
 *
 * Por ejemplo, `informe.pdf` con la página 1 de un total de 5 produce
 * `informe-pagina-001.png`.
 */
export function construirNombreImagen(
  nombreDocumento: string,
  numeroPagina: number,
  anchoNumero: number,
  formato: FormatoImagenPdf,
): string {
  const base = normalizarNombreBase(nombreDocumento)
  const numero = rellenarConCeros(numeroPagina, anchoNumero)

  return `${base}-pagina-${numero}${extensionDeFormato(formato)}`
}

/**
 * Construye los nombres de todas las páginas de una lista.
 * El ancho del número se calcula una sola vez para toda la lista.
 */
export function construirNombresImagenes(
  nombreDocumento: string,
  numerosPagina: readonly number[],
  formato: FormatoImagenPdf,
): readonly string[] {
  const ancho = calcularAnchoNumero(numerosPagina)

  return numerosPagina.map((numero) =>
    construirNombreImagen(nombreDocumento, numero, ancho, formato),
  )
}

/**
 * Ayudas numéricas compartidas.
 *
 * Están aquí, y no dentro de una herramienta concreta, porque las necesitan varias:
 * la numeración de páginas, la marca de agua y el editor visual hacen lo mismo con
 * los valores que llegan de la interfaz.
 */

/**
 * Deja un número dentro de un intervalo.
 *
 * Un valor no finito devuelve el mínimo en lugar de propagarse: los `NaN` que
 * llegan de un campo de texto vacío llegarían hasta pdf-lib y allí producen un
 * documento corrupto sin ningún mensaje de error.
 */
export function limitar(valor: number, minimo: number, maximo: number): number {
  if (!Number.isFinite(valor)) {
    return minimo
  }

  return Math.min(maximo, Math.max(minimo, valor))
}

/** Deja un giro en el intervalo de 0 a 360 grados, incluido el caso negativo. */
export function normalizarGiro(grados: number): number {
  if (!Number.isFinite(grados)) {
    return 0
  }

  const resto = grados % 360

  return resto < 0 ? resto + 360 : resto
}

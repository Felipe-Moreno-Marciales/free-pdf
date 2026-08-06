import type { GradosRotacion, SentidoGiro } from './tipos'

/** Rotaciones admitidas, en grados. */
const ROTACIONES: readonly GradosRotacion[] = [0, 90, 180, 270]

/** Grados que ocupa una vuelta completa. */
const VUELTA_COMPLETA = 360

/** Grados de un cuarto de vuelta. */
export const CUARTO_DE_VUELTA = 90

/** Grados de media vuelta. */
export const MEDIA_VUELTA = 180

/**
 * Normaliza cualquier ángulo a 0, 90, 180 o 270 grados.
 *
 * Se admiten valores negativos y superiores a 360. Los ángulos que no son
 * múltiplos de 90 se redondean al múltiplo más cercano, porque pdf-lib solo
 * acepta cuartos de vuelta.
 */
export function normalizarRotacion(grados: number): GradosRotacion {
  if (!Number.isFinite(grados)) {
    return 0
  }

  const cuartos = Math.round(grados / CUARTO_DE_VUELTA)
  const indice = ((cuartos % 4) + 4) % 4

  return ROTACIONES[indice] ?? 0
}

/** Suma dos rotaciones y normaliza el resultado. */
export function sumarRotacion(
  actual: GradosRotacion,
  incremento: number,
): GradosRotacion {
  return normalizarRotacion(actual + incremento)
}

/** Devuelve los grados que corresponden a un giro de un cuarto de vuelta. */
export function gradosDelGiro(sentido: SentidoGiro): number {
  return sentido === 'derecha' ? CUARTO_DE_VUELTA : VUELTA_COMPLETA - CUARTO_DE_VUELTA
}

/** Describe una rotación en español, para los textos accesibles. */
export function describirRotacion(rotacion: GradosRotacion): string {
  return rotacion === 0 ? 'sin rotación' : `rotada ${rotacion} grados`
}

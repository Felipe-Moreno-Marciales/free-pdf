import { normalizarRotacion } from '../pdf/rotaciones'
import type { GradosRotacion } from '../pdf/tipos'
import type { DimensionesImagen, RecorteRelativo } from './tipos'

/**
 * Recorte de imágenes expresado en fracciones.
 *
 * Guardar el recorte como fracciones del ancho y del alto —y no en píxeles—
 * permite mostrar la misma vista previa a cualquier escala y aplicar después el
 * recorte sobre la imagen a resolución completa. Todas las funciones son puras.
 */

/** Recorte que conserva la imagen completa. */
export const RECORTE_COMPLETO: RecorteRelativo = {
  izquierda: 0,
  superior: 0,
  derecha: 0,
  inferior: 0,
}

/**
 * Fracción mínima que debe quedar de cada lado.
 *
 * Impide recortes que dejarían la imagen sin píxeles y, con ella, páginas
 * vacías en el documento resultante.
 */
export const FRACCION_MINIMA_RESTANTE = 0.05

/** Limita una fracción al rango de 0 a 1. */
function limitarFraccion(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) {
    return 0
  }

  return Math.min(1, valor)
}

/**
 * Normaliza un recorte para que sea siempre aplicable.
 *
 * Se descartan los valores negativos o no numéricos y se reducen de forma
 * proporcional los lados opuestos cuando entre los dos consumirían más de lo
 * permitido, de modo que nunca se obtiene un ancho o un alto igual a cero.
 */
export function normalizarRecorte(recorte: RecorteRelativo): RecorteRelativo {
  const [izquierda, derecha] = repartirEje(
    limitarFraccion(recorte.izquierda),
    limitarFraccion(recorte.derecha),
  )
  const [superior, inferior] = repartirEje(
    limitarFraccion(recorte.superior),
    limitarFraccion(recorte.inferior),
  )

  return { izquierda, superior, derecha, inferior }
}

/**
 * Ajusta los dos recortes de un mismo eje para que dejen píxeles suficientes.
 * Si entre ambos superan el límite se reducen manteniendo su proporción.
 */
function repartirEje(
  primero: number,
  segundo: number,
): readonly [number, number] {
  const maximo = 1 - FRACCION_MINIMA_RESTANTE
  const suma = primero + segundo

  if (suma <= maximo) {
    return [primero, segundo]
  }

  if (suma === 0) {
    return [0, 0]
  }

  const factor = maximo / suma

  return [primero * factor, segundo * factor]
}

/** `true` cuando el recorte conserva la imagen completa. */
export function esRecorteCompleto(recorte: RecorteRelativo | null): boolean {
  if (recorte === null) {
    return true
  }

  return (
    recorte.izquierda === 0 &&
    recorte.superior === 0 &&
    recorte.derecha === 0 &&
    recorte.inferior === 0
  )
}

/** Fracción del ancho que sobrevive al recorte. */
export function fraccionAnchoRestante(recorte: RecorteRelativo): number {
  const normalizado = normalizarRecorte(recorte)

  return 1 - normalizado.izquierda - normalizado.derecha
}

/** Fracción del alto que sobrevive al recorte. */
export function fraccionAltoRestante(recorte: RecorteRelativo): number {
  const normalizado = normalizarRecorte(recorte)

  return 1 - normalizado.superior - normalizado.inferior
}

/** Área en píxeles que se conserva de la imagen original. */
export interface AreaRecorte {
  /** Píxeles descartados por la izquierda. */
  readonly x: number
  /** Píxeles descartados por arriba. */
  readonly y: number
  /** Ancho conservado, en píxeles. */
  readonly ancho: number
  /** Alto conservado, en píxeles. */
  readonly alto: number
}

/**
 * Traduce un recorte relativo al área en píxeles que hay que copiar.
 *
 * Las medidas se redondean a píxeles enteros, porque `drawImage` no admite
 * fracciones de píxel de forma fiable, y se garantiza al menos un píxel de
 * ancho y de alto.
 */
export function calcularAreaRecorte(
  dimensiones: DimensionesImagen,
  recorte: RecorteRelativo | null,
): AreaRecorte {
  if (recorte === null) {
    return {
      x: 0,
      y: 0,
      ancho: Math.max(1, Math.round(dimensiones.ancho)),
      alto: Math.max(1, Math.round(dimensiones.alto)),
    }
  }

  const normalizado = normalizarRecorte(recorte)

  const x = Math.round(dimensiones.ancho * normalizado.izquierda)
  const y = Math.round(dimensiones.alto * normalizado.superior)
  const ancho = Math.max(
    1,
    Math.round(dimensiones.ancho * fraccionAnchoRestante(normalizado)),
  )
  const alto = Math.max(
    1,
    Math.round(dimensiones.alto * fraccionAltoRestante(normalizado)),
  )

  return {
    x: Math.min(x, dimensiones.ancho - 1),
    y: Math.min(y, dimensiones.alto - 1),
    ancho: Math.min(ancho, dimensiones.ancho),
    alto: Math.min(alto, dimensiones.alto),
  }
}

/** Medidas que tendrá la imagen después de recortarla. */
export function dimensionesTrasRecortar(
  dimensiones: DimensionesImagen,
  recorte: RecorteRelativo | null,
): DimensionesImagen {
  const area = calcularAreaRecorte(dimensiones, recorte)

  return { ancho: area.ancho, alto: area.alto }
}

/**
 * Construye el recorte centrado que iguala la proporción de la imagen a la del
 * área de destino.
 *
 * Es lo que necesita el modo «cubrir»: se descarta lo mismo por los dos lados
 * del eje que sobra, así que el motivo de la imagen queda centrado.
 */
export function calcularRecorteParaProporcion(
  dimensiones: DimensionesImagen,
  proporcionDestino: number,
): RecorteRelativo {
  if (
    dimensiones.ancho <= 0 ||
    dimensiones.alto <= 0 ||
    !Number.isFinite(proporcionDestino) ||
    proporcionDestino <= 0
  ) {
    return RECORTE_COMPLETO
  }

  const proporcionOrigen = dimensiones.ancho / dimensiones.alto

  if (proporcionOrigen > proporcionDestino) {
    // La imagen es más ancha de lo necesario: se recorta por los costados.
    const conservado = proporcionDestino / proporcionOrigen
    const descartado = (1 - conservado) / 2

    return { ...RECORTE_COMPLETO, izquierda: descartado, derecha: descartado }
  }

  if (proporcionOrigen < proporcionDestino) {
    // La imagen es más alta de lo necesario: se recorta por arriba y por abajo.
    const conservado = proporcionOrigen / proporcionDestino
    const descartado = (1 - conservado) / 2

    return { ...RECORTE_COMPLETO, superior: descartado, inferior: descartado }
  }

  return RECORTE_COMPLETO
}

/**
 * Combina dos recortes aplicados uno después del otro.
 *
 * El segundo se interpreta sobre lo que quedó del primero, así que sus
 * fracciones se reescalan a lo que ese primer recorte conservó. Es lo que
 * necesita «Escanear a PDF», donde la persona recorta la captura y después el
 * modo «cubrir» recorta un poco más para ajustar la proporción a la página.
 */
export function componerRecortes(
  primero: RecorteRelativo | null,
  segundo: RecorteRelativo | null,
): RecorteRelativo | null {
  if (primero === null) {
    return segundo
  }

  if (segundo === null) {
    return primero
  }

  const base = normalizarRecorte(primero)
  const encima = normalizarRecorte(segundo)

  const anchoRestante = 1 - base.izquierda - base.derecha
  const altoRestante = 1 - base.superior - base.inferior

  return normalizarRecorte({
    izquierda: base.izquierda + encima.izquierda * anchoRestante,
    derecha: base.derecha + encima.derecha * anchoRestante,
    superior: base.superior + encima.superior * altoRestante,
    inferior: base.inferior + encima.inferior * altoRestante,
  })
}

/**
 * Traduce un recorte expresado sobre la imagen ya girada al recorte equivalente
 * sobre la imagen original.
 *
 * Las herramientas guardan el recorte tal y como la persona lo ve, es decir,
 * sobre la imagen girada. `drawImage`, en cambio, copia un área de la imagen sin
 * girar, así que hay que rotar el rectángulo en sentido contrario.
 *
 * Con un cuarto de vuelta a la derecha, el borde superior de lo que se ve
 * proviene del borde izquierdo del original, el derecho del superior, el
 * inferior del derecho y el izquierdo del inferior.
 */
export function convertirRecorteAlOrigen(
  recorte: RecorteRelativo | null,
  rotacion: GradosRotacion,
): RecorteRelativo | null {
  if (recorte === null) {
    return null
  }

  switch (normalizarRotacion(rotacion)) {
    case 90:
      return {
        izquierda: recorte.superior,
        superior: recorte.derecha,
        derecha: recorte.inferior,
        inferior: recorte.izquierda,
      }
    case 180:
      return {
        izquierda: recorte.derecha,
        superior: recorte.inferior,
        derecha: recorte.izquierda,
        inferior: recorte.superior,
      }
    case 270:
      return {
        izquierda: recorte.inferior,
        superior: recorte.izquierda,
        derecha: recorte.superior,
        inferior: recorte.derecha,
      }
    case 0:
      return recorte
  }
}

/** Describe un recorte en español, para los textos accesibles. */
export function describirRecorte(recorte: RecorteRelativo | null): string {
  if (recorte === null || esRecorteCompleto(recorte)) {
    return 'sin recortar'
  }

  const normalizado = normalizarRecorte(recorte)
  const porcentaje = (valor: number): string => `${Math.round(valor * 100)} %`

  return `recortada ${porcentaje(normalizado.superior)} arriba, ${porcentaje(
    normalizado.derecha,
  )} a la derecha, ${porcentaje(normalizado.inferior)} abajo y ${porcentaje(
    normalizado.izquierda,
  )} a la izquierda`
}

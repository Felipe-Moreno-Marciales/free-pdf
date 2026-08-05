import {
  calcularMedidasVisibles,
  puntoVisibleAPdf,
  type CajaPagina,
} from '../../pdf/posicionarEnPagina'
import type { GradosRotacion } from '../../pdf/tipos'
import { milimetrosAPuntos, puntosAMilimetros } from '../../utilidades/unidades'
import type {
  MargenesRecorte,
  MedidasRecorte,
  RectanguloPdf,
  UnidadRecorte,
} from './tipos'

/**
 * Conversión de unidades y cálculo de la caja de recorte.
 *
 * Todas las funciones son puras y no dependen de pdf-lib, así que se puede
 * comprobar por separado que la conversión de milímetros a puntos es correcta,
 * que los recortes inválidos se rechazan y que la caja resultante es la esperada
 * incluso en las páginas que llevan rotación propia.
 */

/** Márgenes que no recortan nada. */
export const MARGENES_CERO: MargenesRecorte = {
  superior: 0,
  derecho: 0,
  inferior: 0,
  izquierdo: 0,
}

/**
 * Medida mínima que debe conservar la página, en puntos.
 *
 * Un punto es aproximadamente un tercio de milímetro: por debajo de eso la
 * página dejaría de tener sentido y algunos visores la rechazarían.
 */
export const MEDIDA_MINIMA = 1

/** Nombre visible de cada unidad. */
const NOMBRE_UNIDAD: Readonly<Record<UnidadRecorte, string>> = {
  milimetros: 'Milímetros',
  puntos: 'Puntos PDF',
}

/** Abreviatura de cada unidad. */
const ABREVIATURA_UNIDAD: Readonly<Record<UnidadRecorte, string>> = {
  milimetros: 'mm',
  puntos: 'pt',
}

/** Devuelve el nombre visible de una unidad. */
export function describirUnidad(unidad: UnidadRecorte): string {
  return NOMBRE_UNIDAD[unidad]
}

/** Devuelve la abreviatura de una unidad. */
export function abreviarUnidad(unidad: UnidadRecorte): string {
  return ABREVIATURA_UNIDAD[unidad]
}

/** Convierte un valor de la unidad indicada a puntos PDF. */
export function aPuntos(valor: number, unidad: UnidadRecorte): number {
  return unidad === 'milimetros' ? milimetrosAPuntos(valor) : valor
}

/** Convierte un valor en puntos PDF a la unidad indicada. */
export function desdePuntos(puntos: number, unidad: UnidadRecorte): number {
  return unidad === 'milimetros' ? puntosAMilimetros(puntos) : puntos
}

/** Convierte los cuatro márgenes a puntos PDF. */
export function convertirMargenesAPuntos(
  margenes: MargenesRecorte,
  unidad: UnidadRecorte,
): MargenesRecorte {
  return {
    superior: aPuntos(margenes.superior, unidad),
    derecho: aPuntos(margenes.derecho, unidad),
    inferior: aPuntos(margenes.inferior, unidad),
    izquierdo: aPuntos(margenes.izquierdo, unidad),
  }
}

/** Convierte los cuatro márgenes de puntos PDF a la unidad indicada. */
export function convertirMargenesDesdePuntos(
  margenes: MargenesRecorte,
  unidad: UnidadRecorte,
): MargenesRecorte {
  return {
    superior: desdePuntos(margenes.superior, unidad),
    derecho: desdePuntos(margenes.derecho, unidad),
    inferior: desdePuntos(margenes.inferior, unidad),
    izquierdo: desdePuntos(margenes.izquierdo, unidad),
  }
}

/** Resultado de comprobar si un recorte se puede aplicar. */
export interface ResultadoValidacionRecorte {
  /** `true` cuando el recorte se puede aplicar. */
  readonly valido: boolean
  /** Mensaje en español listo para mostrar, o `null` si el recorte es válido. */
  readonly mensaje: string | null
  /** Medidas que tendrá el área visible, en puntos. */
  readonly resultantes: MedidasRecorte
}

/**
 * Calcula las medidas que quedarán después de recortar.
 * No comprueba nada: puede devolver medidas negativas si los márgenes se pasan.
 */
export function calcularMedidasResultantes(
  visibles: MedidasRecorte,
  margenesPuntos: MargenesRecorte,
): MedidasRecorte {
  return {
    ancho: visibles.ancho - margenesPuntos.izquierdo - margenesPuntos.derecho,
    alto: visibles.alto - margenesPuntos.superior - margenesPuntos.inferior,
  }
}

/**
 * Comprueba que un recorte se pueda aplicar.
 *
 * Se rechazan los valores que no son números, los negativos y los que dejarían la
 * página sin anchura o sin altura. Cada caso tiene su propio mensaje, de modo que
 * quede claro qué hay que corregir.
 */
export function validarRecorte(
  visibles: MedidasRecorte,
  margenesPuntos: MargenesRecorte,
): ResultadoValidacionRecorte {
  const resultantes = calcularMedidasResultantes(visibles, margenesPuntos)

  const valores = [
    { nombre: 'superior', valor: margenesPuntos.superior },
    { nombre: 'derecho', valor: margenesPuntos.derecho },
    { nombre: 'inferior', valor: margenesPuntos.inferior },
    { nombre: 'izquierdo', valor: margenesPuntos.izquierdo },
  ]

  for (const { nombre, valor } of valores) {
    if (!Number.isFinite(valor)) {
      return {
        valido: false,
        mensaje: `El margen ${nombre} no es un número válido.`,
        resultantes,
      }
    }

    if (valor < 0) {
      return {
        valido: false,
        mensaje: `El margen ${nombre} no puede ser negativo.`,
        resultantes,
      }
    }
  }

  if (resultantes.ancho < MEDIDA_MINIMA) {
    return {
      valido: false,
      mensaje:
        'Los márgenes izquierdo y derecho suman más que el ancho de la página, así que no quedaría nada visible.',
      resultantes,
    }
  }

  if (resultantes.alto < MEDIDA_MINIMA) {
    return {
      valido: false,
      mensaje:
        'Los márgenes superior e inferior suman más que el alto de la página, así que no quedaría nada visible.',
      resultantes,
    }
  }

  return { valido: true, mensaje: null, resultantes }
}

/**
 * Calcula la caja de recorte en coordenadas PDF.
 *
 * Los márgenes se escriben sobre la página tal y como se ve, así que «superior»
 * es siempre el borde de arriba para quien mira el documento, incluso en una
 * página apaisada por su propia rotación. Aquí se traducen a las coordenadas
 * internas del documento, que no giran.
 *
 * Como las rotaciones de una página PDF son siempre múltiplos de noventa grados,
 * el rectángulo sigue teniendo los lados paralelos a los ejes: basta con
 * transformar dos esquinas opuestas y quedarse con los extremos.
 */
export function calcularCajaRecorte(
  caja: CajaPagina,
  rotacion: GradosRotacion,
  margenesPuntos: MargenesRecorte,
): RectanguloPdf {
  const visibles = calcularMedidasVisibles(caja, rotacion)

  const esquinaInferior = puntoVisibleAPdf(caja, rotacion, {
    x: margenesPuntos.izquierdo,
    y: margenesPuntos.inferior,
  })
  const esquinaSuperior = puntoVisibleAPdf(caja, rotacion, {
    x: visibles.ancho - margenesPuntos.derecho,
    y: visibles.alto - margenesPuntos.superior,
  })

  const x = Math.min(esquinaInferior.x, esquinaSuperior.x)
  const y = Math.min(esquinaInferior.y, esquinaSuperior.y)

  return {
    x,
    y,
    ancho: Math.abs(esquinaSuperior.x - esquinaInferior.x),
    alto: Math.abs(esquinaSuperior.y - esquinaInferior.y),
  }
}

/** `true` cuando los márgenes no recortan nada. */
export function noRecortaNada(margenes: MargenesRecorte): boolean {
  return (
    margenes.superior === 0 &&
    margenes.derecho === 0 &&
    margenes.inferior === 0 &&
    margenes.izquierdo === 0
  )
}

/**
 * Calcula el recorte en fracciones del ancho y del alto visibles.
 * Lo usa el editor visual para dibujar el rectángulo de recorte.
 */
export function calcularFraccionesRecorte(
  visibles: MedidasRecorte,
  margenesPuntos: MargenesRecorte,
): {
  readonly izquierda: number
  readonly superior: number
  readonly derecha: number
  readonly inferior: number
} {
  const limitar = (valor: number): number =>
    Math.min(1, Math.max(0, Number.isFinite(valor) ? valor : 0))

  return {
    izquierda: limitar(margenesPuntos.izquierdo / visibles.ancho),
    derecha: limitar(margenesPuntos.derecho / visibles.ancho),
    superior: limitar(margenesPuntos.superior / visibles.alto),
    inferior: limitar(margenesPuntos.inferior / visibles.alto),
  }
}

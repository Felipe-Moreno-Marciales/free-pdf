import { describe, expect, it } from 'vitest'
import {
  BLANCO,
  esColorValido,
  interpretarColor,
  interpretarColorConReserva,
  NEGRO,
  normalizarColor,
} from '../pdf/colores'
import {
  describirCaracterNoRepresentable,
  encontrarCaracterNoRepresentable,
  esCaracterRepresentable,
  esTextoRepresentable,
  NOMBRE_TIPOGRAFIA,
} from '../pdf/textoEstandar'
import {
  formatearMilimetros,
  formatearPuntos,
  MILIMETROS_POR_PULGADA,
  milimetrosAPuntos,
  pixelesAPuntos,
  PUNTOS_POR_PULGADA,
  puntosAMilimetros,
  redondearDecimales,
} from '../utilidades/unidades'

describe('conversión de unidades', () => {
  it('una pulgada son 72 puntos y 25,4 milímetros', () => {
    expect(PUNTOS_POR_PULGADA).toBe(72)
    expect(MILIMETROS_POR_PULGADA).toBe(25.4)
  })

  it('convierte milímetros a puntos', () => {
    expect(milimetrosAPuntos(25.4)).toBeCloseTo(72, 6)
    expect(milimetrosAPuntos(10)).toBeCloseTo(28.34645669, 6)
    expect(milimetrosAPuntos(0)).toBe(0)
  })

  it('convierte puntos a milímetros', () => {
    expect(puntosAMilimetros(72)).toBeCloseTo(25.4, 6)
    expect(puntosAMilimetros(0)).toBe(0)
  })

  it('las dos conversiones son inversas', () => {
    for (const milimetros of [0, 1, 5, 10, 20, 33.7, 210, 297]) {
      expect(puntosAMilimetros(milimetrosAPuntos(milimetros))).toBeCloseTo(
        milimetros,
        6,
      )
    }
  })

  it('convierte píxeles a puntos a 96 píxeles por pulgada', () => {
    expect(pixelesAPuntos(96)).toBeCloseTo(72, 6)
    expect(pixelesAPuntos(960)).toBeCloseTo(720, 6)
  })

  it('descarta los valores que no son números', () => {
    expect(milimetrosAPuntos(Number.NaN)).toBe(0)
    expect(puntosAMilimetros(Number.POSITIVE_INFINITY)).toBe(0)
    expect(pixelesAPuntos(Number.NaN)).toBe(0)
  })

  it('redondea a los decimales indicados', () => {
    expect(redondearDecimales(1.2345, 2)).toBe(1.23)
    expect(redondearDecimales(1.2355, 2)).toBe(1.24)
    expect(redondearDecimales(Number.NaN, 2)).toBe(0)
  })

  it('da formato en español, con la coma como separador decimal', () => {
    expect(formatearMilimetros(10.55)).toBe('10,6 mm')
    expect(formatearPuntos(28.3465)).toBe('28,3 pt')
  })
})

describe('interpretarColor', () => {
  it('interpreta la forma completa', () => {
    expect(interpretarColor('#ff0000')).toEqual({ rojo: 1, verde: 0, azul: 0 })
    expect(interpretarColor('#000000')).toEqual(NEGRO)
    expect(interpretarColor('#ffffff')).toEqual(BLANCO)
  })

  it('interpreta la forma abreviada', () => {
    expect(interpretarColor('#f00')).toEqual({ rojo: 1, verde: 0, azul: 0 })
    expect(interpretarColor('#fff')).toEqual(BLANCO)
  })

  it('tolera la falta de almohadilla y los espacios', () => {
    expect(interpretarColor('  ff0000 ')).toEqual({ rojo: 1, verde: 0, azul: 0 })
    expect(interpretarColor('f00')).toEqual({ rojo: 1, verde: 0, azul: 0 })
  })

  it('no distingue mayúsculas de minúsculas', () => {
    expect(interpretarColor('#FF00AA')).toEqual(interpretarColor('#ff00aa'))
  })

  it('devuelve componentes entre 0 y 1', () => {
    const color = interpretarColor('#808080')

    expect(color?.rojo).toBeCloseTo(128 / 255, 6)
  })

  it('rechaza los textos que no son colores', () => {
    expect(interpretarColor('')).toBeNull()
    expect(interpretarColor('rojo')).toBeNull()
    expect(interpretarColor('#12345')).toBeNull()
    expect(interpretarColor('#gggggg')).toBeNull()
    expect(interpretarColor('#ff00aa00')).toBeNull()
  })

  it('esColorValido concuerda con la interpretación', () => {
    expect(esColorValido('#abc')).toBe(true)
    expect(esColorValido('#ab')).toBe(false)
  })
})

describe('normalizarColor', () => {
  it('lleva la forma abreviada a la completa', () => {
    expect(normalizarColor('#f0a')).toBe('#ff00aa')
  })

  it('pasa a minúsculas y añade la almohadilla', () => {
    expect(normalizarColor('FF00AA')).toBe('#ff00aa')
  })

  it('deja intacta una forma que ya está normalizada', () => {
    expect(normalizarColor('#1b1f2a')).toBe('#1b1f2a')
  })

  it('devuelve nulo cuando el texto no es válido', () => {
    expect(normalizarColor('no es un color')).toBeNull()
  })
})

describe('interpretarColorConReserva', () => {
  it('usa el color cuando es válido', () => {
    expect(interpretarColorConReserva('#000000', BLANCO)).toEqual(NEGRO)
  })

  it('recurre a la reserva cuando no lo es', () => {
    expect(interpretarColorConReserva('cualquier cosa', BLANCO)).toEqual(BLANCO)
  })
})

describe('textoEstandar', () => {
  it('admite las letras y los signos del español', () => {
    expect(esTextoRepresentable('Página 1 de 10')).toBe(true)
    expect(esTextoRepresentable('¡Añoranza, año, ñu! ¿Qué tal?')).toBe(true)
    expect(esTextoRepresentable('Documento — versión «final»')).toBe(true)
    expect(esTextoRepresentable('Precio: 10 € · 50 %')).toBe(true)
  })

  it('admite los signos de puntuación habituales', () => {
    expect(esTextoRepresentable('abc ABC 123 .,;:-_()[]{}/\\@#&*+="\'')).toBe(true)
  })

  it('rechaza los alfabetos que la tipografía estándar no cubre', () => {
    expect(esTextoRepresentable('Документ')).toBe(false)
    expect(esTextoRepresentable('文書')).toBe(false)
    expect(esTextoRepresentable('Σελίδα')).toBe(false)
  })

  it('rechaza los emoticonos', () => {
    expect(esTextoRepresentable('Página 1 ✅')).toBe(false)
    expect(esCaracterRepresentable('🙂')).toBe(false)
  })

  it('señala el primer carácter problemático', () => {
    expect(encontrarCaracterNoRepresentable('Hola 文 mundo')).toBe('文')
    expect(encontrarCaracterNoRepresentable('Hola mundo')).toBeNull()
  })

  it('redacta un aviso que nombra el carácter y la tipografía', () => {
    const aviso = describirCaracterNoRepresentable('Página 文')

    expect(aviso).toContain('文')
    expect(aviso).toContain(NOMBRE_TIPOGRAFIA)
  })

  it('no avisa cuando el texto es representable', () => {
    expect(describirCaracterNoRepresentable('Página 1')).toBeNull()
  })
})

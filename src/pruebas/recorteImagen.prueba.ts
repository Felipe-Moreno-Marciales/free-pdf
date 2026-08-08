import { describe, expect, it } from 'vitest'
import {
  calcularAreaRecorte,
  calcularRecorteParaProporcion,
  componerRecortes,
  convertirRecorteAlOrigen,
  describirRecorte,
  dimensionesTrasRecortar,
  esRecorteCompleto,
  FRACCION_MINIMA_RESTANTE,
  fraccionAltoRestante,
  fraccionAnchoRestante,
  normalizarRecorte,
  RECORTE_COMPLETO,
} from '../imagenes/recorteImagen'
import {
  describirDimensiones,
  dimensionesTrasRotar,
  elGiroIntercambiaEjes,
} from '../imagenes/orientacionImagen'
import type { RecorteRelativo } from '../imagenes/tipos'

/** Construye un recorte partiendo del completo. */
function recortar(cambios: Partial<RecorteRelativo> = {}): RecorteRelativo {
  return { ...RECORTE_COMPLETO, ...cambios }
}

describe('esRecorteCompleto', () => {
  it('el recorte completo no descarta nada', () => {
    expect(esRecorteCompleto(RECORTE_COMPLETO)).toBe(true)
    expect(esRecorteCompleto(null)).toBe(true)
  })

  it('cualquier lado mayor que cero deja de ser completo', () => {
    expect(esRecorteCompleto(recortar({ izquierda: 0.1 }))).toBe(false)
    expect(esRecorteCompleto(recortar({ inferior: 0.01 }))).toBe(false)
  })
})

describe('normalizarRecorte', () => {
  it('descarta los valores negativos', () => {
    expect(normalizarRecorte(recortar({ izquierda: -0.5 })).izquierda).toBe(0)
  })

  it('descarta los valores que no son números', () => {
    expect(normalizarRecorte(recortar({ superior: Number.NaN })).superior).toBe(0)
  })

  it('limita cada lado a la unidad', () => {
    const normalizado = normalizarRecorte(recortar({ izquierda: 5 }))

    expect(normalizado.izquierda).toBeLessThanOrEqual(1)
  })

  it('reduce proporcionalmente dos lados que se solapan', () => {
    const normalizado = normalizarRecorte(
      recortar({ izquierda: 0.8, derecha: 0.8 }),
    )

    expect(normalizado.izquierda).toBeCloseTo(normalizado.derecha, 6)
    expect(normalizado.izquierda + normalizado.derecha).toBeCloseTo(
      1 - FRACCION_MINIMA_RESTANTE,
      6,
    )
  })

  it('siempre deja píxeles suficientes en los dos ejes', () => {
    const normalizado = normalizarRecorte({
      izquierda: 1,
      derecha: 1,
      superior: 1,
      inferior: 1,
    })

    expect(fraccionAnchoRestante(normalizado)).toBeGreaterThanOrEqual(
      FRACCION_MINIMA_RESTANTE - 1e-9,
    )
    expect(fraccionAltoRestante(normalizado)).toBeGreaterThanOrEqual(
      FRACCION_MINIMA_RESTANTE - 1e-9,
    )
  })

  it('deja intacto un recorte que ya es válido', () => {
    const recorte = recortar({ izquierda: 0.1, derecha: 0.2 })
    const normalizado = normalizarRecorte(recorte)

    expect(normalizado.izquierda).toBeCloseTo(0.1, 6)
    expect(normalizado.derecha).toBeCloseTo(0.2, 6)
  })
})

describe('calcularAreaRecorte', () => {
  it('devuelve la imagen completa sin recorte', () => {
    expect(calcularAreaRecorte({ ancho: 200, alto: 100 }, null)).toEqual({
      x: 0,
      y: 0,
      ancho: 200,
      alto: 100,
    })
  })

  it('traduce las fracciones a píxeles', () => {
    const area = calcularAreaRecorte(
      { ancho: 200, alto: 100 },
      recortar({ izquierda: 0.25, derecha: 0.25 }),
    )

    expect(area.x).toBe(50)
    expect(area.ancho).toBe(100)
    expect(area.y).toBe(0)
    expect(area.alto).toBe(100)
  })

  it('recorta también en vertical', () => {
    const area = calcularAreaRecorte(
      { ancho: 200, alto: 100 },
      recortar({ superior: 0.1, inferior: 0.3 }),
    )

    expect(area.y).toBe(10)
    expect(area.alto).toBe(60)
  })

  it('nunca devuelve un área sin píxeles', () => {
    const area = calcularAreaRecorte(
      { ancho: 10, alto: 10 },
      { izquierda: 0.99, derecha: 0.99, superior: 0.99, inferior: 0.99 },
    )

    expect(area.ancho).toBeGreaterThanOrEqual(1)
    expect(area.alto).toBeGreaterThanOrEqual(1)
  })

  it('el área nunca sobresale de la imagen', () => {
    const area = calcularAreaRecorte(
      { ancho: 50, alto: 50 },
      recortar({ izquierda: 0.5, superior: 0.5 }),
    )

    expect(area.x + area.ancho).toBeLessThanOrEqual(50)
    expect(area.y + area.alto).toBeLessThanOrEqual(50)
  })
})

describe('dimensionesTrasRecortar', () => {
  it('reduce las medidas según el recorte', () => {
    expect(
      dimensionesTrasRecortar(
        { ancho: 400, alto: 200 },
        recortar({ izquierda: 0.25, derecha: 0.25, superior: 0.5 }),
      ),
    ).toEqual({ ancho: 200, alto: 100 })
  })

  it('sin recorte devuelve las medidas originales', () => {
    expect(dimensionesTrasRecortar({ ancho: 30, alto: 40 }, null)).toEqual({
      ancho: 30,
      alto: 40,
    })
  })
})

describe('calcularRecorteParaProporcion', () => {
  it('no recorta cuando la proporción ya coincide', () => {
    const recorte = calcularRecorteParaProporcion({ ancho: 200, alto: 100 }, 2)

    expect(esRecorteCompleto(recorte)).toBe(true)
  })

  it('recorta por los costados una imagen demasiado ancha', () => {
    // Imagen 2:1 que hay que llevar a 1:1: sobra la mitad del ancho.
    const recorte = calcularRecorteParaProporcion({ ancho: 200, alto: 100 }, 1)

    expect(recorte.izquierda).toBeCloseTo(0.25, 6)
    expect(recorte.derecha).toBeCloseTo(0.25, 6)
    expect(recorte.superior).toBe(0)
    expect(recorte.inferior).toBe(0)
  })

  it('recorta por arriba y por abajo una imagen demasiado alta', () => {
    const recorte = calcularRecorteParaProporcion({ ancho: 100, alto: 200 }, 1)

    expect(recorte.superior).toBeCloseTo(0.25, 6)
    expect(recorte.inferior).toBeCloseTo(0.25, 6)
    expect(recorte.izquierda).toBe(0)
  })

  it('el resultado tiene exactamente la proporción pedida', () => {
    const dimensiones = { ancho: 1600, alto: 900 }
    const recorte = calcularRecorteParaProporcion(dimensiones, 0.7)
    const finales = dimensionesTrasRecortar(dimensiones, recorte)

    expect(finales.ancho / finales.alto).toBeCloseTo(0.7, 2)
  })

  it('descarta las proporciones inválidas', () => {
    expect(
      esRecorteCompleto(calcularRecorteParaProporcion({ ancho: 10, alto: 10 }, 0)),
    ).toBe(true)
    expect(
      esRecorteCompleto(
        calcularRecorteParaProporcion({ ancho: 10, alto: 10 }, Number.NaN),
      ),
    ).toBe(true)
  })
})

describe('componerRecortes', () => {
  it('devuelve el otro cuando uno es nulo', () => {
    const recorte = recortar({ izquierda: 0.2 })

    expect(componerRecortes(null, recorte)).toBe(recorte)
    expect(componerRecortes(recorte, null)).toBe(recorte)
    expect(componerRecortes(null, null)).toBeNull()
  })

  it('el segundo recorte se aplica sobre lo que dejó el primero', () => {
    // Se descarta el 50 % por la izquierda y después el 50 % de lo que queda:
    // en total, el 75 % del ancho original.
    const compuesto = componerRecortes(
      recortar({ izquierda: 0.5 }),
      recortar({ izquierda: 0.5 }),
    )

    expect(compuesto?.izquierda).toBeCloseTo(0.75, 6)
  })

  it('compone los dos ejes por separado', () => {
    const compuesto = componerRecortes(
      recortar({ izquierda: 0.2, superior: 0.2 }),
      recortar({ derecha: 0.5, inferior: 0.5 }),
    )

    expect(compuesto?.izquierda).toBeCloseTo(0.2, 6)
    expect(compuesto?.derecha).toBeCloseTo(0.4, 6)
    expect(compuesto?.superior).toBeCloseTo(0.2, 6)
    expect(compuesto?.inferior).toBeCloseTo(0.4, 6)
  })

  it('el resultado sigue dejando píxeles suficientes', () => {
    const compuesto = componerRecortes(
      recortar({ izquierda: 0.45, derecha: 0.45 }),
      recortar({ izquierda: 0.45, derecha: 0.45 }),
    )

    expect(compuesto).not.toBeNull()
    expect(fraccionAnchoRestante(compuesto!)).toBeGreaterThanOrEqual(
      FRACCION_MINIMA_RESTANTE - 1e-9,
    )
  })
})

describe('convertirRecorteAlOrigen', () => {
  it('sin giro el recorte no cambia', () => {
    const recorte = recortar({ superior: 0.1, derecha: 0.2 })

    expect(convertirRecorteAlOrigen(recorte, 0)).toBe(recorte)
  })

  it('devuelve nulo cuando no hay recorte', () => {
    expect(convertirRecorteAlOrigen(null, 90)).toBeNull()
  })

  it('con un cuarto de vuelta el borde superior visible es el izquierdo original', () => {
    const convertido = convertirRecorteAlOrigen(recortar({ superior: 0.3 }), 90)

    expect(convertido).toEqual({
      izquierda: 0.3,
      superior: 0,
      derecha: 0,
      inferior: 0,
    })
  })

  it('con un cuarto de vuelta el borde derecho visible es el superior original', () => {
    const convertido = convertirRecorteAlOrigen(recortar({ derecha: 0.4 }), 90)

    expect(convertido?.superior).toBe(0.4)
  })

  it('con media vuelta los lados opuestos se intercambian', () => {
    const convertido = convertirRecorteAlOrigen(
      recortar({ superior: 0.1, izquierda: 0.2 }),
      180,
    )

    expect(convertido).toEqual({
      izquierda: 0,
      superior: 0,
      derecha: 0.2,
      inferior: 0.1,
    })
  })

  it('con tres cuartos de vuelta el borde superior visible es el derecho original', () => {
    const convertido = convertirRecorteAlOrigen(recortar({ superior: 0.3 }), 270)

    expect(convertido?.derecha).toBe(0.3)
  })

  it('cuatro conversiones de un cuarto devuelven el recorte original', () => {
    let recorte: RecorteRelativo | null = recortar({
      superior: 0.1,
      derecha: 0.2,
      inferior: 0.3,
      izquierda: 0.05,
    })
    const original = recorte

    for (let vuelta = 0; vuelta < 4; vuelta += 1) {
      recorte = convertirRecorteAlOrigen(recorte, 90)
    }

    expect(recorte).toEqual(original)
  })
})

describe('orientación y giros', () => {
  it('un cuarto y tres cuartos de vuelta intercambian los ejes', () => {
    expect(elGiroIntercambiaEjes(90)).toBe(true)
    expect(elGiroIntercambiaEjes(270)).toBe(true)
  })

  it('sin giro y con media vuelta los ejes se conservan', () => {
    expect(elGiroIntercambiaEjes(0)).toBe(false)
    expect(elGiroIntercambiaEjes(180)).toBe(false)
  })

  it('las medidas se intercambian al girar un cuarto de vuelta', () => {
    expect(dimensionesTrasRotar({ ancho: 300, alto: 200 }, 90)).toEqual({
      ancho: 200,
      alto: 300,
    })
  })

  it('describe las medidas en español', () => {
    expect(describirDimensiones({ ancho: 800, alto: 600 })).toBe(
      '800 × 600 píxeles',
    )
    expect(describirDimensiones(null)).toBe('medidas desconocidas')
  })
})

describe('describirRecorte', () => {
  it('indica que no hay recorte', () => {
    expect(describirRecorte(null)).toBe('sin recortar')
    expect(describirRecorte(RECORTE_COMPLETO)).toBe('sin recortar')
  })

  it('describe cada lado en porcentaje', () => {
    const texto = describirRecorte(
      recortar({ superior: 0.1, derecha: 0.2, inferior: 0.05, izquierda: 0 }),
    )

    expect(texto).toContain('10 % arriba')
    expect(texto).toContain('20 % a la derecha')
    expect(texto).toContain('5 % abajo')
    expect(texto).toContain('0 % a la izquierda')
  })
})

import { describe, expect, it } from 'vitest'
import {
  AJUSTES_NEUTROS,
  aplicarAjustes,
  calcularFactorContraste,
  calcularLuminancia,
  describirFiltro,
  limitarAjuste,
  sonAjustesNeutros,
  UMBRAL_BLANCO_Y_NEGRO,
} from '../imagenes/aplicarFiltrosImagen'
import type { AjustesImagen } from '../imagenes/tipos'

/** Construye unos ajustes partiendo de los neutros. */
function ajustar(cambios: Partial<AjustesImagen> = {}): AjustesImagen {
  return { ...AJUSTES_NEUTROS, ...cambios }
}

/** Construye un búfer RGBA de un solo píxel. */
function pixel(
  rojo: number,
  verde: number,
  azul: number,
  alfa = 255,
): Uint8ClampedArray {
  return new Uint8ClampedArray([rojo, verde, azul, alfa])
}

describe('calcularLuminancia', () => {
  it('el negro tiene luminancia cero', () => {
    expect(calcularLuminancia(0, 0, 0)).toBe(0)
  })

  it('el blanco tiene la luminancia máxima', () => {
    expect(calcularLuminancia(255, 255, 255)).toBeCloseTo(255, 5)
  })

  it('el verde pesa más que el rojo y el rojo más que el azul', () => {
    const rojo = calcularLuminancia(255, 0, 0)
    const verde = calcularLuminancia(0, 255, 0)
    const azul = calcularLuminancia(0, 0, 255)

    expect(verde).toBeGreaterThan(rojo)
    expect(rojo).toBeGreaterThan(azul)
  })
})

describe('limitarAjuste', () => {
  it('limita al mínimo y al máximo', () => {
    expect(limitarAjuste(-500)).toBe(-100)
    expect(limitarAjuste(500)).toBe(100)
  })

  it('redondea a un entero', () => {
    expect(limitarAjuste(12.6)).toBe(13)
  })

  it('descarta los valores que no son números', () => {
    expect(limitarAjuste(Number.NaN)).toBe(0)
  })
})

describe('sonAjustesNeutros', () => {
  it('los ajustes neutros no modifican nada', () => {
    expect(sonAjustesNeutros(AJUSTES_NEUTROS)).toBe(true)
    expect(sonAjustesNeutros(null)).toBe(true)
  })

  it('un filtro deja de ser neutro', () => {
    expect(sonAjustesNeutros(ajustar({ filtro: 'grises' }))).toBe(false)
  })

  it('el brillo y el contraste dejan de ser neutros', () => {
    expect(sonAjustesNeutros(ajustar({ brillo: 10 }))).toBe(false)
    expect(sonAjustesNeutros(ajustar({ contraste: -10 }))).toBe(false)
  })
})

describe('calcularFactorContraste', () => {
  it('un contraste de cero no cambia nada', () => {
    expect(calcularFactorContraste(0)).toBeCloseTo(1, 6)
  })

  it('un contraste positivo amplía el factor', () => {
    expect(calcularFactorContraste(50)).toBeGreaterThan(1)
  })

  it('un contraste negativo reduce el factor', () => {
    expect(calcularFactorContraste(-50)).toBeLessThan(1)
  })
})

describe('aplicarAjustes: filtro original', () => {
  it('no modifica los píxeles con ajustes neutros', () => {
    const bytes = pixel(10, 120, 200)

    aplicarAjustes(bytes, AJUSTES_NEUTROS)

    expect([...bytes]).toEqual([10, 120, 200, 255])
  })

  it('el brillo positivo aclara los tres componentes', () => {
    const bytes = pixel(100, 100, 100)

    aplicarAjustes(bytes, ajustar({ brillo: 20 }))

    // 20 % de 255 son 51 niveles.
    expect(bytes[0]).toBe(151)
    expect(bytes[1]).toBe(151)
    expect(bytes[2]).toBe(151)
  })

  it('el brillo negativo oscurece', () => {
    const bytes = pixel(100, 100, 100)

    aplicarAjustes(bytes, ajustar({ brillo: -20 }))

    expect(bytes[0]).toBe(49)
  })

  it('el brillo no desborda por arriba ni por abajo', () => {
    const claro = pixel(250, 250, 250)
    aplicarAjustes(claro, ajustar({ brillo: 100 }))
    expect(claro[0]).toBe(255)

    const oscuro = pixel(5, 5, 5)
    aplicarAjustes(oscuro, ajustar({ brillo: -100 }))
    expect(oscuro[0]).toBe(0)
  })

  it('el contraste separa los valores del punto medio', () => {
    const claro = pixel(200, 200, 200)
    const oscuro = pixel(50, 50, 50)

    aplicarAjustes(claro, ajustar({ contraste: 40 }))
    aplicarAjustes(oscuro, ajustar({ contraste: 40 }))

    expect(claro[0]).toBeGreaterThan(200)
    expect(oscuro[0]).toBeLessThan(50)
  })

  it('el contraste negativo acerca los valores al punto medio', () => {
    const bytes = pixel(200, 200, 200)

    aplicarAjustes(bytes, ajustar({ contraste: -40 }))

    expect(bytes[0]).toBeLessThan(200)
    expect(bytes[0]).toBeGreaterThan(128)
  })

  it('nunca altera el canal alfa', () => {
    const bytes = pixel(10, 20, 30, 128)

    aplicarAjustes(bytes, ajustar({ filtro: 'grises', brillo: 30 }))

    expect(bytes[3]).toBe(128)
  })
})

describe('aplicarAjustes: escala de grises', () => {
  it('iguala los tres componentes', () => {
    const bytes = pixel(200, 100, 50)

    aplicarAjustes(bytes, ajustar({ filtro: 'grises' }))

    expect(bytes[0]).toBe(bytes[1])
    expect(bytes[1]).toBe(bytes[2])
  })

  it('usa la luminancia como valor del gris', () => {
    const bytes = pixel(200, 100, 50)
    const esperado = Math.round(calcularLuminancia(200, 100, 50))

    aplicarAjustes(bytes, ajustar({ filtro: 'grises' }))

    expect(bytes[0]).toBe(esperado)
  })

  it('deja el blanco y el negro como estaban', () => {
    const blanco = pixel(255, 255, 255)
    const negro = pixel(0, 0, 0)

    aplicarAjustes(blanco, ajustar({ filtro: 'grises' }))
    aplicarAjustes(negro, ajustar({ filtro: 'grises' }))

    expect(blanco[0]).toBe(255)
    expect(negro[0]).toBe(0)
  })
})

describe('aplicarAjustes: blanco y negro', () => {
  it('lleva a blanco los píxeles por encima del umbral', () => {
    const bytes = pixel(240, 240, 240)

    aplicarAjustes(bytes, ajustar({ filtro: 'blanco-y-negro' }))

    expect([...bytes]).toEqual([255, 255, 255, 255])
  })

  it('lleva a negro los píxeles por debajo del umbral', () => {
    const bytes = pixel(20, 20, 20)

    aplicarAjustes(bytes, ajustar({ filtro: 'blanco-y-negro' }))

    expect([...bytes]).toEqual([0, 0, 0, 255])
  })

  it('solo produce valores extremos', () => {
    const bytes = new Uint8ClampedArray([
      10, 10, 10, 255, 130, 130, 130, 255, 200, 200, 200, 255,
    ])

    aplicarAjustes(bytes, ajustar({ filtro: 'blanco-y-negro' }))

    for (let posicion = 0; posicion < bytes.length; posicion += 4) {
      expect([0, 255]).toContain(bytes[posicion])
    }
  })

  it('el umbral se aplica después del brillo', () => {
    // Un gris oscuro que por sí solo iría a negro, aclarado hasta pasar el umbral.
    const bytes = pixel(90, 90, 90)

    expect(calcularLuminancia(90, 90, 90)).toBeLessThan(UMBRAL_BLANCO_Y_NEGRO)

    aplicarAjustes(bytes, ajustar({ filtro: 'blanco-y-negro', brillo: 40 }))

    expect(bytes[0]).toBe(255)
  })
})

describe('aplicarAjustes: varios píxeles', () => {
  it('recorre todos los píxeles del búfer', () => {
    const bytes = new Uint8ClampedArray([
      10, 10, 10, 255, 20, 20, 20, 255, 30, 30, 30, 255,
    ])

    aplicarAjustes(bytes, ajustar({ filtro: 'grises', brillo: 100 }))

    expect(bytes[0]).toBe(255)
    expect(bytes[4]).toBe(255)
    expect(bytes[8]).toBe(255)
  })

  it('tolera un búfer incompleto sin desbordarse', () => {
    const bytes = new Uint8ClampedArray([10, 20, 30])

    expect(() => aplicarAjustes(bytes, ajustar({ brillo: 10 }))).not.toThrow()
  })

  it('tolera un búfer vacío', () => {
    expect(() =>
      aplicarAjustes(new Uint8ClampedArray(0), ajustar({ brillo: 10 })),
    ).not.toThrow()
  })
})

describe('describirFiltro', () => {
  it('nombra los tres filtros en español', () => {
    expect(describirFiltro('original')).toBe('Original')
    expect(describirFiltro('grises')).toBe('Escala de grises')
    expect(describirFiltro('blanco-y-negro')).toBe('Blanco y negro')
  })
})

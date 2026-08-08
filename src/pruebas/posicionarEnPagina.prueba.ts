import { describe, expect, it } from 'vitest'
import {
  calcularCajaRotada,
  calcularColocacionEnPagina,
  calcularColocacionesMosaico,
  calcularMedidasVisibles,
  contarCopiasMosaico,
  describirPosicion,
  generarReticula,
  girarPunto,
  POSICIONES_COMPLETAS,
  POSICIONES_NUMERACION,
  puntoVisibleAPdf,
  type CajaPagina,
  type PeticionColocacion,
  type PosicionEnPagina,
} from '../pdf/posicionarEnPagina'
import type { GradosRotacion } from '../pdf/tipos'

/** Página vertical de ejemplo, con el origen en cero. */
const VERTICAL: CajaPagina = { x: 0, y: 0, ancho: 600, alto: 800 }

/** Página cuyo origen no está en cero, como ocurre en algunos documentos. */
const DESPLAZADA: CajaPagina = { x: 20, y: 30, ancho: 600, alto: 800 }

/** Construye una petición de colocación con valores razonables. */
function pedir(
  cambios: Partial<PeticionColocacion> = {},
): PeticionColocacion {
  return {
    caja: VERTICAL,
    rotacionPagina: 0,
    posicion: 'inferior-centro',
    contenido: { ancho: 100, alto: 20 },
    margenHorizontal: 40,
    margenVertical: 30,
    ...cambios,
  }
}

describe('calcularMedidasVisibles', () => {
  it('sin rotación las medidas no cambian', () => {
    expect(calcularMedidasVisibles(VERTICAL, 0)).toEqual({
      ancho: 600,
      alto: 800,
    })
  })

  it('con un cuarto de vuelta se intercambian', () => {
    expect(calcularMedidasVisibles(VERTICAL, 90)).toEqual({
      ancho: 800,
      alto: 600,
    })
  })

  it('con media vuelta se conservan', () => {
    expect(calcularMedidasVisibles(VERTICAL, 180)).toEqual({
      ancho: 600,
      alto: 800,
    })
  })

  it('con tres cuartos de vuelta se intercambian', () => {
    expect(calcularMedidasVisibles(VERTICAL, 270)).toEqual({
      ancho: 800,
      alto: 600,
    })
  })
})

describe('puntoVisibleAPdf', () => {
  it('sin rotación solo suma el origen de la caja', () => {
    expect(puntoVisibleAPdf(DESPLAZADA, 0, { x: 10, y: 15 })).toEqual({
      x: 30,
      y: 45,
    })
  })

  it('con un cuarto de vuelta la esquina inferior izquierda visible es la inferior derecha del PDF', () => {
    expect(puntoVisibleAPdf(VERTICAL, 90, { x: 0, y: 0 })).toEqual({
      x: 600,
      y: 0,
    })
  })

  it('con media vuelta la esquina inferior izquierda visible es la superior derecha del PDF', () => {
    expect(puntoVisibleAPdf(VERTICAL, 180, { x: 0, y: 0 })).toEqual({
      x: 600,
      y: 800,
    })
  })

  it('con tres cuartos de vuelta la esquina inferior izquierda visible es la superior izquierda del PDF', () => {
    expect(puntoVisibleAPdf(VERTICAL, 270, { x: 0, y: 0 })).toEqual({
      x: 0,
      y: 800,
    })
  })

  it('las cuatro esquinas visibles caen siempre dentro de la caja', () => {
    for (const rotacion of [0, 90, 180, 270] as const) {
      const visibles = calcularMedidasVisibles(VERTICAL, rotacion)
      const esquinas = [
        { x: 0, y: 0 },
        { x: visibles.ancho, y: 0 },
        { x: 0, y: visibles.alto },
        { x: visibles.ancho, y: visibles.alto },
      ]

      for (const esquina of esquinas) {
        const punto = puntoVisibleAPdf(VERTICAL, rotacion, esquina)

        expect(punto.x).toBeGreaterThanOrEqual(0)
        expect(punto.x).toBeLessThanOrEqual(VERTICAL.ancho)
        expect(punto.y).toBeGreaterThanOrEqual(0)
        expect(punto.y).toBeLessThanOrEqual(VERTICAL.alto)
      }
    }
  })

  it('respeta el origen de la caja con cualquier rotación', () => {
    const punto = puntoVisibleAPdf(DESPLAZADA, 90, { x: 0, y: 0 })

    expect(punto).toEqual({ x: 20 + 600, y: 30 })
  })
})

describe('calcularCajaRotada', () => {
  it('sin giro la caja coincide con el contenido', () => {
    expect(calcularCajaRotada({ ancho: 100, alto: 20 }, 0)).toEqual({
      ancho: 100,
      alto: 20,
      desplazamientoX: 0,
      desplazamientoY: 0,
    })
  })

  it('con un cuarto de vuelta el ancho y el alto se intercambian', () => {
    const caja = calcularCajaRotada({ ancho: 100, alto: 20 }, 90)

    expect(caja.ancho).toBeCloseTo(20, 6)
    expect(caja.alto).toBeCloseTo(100, 6)
  })

  it('con un giro de 45 grados la caja crece en los dos ejes', () => {
    const caja = calcularCajaRotada({ ancho: 100, alto: 100 }, 45)

    expect(caja.ancho).toBeCloseTo(141.42, 1)
    expect(caja.alto).toBeCloseTo(141.42, 1)
  })

  it('el desplazamiento coloca el origen dentro de la caja', () => {
    const caja = calcularCajaRotada({ ancho: 100, alto: 20 }, 45)

    expect(caja.desplazamientoX).toBeGreaterThan(0)
    expect(caja.desplazamientoX).toBeLessThanOrEqual(caja.ancho)
    expect(caja.desplazamientoY).toBeGreaterThanOrEqual(0)
  })

  it('un giro de 180 grados deja las mismas medidas', () => {
    const caja = calcularCajaRotada({ ancho: 100, alto: 20 }, 180)

    expect(caja.ancho).toBeCloseTo(100, 6)
    expect(caja.alto).toBeCloseTo(20, 6)
  })
})

describe('girarPunto', () => {
  it('sin giro el punto no cambia', () => {
    expect(girarPunto({ x: 3, y: 4 }, 0)).toEqual({ x: 3, y: 4 })
  })

  it('un cuarto de vuelta lleva el eje horizontal al vertical', () => {
    const punto = girarPunto({ x: 1, y: 0 }, 90)

    expect(punto.x).toBeCloseTo(0, 6)
    expect(punto.y).toBeCloseTo(1, 6)
  })
})

describe('calcularColocacionEnPagina: posiciones sin rotación', () => {
  it('coloca abajo a la izquierda respetando los márgenes', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ posicion: 'inferior-izquierda' }),
    )

    expect(colocacion.visible).toEqual({ x: 40, y: 30 })
    expect(colocacion.x).toBe(40)
    expect(colocacion.y).toBe(30)
  })

  it('coloca abajo a la derecha', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ posicion: 'inferior-derecha' }),
    )

    // 600 − 40 de margen − 100 de ancho del contenido.
    expect(colocacion.visible.x).toBe(460)
    expect(colocacion.visible.y).toBe(30)
  })

  it('coloca arriba a la izquierda', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ posicion: 'superior-izquierda' }),
    )

    // 800 − 30 de margen − 20 de alto del contenido.
    expect(colocacion.visible).toEqual({ x: 40, y: 750 })
  })

  it('coloca arriba a la derecha', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ posicion: 'superior-derecha' }),
    )

    expect(colocacion.visible).toEqual({ x: 460, y: 750 })
  })

  it('centra en horizontal ignorando el margen', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ posicion: 'inferior-centro' }),
    )

    expect(colocacion.visible.x).toBe((600 - 100) / 2)
  })

  it('centra en los dos ejes', () => {
    const colocacion = calcularColocacionEnPagina(pedir({ posicion: 'centro' }))

    expect(colocacion.visible).toEqual({ x: 250, y: 390 })
  })

  it('el contenido siempre cabe dentro de la página', () => {
    for (const posicion of POSICIONES_COMPLETAS) {
      const colocacion = calcularColocacionEnPagina(pedir({ posicion }))

      expect(colocacion.visible.x).toBeGreaterThanOrEqual(0)
      expect(colocacion.visible.y).toBeGreaterThanOrEqual(0)
      expect(colocacion.visible.x + colocacion.cajaVisible.ancho).toBeLessThanOrEqual(
        600,
      )
      expect(colocacion.visible.y + colocacion.cajaVisible.alto).toBeLessThanOrEqual(
        800,
      )
    }
  })
})

describe('calcularColocacionEnPagina: páginas rotadas', () => {
  it('la rotación de la página se traslada a la del contenido', () => {
    for (const rotacion of [0, 90, 180, 270] as const) {
      const colocacion = calcularColocacionEnPagina(
        pedir({ rotacionPagina: rotacion }),
      )

      expect(colocacion.rotacionGrados).toBe(rotacion)
    }
  })

  it('con la página girada el contenido sigue midiéndose sobre lo que se ve', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ rotacionPagina: 90, posicion: 'inferior-izquierda' }),
    )

    // En coordenadas visibles siempre es la esquina inferior izquierda.
    expect(colocacion.visible).toEqual({ x: 40, y: 30 })
    // En coordenadas PDF, esa esquina cae en la parte derecha de la página.
    expect(colocacion.x).toBe(600 - 30)
    expect(colocacion.y).toBe(40)
  })

  it('el punto resultante cae siempre dentro de la página', () => {
    const rotaciones: readonly GradosRotacion[] = [0, 90, 180, 270]

    for (const rotacion of rotaciones) {
      for (const posicion of POSICIONES_NUMERACION) {
        const colocacion = calcularColocacionEnPagina(
          pedir({ rotacionPagina: rotacion, posicion }),
        )

        expect(colocacion.x).toBeGreaterThanOrEqual(0)
        expect(colocacion.x).toBeLessThanOrEqual(600)
        expect(colocacion.y).toBeGreaterThanOrEqual(0)
        expect(colocacion.y).toBeLessThanOrEqual(800)
      }
    }
  })

  it('respeta el origen de la caja de la página', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ caja: DESPLAZADA, posicion: 'inferior-izquierda' }),
    )

    expect(colocacion.x).toBe(20 + 40)
    expect(colocacion.y).toBe(30 + 30)
  })
})

describe('calcularColocacionEnPagina: desplazamiento local', () => {
  it('suma el desplazamiento en las coordenadas del contenido', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({
        posicion: 'inferior-izquierda',
        desplazamientoLocal: { x: 0, y: 5 },
      }),
    )

    expect(colocacion.y).toBe(35)
  })

  it('gira el desplazamiento junto con el contenido', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({
        posicion: 'inferior-izquierda',
        rotacionContenido: 90,
        desplazamientoLocal: { x: 0, y: 10 },
      }),
    )

    // Girado un cuarto de vuelta, «arriba» en el contenido apunta a la izquierda.
    expect(colocacion.visible.x).toBe(40)
    expect(colocacion.x).toBeCloseTo(40 + 20 - 10, 6)
  })
})

describe('calcularColocacionEnPagina: contenido girado', () => {
  it('suma el giro del contenido al de la página', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ rotacionPagina: 90, rotacionContenido: 45 }),
    )

    expect(colocacion.rotacionGrados).toBe(135)
  })

  it('un contenido girado sigue cabiendo en la página', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({
        posicion: 'superior-derecha',
        rotacionContenido: 45,
        contenido: { ancho: 200, alto: 40 },
      }),
    )

    expect(colocacion.visible.x + colocacion.cajaVisible.ancho).toBeLessThanOrEqual(
      600.01,
    )
    expect(colocacion.visible.y + colocacion.cajaVisible.alto).toBeLessThanOrEqual(
      800.01,
    )
  })

  it('la caja visible de un contenido girado es mayor que el contenido', () => {
    const colocacion = calcularColocacionEnPagina(
      pedir({ rotacionContenido: 45, contenido: { ancho: 100, alto: 100 } }),
    )

    expect(colocacion.cajaVisible.ancho).toBeGreaterThan(100)
  })
})

describe('generarReticula y mosaico', () => {
  it('cubre toda la página', () => {
    const puntos = generarReticula(
      { ancho: 300, alto: 300 },
      { ancho: 100, alto: 100 },
      0,
      0,
    )

    expect(puntos).toHaveLength(9)
  })

  it('la separación reduce el número de copias', () => {
    const sinSeparacion = contarCopiasMosaico(
      { ancho: 300, alto: 300 },
      { ancho: 100, alto: 100 },
      0,
      0,
    )
    const conSeparacion = contarCopiasMosaico(
      { ancho: 300, alto: 300 },
      { ancho: 100, alto: 100 },
      50,
      50,
    )

    expect(conSeparacion).toBeLessThan(sinSeparacion)
  })

  it('siempre coloca al menos una copia', () => {
    expect(
      contarCopiasMosaico(
        { ancho: 100, alto: 100 },
        { ancho: 500, alto: 500 },
        0,
        0,
      ),
    ).toBe(1)
  })

  it('la primera copia parte del origen visible', () => {
    const puntos = generarReticula(
      { ancho: 300, alto: 300 },
      { ancho: 100, alto: 100 },
      0,
      0,
    )

    expect(puntos[0]).toEqual({ x: 0, y: 0 })
  })

  it('el mosaico devuelve una colocación por copia', () => {
    const colocaciones = calcularColocacionesMosaico(
      pedir({ contenido: { ancho: 100, alto: 100 } }),
      0,
      0,
    )

    expect(colocaciones).toHaveLength(
      contarCopiasMosaico({ ancho: 600, alto: 800 }, { ancho: 100, alto: 100 }, 0, 0),
    )
  })

  it('todas las copias del mosaico llevan la misma rotación', () => {
    const colocaciones = calcularColocacionesMosaico(
      pedir({ rotacionPagina: 90, rotacionContenido: 30 }),
      10,
      10,
    )

    for (const colocacion of colocaciones) {
      expect(colocacion.rotacionGrados).toBe(120)
    }
  })

  it('el mosaico no tiene en cuenta la posición elegida', () => {
    const centrado = calcularColocacionesMosaico(
      pedir({ posicion: 'centro' }),
      10,
      10,
    )
    const enEsquina = calcularColocacionesMosaico(
      pedir({ posicion: 'superior-izquierda' }),
      10,
      10,
    )

    expect(centrado).toHaveLength(enEsquina.length)
    expect(centrado[0].visible).toEqual(enEsquina[0].visible)
  })
})

describe('describirPosicion', () => {
  it('nombra las nueve posiciones en español', () => {
    const nombres = POSICIONES_COMPLETAS.map(describirPosicion)

    expect(nombres).toContain('Superior izquierda')
    expect(nombres).toContain('Centro')
    expect(nombres).toContain('Inferior derecha')
    expect(new Set(nombres).size).toBe(POSICIONES_COMPLETAS.length)
  })

  it('la numeración ofrece seis posiciones, sin las del centro vertical', () => {
    expect(POSICIONES_NUMERACION).toHaveLength(6)
    const conCentroVertical: readonly PosicionEnPagina[] = [
      'centro',
      'centro-izquierda',
      'centro-derecha',
    ]

    for (const posicion of conCentroVertical) {
      expect(POSICIONES_NUMERACION).not.toContain(posicion)
    }
  })
})

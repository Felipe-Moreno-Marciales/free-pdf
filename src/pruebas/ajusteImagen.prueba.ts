import { describe, expect, it } from 'vitest'
import {
  aplicarOrientacion,
  calcularAreaDisponible,
  calcularColocacion,
  calcularMargenMilimetros,
  calcularMargenPuntos,
  calcularMedidasPagina,
  calcularProporcionAprovechada,
  CONFIGURACION_PAGINA_PREDETERMINADA,
  laImagenQuedaMuyPequena,
  limitarMargenPersonalizado,
  losMargenesDejanEspacio,
  MARGEN_PERSONALIZADO_MAXIMO_MM,
  TAMANOS_PAGINA,
} from '../imagenes/calcularAjusteImagen'
import { dimensionesTrasRotar } from '../imagenes/orientacionImagen'
import type {
  ConfiguracionPaginaImagen,
  DimensionesImagen,
} from '../imagenes/tipos'
import { milimetrosAPuntos, pixelesAPuntos } from '../utilidades/unidades'

/** Holgura con la que se comparan medidas en punto flotante. */
const HOLGURA = 0.01

/** Construye una configuración partiendo de la predeterminada. */
function configurar(
  cambios: Partial<ConfiguracionPaginaImagen> = {},
): ConfiguracionPaginaImagen {
  return { ...CONFIGURACION_PAGINA_PREDETERMINADA, ...cambios }
}

/** Imagen horizontal de ejemplo. */
const HORIZONTAL: DimensionesImagen = { ancho: 1600, alto: 900 }

/** Imagen vertical de ejemplo. */
const VERTICAL: DimensionesImagen = { ancho: 900, alto: 1600 }

/** Imagen cuadrada de ejemplo. */
const CUADRADA: DimensionesImagen = { ancho: 1000, alto: 1000 }

describe('configuración predeterminada', () => {
  it('usa «contener» como modo de ajuste', () => {
    expect(CONFIGURACION_PAGINA_PREDETERMINADA.ajuste).toBe('contener')
  })

  it('usa el blanco como color de fondo', () => {
    expect(CONFIGURACION_PAGINA_PREDETERMINADA.colorFondo).toBe('#ffffff')
  })
})

describe('calcularMargenMilimetros', () => {
  it('no aplica margen con «sin margen»', () => {
    expect(calcularMargenMilimetros(configurar({ margen: 'sin-margen' }))).toBe(0)
  })

  it('aplica los márgenes predefinidos', () => {
    expect(calcularMargenMilimetros(configurar({ margen: 'pequeno' }))).toBe(5)
    expect(calcularMargenMilimetros(configurar({ margen: 'mediano' }))).toBe(10)
    expect(calcularMargenMilimetros(configurar({ margen: 'grande' }))).toBe(20)
  })

  it('usa el margen propio cuando se elige «personalizado»', () => {
    expect(
      calcularMargenMilimetros(
        configurar({ margen: 'personalizado', margenPersonalizadoMm: 7 }),
      ),
    ).toBe(7)
  })

  it('convierte el margen a puntos', () => {
    // 10 mm son 28,3465 puntos, porque una pulgada son 25,4 mm y 72 puntos.
    expect(calcularMargenPuntos(configurar({ margen: 'mediano' }))).toBeCloseTo(
      28.3465,
      3,
    )
  })
})

describe('limitarMargenPersonalizado', () => {
  it('descarta los valores negativos', () => {
    expect(limitarMargenPersonalizado(-5)).toBe(0)
  })

  it('limita al máximo admitido', () => {
    expect(limitarMargenPersonalizado(9999)).toBe(
      MARGEN_PERSONALIZADO_MAXIMO_MM,
    )
  })

  it('descarta los valores que no son números', () => {
    expect(limitarMargenPersonalizado(Number.NaN)).toBe(0)
  })
})

describe('aplicarOrientacion', () => {
  it('deja el lado mayor en el alto con «vertical»', () => {
    expect(aplicarOrientacion({ ancho: 800, alto: 400 }, 'vertical')).toEqual({
      ancho: 400,
      alto: 800,
    })
  })

  it('deja el lado mayor en el ancho con «horizontal»', () => {
    expect(aplicarOrientacion({ ancho: 400, alto: 800 }, 'horizontal')).toEqual({
      ancho: 800,
      alto: 400,
    })
  })

  it('no cambia nada con «automática»', () => {
    const medidas = { ancho: 400, alto: 800 }

    expect(aplicarOrientacion(medidas, 'automatica')).toBe(medidas)
  })
})

describe('calcularMedidasPagina: tamaños con nombre', () => {
  it('usa las medidas normalizadas de A4 en vertical', () => {
    const pagina = calcularMedidasPagina(
      VERTICAL,
      configurar({ tamano: 'a4', orientacion: 'vertical' }),
    )

    expect(pagina.ancho).toBeCloseTo(TAMANOS_PAGINA.a4.ancho, 2)
    expect(pagina.alto).toBeCloseTo(TAMANOS_PAGINA.a4.alto, 2)
  })

  it('usa las medidas de Carta', () => {
    const pagina = calcularMedidasPagina(
      VERTICAL,
      configurar({ tamano: 'carta', orientacion: 'vertical' }),
    )

    expect(pagina.ancho).toBe(612)
    expect(pagina.alto).toBe(792)
  })

  it('usa las medidas de Legal', () => {
    const pagina = calcularMedidasPagina(
      VERTICAL,
      configurar({ tamano: 'legal', orientacion: 'vertical' }),
    )

    expect(pagina.ancho).toBe(612)
    expect(pagina.alto).toBe(1008)
  })

  it('gira la página con la orientación horizontal', () => {
    const pagina = calcularMedidasPagina(
      VERTICAL,
      configurar({ tamano: 'a4', orientacion: 'horizontal' }),
    )

    expect(pagina.ancho).toBeCloseTo(TAMANOS_PAGINA.a4.alto, 2)
    expect(pagina.alto).toBeCloseTo(TAMANOS_PAGINA.a4.ancho, 2)
  })

  it('con «automática» una imagen horizontal produce una página horizontal', () => {
    const pagina = calcularMedidasPagina(
      HORIZONTAL,
      configurar({ tamano: 'a4', orientacion: 'automatica' }),
    )

    expect(pagina.ancho).toBeGreaterThan(pagina.alto)
  })

  it('con «automática» una imagen vertical produce una página vertical', () => {
    const pagina = calcularMedidasPagina(
      VERTICAL,
      configurar({ tamano: 'a4', orientacion: 'automatica' }),
    )

    expect(pagina.alto).toBeGreaterThan(pagina.ancho)
  })

  it('con «automática» una imagen cuadrada produce una página vertical', () => {
    const pagina = calcularMedidasPagina(
      CUADRADA,
      configurar({ tamano: 'a4', orientacion: 'automatica' }),
    )

    expect(pagina.alto).toBeGreaterThan(pagina.ancho)
  })
})

describe('calcularMedidasPagina: tamaño original', () => {
  it('deriva la página de los píxeles de la imagen a 96 por pulgada', () => {
    const pagina = calcularMedidasPagina(
      { ancho: 960, alto: 480 },
      configurar({ tamano: 'original', margen: 'sin-margen' }),
    )

    // 960 px a 96 px/pulgada son 10 pulgadas, es decir, 720 puntos.
    expect(pagina.ancho).toBeCloseTo(720, 2)
    expect(pagina.alto).toBeCloseTo(360, 2)
  })

  it('suma los márgenes a las medidas de la imagen', () => {
    const margen = milimetrosAPuntos(10)
    const pagina = calcularMedidasPagina(
      { ancho: 960, alto: 480 },
      configurar({ tamano: 'original', margen: 'mediano' }),
    )

    expect(pagina.ancho).toBeCloseTo(720 + margen * 2, 2)
    expect(pagina.alto).toBeCloseTo(360 + margen * 2, 2)
  })

  it('respeta la orientación forzada aunque el tamaño sea el original', () => {
    const pagina = calcularMedidasPagina(
      { ancho: 960, alto: 480 },
      configurar({
        tamano: 'original',
        margen: 'sin-margen',
        orientacion: 'vertical',
      }),
    )

    expect(pagina.ancho).toBeCloseTo(360, 2)
    expect(pagina.alto).toBeCloseTo(720, 2)
  })
})

describe('calcularAreaDisponible', () => {
  it('descuenta el margen por los dos lados', () => {
    expect(calcularAreaDisponible({ ancho: 500, alto: 800 }, 50)).toEqual({
      ancho: 400,
      alto: 700,
    })
  })

  it('nunca devuelve medidas iguales o menores que cero', () => {
    const area = calcularAreaDisponible({ ancho: 100, alto: 100 }, 500)

    expect(area.ancho).toBeGreaterThan(0)
    expect(area.alto).toBeGreaterThan(0)
  })
})

describe('calcularColocacion: modo contener', () => {
  it('muestra la imagen completa dentro del área disponible', () => {
    const colocacion = calcularColocacion(
      HORIZONTAL,
      configurar({
        tamano: 'a4',
        orientacion: 'vertical',
        margen: 'sin-margen',
        ajuste: 'contener',
      }),
    )

    expect(colocacion.ancho).toBeLessThanOrEqual(
      colocacion.pagina.ancho + HOLGURA,
    )
    expect(colocacion.alto).toBeLessThanOrEqual(colocacion.pagina.alto + HOLGURA)
    expect(colocacion.recorta).toBe(false)
    expect(colocacion.recorte).toBeNull()
  })

  it('conserva la proporción original de la imagen', () => {
    const colocacion = calcularColocacion(
      HORIZONTAL,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'contener' }),
    )

    expect(colocacion.ancho / colocacion.alto).toBeCloseTo(
      HORIZONTAL.ancho / HORIZONTAL.alto,
      3,
    )
  })

  it('centra la imagen en la página', () => {
    const colocacion = calcularColocacion(
      HORIZONTAL,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'contener' }),
    )

    expect(colocacion.x).toBeCloseTo(
      (colocacion.pagina.ancho - colocacion.ancho) / 2,
      3,
    )
    expect(colocacion.y).toBeCloseTo(
      (colocacion.pagina.alto - colocacion.alto) / 2,
      3,
    )
  })

  it('respeta los márgenes: la imagen no los invade', () => {
    const configuracion = configurar({
      tamano: 'a4',
      orientacion: 'vertical',
      margen: 'grande',
      ajuste: 'contener',
    })
    const margen = calcularMargenPuntos(configuracion)
    const colocacion = calcularColocacion(HORIZONTAL, configuracion)

    expect(colocacion.x).toBeGreaterThanOrEqual(margen - HOLGURA)
    expect(colocacion.y).toBeGreaterThanOrEqual(margen - HOLGURA)
    expect(colocacion.x + colocacion.ancho).toBeLessThanOrEqual(
      colocacion.pagina.ancho - margen + HOLGURA,
    )
    expect(colocacion.y + colocacion.alto).toBeLessThanOrEqual(
      colocacion.pagina.alto - margen + HOLGURA,
    )
  })

  it('un margen mayor deja la imagen más pequeña', () => {
    const sinMargen = calcularColocacion(
      HORIZONTAL,
      configurar({ tamano: 'a4', margen: 'sin-margen', ajuste: 'contener' }),
    )
    const conMargen = calcularColocacion(
      HORIZONTAL,
      configurar({ tamano: 'a4', margen: 'grande', ajuste: 'contener' }),
    )

    expect(conMargen.ancho).toBeLessThan(sinMargen.ancho)
  })

  it('con el tamaño original y sin margen la imagen llena la página', () => {
    const colocacion = calcularColocacion(
      { ancho: 960, alto: 480 },
      configurar({
        tamano: 'original',
        margen: 'sin-margen',
        ajuste: 'contener',
      }),
    )

    expect(colocacion.x).toBeCloseTo(0, 3)
    expect(colocacion.y).toBeCloseTo(0, 3)
    expect(colocacion.ancho).toBeCloseTo(pixelesAPuntos(960), 2)
    expect(colocacion.alto).toBeCloseTo(pixelesAPuntos(480), 2)
  })
})

describe('calcularColocacion: modo cubrir', () => {
  it('rellena todo el área disponible', () => {
    const configuracion = configurar({
      tamano: 'a4',
      orientacion: 'vertical',
      margen: 'sin-margen',
      ajuste: 'cubrir',
    })
    const colocacion = calcularColocacion(HORIZONTAL, configuracion)

    expect(colocacion.ancho).toBeCloseTo(colocacion.pagina.ancho, 2)
    expect(colocacion.alto).toBeCloseTo(colocacion.pagina.alto, 2)
  })

  it('recorta la imagen cuando la proporción no coincide', () => {
    const colocacion = calcularColocacion(
      HORIZONTAL,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'cubrir' }),
    )

    expect(colocacion.recorta).toBe(true)
    expect(colocacion.recorte).not.toBeNull()
  })

  it('recorta por los costados cuando la imagen es más ancha de lo necesario', () => {
    const colocacion = calcularColocacion(
      HORIZONTAL,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'cubrir' }),
    )
    const recorte = colocacion.recorte

    expect(recorte).not.toBeNull()
    expect(recorte?.izquierda).toBeGreaterThan(0)
    expect(recorte?.derecha).toBeGreaterThan(0)
    expect(recorte?.superior).toBe(0)
    expect(recorte?.inferior).toBe(0)
  })

  it('recorta por arriba y por abajo cuando la imagen es más alta de lo necesario', () => {
    const colocacion = calcularColocacion(
      VERTICAL,
      configurar({ tamano: 'a4', orientacion: 'horizontal', ajuste: 'cubrir' }),
    )
    const recorte = colocacion.recorte

    expect(recorte?.superior).toBeGreaterThan(0)
    expect(recorte?.inferior).toBeGreaterThan(0)
    expect(recorte?.izquierda).toBe(0)
    expect(recorte?.derecha).toBe(0)
  })

  it('recorta lo mismo por los dos lados, así que el motivo queda centrado', () => {
    const colocacion = calcularColocacion(
      HORIZONTAL,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'cubrir' }),
    )

    expect(colocacion.recorte?.izquierda).toBeCloseTo(
      colocacion.recorte?.derecha ?? -1,
      6,
    )
  })

  it('no recorta nada cuando la proporción ya coincide', () => {
    const configuracion = configurar({
      tamano: 'original',
      margen: 'sin-margen',
      ajuste: 'cubrir',
    })
    const colocacion = calcularColocacion({ ancho: 800, alto: 600 }, configuracion)

    expect(colocacion.recorta).toBe(false)
    expect(colocacion.recorte).toBeNull()
  })

  it('respeta los márgenes también al cubrir', () => {
    const configuracion = configurar({
      tamano: 'a4',
      orientacion: 'vertical',
      margen: 'grande',
      ajuste: 'cubrir',
    })
    const margen = calcularMargenPuntos(configuracion)
    const colocacion = calcularColocacion(HORIZONTAL, configuracion)

    expect(colocacion.x).toBeCloseTo(margen, 2)
    expect(colocacion.y).toBeCloseTo(margen, 2)
    expect(colocacion.ancho).toBeCloseTo(
      colocacion.pagina.ancho - margen * 2,
      2,
    )
  })
})

describe('calcularColocacion: imágenes giradas', () => {
  it('trata una imagen girada un cuarto de vuelta como vertical', () => {
    const giradas = dimensionesTrasRotar(HORIZONTAL, 90)

    expect(giradas).toEqual({ ancho: 900, alto: 1600 })

    const pagina = calcularMedidasPagina(
      giradas,
      configurar({ tamano: 'a4', orientacion: 'automatica' }),
    )

    expect(pagina.alto).toBeGreaterThan(pagina.ancho)
  })

  it('conserva la proporción de la imagen girada', () => {
    const giradas = dimensionesTrasRotar(HORIZONTAL, 270)
    const colocacion = calcularColocacion(
      giradas,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'contener' }),
    )

    expect(colocacion.ancho / colocacion.alto).toBeCloseTo(900 / 1600, 3)
  })

  it('no intercambia los ejes con media vuelta', () => {
    expect(dimensionesTrasRotar(HORIZONTAL, 180)).toEqual(HORIZONTAL)
  })
})

describe('losMargenesDejanEspacio', () => {
  it('acepta un margen razonable', () => {
    expect(
      losMargenesDejanEspacio(
        HORIZONTAL,
        configurar({ tamano: 'a4', margen: 'grande' }),
      ),
    ).toBe(true)
  })

  it('el margen máximo admitido sigue dejando página utilizable', () => {
    // Es la garantía que ofrece el límite de 100 mm: ni siquiera aplicado a la
    // página con nombre más estrecha llega a agotarla.
    expect(
      losMargenesDejanEspacio(
        HORIZONTAL,
        configurar({
          tamano: 'a4',
          margen: 'personalizado',
          margenPersonalizadoMm: MARGEN_PERSONALIZADO_MAXIMO_MM,
        }),
      ),
    ).toBe(true)
  })

  it('con el tamaño original siempre queda espacio', () => {
    expect(
      losMargenesDejanEspacio(
        HORIZONTAL,
        configurar({
          tamano: 'original',
          margen: 'personalizado',
          margenPersonalizadoMm: MARGEN_PERSONALIZADO_MAXIMO_MM,
        }),
      ),
    ).toBe(true)
  })
})

describe('laImagenQuedaMuyPequena', () => {
  it('no avisa con un margen normal', () => {
    expect(
      laImagenQuedaMuyPequena(
        VERTICAL,
        configurar({ tamano: 'a4', margen: 'pequeno' }),
      ),
    ).toBe(false)
  })

  it('avisa cuando el margen deja la imagen diminuta', () => {
    expect(
      laImagenQuedaMuyPequena(
        VERTICAL,
        configurar({
          tamano: 'a4',
          margen: 'personalizado',
          margenPersonalizadoMm: MARGEN_PERSONALIZADO_MAXIMO_MM,
        }),
      ),
    ).toBe(true)
  })

  it('la proporción aprovechada está siempre entre 0 y 1', () => {
    const proporcion = calcularProporcionAprovechada(
      VERTICAL,
      configurar({ tamano: 'a4', margen: 'mediano' }),
    )

    expect(proporcion).toBeGreaterThan(0)
    expect(proporcion).toBeLessThanOrEqual(1)
  })

  it('el modo cubrir sin margen aprovecha toda la página', () => {
    expect(
      calcularProporcionAprovechada(
        VERTICAL,
        configurar({ tamano: 'a4', margen: 'sin-margen', ajuste: 'cubrir' }),
      ),
    ).toBeCloseTo(1, 3)
  })
})

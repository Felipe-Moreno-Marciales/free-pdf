import { describe, expect, it } from 'vitest'
import { convertirRectangulosSeleccion } from '../edicion/seleccionTexto'

/** Crea solo los campos de DOMRect que usa la conversión. */
function rectangulo(
  izquierda: number,
  superior: number,
  ancho: number,
  alto: number,
): DOMRect {
  return {
    left: izquierda,
    top: superior,
    right: izquierda + ancho,
    bottom: superior + alto,
    width: ancho,
    height: alto,
  } as DOMRect
}

describe('convertirRectangulosSeleccion', () => {
  it('convierte una palabra seleccionada a fracciones de la página', () => {
    const limite = rectangulo(100, 50, 500, 800)
    const [caja] = convertirRectangulosSeleccion(
      [rectangulo(200, 130, 100, 20)],
      limite,
    )

    expect(caja?.izquierda).toBeCloseTo((200 - 100) / 500, 8)
    expect(caja?.superior).toBeCloseTo((130 - 50) / 800, 8)
    expect(caja?.ancho).toBeCloseTo(100 / 500, 8)
    expect(caja?.alto).toBeCloseTo(20 / 800, 8)
  })

  it('conserva por separado las líneas de una selección multilínea', () => {
    const cajas = convertirRectangulosSeleccion(
      [rectangulo(10, 10, 80, 12), rectangulo(10, 30, 120, 12)],
      rectangulo(0, 0, 200, 300),
    )

    expect(cajas).toHaveLength(2)
    expect(cajas[1]?.superior).toBeGreaterThan(cajas[0]?.superior ?? 0)
  })

  it('recorta la selección en los bordes de la página', () => {
    const [caja] = convertirRectangulosSeleccion(
      [rectangulo(-5, -4, 20, 20)],
      rectangulo(0, 0, 100, 100),
    )

    expect(caja?.izquierda).toBe(0)
    expect(caja?.superior).toBe(0)
    expect((caja?.izquierda ?? 0) + (caja?.ancho ?? 0)).toBeLessThanOrEqual(1)
  })

  it('ignora selecciones cuando el contenedor no tiene dimensiones', () => {
    expect(
      convertirRectangulosSeleccion(
        [rectangulo(0, 0, 10, 10)],
        rectangulo(0, 0, 0, 100),
      ),
    ).toEqual([])
  })
})

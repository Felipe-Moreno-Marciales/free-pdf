import { describe, expect, it } from 'vitest'
import {
  crearHistorial,
  deshacer,
  PASOS_MAXIMOS,
  puedeDeshacer,
  puedeRehacer,
  reemplazar,
  registrar,
  rehacer,
  separar,
} from '../edicion/historial'

describe('historial', () => {
  it('empieza sin nada que deshacer ni rehacer', () => {
    const historial = crearHistorial('a')

    expect(historial.presente).toBe('a')
    expect(puedeDeshacer(historial)).toBe(false)
    expect(puedeRehacer(historial)).toBe(false)
  })

  it('vuelve al estado anterior y lo deja disponible para rehacer', () => {
    const historial = deshacer(registrar(crearHistorial('a'), 'b'))

    expect(historial.presente).toBe('a')
    expect(puedeRehacer(historial)).toBe(true)
    expect(rehacer(historial).presente).toBe('b')
  })

  it('no hace nada cuando no queda historia hacia ese lado', () => {
    const historial = crearHistorial('a')

    expect(deshacer(historial)).toBe(historial)
    expect(rehacer(historial)).toBe(historial)
  })

  it('descarta el futuro al registrar algo nuevo después de deshacer', () => {
    const despues = registrar(deshacer(registrar(crearHistorial('a'), 'b')), 'c')

    expect(despues.presente).toBe('c')
    expect(puedeRehacer(despues)).toBe(false)
    expect(deshacer(despues).presente).toBe('a')
  })

  it('funde en un solo paso los cambios seguidos con la misma clave', () => {
    // Es lo que convierte doscientos movimientos de puntero en un arrastre.
    const arrastre = registrar(
      registrar(registrar(crearHistorial('a'), 'b', 'mover'), 'c', 'mover'),
      'd',
      'mover',
    )

    expect(arrastre.presente).toBe('d')
    expect(deshacer(arrastre).presente).toBe('a')
  })

  it('abre un paso nuevo cuando cambia la clave', () => {
    const historial = registrar(
      registrar(crearHistorial('a'), 'b', 'mover'),
      'c',
      'color',
    )

    expect(deshacer(historial).presente).toBe('b')
  })

  it('separar cierra el paso, de modo que dos gestos iguales no se funden', () => {
    const primero = registrar(crearHistorial('a'), 'b', 'mover')
    const segundo = registrar(separar(primero), 'c', 'mover')

    expect(deshacer(segundo).presente).toBe('b')
  })

  it('separar no cambia nada si el paso ya estaba cerrado', () => {
    const historial = registrar(crearHistorial('a'), 'b')

    expect(separar(historial)).toBe(historial)
  })

  it('deshacer cierra el paso, para no fundirse con lo que venga después', () => {
    const arrastre = registrar(crearHistorial('a'), 'b', 'mover')
    const vuelto = deshacer(arrastre)
    const despues = registrar(vuelto, 'c', 'mover')

    expect(despues.presente).toBe('c')
    expect(deshacer(despues).presente).toBe('a')
  })

  it('reemplazar cambia el presente sin añadir un paso', () => {
    const historial = reemplazar(registrar(crearHistorial('a'), 'b'), 'b2')

    expect(historial.presente).toBe('b2')
    expect(historial.pasado).toHaveLength(1)
    expect(deshacer(historial).presente).toBe('a')
  })

  it('descarta los pasos más antiguos al pasar del límite', () => {
    let historial = crearHistorial(0)

    for (let paso = 1; paso <= PASOS_MAXIMOS + 10; paso += 1) {
      historial = registrar(historial, paso)
    }

    expect(historial.pasado).toHaveLength(PASOS_MAXIMOS)
    // El más antiguo que queda es el paso 10, no el 0: los diez primeros se soltaron.
    expect(historial.pasado[0]).toBe(10)
  })
})

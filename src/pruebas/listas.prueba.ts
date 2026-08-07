import { describe, expect, it } from 'vitest'
import {
  actualizarPorId,
  buscarPorId,
  eliminarPorId,
  esPosicionValida,
  intercambiar,
  moverAPosicion,
  moverPorId,
} from '../utilidades/listas'

/** Elemento de prueba con identificador y una etiqueta. */
interface Elemento {
  readonly id: string
  readonly etiqueta: string
}

/** Lista de tres elementos. */
function crearLista(): readonly Elemento[] {
  return [
    { id: 'a', etiqueta: 'primero' },
    { id: 'b', etiqueta: 'segundo' },
    { id: 'c', etiqueta: 'tercero' },
  ]
}

/** Devuelve los identificadores, para comparar el orden con claridad. */
function ids(lista: readonly Elemento[]): readonly string[] {
  return lista.map((elemento) => elemento.id)
}

describe('esPosicionValida', () => {
  it('acepta las posiciones dentro de la lista', () => {
    expect(esPosicionValida(0, 3)).toBe(true)
    expect(esPosicionValida(2, 3)).toBe(true)
  })

  it('rechaza las posiciones fuera de la lista', () => {
    expect(esPosicionValida(-1, 3)).toBe(false)
    expect(esPosicionValida(3, 3)).toBe(false)
  })

  it('rechaza las posiciones que no son enteros', () => {
    expect(esPosicionValida(1.5, 3)).toBe(false)
    expect(esPosicionValida(Number.NaN, 3)).toBe(false)
  })
})

describe('moverAPosicion', () => {
  it('mueve un elemento desplazando el resto', () => {
    expect(ids(moverAPosicion(crearLista(), 0, 2))).toEqual(['b', 'c', 'a'])
  })

  it('mueve hacia atrás igual de bien', () => {
    expect(ids(moverAPosicion(crearLista(), 2, 0))).toEqual(['c', 'a', 'b'])
  })

  it('devuelve la misma referencia si no hay nada que mover', () => {
    const lista = crearLista()

    expect(moverAPosicion(lista, 1, 1)).toBe(lista)
    expect(moverAPosicion(lista, -1, 0)).toBe(lista)
    expect(moverAPosicion(lista, 0, 9)).toBe(lista)
  })

  it('no modifica la lista original', () => {
    const lista = crearLista()

    moverAPosicion(lista, 0, 2)

    expect(ids(lista)).toEqual(['a', 'b', 'c'])
  })
})

describe('intercambiar', () => {
  it('intercambia dos posiciones', () => {
    expect(ids(intercambiar(crearLista(), 0, 2))).toEqual(['c', 'b', 'a'])
  })

  it('devuelve la misma referencia si alguna posición no existe', () => {
    const lista = crearLista()

    expect(intercambiar(lista, 0, -1)).toBe(lista)
    expect(intercambiar(lista, 0, 3)).toBe(lista)
  })
})

describe('moverPorId', () => {
  it('mueve al elemento anterior', () => {
    expect(ids(moverPorId(crearLista(), 'c', 'anterior'))).toEqual([
      'a',
      'c',
      'b',
    ])
  })

  it('mueve al elemento siguiente', () => {
    expect(ids(moverPorId(crearLista(), 'a', 'siguiente'))).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('lleva al inicio', () => {
    expect(ids(moverPorId(crearLista(), 'c', 'inicio'))).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('lleva al final', () => {
    expect(ids(moverPorId(crearLista(), 'a', 'final'))).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('no altera la lista al salir de los límites', () => {
    const lista = crearLista()

    expect(moverPorId(lista, 'a', 'anterior')).toBe(lista)
    expect(moverPorId(lista, 'c', 'siguiente')).toBe(lista)
  })

  it('no altera la lista si el identificador no existe', () => {
    const lista = crearLista()

    expect(moverPorId(lista, 'z', 'inicio')).toBe(lista)
  })

  it('llevar al inicio el primero no cambia nada', () => {
    const lista = crearLista()

    expect(moverPorId(lista, 'a', 'inicio')).toBe(lista)
  })
})

describe('eliminarPorId', () => {
  it('quita el elemento indicado', () => {
    expect(ids(eliminarPorId(crearLista(), 'b'))).toEqual(['a', 'c'])
  })

  it('deja la lista igual si el identificador no existe', () => {
    expect(ids(eliminarPorId(crearLista(), 'z'))).toEqual(['a', 'b', 'c'])
  })

  it('puede vaciar la lista', () => {
    let lista = crearLista()

    for (const id of ['a', 'b', 'c']) {
      lista = eliminarPorId(lista, id)
    }

    expect(lista).toEqual([])
  })
})

describe('actualizarPorId', () => {
  it('aplica los cambios al elemento indicado', () => {
    const lista = actualizarPorId(crearLista(), 'b', { etiqueta: 'cambiado' })

    expect(lista[1].etiqueta).toBe('cambiado')
  })

  it('no toca el resto de elementos', () => {
    const lista = actualizarPorId(crearLista(), 'b', { etiqueta: 'cambiado' })

    expect(lista[0].etiqueta).toBe('primero')
    expect(lista[2].etiqueta).toBe('tercero')
  })

  it('conserva el orden', () => {
    expect(ids(actualizarPorId(crearLista(), 'a', { etiqueta: 'x' }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('no falla con un identificador inexistente', () => {
    expect(ids(actualizarPorId(crearLista(), 'z', { etiqueta: 'x' }))).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})

describe('buscarPorId', () => {
  it('encuentra el elemento', () => {
    expect(buscarPorId(crearLista(), 'b')?.etiqueta).toBe('segundo')
  })

  it('devuelve nulo si no existe', () => {
    expect(buscarPorId(crearLista(), 'z')).toBeNull()
  })

  it('devuelve nulo con un identificador nulo', () => {
    expect(buscarPorId(crearLista(), null)).toBeNull()
  })
})

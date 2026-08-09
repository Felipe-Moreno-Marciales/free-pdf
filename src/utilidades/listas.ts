/**
 * Operaciones puras sobre listas de elementos identificados.
 *
 * Las usan por igual la selección de imágenes y las capturas del escáner, que
 * necesitan exactamente los mismos movimientos. Todas devuelven una lista nueva
 * sin modificar la que reciben, y cuando el cambio no altera nada devuelven la
 * misma referencia, lo que evita renderizados innecesarios en React.
 */

/** Elemento que se puede localizar por su identificador. */
export interface ConIdentificador {
  readonly id: string
}

/** Movimiento de un elemento dentro de una lista. */
export type Desplazamiento = 'anterior' | 'siguiente' | 'inicio' | 'final'

/** Comprueba que una posición exista dentro de la lista. */
export function esPosicionValida(posicion: number, longitud: number): boolean {
  return Number.isInteger(posicion) && posicion >= 0 && posicion < longitud
}

/** Mueve un elemento de una posición a otra, desplazando el resto. */
export function moverAPosicion<Elemento>(
  lista: readonly Elemento[],
  posicionOrigen: number,
  posicionDestino: number,
): readonly Elemento[] {
  if (
    posicionOrigen === posicionDestino ||
    !esPosicionValida(posicionOrigen, lista.length) ||
    !esPosicionValida(posicionDestino, lista.length)
  ) {
    return lista
  }

  const resultado = [...lista]
  const [movido] = resultado.splice(posicionOrigen, 1)
  resultado.splice(posicionDestino, 0, movido)

  return resultado
}

/** Intercambia dos posiciones si ambas existen. */
export function intercambiar<Elemento>(
  lista: readonly Elemento[],
  primera: number,
  segunda: number,
): readonly Elemento[] {
  if (
    !esPosicionValida(primera, lista.length) ||
    !esPosicionValida(segunda, lista.length)
  ) {
    return lista
  }

  const resultado = [...lista]
  const guardado = resultado[primera]
  resultado[primera] = resultado[segunda]
  resultado[segunda] = guardado

  return resultado
}

/**
 * Mueve el elemento con el identificador indicado.
 *
 * `anterior` y `siguiente` lo intercambian con su vecino; `inicio` y `final` lo
 * llevan a un extremo desplazando el resto.
 */
export function moverPorId<Elemento extends ConIdentificador>(
  lista: readonly Elemento[],
  id: string,
  desplazamiento: Desplazamiento,
): readonly Elemento[] {
  const posicion = lista.findIndex((elemento) => elemento.id === id)
  if (posicion === -1) {
    return lista
  }

  switch (desplazamiento) {
    case 'anterior':
      return intercambiar(lista, posicion, posicion - 1)
    case 'siguiente':
      return intercambiar(lista, posicion, posicion + 1)
    case 'inicio':
      return moverAPosicion(lista, posicion, 0)
    case 'final':
      return moverAPosicion(lista, posicion, lista.length - 1)
  }
}

/** Quita el elemento con el identificador indicado. */
export function eliminarPorId<Elemento extends ConIdentificador>(
  lista: readonly Elemento[],
  id: string,
): readonly Elemento[] {
  return lista.filter((elemento) => elemento.id !== id)
}

/** Aplica cambios parciales al elemento con el identificador indicado. */
export function actualizarPorId<Elemento extends ConIdentificador>(
  lista: readonly Elemento[],
  id: string,
  cambios: Partial<Elemento>,
): readonly Elemento[] {
  return lista.map((elemento) =>
    elemento.id === id ? { ...elemento, ...cambios } : elemento,
  )
}

/** Busca un elemento por su identificador. */
export function buscarPorId<Elemento extends ConIdentificador>(
  lista: readonly Elemento[],
  id: string | null,
): Elemento | null {
  if (id === null) {
    return null
  }

  return lista.find((elemento) => elemento.id === id) ?? null
}

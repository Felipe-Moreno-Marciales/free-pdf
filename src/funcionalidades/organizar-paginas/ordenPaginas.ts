/**
 * Operaciones puras sobre el orden de las páginas.
 *
 * Todas reciben el orden actual —una lista de índices originales— y devuelven
 * un orden nuevo sin modificar el que reciben. Al ser puras se pueden probar sin
 * navegador y las usan por igual los botones y el arrastre.
 */

/** Crea el orden inicial: las páginas tal y como están en el documento. */
export function crearOrdenInicial(numeroPaginas: number): readonly number[] {
  return Array.from({ length: numeroPaginas }, (_, indice) => indice)
}

/** Mueve la página de una posición a otra, desplazando el resto. */
export function moverAPosicion(
  orden: readonly number[],
  posicionOrigen: number,
  posicionDestino: number,
): readonly number[] {
  if (
    !esPosicionValida(posicionOrigen, orden.length) ||
    !esPosicionValida(posicionDestino, orden.length) ||
    posicionOrigen === posicionDestino
  ) {
    return orden
  }

  const siguiente = [...orden]
  const [movida] = siguiente.splice(posicionOrigen, 1)
  siguiente.splice(posicionDestino, 0, movida)

  return siguiente
}

/** Intercambia una página con la anterior. */
export function moverIzquierda(
  orden: readonly number[],
  posicion: number,
): readonly number[] {
  return intercambiar(orden, posicion, posicion - 1)
}

/** Intercambia una página con la siguiente. */
export function moverDerecha(
  orden: readonly number[],
  posicion: number,
): readonly number[] {
  return intercambiar(orden, posicion, posicion + 1)
}

/** Lleva una página al principio del documento. */
export function moverAlInicio(
  orden: readonly number[],
  posicion: number,
): readonly number[] {
  return moverAPosicion(orden, posicion, 0)
}

/** Lleva una página al final del documento. */
export function moverAlFinal(
  orden: readonly number[],
  posicion: number,
): readonly number[] {
  return moverAPosicion(orden, posicion, orden.length - 1)
}

/**
 * Agrupa las páginas seleccionadas y las coloca juntas.
 *
 * Las páginas marcadas conservan entre sí el orden que tenían, y el resto
 * mantiene también su orden relativo. Con `destino` igual a `inicio` el grupo
 * se coloca al principio, y con `final` al final del documento.
 */
export function agruparSeleccionadas(
  orden: readonly number[],
  seleccionadas: ReadonlySet<number>,
  destino: 'inicio' | 'final',
): readonly number[] {
  if (seleccionadas.size === 0 || seleccionadas.size === orden.length) {
    return orden
  }

  const grupo = orden.filter((indice) => seleccionadas.has(indice))
  const resto = orden.filter((indice) => !seleccionadas.has(indice))

  return destino === 'inicio' ? [...grupo, ...resto] : [...resto, ...grupo]
}

/** Comprueba si el orden difiere del original. */
export function estaOrdenAlterado(orden: readonly number[]): boolean {
  return orden.some((indice, posicion) => indice !== posicion)
}

/** Intercambia dos posiciones si ambas existen. */
function intercambiar(
  orden: readonly number[],
  primera: number,
  segunda: number,
): readonly number[] {
  if (
    !esPosicionValida(primera, orden.length) ||
    !esPosicionValida(segunda, orden.length)
  ) {
    return orden
  }

  const siguiente = [...orden]
  const guardada = siguiente[primera]
  siguiente[primera] = siguiente[segunda]
  siguiente[segunda] = guardada

  return siguiente
}

/** Comprueba que una posición esté dentro de la lista. */
function esPosicionValida(posicion: number, longitud: number): boolean {
  return Number.isInteger(posicion) && posicion >= 0 && posicion < longitud
}

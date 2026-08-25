/**
 * Historial de deshacer y rehacer.
 *
 * Todo lo de este módulo es puro: no toca React ni el navegador, así que se puede
 * probar entero. Es deliberado, porque un historial roto se nota tarde y mal —el
 * usuario descubre que su Ctrl+Z no recupera lo que esperaba cuando ya ha perdido el
 * trabajo—, y esa clase de error se caza mucho mejor con pruebas que mirando la
 * interfaz.
 *
 * El modelo es el clásico de tres partes: lo que ya pasó, lo que se ve ahora y lo que
 * se deshizo y todavía se puede recuperar. Registrar algo nuevo borra el futuro, que
 * es lo que espera cualquiera que haya usado un editor.
 *
 * **Los estados se comparten por referencia, no se copian.** Los elementos de la capa
 * son inmutables, así que cien pasos de historia sobre un documento con una imagen de
 * dos megas guardan una sola copia de esos bytes, no cien.
 */

/**
 * Cuántos pasos hacia atrás se conservan.
 *
 * El límite existe porque el historial no se puede vaciar solo: sin él, una sesión
 * larga acumularía estados indefinidamente. Cien pasos cubren de sobra el trabajo de
 * una sesión y acotan la memoria.
 */
export const PASOS_MAXIMOS = 100

/** Estado con su historia, listo para deshacer y rehacer. */
export interface Historial<T> {
  /** Estados anteriores, del más antiguo al más reciente. */
  readonly pasado: readonly T[]
  /** Estado que se está viendo. */
  readonly presente: T
  /** Estados deshechos, del primero que se recuperaría al último. */
  readonly futuro: readonly T[]
  /**
   * Clave con la que se agrupó la última entrada, o `null` si el paso está cerrado.
   *
   * Sin agrupación, arrastrar un elemento generaría un paso por cada movimiento del
   * puntero y deshacer retrocedería un píxel. Los cambios consecutivos que tocan lo
   * mismo se funden en un solo paso, que es lo que de verdad hizo el usuario.
   */
  readonly claveAgrupacion: string | null
}

/** Historial recién empezado, sin nada que deshacer. */
export function crearHistorial<T>(presente: T): Historial<T> {
  return { pasado: [], presente, futuro: [], claveAgrupacion: null }
}

/**
 * Registra un estado nuevo.
 *
 * Con la misma clave que la entrada anterior el cambio se funde en ella en lugar de
 * añadir un paso. Con `null`, o con una clave distinta, se abre un paso nuevo.
 */
export function registrar<T>(
  historial: Historial<T>,
  presente: T,
  clave: string | null = null,
): Historial<T> {
  if (clave !== null && clave === historial.claveAgrupacion) {
    return { ...historial, presente, futuro: [] }
  }

  const pasado = [...historial.pasado, historial.presente]

  return {
    pasado:
      pasado.length > PASOS_MAXIMOS
        ? pasado.slice(pasado.length - PASOS_MAXIMOS)
        : pasado,
    presente,
    futuro: [],
    claveAgrupacion: clave,
  }
}

/**
 * Cambia el presente sin tocar la historia.
 *
 * Es para lo que no es una edición del documento, como elegir qué elemento está
 * seleccionado: importa que deshacer devuelva la selección de entonces, pero
 * seleccionar por sí solo no es algo que nadie quiera deshacer.
 */
export function reemplazar<T>(
  historial: Historial<T>,
  presente: T,
): Historial<T> {
  return { ...historial, presente }
}

/**
 * Cierra el paso en curso, de modo que el cambio siguiente empiece otro.
 *
 * Lo llama la interfaz al terminar un gesto: dos arrastres seguidos del mismo
 * elemento son dos cosas distintas aunque cambien las mismas propiedades.
 */
export function separar<T>(historial: Historial<T>): Historial<T> {
  return historial.claveAgrupacion === null
    ? historial
    : { ...historial, claveAgrupacion: null }
}

/** Retrocede un paso. Devuelve el mismo historial si no hay nada que deshacer. */
export function deshacer<T>(historial: Historial<T>): Historial<T> {
  const anterior = historial.pasado.at(-1)

  if (anterior === undefined) {
    return historial
  }

  return {
    pasado: historial.pasado.slice(0, -1),
    presente: anterior,
    futuro: [historial.presente, ...historial.futuro],
    claveAgrupacion: null,
  }
}

/** Avanza un paso. Devuelve el mismo historial si no hay nada que rehacer. */
export function rehacer<T>(historial: Historial<T>): Historial<T> {
  const [siguiente, ...resto] = historial.futuro

  if (siguiente === undefined) {
    return historial
  }

  return {
    pasado: [...historial.pasado, historial.presente],
    presente: siguiente,
    futuro: resto,
    claveAgrupacion: null,
  }
}

/** Si hay algún paso al que volver. */
export function puedeDeshacer<T>(historial: Historial<T>): boolean {
  return historial.pasado.length > 0
}

/** Si hay algún paso deshecho que recuperar. */
export function puedeRehacer<T>(historial: Historial<T>): boolean {
  return historial.futuro.length > 0
}

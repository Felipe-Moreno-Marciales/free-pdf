/**
 * Cancelación de las operaciones que se pueden interrumpir.
 *
 * Se usa `AbortController`, la API estándar del navegador, y una clase de error
 * propia para distinguir una cancelación pedida por la persona de un fallo real.
 * Una cancelación no es un error: no debe mostrarse como tal ni dejar la
 * herramienta en estado de error.
 */

/** Se lanza cuando la operación se interrumpe a petición de la persona. */
export class OperacionCancelada extends Error {
  constructor(mensaje = 'La operación se canceló.') {
    super(mensaje)
    this.name = 'OperacionCancelada'
  }
}

/** Interrumpe la operación si la señal ya está cancelada. */
export function comprobarCancelacion(senal: AbortSignal | undefined): void {
  if (senal?.aborted === true) {
    throw new OperacionCancelada()
  }
}

/** `true` cuando el error corresponde a una cancelación. */
export function esCancelacion(error: unknown): boolean {
  if (error instanceof OperacionCancelada) {
    return true
  }

  // Las API del navegador señalan la cancelación con un `AbortError`.
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

/**
 * Cede el control al navegador entre dos pasos de un proceso largo.
 *
 * Sin esta pausa la interfaz se congelaría mientras se convierten muchas
 * páginas: el hilo principal no podría atender ni el botón de cancelar ni el
 * anuncio del progreso. Con `setTimeout` de cero milisegundos el navegador
 * aprovecha para pintar antes de seguir.
 */
export function cederElControl(): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, 0)
  })
}

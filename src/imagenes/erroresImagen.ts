/**
 * Error de cualquier operación con imágenes.
 *
 * Su mensaje ya está redactado en español y puede mostrarse tal cual en la
 * interfaz. El error original se conserva en `cause` para depuración, de modo
 * que los detalles técnicos nunca llegan a la persona que usa la aplicación.
 */
export class ErrorImagen extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones)
    this.name = 'ErrorImagen'
  }
}

/**
 * Convierte un error imprevisto en un `ErrorImagen` con un mensaje en español.
 * Los errores que ya son `ErrorImagen` se dejan intactos.
 */
export function envolverErrorImagen(
  error: unknown,
  mensaje: string,
): ErrorImagen {
  if (error instanceof ErrorImagen) {
    return error
  }

  return new ErrorImagen(mensaje, { cause: error })
}

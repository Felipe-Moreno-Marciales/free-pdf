/**
 * Error de cualquier operación con documentos PDF.
 *
 * Su mensaje ya está redactado en español y puede mostrarse tal cual en la
 * interfaz. El error original se conserva en `cause` para depuración, de modo
 * que los detalles técnicos nunca llegan a la persona que usa la aplicación.
 */
export class ErrorPdf extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones)
    this.name = 'ErrorPdf'
  }
}

/**
 * Convierte un error imprevisto en un `ErrorPdf` con un mensaje en español.
 * Los errores que ya son `ErrorPdf` se dejan intactos.
 */
export function envolverErrorPdf(error: unknown, mensaje: string): ErrorPdf {
  if (error instanceof ErrorPdf) {
    return error
  }

  return new ErrorPdf(mensaje, { cause: error })
}

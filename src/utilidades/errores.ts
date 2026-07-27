/**
 * Obtiene un texto descriptivo a partir de un valor de error desconocido.
 *
 * En JavaScript se puede lanzar cualquier valor, no solo instancias de `Error`,
 * así que esta función comprueba el tipo antes de leer nada y recurre al texto
 * de reserva cuando no hay un mensaje aprovechable.
 */
export function obtenerMensajeError(
  error: unknown,
  textoReserva: string,
): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }

  if (typeof error === 'string' && error.trim() !== '') {
    return error
  }

  return textoReserva
}

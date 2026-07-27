/**
 * Margen antes de liberar la URL temporal. Algunos navegadores cancelan la
 * descarga si la URL se revoca en el mismo ciclo en el que se pulsa el enlace.
 */
const RETARDO_LIBERACION_MS = 1000

/**
 * Descarga un `Blob` creando un enlace temporal en el documento.
 *
 * La URL generada con `URL.createObjectURL` se libera después con
 * `URL.revokeObjectURL` para no retener el archivo en memoria. Todo ocurre en
 * el navegador: no se realiza ninguna petición de red.
 */
export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')

  enlace.href = url
  enlace.download = nombreArchivo
  enlace.rel = 'noopener'
  enlace.hidden = true

  document.body.append(enlace)
  enlace.click()
  enlace.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, RETARDO_LIBERACION_MS)
}

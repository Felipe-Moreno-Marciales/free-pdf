/** Extensión obligatoria de los archivos aceptados. */
const EXTENSION_PDF = '.pdf'

/** Tipos MIME que los navegadores usan para los documentos PDF. */
const TIPOS_MIME_PDF = ['application/pdf', 'application/x-pdf'] as const

/** Valor del atributo `accept` del selector de archivos. */
export const ATRIBUTO_ACCEPT_PDF = 'application/pdf,.pdf'

/**
 * Comprueba que un archivo sea un PDF.
 *
 * Se exige siempre la extensión `.pdf` y, cuando el navegador informa de un
 * tipo MIME, se comprueba además que se corresponda con un PDF. Algunos
 * sistemas de archivos no facilitan el tipo MIME, por lo que un valor vacío no
 * invalida el archivo.
 */
export function esArchivoPdf(archivo: File): boolean {
  if (!archivo.name.toLowerCase().endsWith(EXTENSION_PDF)) {
    return false
  }

  const tipoMime = archivo.type.trim().toLowerCase()
  if (tipoMime === '') {
    return true
  }

  return TIPOS_MIME_PDF.some((permitido) => permitido === tipoMime)
}

/**
 * Construye el identificador de un archivo dentro de la selección.
 *
 * Combina nombre, tamaño y fecha de modificación, lo que permite descartar
 * duplicados exactos sin necesidad de leer el contenido del documento.
 */
export function construirIdArchivo(archivo: File): string {
  return `${archivo.name}|${archivo.size}|${archivo.lastModified}`
}

/**
 * Construye el identificador estable de una página.
 *
 * Se combina el identificador del documento con el índice original de la
 * página, de modo que React puede reutilizar la misma miniatura aunque la
 * página cambie de posición al reordenarla.
 */
export function crearIdentificadorPagina(
  idDocumento: string,
  indiceOriginal: number,
): string {
  return `${idDocumento}#${indiceOriginal}`
}

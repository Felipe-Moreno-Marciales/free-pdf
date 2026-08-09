import { zipSync } from 'fflate'

/** Tipo MIME de los paquetes ZIP. */
export const TIPO_MIME_ZIP = 'application/zip'

/**
 * Nivel de compresión.
 *
 * Se usa 0, que guarda los archivos sin comprimir. El contenido de un PDF ya
 * está comprimido internamente, así que volver a comprimirlo apenas reduce el
 * tamaño y en cambio bloquearía el hilo principal durante bastante tiempo.
 */
const NIVEL_SIN_COMPRIMIR = 0

/** Documento que se va a incluir dentro del ZIP. */
export interface ArchivoParaZip {
  /** Nombre con el que aparecerá dentro del paquete. */
  readonly nombreArchivo: string
  /** Contenido del documento. */
  readonly contenido: Uint8Array
}

/**
 * Empaqueta varios documentos en un único ZIP.
 *
 * Todo ocurre en memoria, en el navegador: no se sube nada a ningún servidor.
 * Si dos documentos comparten nombre se añade un sufijo numérico para que
 * ninguno sobrescriba al otro.
 */
export function crearBlobZip(archivos: readonly ArchivoParaZip[]): Blob {
  const contenidoPorNombre: Record<string, Uint8Array> = {}
  const nombresUsados = new Set<string>()

  for (const archivo of archivos) {
    const nombre = evitarNombreRepetido(archivo.nombreArchivo, nombresUsados)
    nombresUsados.add(nombre)
    contenidoPorNombre[nombre] = archivo.contenido
  }

  const bytes = zipSync(contenidoPorNombre, { level: NIVEL_SIN_COMPRIMIR })

  return new Blob([bytes], { type: TIPO_MIME_ZIP })
}

/** Añade un sufijo numérico cuando el nombre ya está ocupado. */
function evitarNombreRepetido(
  nombre: string,
  nombresUsados: ReadonlySet<string>,
): string {
  if (!nombresUsados.has(nombre)) {
    return nombre
  }

  const punto = nombre.lastIndexOf('.')
  const base = punto === -1 ? nombre : nombre.slice(0, punto)
  const extension = punto === -1 ? '' : nombre.slice(punto)

  let intento = 2
  let candidato = `${base}-${intento}${extension}`

  while (nombresUsados.has(candidato)) {
    intento += 1
    candidato = `${base}-${intento}${extension}`
  }

  return candidato
}

import { PDFDocument, degrees } from 'pdf-lib'

/** Alto común de todas las páginas de prueba. */
const ALTO_PAGINA = 400

/** Ancho de la primera página; el resto crece de diez en diez. */
const ANCHO_BASE = 200

/** Diferencia de ancho entre una página y la siguiente. */
const PASO_ANCHO = 10

/**
 * Ayudas para generar documentos PDF dentro de las propias pruebas.
 *
 * Los documentos se crean con pdf-lib en el momento, así que el repositorio no
 * necesita guardar archivos binarios de prueba.
 *
 * Cada página recibe un ancho distinto y creciente. Ese ancho actúa como
 * etiqueta: después de dividir, extraer o reordenar se pueden leer los anchos
 * del documento resultante y deducir de qué páginas originales proviene.
 */

/** Ancho que corresponde a la página con el índice indicado. */
export function anchoDePagina(indice: number): number {
  return ANCHO_BASE + indice * PASO_ANCHO
}

/** Convierte un ancho leído de un documento en el índice original. */
export function indiceDesdeAncho(ancho: number): number {
  return Math.round((ancho - ANCHO_BASE) / PASO_ANCHO)
}

/** Opciones para generar un documento de prueba. */
export interface OpcionesPdfPrueba {
  /** Rotación inicial de todas las páginas, en grados. */
  readonly rotacionInicial?: number
  /** Título que se guarda en los metadatos. */
  readonly titulo?: string
  /** Autor que se guarda en los metadatos. */
  readonly autor?: string
}

/** Genera los bytes de un documento con el número de páginas indicado. */
export async function crearBytesPdf(
  numeroPaginas: number,
  opciones: OpcionesPdfPrueba = {},
): Promise<Uint8Array> {
  const documento = await PDFDocument.create()

  if (opciones.titulo !== undefined) {
    documento.setTitle(opciones.titulo)
  }

  if (opciones.autor !== undefined) {
    documento.setAuthor(opciones.autor)
  }

  for (let indice = 0; indice < numeroPaginas; indice += 1) {
    const pagina = documento.addPage([anchoDePagina(indice), ALTO_PAGINA])

    if (opciones.rotacionInicial !== undefined) {
      pagina.setRotation(degrees(opciones.rotacionInicial))
    }
  }

  return await documento.save()
}

/** Envuelve unos bytes cualesquiera en un `File`. */
export function comoArchivo(
  bytes: Uint8Array,
  nombre: string,
  tipoMime = 'application/pdf',
): File {
  const contenido = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(contenido).set(bytes)

  return new File([contenido], nombre, {
    type: tipoMime,
    lastModified: bytes.byteLength,
  })
}

/** Genera un documento de prueba directamente como `File`. */
export async function crearArchivoPdf(
  nombre: string,
  numeroPaginas: number,
  opciones: OpcionesPdfPrueba = {},
): Promise<File> {
  return comoArchivo(await crearBytesPdf(numeroPaginas, opciones), nombre)
}

/** Abre unos bytes con pdf-lib para poder inspeccionar el resultado. */
export async function abrirBytes(bytes: Uint8Array): Promise<PDFDocument> {
  return await PDFDocument.load(bytes)
}

/** Lee los bytes de un `Blob`. */
export async function bytesDeBlob(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Devuelve los índices originales de las páginas de un documento, leyendo el
 * ancho de cada una.
 */
export async function leerOrdenOriginal(
  bytes: Uint8Array,
): Promise<readonly number[]> {
  const documento = await abrirBytes(bytes)

  return documento.getPages().map((pagina) => indiceDesdeAncho(pagina.getWidth()))
}

/** Devuelve la rotación de cada página de un documento, en grados. */
export async function leerRotaciones(
  bytes: Uint8Array,
): Promise<readonly number[]> {
  const documento = await abrirBytes(bytes)

  return documento.getPages().map((pagina) => pagina.getRotation().angle)
}

/** Devuelve el número de páginas de un documento. */
export async function contarPaginas(bytes: Uint8Array): Promise<number> {
  return (await abrirBytes(bytes)).getPageCount()
}

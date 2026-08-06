import type { PDFDocument } from 'pdf-lib'
import { ErrorPdf } from './erroresPdf'
import type { ResultadoDocumento } from './tipos'

/** Tipo MIME de los documentos PDF. */
export const TIPO_MIME_PDF = 'application/pdf'

/**
 * Crea el `Blob` de un documento a partir de sus bytes.
 *
 * Los bytes se copian a un `ArrayBuffer` propio para no depender del búfer
 * interno que devuelve pdf-lib.
 */
export function crearBlobPdf(bytes: Uint8Array): Blob {
  const contenido = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(contenido).set(bytes)

  return new Blob([contenido], { type: TIPO_MIME_PDF })
}

/** Guarda un documento de pdf-lib y devuelve sus bytes. */
export async function guardarBytes(documento: PDFDocument): Promise<Uint8Array> {
  try {
    return await documento.save()
  } catch (error) {
    throw new ErrorPdf(
      'No se pudo generar el documento resultante. Prueba con un documento más pequeño.',
      { cause: error },
    )
  }
}

/** Guarda un documento de pdf-lib y lo prepara para descargar. */
export async function guardarComoResultado(
  documento: PDFDocument,
  nombreArchivo: string,
): Promise<ResultadoDocumento> {
  const bytes = await guardarBytes(documento)

  return {
    blob: crearBlobPdf(bytes),
    nombreArchivo,
    numeroPaginas: documento.getPageCount(),
    tamano: bytes.byteLength,
  }
}

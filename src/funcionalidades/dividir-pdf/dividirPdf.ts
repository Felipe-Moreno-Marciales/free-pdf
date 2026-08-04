import type { PDFDocument } from 'pdf-lib'
import {
  abrirDocumentoDesdeArchivo,
  copiarYAnadirPaginas,
} from '../../pdf/cargarDocumentoPdf'
import { ErrorPdf, envolverErrorPdf } from '../../pdf/erroresPdf'
import { guardarBytes } from '../../pdf/guardarDocumentoPdf'
import type { ResultadoPaquete, ResumenDocumento } from '../../pdf/tipos'
import {
  crearBlobZip,
  type ArchivoParaZip,
} from '../../utilidades/descargarZip'
import { ErrorRangoPaginas } from '../../utilidades/rangosPaginas'
import { calcularGruposPrevistos } from './interpretarRangos'
import type { ModoDivision } from './tipos'

/** Nombre predeterminado del paquete que agrupa los documentos generados. */
export const NOMBRE_ZIP_DIVIDIDO = 'free-pdf-dividido.zip'

/** Datos necesarios para dividir un documento. */
export interface PeticionDivision {
  /** Archivo original. */
  readonly archivo: File
  /** Número de páginas del documento. */
  readonly totalPaginas: number
  /** Forma de dividir. */
  readonly modo: ModoDivision
  /** Expresión de rangos, solo se usa en el modo `rangos`. */
  readonly expresion: string
}

/**
 * Divide un documento en varios PDF y los empaqueta en un único ZIP.
 *
 * Todo ocurre en el navegador con pdf-lib. Se genera un solo archivo de
 * descarga a propósito: iniciar una descarga por documento haría que el
 * navegador bloquease casi todas.
 *
 * Los metadatos básicos del documento original (título, autor, asunto y
 * palabras clave) se copian a cada documento resultante cuando existen.
 */
export async function dividirPdf(
  peticion: PeticionDivision,
): Promise<ResultadoPaquete> {
  try {
    return await ejecutarDivision(peticion)
  } catch (error) {
    // El intérprete de rangos ya redacta mensajes pensados para la interfaz,
    // como «La página 99 no existe», así que se conservan tal cual.
    if (error instanceof ErrorRangoPaginas) {
      throw new ErrorPdf(error.message, { cause: error })
    }

    throw envolverErrorPdf(
      error,
      'No se pudo dividir el documento. Prueba con menos páginas o con un documento más pequeño.',
    )
  }
}

/** Realiza la división propiamente dicha. */
async function ejecutarDivision(
  peticion: PeticionDivision,
): Promise<ResultadoPaquete> {
  const grupos = calcularGruposPrevistos(
    peticion.modo,
    peticion.expresion,
    peticion.archivo.name,
    peticion.totalPaginas,
  )

  if (grupos.length === 0) {
    throw new ErrorPdf('No hay ninguna página que dividir.')
  }

  const { pdfLib, documento: origen } = await abrirDocumentoDesdeArchivo(
    peticion.archivo,
  )

  const archivosZip: ArchivoParaZip[] = []
  const resumenes: ResumenDocumento[] = []

  for (const grupo of grupos) {
    const destino = await pdfLib.PDFDocument.create()
    copiarMetadatos(origen, destino)

    await copiarYAnadirPaginas(
      destino,
      origen,
      grupo.indices,
      peticion.archivo.name,
    )

    const bytes = await guardarBytes(destino)

    archivosZip.push({ nombreArchivo: grupo.nombreArchivo, contenido: bytes })
    resumenes.push({
      nombreArchivo: grupo.nombreArchivo,
      numeroPaginas: grupo.indices.length,
      tamano: bytes.byteLength,
    })
  }

  const blob = crearBlobZip(archivosZip)

  return {
    blob,
    nombreArchivo: NOMBRE_ZIP_DIVIDIDO,
    tamano: blob.size,
    documentos: resumenes,
  }
}

/**
 * Copia los metadatos básicos del documento original al documento resultante.
 *
 * Se copian solo los campos de texto que pdf-lib expone de forma estable; las
 * fechas y el productor los establece pdf-lib al guardar.
 */
function copiarMetadatos(origen: PDFDocument, destino: PDFDocument): void {
  const titulo = origen.getTitle()
  if (titulo !== undefined && titulo !== '') {
    destino.setTitle(titulo)
  }

  const autor = origen.getAuthor()
  if (autor !== undefined && autor !== '') {
    destino.setAuthor(autor)
  }

  const asunto = origen.getSubject()
  if (asunto !== undefined && asunto !== '') {
    destino.setSubject(asunto)
  }

  const palabrasClave = origen.getKeywords()
  if (palabrasClave !== undefined && palabrasClave !== '') {
    destino.setKeywords([palabrasClave])
  }
}

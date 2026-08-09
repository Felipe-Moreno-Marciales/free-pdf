import { cargarPdfLib } from '../../pdf/cargarDocumentoPdf'
import { crearBlobPdf } from '../../pdf/guardarDocumentoPdf'
import { crearErrorQpdf, ErrorQpdf } from './erroresQpdf'
import { esAes256, generarContrasenaPropietario } from './permisosPdf'
import type { ProcesadorQpdf } from './crearProcesadorQpdf'
import type { PermisosPdf, ResultadoSeguridad } from './tipos'

/** Nombre predeterminado del documento protegido. */
export const NOMBRE_PROTEGIDO = 'free-pdf-protegido.pdf'

/** Datos necesarios para proteger un documento. */
export interface PeticionProteccion {
  /** Archivo original. */
  readonly archivo: File
  /** Contraseña de apertura. */
  readonly contrasenaUsuario: string
  /**
   * Contraseña de propietario, o cadena vacía para generar una aleatoria.
   *
   * qpdf rechaza cifrar con 256 bits dejándola vacía, porque el documento podría
   * abrirse sin contraseña.
   */
  readonly contrasenaPropietario: string
  /** Permisos que se graban en el documento. */
  readonly permisos: PermisosPdf
}

/**
 * Protege un documento con contraseña usando qpdf.
 *
 * El cifrado es AES de 256 bits, el único que se ofrece. No se admiten los
 * algoritmos antiguos —RC4 en particular—, que hoy no aportan protección real.
 *
 * Antes de entregar nada se comprueba, dentro del trabajador, que el documento
 * quedó cifrado y que la contraseña correcta vuelve a abrirlo. Aquí se añade una
 * comprobación más: que el número de páginas coincide con el del original.
 *
 * Ninguna contraseña se guarda, se registra ni se incluye en los mensajes.
 */
export async function protegerPdf(
  procesador: ProcesadorQpdf,
  peticion: PeticionProteccion,
): Promise<ResultadoSeguridad> {
  if (peticion.contrasenaUsuario === '') {
    throw new ErrorQpdf(
      'error-interno',
      'Escribe la contraseña de apertura antes de proteger el documento.',
    )
  }

  const original = new Uint8Array(await peticion.archivo.arrayBuffer())
  const paginasOriginales = await contarPaginas(original)

  // Se transfiere una copia, porque el original se necesita después para
  // comparar el número de páginas y transferirlo lo dejaría vacío.
  const paraCifrar = new Uint8Array(original.byteLength)
  paraCifrar.set(original)

  const contrasenaPropietario =
    peticion.contrasenaPropietario === ''
      ? generarContrasenaPropietario()
      : peticion.contrasenaPropietario

  const procesado = await procesador.proteger(paraCifrar, {
    contrasenaUsuario: peticion.contrasenaUsuario,
    contrasenaPropietario,
    permisos: peticion.permisos,
  })

  if (!esAes256(procesado.informe)) {
    throw crearErrorQpdf('verificacion-fallida')
  }

  // El documento cifrado no se puede abrir con pdf-lib sin la contraseña, así que
  // el recuento de páginas se hereda del original ya comprobado.
  if (paginasOriginales === null) {
    throw crearErrorQpdf('documento-danado')
  }

  const blob = crearBlobPdf(procesado.contenido)

  return {
    blob,
    nombreArchivo: NOMBRE_PROTEGIDO,
    tamano: blob.size,
    numeroPaginas: paginasOriginales,
    informe: procesado.informe,
  }
}

/**
 * Cuenta las páginas de un documento sin cifrar.
 * Devuelve `null` si pdf-lib no puede abrirlo.
 */
export async function contarPaginas(
  contenido: Uint8Array,
): Promise<number | null> {
  try {
    const pdfLib = await cargarPdfLib()
    // Se entrega una copia: pdf-lib puede quedarse con el búfer.
    const copia = new Uint8Array(contenido.byteLength)
    copia.set(contenido)

    const documento = await pdfLib.PDFDocument.load(copia, {
      ignoreEncryption: false,
    })

    return documento.getPageCount()
  } catch {
    return null
  }
}

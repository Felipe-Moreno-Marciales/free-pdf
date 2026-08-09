import { crearBlobPdf } from '../../pdf/guardarDocumentoPdf'
import { crearErrorQpdf, ErrorQpdf } from './erroresQpdf'
import { contarPaginas } from './protegerPdf'
import type { ProcesadorQpdf } from './crearProcesadorQpdf'
import type { ResultadoSeguridad } from './tipos'

/** Nombre predeterminado del documento desbloqueado. */
export const NOMBRE_DESBLOQUEADO = 'free-pdf-desbloqueado.pdf'

/** Datos necesarios para desbloquear un documento. */
export interface PeticionDesbloqueo {
  /** Archivo cifrado. */
  readonly archivo: File
  /** Contraseña de apertura. */
  readonly contrasena: string
}

/**
 * Descifra un documento protegido con contraseña usando qpdf.
 *
 * Descifrar de verdad exige la contraseña correcta: no existe ninguna forma de
 * saltarse la protección, y esta herramienta no lo intenta. Tampoco se usa
 * `ignoreEncryption` de pdf-lib, que no descifra nada y produciría un documento
 * inservible.
 *
 * Antes de entregar el resultado se comprueba, en el trabajador, que ya no
 * aparece como cifrado. Aquí se añaden dos comprobaciones más: que pdf-lib puede
 * abrirlo y que conserva alguna página.
 *
 * La contraseña no se guarda en ningún sitio. La interfaz la borra de su estado en
 * cuanto termina la operación.
 */
export async function desbloquearPdf(
  procesador: ProcesadorQpdf,
  peticion: PeticionDesbloqueo,
): Promise<ResultadoSeguridad> {
  if (peticion.contrasena === '') {
    throw new ErrorQpdf(
      'error-interno',
      'Escribe la contraseña del documento para poder desbloquearlo.',
    )
  }

  const contenido = new Uint8Array(await peticion.archivo.arrayBuffer())

  const procesado = await procesador.desbloquear(contenido, peticion.contrasena)

  if (procesado.informe.cifrado) {
    throw crearErrorQpdf('verificacion-fallida')
  }

  // --- Comprobación con pdf-lib: el resultado debe ser un PDF utilizable. ---
  const numeroPaginas = await contarPaginas(procesado.contenido)

  if (numeroPaginas === null || numeroPaginas === 0) {
    throw crearErrorQpdf('verificacion-fallida')
  }

  const blob = crearBlobPdf(procesado.contenido)

  return {
    blob,
    nombreArchivo: NOMBRE_DESBLOQUEADO,
    tamano: blob.size,
    numeroPaginas,
    informe: procesado.informe,
  }
}

/**
 * Comprueba si un documento está cifrado, sin modificarlo.
 *
 * La herramienta lo usa al cargar el archivo para poder avisar cuanto antes de que
 * no hace falta desbloquear nada, en lugar de esperar a que la persona escriba una
 * contraseña que no se va a usar.
 */
export async function comprobarSiEstaCifrado(
  procesador: ProcesadorQpdf,
  archivo: File,
): Promise<boolean> {
  const contenido = new Uint8Array(await archivo.arrayBuffer())
  const informe = await procesador.inspeccionar(contenido)

  return informe.cifrado
}

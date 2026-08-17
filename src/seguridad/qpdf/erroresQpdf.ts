import type { CodigoErrorQpdf } from './tipos'

/**
 * Errores de las operaciones del motor PDF local qpdf.
 *
 * Los mensajes están redactados en español y se pueden mostrar tal cual. **Nunca
 * incluyen la contraseña**, ni la escrita por la persona ni la generada: solo
 * describen qué ocurrió.
 */
export class ErrorQpdf extends Error {
  /** Motivo concreto, para que la interfaz pueda reaccionar. */
  readonly codigo: CodigoErrorQpdf

  constructor(codigo: CodigoErrorQpdf, mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones)
    this.name = 'ErrorQpdf'
    this.codigo = codigo
  }
}

/** Mensaje que corresponde a cada motivo. */
const MENSAJES: Readonly<Record<CodigoErrorQpdf, string>> = {
  'contrasena-incorrecta':
    'La contraseña no es correcta. Comprueba que la has escrito exactamente igual, incluidas las mayúsculas.',
  'documento-danado':
    'El documento está dañado o no es un PDF válido, así que no se puede procesar.',
  'no-esta-cifrado':
    'Este documento no está protegido con contraseña, así que no hay nada que desbloquear.',
  'ya-esta-cifrado':
    'Este documento ya está protegido con contraseña. Desbloquéalo antes de volver a protegerlo.',
  'verificacion-fallida':
    'La comprobación posterior del documento falló, así que no se entrega el archivo. Vuelve a intentarlo.',
  'reparacion-inutil':
    'No se pudo recuperar ninguna página del documento, así que no se entrega nada: un archivo vacío no sería una reparación.',
  'motor-no-disponible':
    'No se pudo cargar el motor PDF local. Comprueba tu conexión y recarga la página.',
  'error-interno':
    'No se pudo completar la operación por un error inesperado. Vuelve a intentarlo.',
}

/** Crea un error con el mensaje estándar de su motivo. */
export function crearErrorQpdf(
  codigo: CodigoErrorQpdf,
  opciones?: ErrorOptions,
): ErrorQpdf {
  return new ErrorQpdf(codigo, MENSAJES[codigo], opciones)
}

/** Devuelve el mensaje estándar de un motivo. */
export function describirCodigo(codigo: CodigoErrorQpdf): string {
  return MENSAJES[codigo]
}

/**
 * Deduce el motivo a partir de los mensajes que escribió qpdf.
 *
 * qpdf distingue con claridad la contraseña incorrecta —«invalid password»— de un
 * documento que no puede ni leer —«can't find startxref»—, lo que permite dar un
 * mensaje útil en lugar de un fallo genérico.
 *
 * Es una función pura sobre los mensajes ya recogidos, así que se puede probar sin
 * ejecutar el motor.
 */
export function deducirCodigo(mensajes: readonly string[]): CodigoErrorQpdf {
  const texto = mensajes.join('\n').toLowerCase()

  if (texto.includes('invalid password')) {
    return 'contrasena-incorrecta'
  }

  if (
    texto.includes("can't find startxref") ||
    texto.includes('unable to find') ||
    texto.includes('not a pdf file') ||
    texto.includes("can't find pdf header") ||
    texto.includes('damaged') ||
    texto.includes('unexpected eof')
  ) {
    return 'documento-danado'
  }

  return 'error-interno'
}

/**
 * Comprueba que un texto no contenga ninguna de las cadenas indicadas.
 *
 * Lo usan el trabajador y las pruebas para garantizar que ninguna contraseña se
 * cuela en un mensaje antes de enviarlo al hilo principal.
 */
export function contieneAlguna(
  texto: string,
  cadenas: readonly string[],
): boolean {
  return cadenas.some((cadena) => cadena !== '' && texto.includes(cadena))
}

/**
 * Elimina de un texto cualquier aparición de las cadenas indicadas.
 *
 * Es la última red de seguridad antes de publicar un mensaje: aunque qpdf no
 * imprime las contraseñas, se depuran de todos modos por si una versión futura
 * cambiara de comportamiento.
 */
export function depurarMensaje(
  texto: string,
  secretos: readonly string[],
): string {
  let limpio = texto

  for (const secreto of secretos) {
    if (secreto === '') {
      continue
    }

    limpio = limpio.split(secreto).join('«contraseña oculta»')
  }

  return limpio
}

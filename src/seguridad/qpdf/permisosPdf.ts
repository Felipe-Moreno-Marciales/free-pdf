import type {
  InformeCifrado,
  NivelImpresion,
  PermisosPdf,
} from './tipos'

/**
 * Traducción entre los permisos de la interfaz y los argumentos de qpdf.
 *
 * Este módulo es puro: no carga WebAssembly ni depende del navegador, así que se
 * puede comprobar por separado que cada permiso produce exactamente el argumento
 * esperado y que el informe de qpdf se interpreta bien.
 *
 * Los nombres y los valores de los argumentos se han verificado contra la versión
 * de qpdf realmente integrada, la 12.2.0. No se usa el atajo `--modify`, que fija
 * varios permisos a la vez y podría contradecir los que se indican aparte: se
 * escriben todos los permisos de forma granular.
 */

/** Permisos que conceden todo, el punto de partida más permisivo. */
export const PERMISOS_TODOS: PermisosPdf = {
  impresion: 'completa',
  extraccion: true,
  accesibilidad: true,
  anotaciones: true,
  formularios: true,
  ensamblado: true,
  otrasModificaciones: true,
}

/**
 * Permisos predeterminados de la herramienta.
 *
 * Se permite imprimir y se permite el acceso para tecnología asistiva, porque
 * bloquearlo perjudica a quien usa un lector de pantalla sin aportar seguridad
 * real. El resto de modificaciones queda restringido.
 */
export const PERMISOS_PREDETERMINADOS: PermisosPdf = {
  impresion: 'completa',
  extraccion: false,
  accesibilidad: true,
  anotaciones: false,
  formularios: true,
  ensamblado: false,
  otrasModificaciones: false,
}

/** Valor del argumento `--print` para cada nivel de impresión. */
const VALOR_IMPRESION: Readonly<Record<NivelImpresion, string>> = {
  ninguna: 'none',
  baja: 'low',
  completa: 'full',
}

/** Nombre visible de cada nivel de impresión. */
const NOMBRE_IMPRESION: Readonly<Record<NivelImpresion, string>> = {
  ninguna: 'No permitir imprimir',
  baja: 'Solo baja resolución',
  completa: 'Permitir imprimir',
}

/** Devuelve el nombre visible de un nivel de impresión. */
export function describirImpresion(nivel: NivelImpresion): string {
  return NOMBRE_IMPRESION[nivel]
}

/** Traduce un permiso booleano al valor `y` o `n` que espera qpdf. */
function comoBandera(permitido: boolean): string {
  return permitido ? 'y' : 'n'
}

/**
 * Construye los argumentos de permisos para `--encrypt`.
 *
 * El orden es estable para que las pruebas puedan compararlo, y todos los
 * permisos se declaran explícitamente: así el documento resultante nunca depende
 * de valores implícitos de qpdf.
 */
export function construirArgumentosPermisos(
  permisos: PermisosPdf,
): readonly string[] {
  return [
    `--print=${VALOR_IMPRESION[permisos.impresion]}`,
    `--extract=${comoBandera(permisos.extraccion)}`,
    `--accessibility=${comoBandera(permisos.accesibilidad)}`,
    `--annotate=${comoBandera(permisos.anotaciones)}`,
    `--form=${comoBandera(permisos.formularios)}`,
    `--assemble=${comoBandera(permisos.ensamblado)}`,
    `--modify-other=${comoBandera(permisos.otrasModificaciones)}`,
  ]
}

/** Número de bits de la clave. Solo se ofrece AES de 256 bits. */
export const BITS_CLAVE = 256

/**
 * Construye la orden completa de cifrado.
 *
 * La contraseña de apertura y la de propietario viajan dentro de los argumentos
 * porque qpdf no admite leerlas de un archivo al cifrar: `--password-file` solo
 * existe para *abrir* un documento ya cifrado. Los argumentos nunca se registran
 * ni se muestran, y viven solo dentro del trabajador.
 */
export function construirArgumentosCifrado(
  rutaEntrada: string,
  rutaSalida: string,
  contrasenaUsuario: string,
  contrasenaPropietario: string,
  permisos: PermisosPdf,
): readonly string[] {
  return [
    '--encrypt',
    `--user-password=${contrasenaUsuario}`,
    `--owner-password=${contrasenaPropietario}`,
    `--bits=${BITS_CLAVE}`,
    ...construirArgumentosPermisos(permisos),
    '--',
    rutaEntrada,
    rutaSalida,
  ]
}

/**
 * Construye la orden de descifrado.
 *
 * Aquí la contraseña sí se queda fuera de los argumentos: se escribe en un
 * archivo del sistema virtual y se le pasa la ruta con `--password-file`, de modo
 * que ni siquiera un mensaje de uso de qpdf podría llegar a mostrarla.
 */
export function construirArgumentosDescifrado(
  rutaEntrada: string,
  rutaSalida: string,
  rutaContrasena: string,
): readonly string[] {
  return [
    `--password-file=${rutaContrasena}`,
    '--decrypt',
    rutaEntrada,
    rutaSalida,
  ]
}

/** Construye la orden que pide el informe de cifrado. */
export function construirArgumentosInforme(
  rutaEntrada: string,
  rutaContrasena: string | null,
): readonly string[] {
  const argumentos = ['--show-encryption', rutaEntrada]

  return rutaContrasena === null
    ? argumentos
    : [`--password-file=${rutaContrasena}`, ...argumentos]
}

/**
 * Etiquetas con las que qpdf describe cada permiso en `--show-encryption`.
 *
 * Se comparan tal cual porque son cadenas estables de la propia herramienta.
 */
const ETIQUETAS_PERMISO: readonly string[] = [
  'extract for accessibility',
  'extract for any purpose',
  'print low resolution',
  'print high resolution',
  'modify document assembly',
  'modify forms',
  'modify annotations',
  'modify other',
  'modify anything',
]

/** Informe vacío, para los documentos que no están cifrados. */
const INFORME_SIN_CIFRADO: InformeCifrado = {
  cifrado: false,
  revision: null,
  metodo: null,
  permisos: {},
}

/**
 * Interpreta la salida de `--show-encryption`.
 *
 * qpdf escribe «File is not encrypted» cuando no hay cifrado, y en caso
 * contrario una lista de líneas con la revisión, los permisos y los métodos.
 */
export function interpretarInformeCifrado(
  lineas: readonly string[],
): InformeCifrado {
  const texto = lineas.join('\n')

  if (/not encrypted/i.test(texto)) {
    return INFORME_SIN_CIFRADO
  }

  const revision = leerNumero(texto, /(?:^|\n)\s*R\s*=\s*(-?\d+)/)
  const metodo = leerTexto(texto, /stream encryption method:\s*(\S+)/)

  if (revision === null && metodo === null) {
    return INFORME_SIN_CIFRADO
  }

  const permisos: Record<string, boolean> = {}

  for (const etiqueta of ETIQUETAS_PERMISO) {
    const expresion = new RegExp(
      `${etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(allowed|not allowed)`,
      'i',
    )
    const encontrado = expresion.exec(texto)

    if (encontrado !== null) {
      permisos[etiqueta] = encontrado[1].toLowerCase() === 'allowed'
    }
  }

  return { cifrado: true, revision, metodo, permisos }
}

/** Lee un número con una expresión regular, o `null`. */
function leerNumero(texto: string, expresion: RegExp): number | null {
  const encontrado = expresion.exec(texto)

  if (encontrado === null) {
    return null
  }

  const valor = Number.parseInt(encontrado[1], 10)

  return Number.isFinite(valor) ? valor : null
}

/** Lee un texto con una expresión regular, o `null`. */
function leerTexto(texto: string, expresion: RegExp): string | null {
  return expresion.exec(texto)?.[1] ?? null
}

/** `true` cuando el informe corresponde a un cifrado AES de 256 bits. */
export function esAes256(informe: InformeCifrado): boolean {
  return (
    informe.cifrado &&
    informe.revision === 6 &&
    informe.metodo?.toLowerCase() === 'aesv3'
  )
}

/**
 * Longitud de la contraseña de propietario que se genera cuando no se indica
 * ninguna. Con 32 bytes aleatorios el margen es más que suficiente.
 */
const BYTES_CONTRASENA_GENERADA = 32

/**
 * Genera una contraseña de propietario aleatoria.
 *
 * qpdf se niega a cifrar con 256 bits si la contraseña de propietario está vacía,
 * porque el documento podría abrirse sin contraseña. La alternativa sería
 * `--allow-insecure`, que debilita la protección, así que en su lugar se genera
 * una contraseña aleatoria con la API criptográfica del navegador.
 *
 * Esa contraseña no se muestra ni se guarda: su única finalidad es que el
 * diccionario de permisos quede protegido. Quien conozca la contraseña de
 * apertura podrá abrir y leer el documento, que es lo que se pretende.
 */
export function generarContrasenaPropietario(): string {
  const bytes = new Uint8Array(BYTES_CONTRASENA_GENERADA)
  crypto.getRandomValues(bytes)

  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Fuerza aproximada de una contraseña, solo por su longitud. */
export type FuerzaContrasena = 'vacia' | 'corta' | 'aceptable' | 'larga'

/** Longitud a partir de la cual se considera aceptable. */
export const LONGITUD_ACEPTABLE = 8

/** Longitud a partir de la cual se considera larga. */
export const LONGITUD_LARGA = 16

/**
 * Evalúa la longitud de una contraseña.
 *
 * No se imponen reglas de composición —mayúsculas, dígitos o símbolos
 * obligatorios—, porque empujan a contraseñas cortas y difíciles de recordar. Lo
 * que de verdad importa es la longitud, y eso es lo que se mide.
 */
export function evaluarContrasena(contrasena: string): FuerzaContrasena {
  if (contrasena.length === 0) {
    return 'vacia'
  }

  if (contrasena.length < LONGITUD_ACEPTABLE) {
    return 'corta'
  }

  return contrasena.length < LONGITUD_LARGA ? 'aceptable' : 'larga'
}

/** Describe la fuerza de una contraseña en español. */
export function describirFuerza(fuerza: FuerzaContrasena): string {
  switch (fuerza) {
    case 'vacia':
      return 'Escribe una contraseña.'
    case 'corta':
      return `Muy corta: usa al menos ${LONGITUD_ACEPTABLE} caracteres.`
    case 'aceptable':
      return `Aceptable. Con ${LONGITUD_LARGA} caracteres o más sería bastante más difícil de adivinar.`
    case 'larga':
      return 'Buena longitud.'
  }
}

/**
 * Nombres técnicos de los campos de formulario.
 *
 * Los nombres importan más de lo que parece: son la clave con la que un lector
 * PDF, un programa de gestión o un script identifica cada campo. Dos campos con
 * el mismo nombre se tratan como el mismo campo, así que una colisión no es un
 * detalle estético, sino un error que corrompe el formulario.
 *
 * Este módulo es puro, así que se puede comprobar por separado.
 */

/** Longitud máxima admitida de un nombre. */
export const LONGITUD_MAXIMA_NOMBRE = 100

/**
 * Caracteres que no se admiten en un nombre.
 *
 * El punto se excluye a propósito: en el formato PDF separa los niveles de un
 * nombre jerárquico, así que permitirlo dentro de un nombre nuevo crearía
 * estructuras involuntarias.
 */
const CARACTERES_PROHIBIDOS = /[.[\]()<>{}/%#\\\s]/

/** Resultado de validar un nombre. */
export interface ValidacionNombre {
  /** `true` cuando el nombre se puede usar. */
  readonly valido: boolean
  /** Mensaje en español listo para mostrar, o `null`. */
  readonly mensaje: string | null
}

/** Resultado reutilizable para los nombres válidos. */
const VALIDO: ValidacionNombre = { valido: true, mensaje: null }

/**
 * Comprueba que un nombre se pueda usar y que no choque con otro.
 *
 * `nombresOcupados` debe incluir tanto los campos que ya existen en el documento
 * como los que se van a crear en esta misma sesión: una colisión entre dos campos
 * nuevos es igual de dañina que una con uno existente.
 */
export function validarNombreCampo(
  nombre: string,
  nombresOcupados: ReadonlySet<string>,
): ValidacionNombre {
  const limpio = nombre.trim()

  if (limpio === '') {
    return { valido: false, mensaje: 'Escribe un nombre para el campo.' }
  }

  if (limpio.length > LONGITUD_MAXIMA_NOMBRE) {
    return {
      valido: false,
      mensaje: `El nombre no puede superar los ${LONGITUD_MAXIMA_NOMBRE} caracteres.`,
    }
  }

  const prohibido = CARACTERES_PROHIBIDOS.exec(limpio)
  if (prohibido !== null) {
    const caracter = prohibido[0] === ' ' ? 'un espacio' : `«${prohibido[0]}»`

    return {
      valido: false,
      mensaje: `El nombre no puede contener ${caracter}. Usa letras, dígitos, guiones y guiones bajos.`,
    }
  }

  if (nombresOcupados.has(limpio)) {
    return {
      valido: false,
      mensaje: `Ya existe un campo llamado «${limpio}». Elige otro nombre: dos campos con el mismo nombre se tratarían como uno solo.`,
    }
  }

  return VALIDO
}

/**
 * Propone un nombre libre a partir de una base.
 *
 * Se añade un sufijo numérico hasta encontrar uno que no esté ocupado, de modo que
 * la interfaz pueda ofrecer un nombre válido sin obligar a inventarlo.
 */
export function proponerNombreCampo(
  base: string,
  nombresOcupados: ReadonlySet<string>,
): string {
  const raiz = normalizarNombreCampo(base)

  if (!nombresOcupados.has(raiz)) {
    return raiz
  }

  let numero = 2
  while (nombresOcupados.has(`${raiz}-${numero}`)) {
    numero += 1
  }

  return `${raiz}-${numero}`
}

/**
 * Convierte un texto cualquiera en un nombre de campo admisible.
 * Si no queda nada aprovechable se devuelve `campo`.
 */
export function normalizarNombreCampo(texto: string): string {
  const limpio = texto
    .trim()
    .normalize('NFD')
    // Se quitan los diacríticos: «Año» pasa a «Ano», que es un nombre seguro.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LONGITUD_MAXIMA_NOMBRE)

  return limpio === '' ? 'campo' : limpio
}

/** Reúne en un conjunto los nombres de los campos existentes y de los nuevos. */
export function reunirNombresOcupados(
  existentes: readonly string[],
  nuevos: readonly string[],
): ReadonlySet<string> {
  return new Set([...existentes, ...nuevos])
}

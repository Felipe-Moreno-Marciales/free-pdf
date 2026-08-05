import { describirCaracterNoRepresentable } from '../../pdf/textoEstandar'

/**
 * Plantillas del texto que se escribe en cada página.
 *
 * Solo se admiten dos marcadores, `{pagina}` y `{total}`, para que la plantilla
 * sea fácil de entender y de validar. Cualquier otro marcador se rechaza con un
 * mensaje que dice exactamente qué está mal.
 *
 * Este módulo es puro.
 */

/** Plantillas con nombre que se ofrecen, más la opción de escribir una propia. */
export type ClavePlantilla =
  | 'numero'
  | 'pagina-numero'
  | 'numero-de-total'
  | 'pagina-numero-de-total'
  | 'personalizada'

/** Marcador del número de la página. */
export const MARCADOR_PAGINA = '{pagina}'

/** Marcador del número más alto de la numeración. */
export const MARCADOR_TOTAL = '{total}'

/** Texto de cada plantilla con nombre. */
export const PLANTILLAS: Readonly<
  Record<Exclude<ClavePlantilla, 'personalizada'>, string>
> = {
  numero: MARCADOR_PAGINA,
  'pagina-numero': `Página ${MARCADOR_PAGINA}`,
  'numero-de-total': `${MARCADOR_PAGINA} de ${MARCADOR_TOTAL}`,
  'pagina-numero-de-total': `Página ${MARCADOR_PAGINA} de ${MARCADOR_TOTAL}`,
}

/** Longitud máxima de una plantilla, para no generar textos desmedidos. */
export const LONGITUD_MAXIMA_PLANTILLA = 120

/** Reconoce cualquier marcador escrito entre llaves. */
const CUALQUIER_MARCADOR = /\{([^{}]*)\}/g

/** Nombres de marcador admitidos. */
const NOMBRES_ADMITIDOS = new Set(['pagina', 'total'])

/** Resultado de validar una plantilla. */
export interface ResultadoValidacionPlantilla {
  /** `true` cuando la plantilla se puede usar. */
  readonly valida: boolean
  /** Mensaje en español listo para mostrar, o `null` si la plantilla es válida. */
  readonly mensaje: string | null
}

/** Resultado reutilizable para las plantillas válidas. */
const VALIDA: ResultadoValidacionPlantilla = { valida: true, mensaje: null }

/**
 * Comprueba que una plantilla se pueda usar.
 *
 * Se exige que no esté vacía, que quepa en el límite de longitud, que incluya el
 * marcador de la página —sin él no habría numeración, sino un texto repetido—,
 * que no use ningún otro marcador y que todos sus caracteres se puedan escribir
 * con la tipografía estándar.
 */
export function validarPlantilla(
  plantilla: string,
): ResultadoValidacionPlantilla {
  if (plantilla.trim() === '') {
    return {
      valida: false,
      mensaje: `Escribe el texto de la numeración. Puedes usar ${MARCADOR_PAGINA} y ${MARCADOR_TOTAL}.`,
    }
  }

  if (plantilla.length > LONGITUD_MAXIMA_PLANTILLA) {
    return {
      valida: false,
      mensaje: `El texto no puede superar los ${LONGITUD_MAXIMA_PLANTILLA} caracteres.`,
    }
  }

  const desconocido = encontrarMarcadorDesconocido(plantilla)
  if (desconocido !== null) {
    return {
      valida: false,
      mensaje: `«{${desconocido}}» no es un marcador válido. Solo se admiten ${MARCADOR_PAGINA} y ${MARCADOR_TOTAL}.`,
    }
  }

  if (tieneLlavesSueltas(plantilla)) {
    return {
      valida: false,
      mensaje: `Hay una llave sin cerrar. Escribe los marcadores completos, por ejemplo ${MARCADOR_PAGINA}.`,
    }
  }

  if (!plantilla.includes(MARCADOR_PAGINA)) {
    return {
      valida: false,
      mensaje: `El texto debe incluir ${MARCADOR_PAGINA}; si no, todas las páginas mostrarían lo mismo.`,
    }
  }

  const avisoCaracter = describirCaracterNoRepresentable(plantilla)
  if (avisoCaracter !== null) {
    return { valida: false, mensaje: avisoCaracter }
  }

  return VALIDA
}

/** Devuelve el nombre del primer marcador no admitido, o `null`. */
function encontrarMarcadorDesconocido(plantilla: string): string | null {
  for (const coincidencia of plantilla.matchAll(CUALQUIER_MARCADOR)) {
    const nombre = coincidencia[1]

    if (!NOMBRES_ADMITIDOS.has(nombre)) {
      return nombre
    }
  }

  return null
}

/**
 * Comprueba si quedan llaves sin pareja después de quitar los marcadores
 * válidos, lo que indica que hay un marcador a medio escribir.
 */
function tieneLlavesSueltas(plantilla: string): boolean {
  const sinMarcadores = plantilla.replaceAll(CUALQUIER_MARCADOR, '')

  return sinMarcadores.includes('{') || sinMarcadores.includes('}')
}

/**
 * Sustituye los marcadores por sus valores.
 *
 * No valida nada: se da por hecho que la plantilla ya pasó por
 * `validarPlantilla`. Un marcador desconocido se dejaría tal cual.
 */
export function aplicarPlantilla(
  plantilla: string,
  numeroPagina: number,
  total: number,
): string {
  return plantilla
    .replaceAll(MARCADOR_PAGINA, String(numeroPagina))
    .replaceAll(MARCADOR_TOTAL, String(total))
}

/** Nombre visible de cada plantilla con nombre. */
const NOMBRE_PLANTILLA: Readonly<Record<ClavePlantilla, string>> = {
  numero: 'Solo el número',
  'pagina-numero': 'Página y número',
  'numero-de-total': 'Número de total',
  'pagina-numero-de-total': 'Página, número y total',
  personalizada: 'Texto propio',
}

/** Devuelve el nombre visible de una plantilla. */
export function describirPlantilla(clave: ClavePlantilla): string {
  return NOMBRE_PLANTILLA[clave]
}

/**
 * Devuelve el texto que corresponde a una clave de plantilla.
 * Para `personalizada` se devuelve el texto que la persona haya escrito.
 */
export function resolverPlantilla(
  clave: ClavePlantilla,
  plantillaPropia: string,
): string {
  return clave === 'personalizada' ? plantillaPropia : PLANTILLAS[clave]
}

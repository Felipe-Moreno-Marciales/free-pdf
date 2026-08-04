import type { ClaveTipografia } from './tipos'

/**
 * Tipografías que se pueden usar sin incrustar ningún archivo.
 *
 * Son las catorce estándar del formato PDF, que todos los lectores incluyen. Se usan
 * porque no hay que descargar nada: cualquier otra tipografía habría que traerla de
 * algún sitio, y traerla de un CDN está descartado en este proyecto.
 *
 * El precio es que solo cubren el alfabeto latino con la codificación WinAnsi. Un
 * texto en griego, cirílico o con caracteres CJK no se puede representar, y eso se
 * avisa en la interfaz en lugar de dibujar cuadraditos.
 */

/** Nombre de cada tipografía en `StandardFonts` de pdf-lib. */
export const TIPOGRAFIAS_ESTANDAR = {
  helvetica: 'Helvetica',
  'helvetica-negrita': 'HelveticaBold',
  'helvetica-cursiva': 'HelveticaOblique',
  times: 'TimesRoman',
  'times-negrita': 'TimesRomanBold',
  'times-cursiva': 'TimesRomanItalic',
  courier: 'Courier',
  'courier-negrita': 'CourierBold',
} as const satisfies Record<ClaveTipografia, string>

/** Nombre legible de cada tipografía, para mostrarlo en la interfaz. */
export const NOMBRE_TIPOGRAFIA = {
  helvetica: 'Helvetica',
  'helvetica-negrita': 'Helvetica negrita',
  'helvetica-cursiva': 'Helvetica cursiva',
  times: 'Times',
  'times-negrita': 'Times negrita',
  'times-cursiva': 'Times cursiva',
  courier: 'Courier (monoespaciada)',
  'courier-negrita': 'Courier negrita',
} as const satisfies Record<ClaveTipografia, string>

/** Todas las tipografías disponibles, en el orden en que se ofrecen. */
export const TIPOGRAFIAS_DISPONIBLES: readonly ClaveTipografia[] = [
  'helvetica',
  'helvetica-negrita',
  'helvetica-cursiva',
  'times',
  'times-negrita',
  'times-cursiva',
  'courier',
  'courier-negrita',
]

/** Describe una tipografía por su clave. */
export function describirTipografia(clave: ClaveTipografia): string {
  return NOMBRE_TIPOGRAFIA[clave]
}

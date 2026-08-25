import type { ClaveTipografia } from './tipos'

/** Caja seleccionada, expresada como fracciones de la página visible. */
export interface CajaTextoSeleccionado {
  readonly izquierda: number
  readonly superior: number
  readonly ancho: number
  readonly alto: number
}

/** Texto existente elegido en la página junto con su posición visual. */
export interface SeleccionTextoPdf {
  readonly texto: string
  readonly cajas: readonly CajaTextoSeleccionado[]
  /** Tamaño aproximado del texto original, expresado en puntos PDF. */
  readonly tamano: number
  /** Tipografía estándar más cercana a la fuente incrustada del fragmento. */
  readonly tipografia: ClaveTipografia
  /**
   * Fracción de la altura de la página, medida desde arriba, donde se apoyaba la
   * línea base del texto original.
   *
   * Sin este dato habría que adivinar la línea base a partir de la altura de la caja,
   * y la caja de un fragmento del DOM incluye ascendentes y descendentes que no todas
   * las palabras usan: «recomendaciones» y «xxx» tienen cajas distintas con la misma
   * línea base, así que adivinarla desplaza el texto corregido respecto al original.
   */
  readonly lineaBase: number
  /** Color estimado de los trazos de las letras. */
  readonly colorTexto: string
  /** Color estimado del fondo que hay detrás de la palabra. */
  readonly colorFondo: string
}

/**
 * Margen, en puntos PDF, con el que se agranda el fondo que tapa la palabra original.
 *
 * No se suma a la caja del elemento: la caja tiene que coincidir exactamente con el
 * texto original para que la corrección caiga en su sitio. El margen se aplica solo
 * al rectángulo de fondo, al dibujarlo, y sirve para que no asome el antialias de los
 * glifos que hay debajo.
 */
export const MARGEN_COBERTURA_PUNTOS = 0.9

/** Proporción de la caja en la que suele quedar la línea base cuando no se conoce. */
export const LINEA_BASE_APROXIMADA = 0.8

/** Elige la tipografía PDF estándar más cercana a una fuente incrustada. */
export function elegirTipografia(datos: {
  readonly familia: string
  readonly nombre: string
  readonly negrita: boolean
  readonly cursiva: boolean
}): ClaveTipografia {
  const nombre = `${datos.familia} ${datos.nombre}`.toLocaleLowerCase()
  const negrita = datos.negrita || /bold|black|heavy|semibold|demi/u.test(nombre)
  const cursiva = datos.cursiva || /italic|oblique/u.test(nombre)

  if (/mono|courier|consolas/u.test(nombre)) {
    return negrita ? 'courier-negrita' : 'courier'
  }

  if (
    !/sans[- ]?serif/u.test(nombre) &&
    /serif|times|georgia|garamond|cambria/u.test(nombre)
  ) {
    if (negrita) {
      return 'times-negrita'
    }
    return cursiva ? 'times-cursiva' : 'times'
  }

  if (negrita) {
    return 'helvetica-negrita'
  }
  return cursiva ? 'helvetica-cursiva' : 'helvetica'
}

/**
 * Convierte los rectángulos DOM de una selección en cajas normalizadas.
 *
 * Las cajas salen ajustadas al texto, sin margen: son las que fijan dónde se dibuja
 * la corrección, y agrandarlas la desplazaría respecto de la palabra original.
 */
export function convertirRectangulosSeleccion(
  rectangulos: Iterable<DOMRect>,
  limite: DOMRect,
): readonly CajaTextoSeleccionado[] {
  if (limite.width <= 0 || limite.height <= 0) {
    return []
  }

  const cajas: CajaTextoSeleccionado[] = []

  for (const rectangulo of rectangulos) {
    const izquierda = Math.max(limite.left, rectangulo.left)
    const superior = Math.max(limite.top, rectangulo.top)
    const derecha = Math.min(limite.right, rectangulo.right)
    const inferior = Math.min(limite.bottom, rectangulo.bottom)

    if (derecha <= izquierda || inferior <= superior) {
      continue
    }

    cajas.push({
      izquierda: (izquierda - limite.left) / limite.width,
      superior: (superior - limite.top) / limite.height,
      ancho: (derecha - izquierda) / limite.width,
      alto: (inferior - superior) / limite.height,
    })
  }

  return cajas
}

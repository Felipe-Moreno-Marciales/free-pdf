import type { AjustesImagen, FiltroImagen } from './tipos'

/**
 * Filtros de imagen aplicados píxel a píxel.
 *
 * Todas las funciones trabajan sobre los bytes RGBA que devuelve un `canvas`,
 * así que no dependen del navegador y se pueden probar por separado. El
 * procesamiento es local: no interviene ningún servicio de tratamiento de
 * imágenes.
 */

/** Ajustes que dejan la imagen tal y como estaba. */
export const AJUSTES_NEUTROS: AjustesImagen = {
  filtro: 'original',
  brillo: 0,
  contraste: 0,
}

/** Valor mínimo admitido de brillo y de contraste. */
export const AJUSTE_MINIMO = -100

/** Valor máximo admitido de brillo y de contraste. */
export const AJUSTE_MAXIMO = 100

/**
 * Umbral con el que se decide si un píxel pasa a blanco o a negro.
 *
 * Es el punto medio de la escala de luminancia. Se aplica después del brillo y
 * del contraste, de modo que esos dos controles permiten corregir una
 * fotografía antes de convertirla en blanco y negro.
 */
export const UMBRAL_BLANCO_Y_NEGRO = 128

/** Pesos de la luminancia según la recomendación UIT-R BT.709. */
const PESO_ROJO = 0.2126
const PESO_VERDE = 0.7152
const PESO_AZUL = 0.0722

/** Número de bytes que ocupa cada píxel en un búfer RGBA. */
const BYTES_POR_PIXEL = 4

/** Valor máximo de un componente de color. */
const MAXIMO_COMPONENTE = 255

/** Nombre visible de cada filtro. */
const NOMBRE_FILTRO: Readonly<Record<FiltroImagen, string>> = {
  original: 'Original',
  grises: 'Escala de grises',
  'blanco-y-negro': 'Blanco y negro',
}

/** Devuelve el nombre visible de un filtro. */
export function describirFiltro(filtro: FiltroImagen): string {
  return NOMBRE_FILTRO[filtro]
}

/** Calcula la luminancia de un color, entre 0 y 255. */
export function calcularLuminancia(
  rojo: number,
  verde: number,
  azul: number,
): number {
  return rojo * PESO_ROJO + verde * PESO_VERDE + azul * PESO_AZUL
}

/** Limita un valor al rango admitido de un componente de color. */
function limitarComponente(valor: number): number {
  if (valor < 0) {
    return 0
  }

  if (valor > MAXIMO_COMPONENTE) {
    return MAXIMO_COMPONENTE
  }

  return Math.round(valor)
}

/** Limita un ajuste al rango de −100 a 100. */
export function limitarAjuste(valor: number): number {
  if (!Number.isFinite(valor)) {
    return 0
  }

  return Math.min(AJUSTE_MAXIMO, Math.max(AJUSTE_MINIMO, Math.round(valor)))
}

/** `true` cuando los ajustes no modifican ningún píxel. */
export function sonAjustesNeutros(ajustes: AjustesImagen | null): boolean {
  if (ajustes === null) {
    return true
  }

  return (
    ajustes.filtro === 'original' &&
    limitarAjuste(ajustes.brillo) === 0 &&
    limitarAjuste(ajustes.contraste) === 0
  )
}

/**
 * Calcula el factor de contraste a partir de un ajuste de −100 a 100.
 *
 * Se usa la fórmula habitual del tratamiento de imágenes, con el ajuste
 * reescalado al rango de −255 a 255 que espera. Un ajuste de 0 devuelve
 * exactamente 1, es decir, ningún cambio.
 */
export function calcularFactorContraste(contraste: number): number {
  const nivel = (limitarAjuste(contraste) / AJUSTE_MAXIMO) * MAXIMO_COMPONENTE

  return (259 * (nivel + MAXIMO_COMPONENTE)) / (MAXIMO_COMPONENTE * (259 - nivel))
}

/**
 * Aplica los ajustes sobre un búfer RGBA, modificándolo en el sitio.
 *
 * Se modifica el búfer recibido a propósito: una fotografía de varios
 * megapíxeles ocupa decenas de megabytes, así que duplicarla para devolver una
 * copia gastaría memoria sin ninguna ventaja.
 *
 * El orden es brillo, contraste y por último el filtro de color, que es el que
 * corresponde a un escaneado: primero se corrige la exposición y después se
 * decide el color.
 */
export function aplicarAjustes(
  bytes: Uint8ClampedArray | Uint8Array,
  ajustes: AjustesImagen,
): void {
  if (sonAjustesNeutros(ajustes)) {
    return
  }

  const desplazamientoBrillo =
    (limitarAjuste(ajustes.brillo) / AJUSTE_MAXIMO) * MAXIMO_COMPONENTE
  const factorContraste = calcularFactorContraste(ajustes.contraste)
  const hayBrillo = desplazamientoBrillo !== 0
  const hayContraste = limitarAjuste(ajustes.contraste) !== 0

  for (let posicion = 0; posicion + 3 < bytes.length; posicion += BYTES_POR_PIXEL) {
    let rojo = bytes[posicion]
    let verde = bytes[posicion + 1]
    let azul = bytes[posicion + 2]

    if (hayBrillo) {
      rojo += desplazamientoBrillo
      verde += desplazamientoBrillo
      azul += desplazamientoBrillo
    }

    if (hayContraste) {
      const centro = MAXIMO_COMPONENTE / 2
      rojo = factorContraste * (rojo - centro) + centro
      verde = factorContraste * (verde - centro) + centro
      azul = factorContraste * (azul - centro) + centro
    }

    if (ajustes.filtro === 'original') {
      bytes[posicion] = limitarComponente(rojo)
      bytes[posicion + 1] = limitarComponente(verde)
      bytes[posicion + 2] = limitarComponente(azul)
      continue
    }

    const luminancia = calcularLuminancia(
      limitarComponente(rojo),
      limitarComponente(verde),
      limitarComponente(azul),
    )

    const resultado =
      ajustes.filtro === 'grises'
        ? limitarComponente(luminancia)
        : luminancia >= UMBRAL_BLANCO_Y_NEGRO
          ? MAXIMO_COMPONENTE
          : 0

    bytes[posicion] = resultado
    bytes[posicion + 1] = resultado
    bytes[posicion + 2] = resultado
  }
}

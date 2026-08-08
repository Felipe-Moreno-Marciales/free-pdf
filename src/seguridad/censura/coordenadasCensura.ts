import type {
  MedidasPaginaCensura,
  PerfilCalidad,
  ZonaCensura,
} from './tipos'

/**
 * Coordenadas y calidad de la censura.
 *
 * Todo es puro, así que se puede comprobar por separado que una zona guardada en
 * fracciones se traduce a los píxeles correctos a cualquier resolución. Esa
 * traducción es la parte delicada: un error aquí dejaría al descubierto justo lo
 * que se quería tapar.
 */

/** Densidad de cada perfil, en puntos por pulgada. */
export const PUNTOS_POR_PULGADA_PERFIL: Readonly<
  Record<PerfilCalidad, number>
> = {
  ligera: 150,
  equilibrada: 200,
  alta: 300,
}

/** Nombre visible de cada perfil. */
const NOMBRE_PERFIL: Readonly<Record<PerfilCalidad, string>> = {
  ligera: 'Ligera',
  equilibrada: 'Equilibrada',
  alta: 'Alta',
}

/** Devuelve el nombre visible de un perfil. */
export function describirPerfil(perfil: PerfilCalidad): string {
  return NOMBRE_PERFIL[perfil]
}

/** Describe la densidad de un perfil. */
export function describirDensidad(perfil: PerfilCalidad): string {
  return `${PUNTOS_POR_PULGADA_PERFIL[perfil]} puntos por pulgada`
}

/**
 * Escala de rasterizado que corresponde a un perfil.
 *
 * Una página PDF se mide en puntos, y un punto es 1/72 de pulgada. Para obtener una
 * imagen a la densidad deseada hay que dibujar a esa densidad dividida por 72.
 */
export function calcularEscala(perfil: PerfilCalidad): number {
  return PUNTOS_POR_PULGADA_PERFIL[perfil] / 72
}

/** Rectángulo en píxeles de la imagen rasterizada. */
export interface RectanguloPixeles {
  readonly x: number
  readonly y: number
  readonly ancho: number
  readonly alto: number
}

/** Limita una fracción al intervalo de 0 a 1. */
function limitarFraccion(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) {
    return 0
  }

  return Math.min(1, valor)
}

/**
 * Normaliza una zona para que siempre quede dentro de la página.
 *
 * Se admiten zonas creadas arrastrando en cualquier dirección, así que un ancho o un
 * alto negativos se convierten en un rectángulo equivalente bien orientado.
 */
export function normalizarZona(zona: ZonaCensura): ZonaCensura {
  const izquierda = zona.ancho < 0 ? zona.izquierda + zona.ancho : zona.izquierda
  const superior = zona.alto < 0 ? zona.superior + zona.alto : zona.superior
  const ancho = Math.abs(zona.ancho)
  const alto = Math.abs(zona.alto)

  const x = limitarFraccion(izquierda)
  const y = limitarFraccion(superior)

  return {
    ...zona,
    izquierda: x,
    superior: y,
    ancho: limitarFraccion(Math.min(ancho, 1 - x)),
    alto: limitarFraccion(Math.min(alto, 1 - y)),
  }
}

/** `true` cuando la zona tiene superficie suficiente para tapar algo. */
export function esZonaUtil(zona: ZonaCensura): boolean {
  const normalizada = normalizarZona(zona)

  return normalizada.ancho > 0.001 && normalizada.alto > 0.001
}

/**
 * Traduce una zona a los píxeles de la imagen rasterizada.
 *
 * El origen es la esquina superior izquierda, que es el del `canvas`. Las medidas se
 * redondean **hacia fuera**: es preferible tapar un píxel de más que dejar medio
 * carácter asomando por el borde.
 */
export function calcularRectanguloPixeles(
  zona: ZonaCensura,
  anchoPixeles: number,
  altoPixeles: number,
): RectanguloPixeles {
  const normalizada = normalizarZona(zona)

  const x = Math.floor(normalizada.izquierda * anchoPixeles)
  const y = Math.floor(normalizada.superior * altoPixeles)
  const derecha = Math.ceil(
    (normalizada.izquierda + normalizada.ancho) * anchoPixeles,
  )
  const abajo = Math.ceil((normalizada.superior + normalizada.alto) * altoPixeles)

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    ancho: Math.max(1, Math.min(anchoPixeles, derecha) - Math.max(0, x)),
    alto: Math.max(1, Math.min(altoPixeles, abajo) - Math.max(0, y)),
  }
}

/**
 * Traduce un rectángulo dibujado en pantalla a fracciones.
 *
 * Lo usa el editor visual: recibe las medidas en píxeles CSS del elemento que
 * muestra la página y devuelve la zona en fracciones, que es como se guarda.
 */
export function calcularZonaDesdePantalla(
  x: number,
  y: number,
  ancho: number,
  alto: number,
  anchoPantalla: number,
  altoPantalla: number,
): Pick<ZonaCensura, 'izquierda' | 'superior' | 'ancho' | 'alto'> {
  if (anchoPantalla <= 0 || altoPantalla <= 0) {
    return { izquierda: 0, superior: 0, ancho: 0, alto: 0 }
  }

  return {
    izquierda: x / anchoPantalla,
    superior: y / altoPantalla,
    ancho: ancho / anchoPantalla,
    alto: alto / altoPantalla,
  }
}

/** Zonas de una página concreta, ya normalizadas y filtradas. */
export function zonasDePagina(
  zonas: readonly ZonaCensura[],
  numeroPagina: number,
): readonly ZonaCensura[] {
  return zonas
    .filter((zona) => zona.pagina === numeroPagina)
    .map(normalizarZona)
    .filter(esZonaUtil)
}

/**
 * Estima el número de píxeles que va a ocupar el documento rasterizado.
 *
 * Sirve para avisar antes de empezar: una resolución alta sobre muchas páginas puede
 * agotar la memoria del navegador.
 */
export function estimarPixelesTotales(
  medidas: readonly MedidasPaginaCensura[],
  perfil: PerfilCalidad,
): number {
  const escala = calcularEscala(perfil)

  return medidas.reduce(
    (total, pagina) =>
      total + pagina.ancho * escala * (pagina.alto * escala),
    0,
  )
}

/** Píxeles a partir de los cuales se avisa del consumo de memoria. */
export const PIXELES_AVISO = 80_000_000

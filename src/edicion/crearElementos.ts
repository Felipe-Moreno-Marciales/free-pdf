import type { Punto } from '../pdf/posicionarEnPagina'
import { OPACIDAD_RESALTADO } from './colocarElementos'
import type {
  ElementoForma,
  ElementoImagen,
  ElementoResaltado,
  ElementoTexto,
  ElementoTrazo,
  FiguraGeometrica,
  FormatoImagenIncrustable,
} from './tipos'

/**
 * Elementos nuevos con valores de partida razonables.
 *
 * Cada elemento se coloca en un sitio visible y con un tamaño que se ve, para que al
 * añadirlo aparezca algo en pantalla en lugar de tener que buscarlo. Después se
 * mueve, que es la parte fácil.
 */

/** Color de partida de los textos y las líneas. */
export const COLOR_PREDETERMINADO = '#1f2933'

/** Color de partida del resaltado. */
export const COLOR_RESALTADO = '#ffe066'

/** Texto nuevo, colocado arriba a la izquierda. */
export function crearTexto(
  id: string,
  pagina: number,
  cambios: Partial<ElementoTexto> = {},
): ElementoTexto {
  return {
    id,
    clase: 'texto',
    pagina,
    izquierda: 0.1,
    superior: 0.1,
    ancho: 0.4,
    alto: 0.08,
    giro: 0,
    opacidad: 1,
    texto: '',
    tipografia: 'helvetica',
    tamano: 12,
    color: COLOR_PREDETERMINADO,
    alineacion: 'izquierda',
    ...cambios,
  }
}

/** Forma nueva. */
export function crearForma(
  id: string,
  pagina: number,
  figura: FiguraGeometrica = 'rectangulo',
  cambios: Partial<ElementoForma> = {},
): ElementoForma {
  const esLinea = figura === 'linea' || figura === 'flecha'

  return {
    id,
    clase: 'forma',
    pagina,
    izquierda: 0.15,
    superior: 0.2,
    ancho: 0.3,
    alto: esLinea ? 0.1 : 0.15,
    giro: 0,
    opacidad: 1,
    figura,
    // Las líneas y flechas solo tienen trazo; las figuras cerradas empiezan sin
    // relleno para no tapar lo que hay debajo por accidente.
    relleno: null,
    borde: COLOR_PREDETERMINADO,
    grosorBorde: 2,
    ...cambios,
  }
}

/** Resaltado nuevo, con la franja apaisada de un rotulador. */
export function crearResaltado(
  id: string,
  pagina: number,
  cambios: Partial<ElementoResaltado> = {},
): ElementoResaltado {
  return {
    id,
    clase: 'resaltado',
    pagina,
    izquierda: 0.1,
    superior: 0.15,
    ancho: 0.5,
    alto: 0.025,
    giro: 0,
    opacidad: OPACIDAD_RESALTADO,
    color: COLOR_RESALTADO,
    ...cambios,
  }
}

/** Imagen nueva, con las medidas ajustadas a su proporción real. */
export function crearImagen(
  id: string,
  pagina: number,
  bytes: Uint8Array,
  formato: FormatoImagenIncrustable,
  descripcion: string,
  proporcion: number,
  cambios: Partial<ElementoImagen> = {},
): ElementoImagen {
  // Se parte de un tercio del ancho de la página y se deriva el alto de la
  // proporción, para que la imagen no aparezca deformada de entrada.
  const ancho = 0.3
  // La proporción está en píxeles y la página en fracciones, así que se usa la
  // relación entre ancho y alto de un A4 para no distorsionarla al convertir.
  const relacionPagina = 595 / 842
  const alto = proporcion > 0 ? (ancho / proporcion) * relacionPagina : ancho

  return {
    id,
    clase: 'imagen',
    pagina,
    izquierda: 0.1,
    superior: 0.1,
    ancho,
    alto: Math.min(0.9, Math.max(0.02, alto)),
    giro: 0,
    opacidad: 1,
    bytes,
    formato,
    descripcion,
    ...cambios,
  }
}

/** Trazo nuevo a partir de un dibujo ya hecho. */
export function crearTrazo(
  id: string,
  pagina: number,
  trazos: readonly (readonly Punto[])[],
  cambios: Partial<ElementoTrazo> = {},
): ElementoTrazo {
  return {
    id,
    clase: 'trazo',
    pagina,
    izquierda: 0.1,
    superior: 0.7,
    ancho: 0.3,
    alto: 0.12,
    giro: 0,
    opacidad: 1,
    trazos,
    grosor: 1.5,
    color: COLOR_PREDETERMINADO,
    ...cambios,
  }
}

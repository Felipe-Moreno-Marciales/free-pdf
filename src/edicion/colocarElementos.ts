import {
  calcularColocacionLibre,
  calcularMedidasVisibles,
  type CajaPagina,
  type ColocacionEnPagina,
  type Medidas,
  type Punto,
} from '../pdf/posicionarEnPagina'
import type { GradosRotacion } from '../pdf/tipos'
import { limitar, normalizarGiro } from '../utilidades/numeros'
import type { BaseElemento, ElementoSuperpuesto } from './tipos'

export { limitar, normalizarGiro }

/**
 * Traducción de elementos en fracciones a coordenadas PDF.
 *
 * Todo lo de este módulo es puro: no toca el navegador ni pdf-lib, así que se puede
 * probar entero. Es deliberado, porque la geometría es la parte donde de verdad se
 * cometen errores, y son errores silenciosos: un elemento aparece diez puntos más
 * abajo y nadie se da cuenta hasta que lo ve impreso.
 */

/** Fracción mínima que se le permite a un elemento, para que siga siendo visible. */
export const FRACCION_MINIMA = 0.005

/** Tamaño de texto mínimo y máximo, en puntos. */
export const TAMANO_TEXTO_MINIMO = 4
export const TAMANO_TEXTO_MAXIMO = 200

/** Grosor de línea mínimo y máximo, en puntos. */
export const GROSOR_MINIMO = 0.25
export const GROSOR_MAXIMO = 40

/** Opacidad predeterminada del resaltado, para que deje leer lo que hay debajo. */
export const OPACIDAD_RESALTADO = 0.35

/**
 * Coloca las fracciones de un elemento dentro de la página.
 *
 * Un elemento nunca se recorta a la mitad ni se sale del todo: se limita el tamaño
 * primero y después la posición, de modo que la caja completa quepa. Se prefiere
 * mover un elemento a que desaparezca sin explicación.
 */
export function normalizarElemento<E extends BaseElemento>(elemento: E): E {
  const ancho = limitar(elemento.ancho, FRACCION_MINIMA, 1)
  const alto = limitar(elemento.alto, FRACCION_MINIMA, 1)

  return {
    ...elemento,
    pagina: Math.max(1, Math.trunc(elemento.pagina)),
    ancho,
    alto,
    izquierda: limitar(elemento.izquierda, 0, 1 - ancho),
    superior: limitar(elemento.superior, 0, 1 - alto),
    giro: normalizarGiro(elemento.giro),
    opacidad: limitar(elemento.opacidad, 0, 1),
  }
}

/** Caja de un elemento en coordenadas visibles, en puntos. */
export interface CajaVisible {
  /** Borde izquierdo, desde la izquierda de la página visible. */
  readonly x: number
  /** Borde inferior, desde **abajo**, que es el origen que usa PDF. */
  readonly y: number
  readonly ancho: number
  readonly alto: number
}

/**
 * Convierte las fracciones de un elemento a puntos visibles.
 *
 * Aquí es donde se invierte el eje vertical: el editor razona con `superior`, medido
 * desde arriba, porque es como se mira una página; PDF mide desde abajo.
 */
export function calcularCajaVisible(
  elemento: BaseElemento,
  medidasVisibles: Medidas,
): CajaVisible {
  const normalizado = normalizarElemento(elemento)
  const ancho = normalizado.ancho * medidasVisibles.ancho
  const alto = normalizado.alto * medidasVisibles.alto

  return {
    x: normalizado.izquierda * medidasVisibles.ancho,
    y:
      medidasVisibles.alto - normalizado.superior * medidasVisibles.alto - alto,
    ancho,
    alto,
  }
}

/** Datos de la página que necesita la colocación. */
export interface ContextoPagina {
  /** Caja de la página, sin aplicar su rotación. */
  readonly caja: CajaPagina
  /** Rotación que declara la página. */
  readonly rotacion: GradosRotacion
}

/** Colocación de un elemento, lista para pasarla a pdf-lib. */
export interface ColocacionElemento extends ColocacionEnPagina {
  /** Caja del elemento en coordenadas visibles, útil para la vista previa. */
  readonly cajaEnPagina: CajaVisible
}

/**
 * Calcula dónde dibujar un elemento.
 *
 * El giro propio del elemento se aplica sobre su caja **sin cambiarla de sitio**: la
 * caja marca dónde está el elemento y el giro es cómo se ve dentro de ella. Por eso
 * se centra el contenido girado en la caja original en lugar de dejar que la caja
 * envolvente crezca hacia un lado.
 */
export function calcularColocacionElemento(
  elemento: BaseElemento,
  pagina: ContextoPagina,
  desplazamientoLocal?: Punto,
): ColocacionElemento {
  const medidasVisibles = calcularMedidasVisibles(pagina.caja, pagina.rotacion)
  const caja = calcularCajaVisible(elemento, medidasVisibles)
  const giro = normalizarGiro(elemento.giro)

  const colocacion = calcularColocacionLibre({
    caja: pagina.caja,
    rotacionPagina: pagina.rotacion,
    contenido: { ancho: caja.ancho, alto: caja.alto },
    esquinaVisible: { x: caja.x, y: caja.y },
    rotacionContenido: giro,
    ...(desplazamientoLocal === undefined ? {} : { desplazamientoLocal }),
  })

  // Al girar, la caja envolvente crece. Se recentra sobre la caja original para que
  // el elemento no se desplace solo por haberlo girado.
  const correccionX = (caja.ancho - colocacion.cajaVisible.ancho) / 2
  const correccionY = (caja.alto - colocacion.cajaVisible.alto) / 2

  if (correccionX === 0 && correccionY === 0) {
    return { ...colocacion, cajaEnPagina: caja }
  }

  const recentrada = calcularColocacionLibre({
    caja: pagina.caja,
    rotacionPagina: pagina.rotacion,
    contenido: { ancho: caja.ancho, alto: caja.alto },
    esquinaVisible: { x: caja.x + correccionX, y: caja.y + correccionY },
    rotacionContenido: giro,
    ...(desplazamientoLocal === undefined ? {} : { desplazamientoLocal }),
  })

  return { ...recentrada, cajaEnPagina: caja }
}

/**
 * Convierte un punto en fracciones de la caja de un elemento a puntos visibles.
 *
 * Lo usan los trazos: sus puntos van en fracciones de la caja, no de la página, para
 * que el dibujo se escale al redimensionar sin recalcular nada.
 */
export function puntoDeTrazoAVisible(
  punto: Punto,
  caja: CajaVisible,
): Punto {
  return {
    x: caja.x + limitar(punto.x, 0, 1) * caja.ancho,
    y: caja.y + (1 - limitar(punto.y, 0, 1)) * caja.alto,
  }
}

/** Agrupa elementos por página, conservando el orden dentro de cada una. */
export function agruparPorPagina(
  elementos: readonly ElementoSuperpuesto[],
): ReadonlyMap<number, readonly ElementoSuperpuesto[]> {
  const grupos = new Map<number, ElementoSuperpuesto[]>()

  for (const elemento of elementos) {
    const pagina = Math.max(1, Math.trunc(elemento.pagina))
    const grupo = grupos.get(pagina)

    if (grupo === undefined) {
      grupos.set(pagina, [elemento])
    } else {
      grupo.push(elemento)
    }
  }

  return grupos
}

/**
 * Comprueba si un elemento va a dibujar algo.
 *
 * Un texto vacío, una forma sin relleno ni borde o un trazo sin puntos no pintan
 * nada. Se descartan antes de dibujar para que el recuento final de elementos
 * dibujados sea cierto y no una promesa.
 */
export function elementoPinta(elemento: ElementoSuperpuesto): boolean {
  if (elemento.opacidad <= 0) {
    return false
  }

  switch (elemento.clase) {
    case 'texto':
      return elemento.texto.trim() !== ''
    case 'texto-editado':
      // Aunque se deje vacío, el fondo sigue quitando visualmente la palabra original.
      return true
    case 'imagen':
      return elemento.bytes.byteLength > 0
    case 'trazo':
      return elemento.trazos.some((trazo) => trazo.length >= 2)
    case 'forma':
      return elemento.relleno !== null || elemento.borde !== null
    case 'resaltado':
      return true
  }
}

/** Descripción corta de un elemento, para listas y etiquetas de accesibilidad. */
export function describirElemento(elemento: ElementoSuperpuesto): string {
  switch (elemento.clase) {
    case 'texto': {
      const recortado = elemento.texto.trim()

      return recortado === ''
        ? 'Texto sin contenido'
        : `Texto «${recortado.length > 30 ? `${recortado.slice(0, 30)}…` : recortado}»`
    }
    case 'texto-editado': {
      const recortado = elemento.texto.trim()

      return recortado === ''
        ? 'Texto existente eliminado'
        : `Texto existente «${recortado.length > 30 ? `${recortado.slice(0, 30)}…` : recortado}»`
    }
    case 'imagen':
      return elemento.descripcion.trim() === ''
        ? 'Imagen'
        : `Imagen: ${elemento.descripcion.trim()}`
    case 'trazo':
      return `Dibujo a mano alzada con ${elemento.trazos.length} ${
        elemento.trazos.length === 1 ? 'trazo' : 'trazos'
      }`
    case 'forma':
      return `Forma: ${NOMBRE_FIGURA[elemento.figura]}`
    case 'resaltado':
      return 'Resaltado'
  }
}

/** Nombres de las figuras, para mostrarlos. */
export const NOMBRE_FIGURA = {
  rectangulo: 'rectángulo',
  elipse: 'elipse',
  linea: 'línea',
  flecha: 'flecha',
} as const

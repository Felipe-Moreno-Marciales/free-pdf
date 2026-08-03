import type { GradosRotacion } from '../pdf/tipos'

/**
 * Tipos de la comparación de documentos.
 *
 * La comparación se hace en dos planos que **no hay que confundir**:
 *
 * - **El texto**: se extrae con PDF.js y se compara palabra por palabra. Es la
 *   comparación fiable, porque dos documentos con el mismo texto dicen lo mismo.
 * - **Los píxeles**: se dibuja cada página y se cuentan las diferencias. Detecta
 *   cambios que el texto no ve —una imagen distinta, un sello movido, un color— pero
 *   **una diferencia visual no implica una diferencia de contenido**: cambiar de
 *   tipografía altera todos los píxeles sin cambiar una sola palabra.
 *
 * La interfaz dice las dos cosas por separado y no las mezcla en un veredicto único.
 */

/** Cómo terminó la comparación de una página. */
export type EstadoPagina =
  /** Ni el texto ni los píxeles cambian. */
  | 'identica'
  /** Hay diferencias. */
  | 'modificada'
  /** Solo existe en el segundo documento. */
  | 'anadida'
  /** Solo existe en el primero. */
  | 'eliminada'

/** Describe un estado de página en español. */
export function describirEstadoPagina(estado: EstadoPagina): string {
  switch (estado) {
    case 'identica':
      return 'Sin cambios'
    case 'modificada':
      return 'Modificada'
    case 'anadida':
      return 'Añadida'
    case 'eliminada':
      return 'Eliminada'
  }
}

/** Medidas y giro de una página. */
export interface GeometriaPagina {
  readonly ancho: number
  readonly alto: number
  readonly rotacion: GradosRotacion
}

/** Diferencias de texto encontradas en una página. */
export interface DiferenciaTexto {
  /** Palabras que estaban en el primero y no en el segundo. */
  readonly eliminadas: readonly string[]
  /** Palabras que aparecen en el segundo y no estaban en el primero. */
  readonly anadidas: readonly string[]
  /** `true` cuando el texto es exactamente el mismo. */
  readonly identico: boolean
  /** Cuántas palabras tenía cada versión. */
  readonly palabrasAntes: number
  readonly palabrasDespues: number
}

/** Diferencias visuales encontradas en una página. */
export interface DiferenciaVisual {
  /** Fracción de píxeles que cambian, entre 0 y 1. */
  readonly fraccionCambiada: number
  /** `true` cuando la fracción supera el umbral configurado. */
  readonly superaUmbral: boolean
  /**
   * Zonas donde se concentran las diferencias, en fracciones de la página.
   * Sirven para resaltarlas; no son un análisis semántico.
   */
  readonly zonas: readonly ZonaDiferencia[]
}

/** Zona rectangular con diferencias, en fracciones de la página. */
export interface ZonaDiferencia {
  readonly izquierda: number
  readonly superior: number
  readonly ancho: number
  readonly alto: number
}

/** Resultado de comparar una página. */
export interface ComparacionPagina {
  /** Número de página, empezando en 1. */
  readonly numero: number
  readonly estado: EstadoPagina
  /** Geometría en el primer documento, o `null` si la página no existe ahí. */
  readonly geometriaAntes: GeometriaPagina | null
  readonly geometriaDespues: GeometriaPagina | null
  /** `true` cuando las medidas o el giro no coinciden. */
  readonly geometriaDistinta: boolean
  /** Diferencias de texto, o `null` si la página solo existe en uno. */
  readonly texto: DiferenciaTexto | null
  /** Diferencias visuales, o `null` si no se pudieron comparar. */
  readonly visual: DiferenciaVisual | null
}

/** Diferencia de un metadato concreto. */
export interface DiferenciaMetadato {
  readonly clave: string
  readonly antes: string
  readonly despues: string
}

/** Resumen del recuento de páginas por estado. */
export interface RecuentoPaginas {
  readonly identicas: number
  readonly modificadas: number
  readonly anadidas: number
  readonly eliminadas: number
}

/** Resultado completo de comparar dos documentos. */
export interface ResultadoComparacion {
  readonly nombreAntes: string
  readonly nombreDespues: string
  readonly paginasAntes: number
  readonly paginasDespues: number
  readonly paginas: readonly ComparacionPagina[]
  readonly recuento: RecuentoPaginas
  readonly metadatos: readonly DiferenciaMetadato[]
  /** Umbral con el que se hizo la comparación visual, en fracción. */
  readonly umbral: number
  /** `true` cuando no hay ninguna diferencia de ningún tipo. */
  readonly sonIdenticos: boolean
}

/** Umbral de comparación visual, en fracción de píxeles cambiados. */
export const UMBRAL_MINIMO = 0
export const UMBRAL_MAXIMO = 0.2
export const UMBRAL_PREDETERMINADO = 0.005

/**
 * Tolerancia por canal para considerar que un píxel ha cambiado.
 *
 * No es cero a propósito. Dibujar la misma página dos veces puede dar valores que
 * difieren en una o dos unidades por el antialias, y con tolerancia cero cada página
 * saldría «modificada» aunque los documentos fueran idénticos.
 */
export const TOLERANCIA_CANAL = 12

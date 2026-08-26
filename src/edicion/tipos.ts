import type { Punto } from '../pdf/posicionarEnPagina'
import type { ResultadoDocumento } from '../pdf/tipos'

/**
 * Tipos del editor visual compartido.
 *
 * Estos tipos los usan tanto «Editar y anotar» como «Firma visual», porque el
 * problema es el mismo: colocar cosas encima de una página y poder moverlas.
 *
 * Dos decisiones que conviene entender antes de tocar nada:
 *
 * 1. **Las posiciones se guardan en fracciones de la página**, entre 0 y 1, nunca en
 *    píxeles de pantalla. Es lo que hace que la vista previa y el documento final
 *    coincidan aunque la miniatura mida 200 píxeles y la página 595 puntos.
 *
 * 2. **Nada de esto modifica el texto original del documento.** Los elementos se
 *    dibujan encima, como una capa. Cambiar el texto ya existente en un PDF exigiría
 *    rehacer tipografía, interletraje y reflujo del párrafo, y no se hace.
 */

/** Tipografías que se pueden usar sin incrustar ningún archivo. */
export type ClaveTipografia =
  | 'helvetica'
  | 'helvetica-negrita'
  | 'helvetica-cursiva'
  | 'times'
  | 'times-negrita'
  | 'times-cursiva'
  | 'courier'
  | 'courier-negrita'

/** Alineación del texto dentro de su caja. */
export type AlineacionTexto = 'izquierda' | 'centro' | 'derecha'

/** Figuras geométricas que se pueden dibujar. */
export type FiguraGeometrica = 'rectangulo' | 'elipse' | 'linea' | 'flecha'

/** Formatos de imagen que pdf-lib puede incrustar directamente. */
export type FormatoImagenIncrustable = 'png' | 'jpeg'

/** Clases de elemento que admite el editor. */
export type ClaseElemento =
  | 'texto'
  | 'texto-editado'
  | 'imagen'
  | 'trazo'
  | 'forma'
  | 'resaltado'

/**
 * Lo que comparten todos los elementos.
 *
 * `izquierda`, `superior`, `ancho` y `alto` son fracciones de la página **visible**,
 * es decir, de la página tal y como se ve una vez aplicada su rotación. `superior` se
 * mide desde arriba, que es como se razona al mirar una página; la conversión al
 * origen inferior de PDF ocurre en `colocarElementos.ts`.
 */
export interface BaseElemento {
  /** Identificador estable, para poder editar y reordenar. */
  readonly id: string
  /** Página en la que está, empezando en 1. */
  readonly pagina: number
  /** Fracción desde el borde izquierdo, de 0 a 1. */
  readonly izquierda: number
  /** Fracción desde el borde superior, de 0 a 1. */
  readonly superior: number
  /** Ancho como fracción del ancho visible, mayor que 0. */
  readonly ancho: number
  /** Alto como fracción del alto visible, mayor que 0. */
  readonly alto: number
  /** Giro propio en grados, en sentido antihorario. */
  readonly giro: number
  /** Opacidad de 0 a 1. */
  readonly opacidad: number
  /** Confirmado individualmente en la sesión de «Editar PDF». */
  readonly guardado?: boolean
}

/** Texto suelto colocado sobre la página. */
export interface ElementoTexto extends BaseElemento {
  readonly clase: 'texto'
  readonly texto: string
  readonly tipografia: ClaveTipografia
  /** Tamaño en puntos PDF. No es una fracción: un cuerpo de 12 son 12 puntos. */
  readonly tamano: number
  /** Color en notación `#rrggbb`. */
  readonly color: string
  readonly alineacion: AlineacionTexto
}

/** Sustitución visual de una palabra que ya existía en el PDF. */
export interface ElementoTextoEditado extends BaseElemento {
  readonly clase: 'texto-editado'
  readonly texto: string
  readonly tipografia: ClaveTipografia
  readonly tamano: number
  readonly color: string
  readonly colorFondo: string
  readonly alineacion: AlineacionTexto
  /**
   * Dónde se apoya la primera línea base, como fracción del alto de la caja medida
   * desde arriba.
   *
   * La caja marca el hueco que ocupaba la palabra original, con sus ascendentes y
   * descendentes; la línea base es lo que de verdad hay que respetar para que la
   * corrección quede a la misma altura que el resto de la línea. Se guarda como
   * fracción para que siga valiendo si la caja se redimensiona.
   */
  readonly lineaBase: number
}

/** Imagen incrustada. */
export interface ElementoImagen extends BaseElemento {
  readonly clase: 'imagen'
  /** Bytes originales del archivo, sin recodificar. */
  readonly bytes: Uint8Array
  readonly formato: FormatoImagenIncrustable
  /** Texto alternativo, para poder describir la imagen en la interfaz. */
  readonly descripcion: string
}

/**
 * Un trazo a mano alzada.
 *
 * Los puntos van en fracciones **de la caja del elemento**, no de la página: así el
 * dibujo se escala al redimensionar la caja sin tener que recalcular cada punto.
 */
export interface ElementoTrazo extends BaseElemento {
  readonly clase: 'trazo'
  /** Cada trazo es una sucesión de puntos; levantar el lápiz empieza otro. */
  readonly trazos: readonly (readonly Punto[])[]
  /** Grosor de la línea en puntos PDF. */
  readonly grosor: number
  readonly color: string
}

/** Figura geométrica. */
export interface ElementoForma extends BaseElemento {
  readonly clase: 'forma'
  readonly figura: FiguraGeometrica
  /** Color de relleno, o `null` para dejarla sin rellenar. */
  readonly relleno: string | null
  /** Color del borde, o `null` para dejarla sin borde. */
  readonly borde: string | null
  /** Grosor del borde en puntos PDF. */
  readonly grosorBorde: number
}

/**
 * Resaltado translúcido.
 *
 * Es un rectángulo con opacidad, dibujado encima. **No marca el texto**: el texto
 * subyacente no se toca y sigue siendo seleccionable, igual que con un rotulador
 * sobre un papel ya impreso.
 */
export interface ElementoResaltado extends BaseElemento {
  readonly clase: 'resaltado'
  readonly color: string
}

/**
 * Un elemento cualquiera de la capa de edición.
 *
 * Es una unión discriminada por `clase`, igual que `ValorCampo` en los formularios.
 * El motivo es el mismo: que el tipo impida construir un elemento incoherente, como
 * un texto sin tipografía o una imagen sin bytes.
 */
export type ElementoSuperpuesto =
  | ElementoTexto
  | ElementoTextoEditado
  | ElementoImagen
  | ElementoTrazo
  | ElementoForma
  | ElementoResaltado

/** Elemento de una clase concreta, para funciones que solo tratan con una. */
export type ElementoDeClase<C extends ClaseElemento> = Extract<
  ElementoSuperpuesto,
  { readonly clase: C }
>

/** Progreso de la aplicación de la capa de edición. */
export interface ProgresoEdicion {
  readonly completados: number
  readonly total: number
}

/**
 * Resultado de aplicar la capa de edición a un documento.
 *
 * Los recuentos son de lo que se dibujó **de verdad**, no de lo que se pidió: un
 * texto vacío o una forma sin relleno ni borde se descartan, y decir lo contrario
 * sería informar de un trabajo que no se hizo.
 */
export interface ResultadoEdicion extends ResultadoDocumento {
  /** Cuántos elementos se dibujaron. */
  readonly elementosDibujados: number
  /** Cuántos se descartaron porque no pintaban nada. */
  readonly elementosDescartados: number
  /** Cuántas páginas recibieron al menos un elemento. */
  readonly paginasAfectadas: number
  /**
   * Elementos que se pidieron en una página que no existe.
   * No se dibujan y se informa, en lugar de perderlos en silencio.
   */
  readonly paginasInexistentes: readonly number[]
}

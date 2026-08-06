import type { GradosRotacion } from '../pdf/tipos'

/**
 * Formatos de imagen que la aplicación acepta al seleccionar archivos.
 *
 * Son los cuatro que se han comprobado: JPEG (con las extensiones `.jpg` y
 * `.jpeg`), PNG y WebP. No se anuncia compatibilidad con ningún otro formato.
 */
export type FormatoImagen = 'jpeg' | 'png' | 'webp'

/**
 * Formatos que pdf-lib sabe incrustar directamente en un documento.
 *
 * WebP no está en la lista: se convierte antes con un `canvas` del propio
 * navegador, sin recurrir a ningún servicio externo.
 */
export type FormatoImagenPdf = 'jpeg' | 'png'

/** Medidas de una imagen, en píxeles. */
export interface DimensionesImagen {
  /** Ancho en píxeles. */
  readonly ancho: number
  /** Alto en píxeles. */
  readonly alto: number
}

/** Recorte expresado en fracciones del ancho y del alto, entre 0 y 1. */
export interface RecorteRelativo {
  /** Fracción que se descarta por la izquierda. */
  readonly izquierda: number
  /** Fracción que se descarta por arriba. */
  readonly superior: number
  /** Fracción que se descarta por la derecha. */
  readonly derecha: number
  /** Fracción que se descarta por abajo. */
  readonly inferior: number
}

/** Filtro que se aplica a una imagen antes de generar el PDF. */
export type FiltroImagen = 'original' | 'grises' | 'blanco-y-negro'

/** Ajustes de aspecto que se aplican sobre los píxeles de una imagen. */
export interface AjustesImagen {
  /** Filtro de color. */
  readonly filtro: FiltroImagen
  /** Brillo, de −100 a 100. El 0 deja la imagen como estaba. */
  readonly brillo: number
  /** Contraste, de −100 a 100. El 0 deja la imagen como estaba. */
  readonly contraste: number
}

/** Transformaciones que se aplican al dibujar una imagen en un `canvas`. */
export interface TransformacionImagen {
  /** Giro que se aplica, en grados. */
  readonly rotacion: GradosRotacion
  /** Recorte relativo, o `null` si se conserva la imagen completa. */
  readonly recorte: RecorteRelativo | null
  /** Ajustes de color, o `null` si la imagen se deja como estaba. */
  readonly ajustes: AjustesImagen | null
}

/** Imagen ya validada que forma parte de una selección. */
export interface ImagenSeleccionada {
  /** Identificador estable derivado de nombre, tamaño y fecha de modificación. */
  readonly id: string
  /** Archivo original facilitado por el navegador. */
  readonly archivo: File
  /** Nombre visible del archivo. */
  readonly nombre: string
  /** Tamaño en bytes. */
  readonly tamano: number
  /** Formato detectado a partir de la extensión y del tipo MIME. */
  readonly formato: FormatoImagen
  /** Giro que la persona ha aplicado, en grados. */
  readonly rotacion: GradosRotacion
  /** Medidas leídas al descodificarla, o `null` si todavía no se conocen. */
  readonly dimensiones: DimensionesImagen | null
}

/** Imagen ya descodificada y lista para dibujarse en un `canvas`. */
export interface ImagenDescodificada {
  /** Origen que acepta `drawImage`. */
  readonly fuente: CanvasImageSource
  /** Medidas reales, ya corregida la orientación si la imagen la declaraba. */
  readonly dimensiones: DimensionesImagen
  /** Libera la memoria y las URL temporales asociadas. */
  readonly liberar: () => void
}

/** Bytes de una imagen listos para incrustarse en un documento PDF. */
export interface ImagenParaPdf {
  /** Contenido de la imagen. */
  readonly bytes: Uint8Array
  /** Formato de esos bytes. */
  readonly formato: FormatoImagenPdf
  /** Medidas en píxeles. */
  readonly dimensiones: DimensionesImagen
}

/** Motivo por el que se descarta una imagen al seleccionarla. */
export type MotivoDescarteImagen = 'formato-no-admitido' | 'vacia' | 'duplicada'

/** Movimiento de una imagen dentro de la lista. */
export type DesplazamientoImagen =
  | 'anterior'
  | 'siguiente'
  | 'inicio'
  | 'final'

/** Imagen descartada junto con el motivo. */
export interface ImagenDescartada {
  readonly nombre: string
  readonly motivo: MotivoDescarteImagen
}

/** Modo con el que una imagen se ajusta a su página. */
export type ModoAjuste = 'contener' | 'cubrir'

/** Tamaños de página que ofrecen las herramientas de imágenes. */
export type ClaveTamanoPagina = 'original' | 'a4' | 'carta' | 'legal'

/** Orientación de la página. */
export type OrientacionPagina = 'automatica' | 'vertical' | 'horizontal'

/** Márgenes predefinidos, más la opción de escribir uno propio. */
export type ClaveMargen =
  | 'sin-margen'
  | 'pequeno'
  | 'mediano'
  | 'grande'
  | 'personalizado'

/** Medidas de una página, en puntos PDF. */
export interface MedidasPagina {
  /** Ancho en puntos PDF. */
  readonly ancho: number
  /** Alto en puntos PDF. */
  readonly alto: number
}

/** Configuración de las páginas que se generan a partir de imágenes. */
export interface ConfiguracionPaginaImagen {
  /** Tamaño de la página. */
  readonly tamano: ClaveTamanoPagina
  /** Orientación de la página. */
  readonly orientacion: OrientacionPagina
  /** Margen predefinido. */
  readonly margen: ClaveMargen
  /** Margen propio en milímetros; solo se usa con `personalizado`. */
  readonly margenPersonalizadoMm: number
  /** Modo de ajuste de la imagen dentro del área disponible. */
  readonly ajuste: ModoAjuste
  /** Color de fondo de la página, en notación hexadecimal. */
  readonly colorFondo: string
}

/** Colocación calculada de una imagen dentro de su página. */
export interface ColocacionImagen {
  /** Medidas de la página, en puntos PDF. */
  readonly pagina: MedidasPagina
  /** Distancia desde el borde izquierdo de la página, en puntos. */
  readonly x: number
  /** Distancia desde el borde inferior de la página, en puntos. */
  readonly y: number
  /** Ancho con el que se dibuja la imagen, en puntos. */
  readonly ancho: number
  /** Alto con el que se dibuja la imagen, en puntos. */
  readonly alto: number
  /**
   * Recorte que hay que aplicar a la imagen antes de dibujarla, o `null` si se
   * dibuja completa.
   *
   * El modo «cubrir» necesita descartar parte de la imagen para que su
   * proporción coincida con el área disponible. Se recorta la propia imagen en
   * lugar de dibujarla más grande y dejar que la página la corte, así los
   * márgenes se respetan y el documento resultante no guarda píxeles que nunca
   * se van a ver.
   */
  readonly recorte: RecorteRelativo | null
  /** `true` cuando el ajuste elegido descarta parte de la imagen. */
  readonly recorta: boolean
}

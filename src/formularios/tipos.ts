/**
 * Tipos de la infraestructura de formularios PDF.
 *
 * Se apoya en las API reales de formularios de pdf-lib, que cubren los campos
 * AcroForm. Los formularios XFA —una tecnología distinta y en desuso— quedan
 * fuera: se detectan y se avisa, pero no se pueden manipular.
 */

/** Clase de campo que la herramienta sabe manejar. */
export type ClaseCampo =
  | 'texto'
  | 'texto-multilinea'
  | 'casilla'
  | 'opcion'
  | 'desplegable'
  | 'lista'
  | 'boton'
  | 'firma'
  | 'no-compatible'

/** Valor de un campo, según su clase. */
export type ValorCampo =
  | { readonly clase: 'texto'; readonly texto: string }
  | { readonly clase: 'casilla'; readonly marcada: boolean }
  | { readonly clase: 'opcion'; readonly elegida: string | null }
  | { readonly clase: 'seleccion'; readonly elegidas: readonly string[] }

/** Campo detectado en un formulario existente. */
export interface CampoDetectado {
  /** Nombre técnico del campo, tal y como está en el documento. */
  readonly nombre: string
  /** Clase de campo. */
  readonly clase: ClaseCampo
  /** Página en la que aparece, empezando en 1, o `null` si no se pudo deducir. */
  readonly pagina: number | null
  /** `true` cuando el campo no se puede modificar. */
  readonly soloLectura: boolean
  /** `true` cuando el documento marca el campo como obligatorio. */
  readonly obligatorio: boolean
  /** Valor actual del campo. */
  readonly valor: ValorCampo
  /** Opciones admitidas, para los campos de elección. */
  readonly opciones: readonly string[]
  /** Longitud máxima del texto, o `null` si no la declara. */
  readonly longitudMaxima: number | null
  /** `true` cuando el campo admite varias líneas. */
  readonly multilinea: boolean
  /** `true` cuando el campo admite elegir varias opciones. */
  readonly multiseleccion: boolean
  /**
   * `true` cuando el campo es de contraseña.
   *
   * Su valor **nunca** se muestra ni se rellena: sería una filtración.
   */
  readonly esContrasena: boolean
}

/** Resultado de inspeccionar un documento. */
export interface InspeccionFormulario {
  /** Campos detectados, en el orden en el que los devuelve el documento. */
  readonly campos: readonly CampoDetectado[]
  /** Número de páginas del documento. */
  readonly numeroPaginas: number
  /** `true` cuando el documento declara un formulario XFA, que no se admite. */
  readonly tieneXfa: boolean
}

/** Clase de campo que se puede crear. */
export type ClaseCampoNuevo =
  | 'texto'
  | 'texto-multilinea'
  | 'casilla'
  | 'opcion'
  | 'desplegable'
  | 'lista'

/** Rectángulo de un campo, en puntos PDF y coordenadas visibles. */
export interface RectanguloCampo {
  /** Distancia desde el borde izquierdo. */
  readonly x: number
  /** Distancia desde el borde inferior. */
  readonly y: number
  /** Ancho del campo. */
  readonly ancho: number
  /** Alto del campo. */
  readonly alto: number
}

/** Definición de un campo que se va a crear. */
export interface CampoNuevo {
  /** Identificador interno, solo para la interfaz. */
  readonly id: string
  /** Nombre técnico con el que se creará. */
  readonly nombre: string
  /** Clase de campo. */
  readonly clase: ClaseCampoNuevo
  /** Página en la que se coloca, empezando en 1. */
  readonly pagina: number
  /** Posición y tamaño. */
  readonly rectangulo: RectanguloCampo
  /** Valor inicial del campo. */
  readonly valorPredeterminado: string
  /** Opciones, para los campos de elección. */
  readonly opciones: readonly string[]
  /** Texto de ayuda que muestran algunos lectores. */
  readonly textoAyuda: string
  /** `true` para crearlo como solo lectura. */
  readonly soloLectura: boolean
  /** `true` para marcarlo como obligatorio. */
  readonly obligatorio: boolean
  /** Tamaño de la tipografía, en puntos. */
  readonly tamanoFuente: number
  /** Color del texto, en notación hexadecimal. */
  readonly colorTexto: string
  /** Color del borde, en notación hexadecimal. */
  readonly colorBorde: string
  /** Color de fondo, en notación hexadecimal. */
  readonly colorFondo: string
  /** Grosor del borde, en puntos. */
  readonly grosorBorde: number
}

/** Problema encontrado al validar un campo o un valor. */
export interface ProblemaFormulario
{
  /** Nombre del campo afectado. */
  readonly campo: string
  /** Explicación en español. */
  readonly mensaje: string
}

/** Resultado de validar los valores o los campos nuevos. */
export interface ValidacionFormulario {
  /** `true` cuando no hay ningún problema. */
  readonly valida: boolean
  /** Problemas encontrados. */
  readonly problemas: readonly ProblemaFormulario[]
}

/** Datos necesarios para generar el documento. */
export interface PeticionFormulario {
  /** Archivo original. */
  readonly archivo: File
  /** Valores que se aplican a los campos existentes, por nombre. */
  readonly valores: ReadonlyMap<string, ValorCampo>
  /** Campos nuevos que se van a crear. */
  readonly camposNuevos: readonly CampoNuevo[]
  /** `true` para convertir los campos en contenido no editable. */
  readonly aplanar: boolean
}

import type {
  PerfilCompresion,
  ResumenCompresion,
} from './compresionPdf'
import type {
  DiagnosticoPdf,
  NivelReparacion,
  ResumenReparacion,
} from './reparacionPdf'

/**
 * Tipos de la integración con qpdf compilado a WebAssembly.
 *
 * qpdf es el motor que cifra y descifra documentos. pdf-lib no sabe hacerlo, así
 * que no se intenta: usar `ignoreEncryption` no descifra nada y produciría
 * documentos inválidos.
 */

/** Nivel de impresión que se concede. */
export type NivelImpresion = 'ninguna' | 'baja' | 'completa'

/**
 * Permisos que se graban en el documento cifrado.
 *
 * Son declaraciones que el lector PDF decide respetar o no: no son una barrera
 * técnica. Lo que sí protege de verdad es la contraseña de apertura, que cifra el
 * contenido.
 */
export interface PermisosPdf {
  /** Nivel de impresión permitido. */
  readonly impresion: NivelImpresion
  /** Permite copiar o extraer texto e imágenes. */
  readonly extraccion: boolean
  /** Permite extraer contenido para herramientas de accesibilidad. */
  readonly accesibilidad: boolean
  /** Permite añadir o modificar anotaciones. */
  readonly anotaciones: boolean
  /** Permite rellenar campos de formulario. */
  readonly formularios: boolean
  /** Permite reordenar, insertar o girar páginas. */
  readonly ensamblado: boolean
  /** Permite cualquier otra modificación del contenido. */
  readonly otrasModificaciones: boolean
}

/** Datos necesarios para proteger un documento. */
export interface OpcionesProteccion {
  /** Contraseña de apertura, obligatoria. */
  readonly contrasenaUsuario: string
  /**
   * Contraseña de propietario.
   *
   * qpdf rechaza dejarla vacía con claves de 256 bits, porque un documento así
   * se puede abrir sin contraseña. Cuando no se indica ninguna, se genera una
   * aleatoria con `crypto.getRandomValues`.
   */
  readonly contrasenaPropietario: string
  /** Permisos que se graban en el documento. */
  readonly permisos: PermisosPdf
}

/** Informe del cifrado de un documento, leído de la salida de qpdf. */
export interface InformeCifrado {
  /** `true` cuando el documento está cifrado. */
  readonly cifrado: boolean
  /** Revisión del diccionario de cifrado, por ejemplo 6 para AES-256. */
  readonly revision: number | null
  /** Método de cifrado de los flujos, por ejemplo `AESv3`. */
  readonly metodo: string | null
  /** Permisos que declara el documento, tal y como los describe qpdf. */
  readonly permisos: Readonly<Record<string, boolean>>
}

/** Motivo por el que una operación de qpdf no se pudo completar. */
export type CodigoErrorQpdf =
  | 'contrasena-incorrecta'
  | 'documento-danado'
  | 'no-esta-cifrado'
  | 'ya-esta-cifrado'
  | 'verificacion-fallida'
  | 'reparacion-inutil'
  | 'motor-no-disponible'
  | 'error-interno'

/** Petición que se envía al trabajador. */
export type PeticionQpdf =
  | {
      readonly tipo: 'proteger'
      readonly identificador: number
      readonly contenido: Uint8Array
      readonly opciones: OpcionesProteccion
    }
  | {
      readonly tipo: 'desbloquear'
      readonly identificador: number
      readonly contenido: Uint8Array
      readonly contrasena: string
    }
  | {
      readonly tipo: 'inspeccionar'
      readonly identificador: number
      readonly contenido: Uint8Array
      readonly contrasena: string | null
    }
  | {
      readonly tipo: 'diagnosticar'
      readonly identificador: number
      readonly contenido: Uint8Array
    }
  | {
      readonly tipo: 'reparar'
      readonly identificador: number
      readonly contenido: Uint8Array
      readonly nivel: NivelReparacion
    }
  | {
      readonly tipo: 'comprimir'
      readonly identificador: number
      readonly contenido: Uint8Array
      readonly perfil: PerfilCompresion
    }

/** Respuesta que devuelve el trabajador. */
export type RespuestaQpdf =
  | {
      readonly tipo: 'preparado'
    }
  | {
      readonly tipo: 'listo'
      readonly identificador: number
      readonly contenido: Uint8Array | null
      readonly informe: InformeCifrado | null
      readonly numeroPaginas: number | null
    }
  | {
      readonly tipo: 'diagnosticado'
      readonly identificador: number
      readonly diagnostico: DiagnosticoPdf
      readonly numeroPaginas: number | null
    }
  | {
      readonly tipo: 'reparado'
      readonly identificador: number
      readonly contenido: Uint8Array
      readonly resumen: ResumenReparacion
    }
  | {
      readonly tipo: 'comprimido'
      readonly identificador: number
      /**
       * Contenido comprimido, o `null` cuando no se entrega.
       *
       * Es `null` a propósito si el resultado no era menor: así el hilo principal no
       * puede entregar por descuido un archivo que no debía entregarse.
       */
      readonly contenido: Uint8Array | null
      readonly resumen: ResumenCompresion
    }
  | {
      readonly tipo: 'fallo'
      readonly identificador: number
      readonly codigo: CodigoErrorQpdf
      readonly mensaje: string
    }

/** Resultado de proteger o desbloquear, listo para descargar. */
export interface ResultadoSeguridad {
  /** Contenido del documento resultante. */
  readonly blob: Blob
  /** Nombre con el que se descarga. */
  readonly nombreArchivo: string
  /** Tamaño en bytes. */
  readonly tamano: number
  /** Número de páginas del documento resultante. */
  readonly numeroPaginas: number
  /** Informe de cifrado con el que se verificó el resultado. */
  readonly informe: InformeCifrado
}

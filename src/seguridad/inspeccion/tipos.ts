import type { ClaseHallazgo, EstadoDocumento } from '../qpdf/reparacionPdf'

/** Nivel general de los indicadores estructurales encontrados. */
export type NivelRiesgo =
  | 'sin-indicios'
  | 'bajo'
  | 'precaucion'
  | 'elevado'

/** Importancia de un hallazgo individual. */
export type SeveridadHallazgoSeguridad =
  | 'informativa'
  | 'baja'
  | 'media'
  | 'alta'

/** Características del formato PDF que reconoce el inspector. */
export type TipoHallazgoSeguridad =
  | 'javascript'
  | 'accion-apertura'
  | 'accion-adicional'
  | 'launch'
  | 'archivo-incrustado'
  | 'ejecutable-incrustado'
  | 'envio-formulario'
  | 'enlace-externo'
  | 'contenido-multimedia'
  | 'formulario'
  | 'xfa'
  | 'estructura-danada'

/** Un indicador estructural explicado sin afirmar que sea contenido malicioso. */
export interface HallazgoSeguridad {
  readonly tipo: TipoHallazgoSeguridad
  readonly severidad: SeveridadHallazgoSeguridad
  readonly titulo: string
  readonly descripcion: string
  readonly cantidad: number
  /** Ubicaciones acotadas dentro del JSON de qpdf para los detalles técnicos. */
  readonly contextos: readonly string[]
}

/** Metadatos que qpdf pudo determinar para un archivo incrustado. */
export interface ArchivoIncrustadoSeguridad {
  readonly nombre: string
  readonly extension: string | null
  readonly tipoDeclarado: string | null
  readonly aparentaEjecutable: boolean
  readonly referencia: string | null
}

/** Resumen del diagnóstico estructural de qpdf. */
export type EstadoEstructuraSeguridad =
  | 'valida'
  | 'con-advertencias'
  | 'danada'

/** Resultado completo de la inspección local de un PDF que qpdf pudo leer. */
export interface InformeSeguridadPdf {
  readonly nivel: NivelRiesgo
  readonly hallazgos: readonly HallazgoSeguridad[]
  readonly archivosIncrustados: readonly ArchivoIncrustadoSeguridad[]
  readonly numeroPaginas: number | null
  /** Solo es `true` cuando el diagnóstico de qpdf terminó como intacto. */
  readonly estructuraValida: boolean
  readonly estadoEstructura: EstadoEstructuraSeguridad
  /** `true` si qpdf declara cifrado, aunque pudiera leerlo sin pedir una clave. */
  readonly cifrado: boolean
  readonly analisisCompleto: true
  /** Mensajes de diagnóstico de qpdf, deduplicados, truncados y acotados. */
  readonly advertenciasTecnicas: readonly string[]
}

/** Datos ya obtenidos por la comprobación estructural de qpdf. */
export interface ContextoInspeccionSeguridad {
  readonly numeroPaginas: number | null
  readonly diagnostico: {
    readonly estado: EstadoDocumento
    readonly hallazgos: readonly {
      readonly clase?: ClaseHallazgo
      readonly mensaje: string
    }[]
    readonly necesitaContrasena: boolean
  }
}

/** Motivos por los que no puede emitirse un informe completo y fiable. */
export type MotivoErrorInspeccionSeguridad =
  | 'documento-cifrado'
  | 'estructura-no-inspeccionable'
  | 'json-invalido'
  | 'limite-profundidad'
  | 'limite-nodos'
  | 'cadena-demasiado-larga'

import type { PermisosPdf } from '../../seguridad/qpdf/tipos'

/** Configuración de la protección con contraseña. */
export interface ConfiguracionProteccion {
  /** Contraseña de apertura. */
  readonly contrasenaUsuario: string
  /** Repetición de la contraseña de apertura, para detectar erratas. */
  readonly confirmacionUsuario: string
  /** `true` cuando se quiere fijar una contraseña de propietario propia. */
  readonly usarPropietarioPropio: boolean
  /** Contraseña de propietario escrita por la persona. */
  readonly contrasenaPropietario: string
  /** Repetición de la contraseña de propietario. */
  readonly confirmacionPropietario: string
  /** Permisos que se graban en el documento. */
  readonly permisos: PermisosPdf
}

/** Resultado de validar la configuración antes de procesar. */
export interface ValidacionProteccion {
  /** `true` cuando se puede proceder. */
  readonly valida: boolean
  /** Mensaje de la contraseña de apertura, o `null`. */
  readonly mensajeUsuario: string | null
  /** Mensaje de la confirmación de apertura, o `null`. */
  readonly mensajeConfirmacionUsuario: string | null
  /** Mensaje de la contraseña de propietario, o `null`. */
  readonly mensajePropietario: string | null
  /** Mensaje de la confirmación de propietario, o `null`. */
  readonly mensajeConfirmacionPropietario: string | null
}

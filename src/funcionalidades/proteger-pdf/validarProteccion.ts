import { LONGITUD_ACEPTABLE } from '../../seguridad/qpdf/permisosPdf'
import type { ConfiguracionProteccion, ValidacionProteccion } from './tipos'

/**
 * Validación de la configuración de protección.
 *
 * Es una función pura, así que se puede comprobar por separado que cada caso
 * produce el mensaje esperado. **No recibe ni devuelve la contraseña**: solo
 * decide si se puede proceder y qué explicar.
 */

/** Validación sin ningún problema. */
const SIN_PROBLEMAS: ValidacionProteccion = {
  valida: true,
  mensajeUsuario: null,
  mensajeConfirmacionUsuario: null,
  mensajePropietario: null,
  mensajeConfirmacionPropietario: null,
}

/**
 * Comprueba la configuración antes de cifrar.
 *
 * Se exige una contraseña de apertura de longitud razonable y que las
 * confirmaciones coincidan. Cuando se pide una contraseña de propietario propia,
 * se le aplican las mismas reglas y además no puede coincidir con la de apertura:
 * si fueran iguales, los permisos no aportarían nada, porque quien puede abrir el
 * documento podría también cambiarlos.
 */
export function validarProteccion(
  configuracion: ConfiguracionProteccion,
): ValidacionProteccion {
  const problemas: {
    mensajeUsuario: string | null
    mensajeConfirmacionUsuario: string | null
    mensajePropietario: string | null
    mensajeConfirmacionPropietario: string | null
  } = {
    mensajeUsuario: null,
    mensajeConfirmacionUsuario: null,
    mensajePropietario: null,
    mensajeConfirmacionPropietario: null,
  }

  if (configuracion.contrasenaUsuario === '') {
    problemas.mensajeUsuario = 'Escribe la contraseña de apertura.'
  } else if (configuracion.contrasenaUsuario.length < LONGITUD_ACEPTABLE) {
    problemas.mensajeUsuario = `La contraseña debe tener al menos ${LONGITUD_ACEPTABLE} caracteres.`
  }

  if (
    configuracion.contrasenaUsuario !== '' &&
    configuracion.confirmacionUsuario !== configuracion.contrasenaUsuario
  ) {
    problemas.mensajeConfirmacionUsuario =
      'Las dos contraseñas de apertura no coinciden.'
  }

  if (configuracion.usarPropietarioPropio) {
    if (configuracion.contrasenaPropietario === '') {
      problemas.mensajePropietario = 'Escribe la contraseña de propietario.'
    } else if (
      configuracion.contrasenaPropietario.length < LONGITUD_ACEPTABLE
    ) {
      problemas.mensajePropietario = `La contraseña debe tener al menos ${LONGITUD_ACEPTABLE} caracteres.`
    } else if (
      configuracion.contrasenaPropietario === configuracion.contrasenaUsuario
    ) {
      problemas.mensajePropietario =
        'La contraseña de propietario debe ser distinta de la de apertura; si no, los permisos no protegen nada.'
    }

    if (
      configuracion.contrasenaPropietario !== '' &&
      configuracion.confirmacionPropietario !==
        configuracion.contrasenaPropietario
    ) {
      problemas.mensajeConfirmacionPropietario =
        'Las dos contraseñas de propietario no coinciden.'
    }
  }

  const valida =
    problemas.mensajeUsuario === null &&
    problemas.mensajeConfirmacionUsuario === null &&
    problemas.mensajePropietario === null &&
    problemas.mensajeConfirmacionPropietario === null

  return valida ? SIN_PROBLEMAS : { valida: false, ...problemas }
}

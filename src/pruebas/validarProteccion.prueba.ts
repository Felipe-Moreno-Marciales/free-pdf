import { describe, expect, it } from 'vitest'
import { CONFIGURACION_PREDETERMINADA } from '../funcionalidades/proteger-pdf/useProtegerPdf'
import { validarProteccion } from '../funcionalidades/proteger-pdf/validarProteccion'
import type { ConfiguracionProteccion } from '../funcionalidades/proteger-pdf/tipos'
import { LONGITUD_ACEPTABLE } from '../seguridad/qpdf/permisosPdf'

/** Contraseña de longitud suficiente para las pruebas. */
const CLAVE = 'contraseña-larga'

/** Otra contraseña distinta, también de longitud suficiente. */
const OTRA_CLAVE = 'otra-contraseña-larga'

/** Construye una configuración partiendo de la predeterminada. */
function configurar(
  cambios: Partial<ConfiguracionProteccion> = {},
): ConfiguracionProteccion {
  return { ...CONFIGURACION_PREDETERMINADA, ...cambios }
}

describe('validarProteccion: contraseña de apertura', () => {
  it('rechaza la configuración inicial, sin contraseña', () => {
    const resultado = validarProteccion(CONFIGURACION_PREDETERMINADA)

    expect(resultado.valida).toBe(false)
    expect(resultado.mensajeUsuario).toContain('Escribe la contraseña')
  })

  it('rechaza una contraseña demasiado corta', () => {
    const resultado = validarProteccion(
      configurar({
        contrasenaUsuario: 'abc',
        confirmacionUsuario: 'abc',
      }),
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.mensajeUsuario).toContain(String(LONGITUD_ACEPTABLE))
  })

  it('acepta una contraseña justo en el límite', () => {
    const justa = 'a'.repeat(LONGITUD_ACEPTABLE)
    const resultado = validarProteccion(
      configurar({ contrasenaUsuario: justa, confirmacionUsuario: justa }),
    )

    expect(resultado.valida).toBe(true)
  })

  it('acepta una contraseña larga con la confirmación correcta', () => {
    const resultado = validarProteccion(
      configurar({ contrasenaUsuario: CLAVE, confirmacionUsuario: CLAVE }),
    )

    expect(resultado.valida).toBe(true)
    expect(resultado.mensajeUsuario).toBeNull()
    expect(resultado.mensajeConfirmacionUsuario).toBeNull()
  })

  it('rechaza dos contraseñas de apertura distintas', () => {
    const resultado = validarProteccion(
      configurar({
        contrasenaUsuario: CLAVE,
        confirmacionUsuario: `${CLAVE}x`,
      }),
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.mensajeConfirmacionUsuario).toContain('no coinciden')
  })

  it('no protesta por la confirmación si aún no hay contraseña', () => {
    const resultado = validarProteccion(configurar({ confirmacionUsuario: 'x' }))

    expect(resultado.mensajeConfirmacionUsuario).toBeNull()
  })

  it('distingue mayúsculas al comparar las confirmaciones', () => {
    const resultado = validarProteccion(
      configurar({
        contrasenaUsuario: 'contraseñalarga',
        confirmacionUsuario: 'ContraseñaLarga',
      }),
    )

    expect(resultado.valida).toBe(false)
  })
})

describe('validarProteccion: contraseña de propietario', () => {
  /** Configuración válida de apertura, para probar solo el propietario. */
  function conAperturaValida(
    cambios: Partial<ConfiguracionProteccion> = {},
  ): ConfiguracionProteccion {
    return configurar({
      contrasenaUsuario: CLAVE,
      confirmacionUsuario: CLAVE,
      usarPropietarioPropio: true,
      ...cambios,
    })
  }

  it('no exige contraseña de propietario cuando no se pide elegirla', () => {
    const resultado = validarProteccion(
      configurar({
        contrasenaUsuario: CLAVE,
        confirmacionUsuario: CLAVE,
        usarPropietarioPropio: false,
      }),
    )

    expect(resultado.valida).toBe(true)
    expect(resultado.mensajePropietario).toBeNull()
  })

  it('la exige cuando se pide elegirla', () => {
    const resultado = validarProteccion(conAperturaValida())

    expect(resultado.valida).toBe(false)
    expect(resultado.mensajePropietario).toContain('Escribe la contraseña')
  })

  it('rechaza una contraseña de propietario corta', () => {
    const resultado = validarProteccion(
      conAperturaValida({
        contrasenaPropietario: 'abc',
        confirmacionPropietario: 'abc',
      }),
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.mensajePropietario).toContain(String(LONGITUD_ACEPTABLE))
  })

  it('rechaza que coincida con la de apertura', () => {
    const resultado = validarProteccion(
      conAperturaValida({
        contrasenaPropietario: CLAVE,
        confirmacionPropietario: CLAVE,
      }),
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.mensajePropietario).toContain('distinta')
  })

  it('rechaza dos contraseñas de propietario distintas', () => {
    const resultado = validarProteccion(
      conAperturaValida({
        contrasenaPropietario: OTRA_CLAVE,
        confirmacionPropietario: `${OTRA_CLAVE}x`,
      }),
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.mensajeConfirmacionPropietario).toContain('no coinciden')
  })

  it('acepta una contraseña de propietario válida y distinta', () => {
    const resultado = validarProteccion(
      conAperturaValida({
        contrasenaPropietario: OTRA_CLAVE,
        confirmacionPropietario: OTRA_CLAVE,
      }),
    )

    expect(resultado.valida).toBe(true)
    expect(resultado.mensajePropietario).toBeNull()
    expect(resultado.mensajeConfirmacionPropietario).toBeNull()
  })
})

describe('validarProteccion: no filtra contraseñas', () => {
  it('ningún mensaje contiene la contraseña escrita', () => {
    const clave = 'contraseña-inconfundible-9z8x'
    const resultado = validarProteccion(
      configurar({
        contrasenaUsuario: clave,
        confirmacionUsuario: 'otra cosa',
        usarPropietarioPropio: true,
        contrasenaPropietario: clave,
        confirmacionPropietario: 'distinta',
      }),
    )

    const mensajes = [
      resultado.mensajeUsuario,
      resultado.mensajeConfirmacionUsuario,
      resultado.mensajePropietario,
      resultado.mensajeConfirmacionPropietario,
    ]
      .filter((mensaje): mensaje is string => mensaje !== null)
      .join(' ')

    expect(mensajes).not.toContain(clave)
  })

  it('la configuración inicial no trae ninguna contraseña', () => {
    expect(CONFIGURACION_PREDETERMINADA.contrasenaUsuario).toBe('')
    expect(CONFIGURACION_PREDETERMINADA.confirmacionUsuario).toBe('')
    expect(CONFIGURACION_PREDETERMINADA.contrasenaPropietario).toBe('')
    expect(CONFIGURACION_PREDETERMINADA.confirmacionPropietario).toBe('')
  })
})

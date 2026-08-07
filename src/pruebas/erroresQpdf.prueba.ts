import { describe, expect, it } from 'vitest'
import {
  contieneAlguna,
  crearErrorQpdf,
  deducirCodigo,
  depurarMensaje,
  describirCodigo,
  ErrorQpdf,
} from '../seguridad/qpdf/erroresQpdf'
import type { CodigoErrorQpdf } from '../seguridad/qpdf/tipos'

/** Todos los motivos, para comprobarlos en bloque. */
const CODIGOS: readonly CodigoErrorQpdf[] = [
  'contrasena-incorrecta',
  'documento-danado',
  'no-esta-cifrado',
  'ya-esta-cifrado',
  'verificacion-fallida',
  'motor-no-disponible',
  'error-interno',
]

describe('deducirCodigo', () => {
  it('reconoce una contraseña incorrecta', () => {
    // Mensaje literal de qpdf, tomado de la auditoría del motor.
    expect(deducirCodigo(['error: qpdf: /c.pdf: invalid password'])).toBe(
      'contrasena-incorrecta',
    )
  })

  it('reconoce un documento sin tabla de referencias', () => {
    expect(deducirCodigo(["error: qpdf: /x.pdf: can't find startxref"])).toBe(
      'documento-danado',
    )
  })

  it('reconoce un documento sin cabecera PDF', () => {
    expect(deducirCodigo(["WARNING: /x.pdf: can't find PDF header"])).toBe(
      'documento-danado',
    )
  })

  it('reconoce un final de archivo inesperado', () => {
    expect(deducirCodigo(['unexpected EOF'])).toBe('documento-danado')
  })

  it('distingue la contraseña incorrecta de un documento dañado', () => {
    expect(deducirCodigo(['invalid password'])).not.toBe(
      deducirCodigo(["can't find startxref"]),
    )
  })

  it('recurre al error interno cuando no reconoce el mensaje', () => {
    expect(deducirCodigo(['algo raro ha pasado'])).toBe('error-interno')
    expect(deducirCodigo([])).toBe('error-interno')
  })

  it('no distingue mayúsculas de minúsculas', () => {
    expect(deducirCodigo(['INVALID PASSWORD'])).toBe('contrasena-incorrecta')
  })

  it('la contraseña incorrecta manda sobre otros avisos', () => {
    expect(
      deducirCodigo(['WARNING: algo menor', 'qpdf: invalid password']),
    ).toBe('contrasena-incorrecta')
  })
})

describe('depurarMensaje', () => {
  it('oculta la contraseña si apareciera en un mensaje', () => {
    const depurado = depurarMensaje(
      'qpdf: no se pudo usar secreto123',
      ['secreto123'],
    )

    expect(depurado).not.toContain('secreto123')
    expect(depurado).toContain('«contraseña oculta»')
  })

  it('oculta todas las apariciones', () => {
    const depurado = depurarMensaje('abc y otra vez abc', ['abc'])

    expect(depurado).not.toContain('abc')
  })

  it('oculta varias contraseñas a la vez', () => {
    const depurado = depurarMensaje('usuario y dueno', ['usuario', 'dueno'])

    expect(depurado).not.toContain('usuario')
    expect(depurado).not.toContain('dueno')
  })

  it('deja intacto un mensaje que no contiene ninguna', () => {
    expect(depurarMensaje('invalid password', ['secreto'])).toBe(
      'invalid password',
    )
  })

  it('ignora las cadenas vacías, que si no ocultarían todo', () => {
    expect(depurarMensaje('mensaje normal', [''])).toBe('mensaje normal')
  })

  it('tolera una lista de secretos vacía', () => {
    expect(depurarMensaje('mensaje', [])).toBe('mensaje')
  })
})

describe('contieneAlguna', () => {
  it('detecta que un texto incluye un secreto', () => {
    expect(contieneAlguna('el valor es abc', ['abc'])).toBe(true)
  })

  it('devuelve falso cuando no hay ninguna coincidencia', () => {
    expect(contieneAlguna('texto limpio', ['abc', 'xyz'])).toBe(false)
  })

  it('ignora las cadenas vacías', () => {
    expect(contieneAlguna('cualquier texto', [''])).toBe(false)
  })
})

describe('mensajes de los errores', () => {
  it('cada motivo tiene un mensaje propio en español', () => {
    const mensajes = CODIGOS.map(describirCodigo)

    expect(new Set(mensajes).size).toBe(CODIGOS.length)
  })

  it('ningún mensaje menciona contraseñas concretas ni jerga técnica', () => {
    for (const codigo of CODIGOS) {
      const mensaje = describirCodigo(codigo)

      expect(mensaje.length).toBeGreaterThan(20)
      expect(mensaje).not.toContain('qpdf')
      expect(mensaje).not.toContain('WASM')
      expect(mensaje).not.toContain('undefined')
    }
  })

  it('el error conserva su motivo', () => {
    const error = crearErrorQpdf('contrasena-incorrecta')

    expect(error).toBeInstanceOf(ErrorQpdf)
    expect(error.codigo).toBe('contrasena-incorrecta')
    expect(error.name).toBe('ErrorQpdf')
  })

  it('el mensaje de contraseña incorrecta explica qué comprobar', () => {
    expect(describirCodigo('contrasena-incorrecta')).toContain('mayúsculas')
  })

  it('el mensaje de documento sin cifrar lo dice con claridad', () => {
    expect(describirCodigo('no-esta-cifrado')).toContain('no está protegido')
  })

  it('conserva la causa original para depurar', () => {
    const causa = new Error('detalle interno')
    const error = crearErrorQpdf('error-interno', { cause: causa })

    expect(error.cause).toBe(causa)
  })
})

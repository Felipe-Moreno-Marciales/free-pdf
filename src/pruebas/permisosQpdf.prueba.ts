import { describe, expect, it } from 'vitest'
import {
  BITS_CLAVE,
  construirArgumentosCifrado,
  construirArgumentosDescifrado,
  construirArgumentosInforme,
  construirArgumentosPermisos,
  describirFuerza,
  describirImpresion,
  esAes256,
  evaluarContrasena,
  generarContrasenaPropietario,
  interpretarInformeCifrado,
  LONGITUD_ACEPTABLE,
  LONGITUD_LARGA,
  PERMISOS_PREDETERMINADOS,
  PERMISOS_TODOS,
} from '../seguridad/qpdf/permisosPdf'
import type { PermisosPdf } from '../seguridad/qpdf/tipos'

/** Construye unos permisos partiendo de los más permisivos. */
function permisos(cambios: Partial<PermisosPdf> = {}): PermisosPdf {
  return { ...PERMISOS_TODOS, ...cambios }
}

/**
 * Salida real de `qpdf --show-encryption` sobre un documento cifrado con AES-256.
 *
 * Se copió literalmente de la auditoría del motor, así que la interpretación se
 * comprueba contra lo que qpdf escribe de verdad y no contra una suposición.
 */
const INFORME_REAL: readonly string[] = [
  'R = 6',
  'P = -3100',
  'User password = ',
  'Supplied password is owner password',
  'extract for accessibility: allowed',
  'extract for any purpose: not allowed',
  'print low resolution: allowed',
  'print high resolution: not allowed',
  'modify document assembly: not allowed',
  'modify forms: allowed',
  'modify annotations: allowed',
  'modify other: not allowed',
  'modify anything: not allowed',
  'stream encryption method: AESv3',
  'string encryption method: AESv3',
  'file encryption method: AESv3',
]

describe('construirArgumentosPermisos', () => {
  it('declara los siete permisos, siempre en el mismo orden', () => {
    const argumentos = construirArgumentosPermisos(PERMISOS_TODOS)

    expect(argumentos).toHaveLength(7)
    expect(argumentos[0].startsWith('--print=')).toBe(true)
  })

  it('traduce los tres niveles de impresión', () => {
    expect(
      construirArgumentosPermisos(permisos({ impresion: 'completa' })),
    ).toContain('--print=full')
    expect(
      construirArgumentosPermisos(permisos({ impresion: 'baja' })),
    ).toContain('--print=low')
    expect(
      construirArgumentosPermisos(permisos({ impresion: 'ninguna' })),
    ).toContain('--print=none')
  })

  it('traduce los permisos concedidos como «y»', () => {
    const argumentos = construirArgumentosPermisos(PERMISOS_TODOS)

    expect(argumentos).toContain('--extract=y')
    expect(argumentos).toContain('--accessibility=y')
    expect(argumentos).toContain('--annotate=y')
    expect(argumentos).toContain('--form=y')
    expect(argumentos).toContain('--assemble=y')
    expect(argumentos).toContain('--modify-other=y')
  })

  it('traduce los permisos denegados como «n»', () => {
    const argumentos = construirArgumentosPermisos({
      impresion: 'ninguna',
      extraccion: false,
      accesibilidad: false,
      anotaciones: false,
      formularios: false,
      ensamblado: false,
      otrasModificaciones: false,
    })

    expect(argumentos).toContain('--extract=n')
    expect(argumentos).toContain('--accessibility=n')
    expect(argumentos).toContain('--annotate=n')
    expect(argumentos).toContain('--form=n')
    expect(argumentos).toContain('--assemble=n')
    expect(argumentos).toContain('--modify-other=n')
  })

  it('no usa el atajo --modify, que fijaría varios permisos a la vez', () => {
    const argumentos = construirArgumentosPermisos(PERMISOS_TODOS)

    expect(argumentos.some((a) => a === '--modify=none')).toBe(false)
    expect(argumentos.some((a) => a.startsWith('--modify='))).toBe(false)
  })

  it('los permisos recomendados conceden imprimir y accesibilidad', () => {
    expect(PERMISOS_PREDETERMINADOS.impresion).toBe('completa')
    expect(PERMISOS_PREDETERMINADOS.accesibilidad).toBe(true)
  })

  it('los permisos recomendados no conceden copiar ni modificar', () => {
    expect(PERMISOS_PREDETERMINADOS.extraccion).toBe(false)
    expect(PERMISOS_PREDETERMINADOS.otrasModificaciones).toBe(false)
  })

  it('nombra los niveles de impresión en español', () => {
    expect(describirImpresion('completa')).toBe('Permitir imprimir')
    expect(describirImpresion('baja')).toBe('Solo baja resolución')
    expect(describirImpresion('ninguna')).toBe('No permitir imprimir')
  })
})

describe('construirArgumentosCifrado', () => {
  it('usa AES de 256 bits', () => {
    const argumentos = construirArgumentosCifrado(
      '/e.pdf',
      '/s.pdf',
      'clave',
      'dueno',
      PERMISOS_TODOS,
    )

    expect(BITS_CLAVE).toBe(256)
    expect(argumentos).toContain('--bits=256')
  })

  it('no ofrece nunca RC4 ni claves cortas', () => {
    const argumentos = construirArgumentosCifrado(
      '/e.pdf',
      '/s.pdf',
      'clave',
      'dueno',
      PERMISOS_TODOS,
    ).join(' ')

    expect(argumentos).not.toContain('--bits=40')
    expect(argumentos).not.toContain('--bits=128')
    expect(argumentos.toLowerCase()).not.toContain('rc4')
  })

  it('termina las opciones de cifrado con --, como exige qpdf', () => {
    const argumentos = construirArgumentosCifrado(
      '/e.pdf',
      '/s.pdf',
      'clave',
      'dueno',
      PERMISOS_TODOS,
    )
    const separador = argumentos.indexOf('--')

    expect(separador).toBeGreaterThan(0)
    expect(argumentos.slice(separador + 1)).toEqual(['/e.pdf', '/s.pdf'])
  })

  it('no usa --allow-insecure, que debilitaría la protección', () => {
    expect(
      construirArgumentosCifrado(
        '/e.pdf',
        '/s.pdf',
        'clave',
        'dueno',
        PERMISOS_TODOS,
      ),
    ).not.toContain('--allow-insecure')
  })

  it('incluye las dos contraseñas, que qpdf exige en los argumentos al cifrar', () => {
    const argumentos = construirArgumentosCifrado(
      '/e.pdf',
      '/s.pdf',
      'abre',
      'dueno',
      PERMISOS_TODOS,
    )

    expect(argumentos).toContain('--user-password=abre')
    expect(argumentos).toContain('--owner-password=dueno')
  })
})

describe('construirArgumentosDescifrado', () => {
  it('lee la contraseña de un archivo, no de los argumentos', () => {
    const argumentos = construirArgumentosDescifrado(
      '/c.pdf',
      '/s.pdf',
      '/clave',
    )

    expect(argumentos).toContain('--password-file=/clave')
    expect(argumentos.join(' ')).not.toContain('--password=')
  })

  it('pide el descifrado y las dos rutas', () => {
    expect(
      construirArgumentosDescifrado('/c.pdf', '/s.pdf', '/clave'),
    ).toEqual(['--password-file=/clave', '--decrypt', '/c.pdf', '/s.pdf'])
  })
})

describe('construirArgumentosInforme', () => {
  it('sin contraseña pide solo el informe', () => {
    expect(construirArgumentosInforme('/c.pdf', null)).toEqual([
      '--show-encryption',
      '/c.pdf',
    ])
  })

  it('con contraseña la lee de un archivo', () => {
    expect(construirArgumentosInforme('/c.pdf', '/clave')).toEqual([
      '--password-file=/clave',
      '--show-encryption',
      '/c.pdf',
    ])
  })
})

describe('interpretarInformeCifrado', () => {
  it('reconoce un documento sin cifrar', () => {
    const informe = interpretarInformeCifrado(['File is not encrypted'])

    expect(informe.cifrado).toBe(false)
    expect(informe.revision).toBeNull()
    expect(informe.metodo).toBeNull()
  })

  it('reconoce un documento cifrado y su revisión', () => {
    const informe = interpretarInformeCifrado(INFORME_REAL)

    expect(informe.cifrado).toBe(true)
    expect(informe.revision).toBe(6)
    expect(informe.metodo).toBe('AESv3')
  })

  it('lee los permisos concedidos y denegados', () => {
    const informe = interpretarInformeCifrado(INFORME_REAL)

    expect(informe.permisos['extract for accessibility']).toBe(true)
    expect(informe.permisos['extract for any purpose']).toBe(false)
    expect(informe.permisos['print low resolution']).toBe(true)
    expect(informe.permisos['print high resolution']).toBe(false)
    expect(informe.permisos['modify forms']).toBe(true)
    expect(informe.permisos['modify other']).toBe(false)
  })

  it('trata una salida vacía como documento sin cifrar', () => {
    expect(interpretarInformeCifrado([]).cifrado).toBe(false)
  })

  it('trata una salida sin datos de cifrado como documento sin cifrar', () => {
    expect(
      interpretarInformeCifrado(['algo que no viene a cuento']).cifrado,
    ).toBe(false)
  })
})

describe('esAes256', () => {
  it('acepta la revisión 6 con AESv3', () => {
    expect(esAes256(interpretarInformeCifrado(INFORME_REAL))).toBe(true)
  })

  it('rechaza un documento sin cifrar', () => {
    expect(esAes256(interpretarInformeCifrado(['File is not encrypted']))).toBe(
      false,
    )
  })

  it('rechaza una revisión anterior', () => {
    const informe = interpretarInformeCifrado([
      'R = 4',
      'stream encryption method: RC4',
    ])

    expect(esAes256(informe)).toBe(false)
  })

  it('rechaza un método que no sea AESv3', () => {
    const informe = interpretarInformeCifrado([
      'R = 6',
      'stream encryption method: RC4',
    ])

    expect(esAes256(informe)).toBe(false)
  })
})

describe('generarContrasenaPropietario', () => {
  it('genera una contraseña larga', () => {
    // 32 bytes en hexadecimal son 64 caracteres.
    expect(generarContrasenaPropietario()).toHaveLength(64)
  })

  it('genera una contraseña distinta cada vez', () => {
    const generadas = new Set(
      Array.from({ length: 20 }, () => generarContrasenaPropietario()),
    )

    expect(generadas.size).toBe(20)
  })

  it('solo usa dígitos hexadecimales', () => {
    expect(generarContrasenaPropietario()).toMatch(/^[0-9a-f]+$/)
  })
})

describe('evaluarContrasena', () => {
  it('detecta una contraseña vacía', () => {
    expect(evaluarContrasena('')).toBe('vacia')
  })

  it('detecta una contraseña corta', () => {
    expect(evaluarContrasena('abc')).toBe('corta')
    expect(evaluarContrasena('a'.repeat(LONGITUD_ACEPTABLE - 1))).toBe('corta')
  })

  it('acepta una contraseña de longitud razonable', () => {
    expect(evaluarContrasena('a'.repeat(LONGITUD_ACEPTABLE))).toBe('aceptable')
  })

  it('reconoce una contraseña larga', () => {
    expect(evaluarContrasena('a'.repeat(LONGITUD_LARGA))).toBe('larga')
  })

  it('no exige mayúsculas, dígitos ni símbolos', () => {
    // Una frase larga en minúsculas es una buena contraseña y debe aceptarse.
    expect(evaluarContrasena('caballo correcto bateria grapa')).toBe('larga')
  })

  it('describe cada fuerza en español', () => {
    const descripciones = (
      ['vacia', 'corta', 'aceptable', 'larga'] as const
    ).map(describirFuerza)

    expect(new Set(descripciones).size).toBe(4)
    for (const descripcion of descripciones) {
      expect(descripcion.length).toBeGreaterThan(10)
    }
  })
})

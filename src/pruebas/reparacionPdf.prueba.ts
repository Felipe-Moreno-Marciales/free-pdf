import { describe, expect, it } from 'vitest'
import {
  clasificarMensaje,
  construirArgumentosComprobacion,
  construirArgumentosRecuentoPaginas,
  construirArgumentosReparacion,
  describirClaseHallazgo,
  describirEstado,
  describirNivel,
  esMensajeUtil,
  explicarEstado,
  explicarNivel,
  explicarResultado,
  interpretarComprobacion,
  laReparacionSirve,
  NOMBRE_REPARADO,
  reunirHallazgos,
  type DiagnosticoPdf,
  type EstadoDocumento,
  type ResumenReparacion,
} from '../seguridad/qpdf/reparacionPdf'

/** Mensajes reales que qpdf escribe con un documento sano. */
const SALIDA_SANA: readonly string[] = [
  'checking /entrada.pdf',
  'PDF Version: 1.7',
  'File is not linearized',
  'No syntax or stream encoding errors found; the file may still contain',
  'errors that qpdf cannot detect',
]

/** Mensajes que qpdf escribe con la tabla de referencias destruida. */
const SALIDA_DANADA: readonly string[] = [
  'checking /entrada.pdf',
  'WARNING: /entrada.pdf: can\'t find startxref',
  'WARNING: /entrada.pdf: Attempting to reconstruct cross-reference table',
  'PDF Version: 1.7',
]

/** Un diagnóstico mínimo, para componer resúmenes en las pruebas. */
function diagnostico(cambios: Partial<DiagnosticoPdf> = {}): DiagnosticoPdf {
  return {
    estado: 'intacto',
    hallazgos: [],
    reconstruyoReferencias: false,
    necesitaContrasena: false,
    ...cambios,
  }
}

/** Un resumen de reparación, para probar las explicaciones. */
function resumen(cambios: Partial<ResumenReparacion> = {}): ResumenReparacion {
  return {
    diagnosticoPrevio: diagnostico(),
    diagnosticoFinal: diagnostico(),
    paginasAntes: 5,
    paginasDespues: 5,
    ...cambios,
  }
}

describe('construirArgumentosComprobacion', () => {
  it('usa --check, que recorre el archivo entero', () => {
    expect(construirArgumentosComprobacion('/entrada.pdf')).toEqual([
      '--check',
      '/entrada.pdf',
    ])
  })

  it('no escribe ninguna salida: comprobar no debe modificar nada', () => {
    const argumentos = construirArgumentosComprobacion('/entrada.pdf')

    expect(argumentos).not.toContain('/salida.pdf')
    expect(argumentos.filter((valor) => valor.endsWith('.pdf'))).toHaveLength(1)
  })

  it('no usa --is-encrypted ni --requires-password, cuyos códigos se confunden con errores', () => {
    const argumentos = construirArgumentosComprobacion('/entrada.pdf').join(' ')

    expect(argumentos).not.toContain('--is-encrypted')
    expect(argumentos).not.toContain('--requires-password')
  })
})

describe('construirArgumentosReparacion', () => {
  it('pasa entrada y salida, que es lo que hace que qpdf reescriba el archivo', () => {
    const argumentos = construirArgumentosReparacion(
      '/entrada.pdf',
      '/salida.pdf',
    )

    expect(argumentos[0]).toBe('/entrada.pdf')
    expect(argumentos[1]).toBe('/salida.pdf')
  })

  it('en el nivel conservador no recomprime los flujos', () => {
    const argumentos = construirArgumentosReparacion(
      '/entrada.pdf',
      '/salida.pdf',
      'conservador',
    )

    expect(argumentos).toContain('--stream-data=preserve')
    expect(argumentos).not.toContain('--object-streams=generate')
  })

  it('en el nivel completo regenera los flujos de objetos', () => {
    const argumentos = construirArgumentosReparacion(
      '/entrada.pdf',
      '/salida.pdf',
      'completo',
    )

    expect(argumentos).toContain('--object-streams=generate')
    expect(argumentos).not.toContain('--stream-data=preserve')
  })

  it('el nivel conservador es el de partida', () => {
    expect(
      construirArgumentosReparacion('/entrada.pdf', '/salida.pdf'),
    ).toEqual(
      construirArgumentosReparacion(
        '/entrada.pdf',
        '/salida.pdf',
        'conservador',
      ),
    )
  })

  it('nunca usa --replace-input, que sobrescribiría el original', () => {
    for (const nivel of ['conservador', 'completo'] as const) {
      expect(
        construirArgumentosReparacion('/entrada.pdf', '/salida.pdf', nivel),
      ).not.toContain('--replace-input')
    }
  })

  it('no cifra ni descifra nada al reparar', () => {
    const argumentos = construirArgumentosReparacion(
      '/entrada.pdf',
      '/salida.pdf',
      'completo',
    ).join(' ')

    expect(argumentos).not.toContain('--encrypt')
    expect(argumentos).not.toContain('--decrypt')
    expect(argumentos).not.toContain('--password')
  })
})

describe('construirArgumentosRecuentoPaginas', () => {
  it('pide el número de páginas sin escribir nada', () => {
    expect(construirArgumentosRecuentoPaginas('/entrada.pdf')).toEqual([
      '--show-npages',
      '/entrada.pdf',
    ])
  })
})

describe('esMensajeUtil', () => {
  it('descarta las líneas que qpdf escribe siempre', () => {
    expect(esMensajeUtil('checking /entrada.pdf')).toBe(false)
    expect(esMensajeUtil('PDF Version: 1.7')).toBe(false)
    expect(esMensajeUtil('File is not linearized')).toBe(false)
    expect(
      esMensajeUtil('No syntax or stream encoding errors found'),
    ).toBe(false)
  })

  it('descarta las líneas vacías', () => {
    expect(esMensajeUtil('')).toBe(false)
    expect(esMensajeUtil('   \n ')).toBe(false)
  })

  it('conserva las advertencias de verdad', () => {
    expect(
      esMensajeUtil('WARNING: Attempting to reconstruct cross-reference table'),
    ).toBe(true)
    expect(esMensajeUtil("can't find startxref")).toBe(true)
  })
})

describe('clasificarMensaje', () => {
  it('reconoce los problemas de referencias cruzadas', () => {
    expect(
      clasificarMensaje('Attempting to reconstruct cross-reference table'),
    ).toBe('referencias-cruzadas')
    expect(clasificarMensaje("can't find startxref")).toBe(
      'referencias-cruzadas',
    )
    expect(clasificarMensaje('file is damaged')).toBe('referencias-cruzadas')
  })

  it('reconoce los objetos dañados', () => {
    expect(clasificarMensaje('expected dictionary key')).toBe('objeto-danado')
    expect(clasificarMensaje('dangling reference to object 5')).toBe(
      'objeto-danado',
    )
  })

  it('reconoce los flujos dañados', () => {
    expect(clasificarMensaje('stream length is incorrect')).toBe(
      'flujo-danado',
    )
    expect(clasificarMensaje('inflate: data error')).toBe('flujo-danado')
  })

  it('reconoce los problemas de estructura', () => {
    expect(clasificarMensaje('not a pdf file')).toBe('estructura')
    expect(clasificarMensaje('trailer is missing /Root')).toBe('estructura')
  })

  it('reconoce el cifrado', () => {
    expect(clasificarMensaje('invalid password')).toBe('cifrado')
  })

  it('deja como «otra» lo que no encaja en ninguna categoría', () => {
    expect(clasificarMensaje('algo completamente inesperado')).toBe('otra')
  })

  it('no distingue mayúsculas de minúsculas', () => {
    expect(clasificarMensaje('RECONSTRUCT CROSS-REFERENCE')).toBe(
      'referencias-cruzadas',
    )
  })
})

describe('reunirHallazgos', () => {
  it('no repite el mismo mensaje dos veces', () => {
    const hallazgos = reunirHallazgos([
      'stream length is incorrect',
      'stream length is incorrect',
      'inflate: data error',
    ])

    expect(hallazgos).toHaveLength(2)
  })

  it('trata como iguales los mensajes que solo difieren en mayúsculas o espacios', () => {
    const hallazgos = reunirHallazgos([
      'Stream Length Is Incorrect',
      '  stream length is incorrect  ',
    ])

    expect(hallazgos).toHaveLength(1)
  })

  it('clasifica cada hallazgo', () => {
    const hallazgos = reunirHallazgos([
      "can't find startxref",
      'not a pdf file',
    ])

    expect(hallazgos[0]?.clase).toBe('referencias-cruzadas')
    expect(hallazgos[1]?.clase).toBe('estructura')
  })
})

describe('interpretarComprobacion', () => {
  it('un documento sano queda como intacto y sin hallazgos', () => {
    const resultado = interpretarComprobacion(0, SALIDA_SANA)

    expect(resultado.estado).toBe<EstadoDocumento>('intacto')
    expect(resultado.hallazgos).toHaveLength(0)
    expect(resultado.reconstruyoReferencias).toBe(false)
    expect(resultado.necesitaContrasena).toBe(false)
  })

  it('detecta que qpdf reconstruyó las referencias cruzadas', () => {
    const resultado = interpretarComprobacion(3, SALIDA_DANADA)

    expect(resultado.reconstruyoReferencias).toBe(true)
    expect(resultado.estado).toBe<EstadoDocumento>('danado')
  })

  it('el código 3 con avisos que no son de estructura queda en «con advertencias»', () => {
    const resultado = interpretarComprobacion(3, [
      'WARNING: stream length is incorrect',
    ])

    expect(resultado.estado).toBe<EstadoDocumento>('con-advertencias')
    expect(resultado.reconstruyoReferencias).toBe(false)
  })

  it('el código 2 sin nada legible es irrecuperable', () => {
    const resultado = interpretarComprobacion(2, SALIDA_SANA)

    // Los mensajes de ruido no cuentan como hallazgos, así que no hay nada legible.
    expect(resultado.estado).toBe<EstadoDocumento>('irrecuperable')
  })

  it('el código 2 con hallazgos es dañado, no irrecuperable', () => {
    const resultado = interpretarComprobacion(2, [
      'WARNING: dangling reference to object 7',
    ])

    expect(resultado.estado).toBe<EstadoDocumento>('danado')
  })

  it('detecta que hace falta una contraseña', () => {
    const resultado = interpretarComprobacion(2, [
      'entrada.pdf: invalid password',
    ])

    expect(resultado.necesitaContrasena).toBe(true)
  })

  it('un documento cifrado se reconoce por el aviso de qpdf', () => {
    const resultado = interpretarComprobacion(0, [
      'WARNING: file is encrypted',
    ])

    expect(resultado.necesitaContrasena).toBe(true)
  })

  it('no cuenta el ruido como irregularidades', () => {
    const resultado = interpretarComprobacion(0, [
      'checking archivo',
      'PDF Version: 1.4',
      'File is linearized',
    ])

    expect(resultado.hallazgos).toHaveLength(0)
    expect(resultado.estado).toBe<EstadoDocumento>('intacto')
  })
})

describe('laReparacionSirve', () => {
  it('acepta una reparación que conserva las páginas', () => {
    expect(laReparacionSirve(resumen())).toBe(true)
  })

  it('acepta una reparación que pierde páginas pero conserva alguna', () => {
    expect(
      laReparacionSirve(resumen({ paginasAntes: 10, paginasDespues: 3 })),
    ).toBe(true)
  })

  it('rechaza un resultado sin ninguna página: eso no es una reparación', () => {
    expect(laReparacionSirve(resumen({ paginasDespues: 0 }))).toBe(false)
  })

  it('rechaza un recuento negativo, que no debería ocurrir nunca', () => {
    expect(laReparacionSirve(resumen({ paginasDespues: -1 }))).toBe(false)
  })

  it('rechaza un resultado que sigue siendo irrecuperable', () => {
    expect(
      laReparacionSirve(
        resumen({ diagnosticoFinal: diagnostico({ estado: 'irrecuperable' }) }),
      ),
    ).toBe(false)
  })
})

describe('explicarResultado', () => {
  it('dice cuántas páginas tiene el resultado', () => {
    expect(explicarResultado(resumen({ paginasDespues: 7 }))).toContain(
      '7 páginas',
    )
  })

  it('usa el singular con una sola página', () => {
    const texto = explicarResultado(
      resumen({ paginasAntes: 1, paginasDespues: 1 }),
    )

    expect(texto).toContain('1 página.')
  })

  it('confirma explícitamente cuando no se pierde nada', () => {
    expect(explicarResultado(resumen())).toMatch(/todas las páginas/i)
  })

  it('dice cuántas páginas se perdieron, con el número exacto', () => {
    const texto = explicarResultado(
      resumen({ paginasAntes: 10, paginasDespues: 4 }),
    )

    expect(texto).toContain('10')
    expect(texto).toMatch(/6 no se pudieron recuperar/i)
  })

  it('usa el singular al perder una sola página', () => {
    const texto = explicarResultado(
      resumen({ paginasAntes: 5, paginasDespues: 4 }),
    )

    expect(texto).toMatch(/1 no se pudo recuperar/i)
  })

  it('no dice que se pierden páginas cuando el resultado tiene más', () => {
    const texto = explicarResultado(
      resumen({ paginasAntes: 3, paginasDespues: 4 }),
    )

    expect(texto).not.toMatch(/no se pudieron recuperar/i)
  })

  it('avisa cuando no se pudo contar las páginas del original', () => {
    const texto = explicarResultado(
      resumen({ paginasAntes: null, paginasDespues: 2 }),
    )

    expect(texto).toMatch(/no se pudo contar/i)
  })

  it('menciona la reconstrucción de las referencias cuando la hubo', () => {
    const texto = explicarResultado(
      resumen({
        diagnosticoPrevio: diagnostico({ reconstruyoReferencias: true }),
      }),
    )

    expect(texto).toMatch(/referencias cruzadas/i)
  })

  it('informa de las irregularidades que quedan sin corregir', () => {
    const texto = explicarResultado(
      resumen({
        diagnosticoFinal: diagnostico({
          estado: 'con-advertencias',
          hallazgos: [{ clase: 'flujo-danado', mensaje: 'stream length' }],
        }),
      }),
    )

    expect(texto).toMatch(/1 irregularidad/i)
  })

  it('confirma cuando la comprobación posterior sale limpia', () => {
    expect(explicarResultado(resumen())).toMatch(/no encuentra ningún error/i)
  })
})

describe('descripciones para la interfaz', () => {
  it('describe los cuatro estados', () => {
    const estados: readonly EstadoDocumento[] = [
      'intacto',
      'con-advertencias',
      'danado',
      'irrecuperable',
    ]

    for (const estado of estados) {
      expect(describirEstado(estado).length).toBeGreaterThan(0)
      expect(explicarEstado(estado).length).toBeGreaterThan(0)
    }
  })

  it('explica que un documento intacto no gana nada con la reparación', () => {
    expect(explicarEstado('intacto')).toMatch(/no va a mejorar/i)
  })

  it('deja claro que de un archivo irrecuperable no se saca nada', () => {
    expect(explicarEstado('irrecuperable')).toMatch(/no hay nada que se pueda recuperar/i)
  })

  it('describe los dos niveles y recomienda el conservador para archivos dañados', () => {
    expect(describirNivel('conservador')).toBe('Conservadora')
    expect(describirNivel('completo')).toBe('Completa')
    expect(explicarNivel('conservador')).toMatch(/recomendada/i)
  })

  it('describe todas las clases de hallazgo', () => {
    const clases = [
      'referencias-cruzadas',
      'objeto-danado',
      'flujo-danado',
      'paginas',
      'cifrado',
      'estructura',
      'otra',
    ] as const

    for (const clase of clases) {
      expect(describirClaseHallazgo(clase).length).toBeGreaterThan(0)
    }
  })

  it('el documento reparado se llama free-pdf-reparado.pdf', () => {
    expect(NOMBRE_REPARADO).toBe('free-pdf-reparado.pdf')
  })
})

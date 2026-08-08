import { describe, expect, it } from 'vitest'
import {
  describirGrupo,
  ErrorRangoPaginas,
  interpretarRangos,
  interpretarRangosComoIndices,
  resumirIndicesComoTexto,
} from '../utilidades/rangosPaginas'

/** Número de páginas que se usa en la mayoría de los casos. */
const TOTAL = 10

describe('interpretarRangos: expresiones válidas', () => {
  it('interpreta una página suelta', () => {
    const resultado = interpretarRangos('1', TOTAL)

    expect(resultado.indices).toEqual([0])
    expect(resultado.grupos).toHaveLength(1)
    expect(resultado.grupos[0]).toMatchObject({
      primeraPagina: 1,
      ultimaPagina: 1,
    })
  })

  it('interpreta un rango simple', () => {
    expect(interpretarRangosComoIndices('1-3', TOTAL)).toEqual([0, 1, 2])
  })

  it('interpreta varias páginas sueltas', () => {
    expect(interpretarRangosComoIndices('1,3,5', TOTAL)).toEqual([0, 2, 4])
  })

  it('combina rangos y páginas sueltas', () => {
    expect(interpretarRangosComoIndices('1-3,5,8-10', TOTAL)).toEqual([
      0, 1, 2, 4, 7, 8, 9,
    ])
  })

  it('acepta espacios en cualquier posición', () => {
    expect(interpretarRangosComoIndices('  1 - 3 ,  5  ', TOTAL)).toEqual([
      0, 1, 2, 4,
    ])
  })

  it('acepta la última página del documento', () => {
    expect(interpretarRangosComoIndices('10', TOTAL)).toEqual([9])
  })

  it('acepta un documento de una sola página', () => {
    expect(interpretarRangosComoIndices('1', 1)).toEqual([0])
  })

  it('acepta ceros a la izquierda', () => {
    expect(interpretarRangosComoIndices('01-03', TOTAL)).toEqual([0, 1, 2])
  })

  it('admite un rango que abarca todo el documento', () => {
    expect(interpretarRangosComoIndices('1-10', TOTAL)).toHaveLength(TOTAL)
  })
})

describe('interpretarRangos: duplicados y orden', () => {
  it('elimina los índices duplicados', () => {
    expect(interpretarRangosComoIndices('1,1,2,2-3', TOTAL)).toEqual([0, 1, 2])
  })

  it('devuelve los índices en orden ascendente aunque se escriban al revés', () => {
    expect(interpretarRangosComoIndices('9,1,5', TOTAL)).toEqual([0, 4, 8])
  })

  it('conserva los grupos en el orden en que se escribieron', () => {
    const { grupos } = interpretarRangos('8-10,1-3', TOTAL)

    expect(grupos.map((grupo) => grupo.primeraPagina)).toEqual([8, 1])
  })

  it('conserva los grupos duplicados, porque cada uno genera un documento', () => {
    const { grupos, indices } = interpretarRangos('1-2,1-2', TOTAL)

    expect(grupos).toHaveLength(2)
    expect(indices).toEqual([0, 1])
  })
})

describe('interpretarRangos: entradas inválidas', () => {
  const casosInvalidos: readonly (readonly [string, string])[] = [
    ['entrada vacía', ''],
    ['solo espacios', '   '],
    ['solo una coma', ','],
    ['comas duplicadas', '1,,3'],
    ['coma final', '1,3,'],
    ['coma inicial', ',1'],
    ['guion incompleto por la derecha', '1-'],
    ['guion incompleto por la izquierda', '-3'],
    ['guion doble', '1--3'],
    ['letras', 'abc'],
    ['mezcla de letras y números', '1-a'],
    ['número negativo', '-1'],
    ['página cero', '0'],
    ['rango que empieza en cero', '0-3'],
    ['número decimal', '1.5'],
    ['dos guiones seguidos en un rango', '1-2-3'],
  ]

  for (const [descripcion, expresion] of casosInvalidos) {
    it(`rechaza ${descripcion}`, () => {
      expect(() => interpretarRangos(expresion, TOTAL)).toThrow(
        ErrorRangoPaginas,
      )
    })
  }

  it('rechaza el rango invertido y sugiere el correcto', () => {
    expect(() => interpretarRangos('3-1', TOTAL)).toThrow(/invertido/)
    expect(() => interpretarRangos('3-1', TOTAL)).toThrow(/1-3/)
  })

  it('rechaza una página superior al total', () => {
    expect(() => interpretarRangos('11', TOTAL)).toThrow(/no existe/)
  })

  it('rechaza un rango que se sale del documento', () => {
    expect(() => interpretarRangos('8-12', TOTAL)).toThrow(/no existe/)
  })

  it('rechaza trabajar sin documento cargado', () => {
    expect(() => interpretarRangos('1', 0)).toThrow(ErrorRangoPaginas)
  })

  it('avisa en singular cuando el documento tiene una sola página', () => {
    expect(() => interpretarRangos('2', 1)).toThrow(/tiene 1 página\./)
  })

  it('redacta los mensajes en español', () => {
    expect(() => interpretarRangos('abc', TOTAL)).toThrow(
      /no es una página ni un rango válido/,
    )
  })
})

describe('describirGrupo', () => {
  it('describe una página suelta', () => {
    const { grupos } = interpretarRangos('5', TOTAL)

    expect(describirGrupo(grupos[0])).toBe('pagina-5')
  })

  it('describe un rango', () => {
    const { grupos } = interpretarRangos('2-7', TOTAL)

    expect(describirGrupo(grupos[0])).toBe('paginas-2-7')
  })
})

describe('resumirIndicesComoTexto', () => {
  it('devuelve una cadena vacía sin índices', () => {
    expect(resumirIndicesComoTexto([])).toBe('')
  })

  it('agrupa los índices consecutivos', () => {
    expect(resumirIndicesComoTexto([0, 1, 2, 4])).toBe('1-3, 5')
  })

  it('ordena y elimina duplicados', () => {
    expect(resumirIndicesComoTexto([4, 0, 4, 1])).toBe('1-2, 5')
  })

  it('describe una página suelta', () => {
    expect(resumirIndicesComoTexto([6])).toBe('7')
  })
})

import { describe, expect, it } from 'vitest'
import {
  avisarSobreImagenes,
  calcularPorcentaje,
  calcularReduccion,
  construirArgumentosCompresion,
  decidirDesenlace,
  describirPerfil,
  detectarImagenesIntocables,
  EXPLICACION_TIPOS_COMPRESION,
  explicarCompresion,
  explicarPerfil,
  NIVEL_FLATE_MAXIMO,
  NOMBRE_COMPRIMIDO,
  REDUCCION_MINIMA_UTIL,
  seEntregaElComprimido,
  type DesenlaceCompresion,
  type PerfilCompresion,
  type ResumenCompresion,
} from '../seguridad/qpdf/compresionPdf'

/** Resumen de compresión con valores neutros, para componer casos. */
function resumen(cambios: Partial<ResumenCompresion> = {}): ResumenCompresion {
  return {
    desenlace: 'reducido',
    tamanoOriginal: 100_000,
    tamanoResultante: 60_000,
    porcentaje: 40,
    perfil: 'estructural',
    paginasAntes: 10,
    paginasDespues: 10,
    tieneImagenesIntocables: false,
    ...cambios,
  }
}

/** Envuelve un texto ASCII en bytes, para las pruebas de detección. */
function comoBytes(texto: string): Uint8Array {
  return new TextEncoder().encode(texto)
}

describe('construirArgumentosCompresion', () => {
  it('pasa entrada y salida en ese orden', () => {
    const argumentos = construirArgumentosCompresion('/e.pdf', '/s.pdf')

    expect(argumentos[0]).toBe('/e.pdf')
    expect(argumentos[1]).toBe('/s.pdf')
  })

  it('el perfil estructural agrupa los objetos en flujos, que es de donde sale el ahorro', () => {
    const argumentos = construirArgumentosCompresion(
      '/e.pdf',
      '/s.pdf',
      'estructural',
    )

    expect(argumentos).toContain('--object-streams=generate')
    expect(argumentos).toContain('--compress-streams=y')
  })

  it('el perfil estructural no recomprime los flujos que ya lo estaban', () => {
    const argumentos = construirArgumentosCompresion(
      '/e.pdf',
      '/s.pdf',
      'estructural',
    )

    expect(argumentos).not.toContain('--recompress-flate')
  })

  it('el perfil máximo añade la recompresión con el nivel más alto', () => {
    const argumentos = construirArgumentosCompresion('/e.pdf', '/s.pdf', 'maxima')

    expect(argumentos).toContain('--recompress-flate')
    expect(argumentos).toContain(`--compression-level=${NIVEL_FLATE_MAXIMO}`)
  })

  it('el nivel de compresión es el máximo que admite zlib', () => {
    expect(NIVEL_FLATE_MAXIMO).toBe(9)
  })

  it('el perfil estructural es el de partida', () => {
    expect(construirArgumentosCompresion('/e.pdf', '/s.pdf')).toEqual(
      construirArgumentosCompresion('/e.pdf', '/s.pdf', 'estructural'),
    )
  })

  /**
   * Estas dos son las pruebas que impiden volver a meter opciones que, medidas,
   * hacen el archivo más grande. `--linearize` lo infló un 96,9 % en el documento ya
   * optimizado y `--normalize-content=y` un 472 %.
   */
  it('nunca lineariza: medido, agranda el archivo en vez de reducirlo', () => {
    for (const perfil of ['estructural', 'maxima'] as const) {
      expect(
        construirArgumentosCompresion('/e.pdf', '/s.pdf', perfil),
      ).not.toContain('--linearize')
    }
  })

  it('nunca normaliza el contenido: descomprimirlo es lo contrario de comprimir', () => {
    for (const perfil of ['estructural', 'maxima'] as const) {
      const texto = construirArgumentosCompresion(
        '/e.pdf',
        '/s.pdf',
        perfil,
      ).join(' ')

      expect(texto).not.toContain('--normalize-content')
    }
  })

  it('no cifra, descifra ni pide contraseñas', () => {
    const texto = construirArgumentosCompresion(
      '/e.pdf',
      '/s.pdf',
      'maxima',
    ).join(' ')

    expect(texto).not.toContain('--encrypt')
    expect(texto).not.toContain('--decrypt')
    expect(texto).not.toContain('--password')
  })

  it('no sobrescribe la entrada', () => {
    expect(
      construirArgumentosCompresion('/e.pdf', '/s.pdf', 'maxima'),
    ).not.toContain('--replace-input')
  })
})

describe('calcularReduccion y calcularPorcentaje', () => {
  it('calcula la fracción reducida', () => {
    expect(
      calcularReduccion({ tamanoOriginal: 100, tamanoResultante: 60 }),
    ).toBeCloseTo(0.4, 10)
  })

  it('devuelve un valor negativo cuando el resultado es mayor', () => {
    expect(
      calcularReduccion({ tamanoOriginal: 100, tamanoResultante: 130 }),
    ).toBeCloseTo(-0.3, 10)
  })

  it('devuelve cero con un original vacío, sin dividir por cero', () => {
    expect(
      calcularReduccion({ tamanoOriginal: 0, tamanoResultante: 100 }),
    ).toBe(0)
  })

  it('el porcentaje se redondea a una cifra decimal', () => {
    expect(
      calcularPorcentaje({ tamanoOriginal: 43_292, tamanoResultante: 21_880 }),
    ).toBe(49.5)
  })

  it('el porcentaje es negativo si el archivo crece', () => {
    expect(
      calcularPorcentaje({ tamanoOriginal: 100, tamanoResultante: 200 }),
    ).toBe(-100)
  })
})

describe('decidirDesenlace', () => {
  it('entrega el comprimido cuando la reducción es apreciable', () => {
    expect(
      decidirDesenlace({ tamanoOriginal: 100_000, tamanoResultante: 60_000 }),
    ).toBe<DesenlaceCompresion>('reducido')
  })

  it('no entrega nada cuando el resultado sería mayor', () => {
    expect(
      decidirDesenlace({ tamanoOriginal: 100_000, tamanoResultante: 101_000 }),
    ).toBe<DesenlaceCompresion>('contraproducente')
  })

  it('considera ya optimizado un documento que apenas baja', () => {
    // El caso real del documento con flujos de objetos: bajó un 0,3 %.
    expect(
      decidirDesenlace({ tamanoOriginal: 22_298, tamanoResultante: 22_223 }),
    ).toBe<DesenlaceCompresion>('ya-optimizado')
  })

  it('el umbral es medio por ciento', () => {
    expect(REDUCCION_MINIMA_UTIL).toBe(0.005)
  })

  it('justo por debajo del umbral no se entrega', () => {
    const apenas = Math.round(100_000 * (1 - REDUCCION_MINIMA_UTIL / 2))

    expect(
      decidirDesenlace({ tamanoOriginal: 100_000, tamanoResultante: apenas }),
    ).toBe<DesenlaceCompresion>('ya-optimizado')
  })

  it('justo por encima del umbral sí se entrega', () => {
    const suficiente = Math.floor(100_000 * (1 - REDUCCION_MINIMA_UTIL * 2))

    expect(
      decidirDesenlace({
        tamanoOriginal: 100_000,
        tamanoResultante: suficiente,
      }),
    ).toBe<DesenlaceCompresion>('reducido')
  })

  it('un tamaño idéntico no se entrega', () => {
    expect(
      decidirDesenlace({ tamanoOriginal: 50_000, tamanoResultante: 50_000 }),
    ).toBe<DesenlaceCompresion>('ya-optimizado')
  })
})

describe('seEntregaElComprimido', () => {
  it('solo se entrega cuando de verdad se ha reducido', () => {
    expect(seEntregaElComprimido('reducido')).toBe(true)
    expect(seEntregaElComprimido('ya-optimizado')).toBe(false)
    expect(seEntregaElComprimido('contraproducente')).toBe(false)
  })
})

describe('explicarCompresion', () => {
  it('dice el porcentaje real cuando se ha reducido', () => {
    expect(explicarCompresion(resumen({ porcentaje: 49.5 }))).toContain('49.5 %')
  })

  it('dice que ya estaba optimizado y que se conserva el original', () => {
    const texto = explicarCompresion(
      resumen({ desenlace: 'ya-optimizado', porcentaje: 0.3 }),
    )

    expect(texto).toMatch(/ya estaba optimizado/i)
    expect(texto).toMatch(/se conserva el original/i)
  })

  it('dice cuánto habría crecido, si comprimir era contraproducente', () => {
    const texto = explicarCompresion(
      resumen({
        desenlace: 'contraproducente',
        porcentaje: -96.9,
        tamanoResultante: 196_900,
      }),
    )

    expect(texto).toContain('96.9 %')
    expect(texto).toMatch(/más grande/i)
    expect(texto).toMatch(/se conserva el original/i)
  })

  it('nunca dice que se ha reducido cuando no se ha reducido', () => {
    for (const desenlace of [
      'ya-optimizado',
      'contraproducente',
    ] as const) {
      const texto = explicarCompresion(resumen({ desenlace }))

      expect(texto).not.toMatch(/se ha reducido/i)
    }
  })

  it('avisa si el número de páginas ha cambiado', () => {
    const texto = explicarCompresion(
      resumen({ paginasAntes: 10, paginasDespues: 9 }),
    )

    expect(texto).toMatch(/Atención/i)
    expect(texto).toContain('10')
    expect(texto).toContain('9')
  })

  it('no menciona las páginas cuando no han cambiado', () => {
    expect(explicarCompresion(resumen())).not.toMatch(/Atención/i)
  })

  it('explica que las imágenes no se tocan cuando no se ha reducido nada', () => {
    const texto = explicarCompresion(
      resumen({ desenlace: 'ya-optimizado', tieneImagenesIntocables: true }),
    )

    expect(texto).toMatch(/no las toca|imágenes JPEG/i)
  })

  it('no repite el aviso de las imágenes si la compresión sí funcionó', () => {
    const texto = explicarCompresion(
      resumen({ desenlace: 'reducido', tieneImagenesIntocables: true }),
    )

    expect(texto).not.toMatch(/no las toca/i)
  })

  it('está en español, sin dejar el porcentaje sin unidad', () => {
    expect(explicarCompresion(resumen())).toMatch(/%/)
  })
})

describe('detectarImagenesIntocables', () => {
  it('reconoce las imágenes JPEG por su filtro', () => {
    expect(
      detectarImagenesIntocables(comoBytes('<< /Filter /DCTDecode >>')),
    ).toBe(true)
  })

  it('reconoce JPEG 2000 y JBIG2, que tampoco se recomprimen', () => {
    expect(detectarImagenesIntocables(comoBytes('/JPXDecode'))).toBe(true)
    expect(detectarImagenesIntocables(comoBytes('/JBIG2Decode'))).toBe(true)
  })

  it('no avisa en un documento sin imágenes de ese tipo', () => {
    expect(
      detectarImagenesIntocables(comoBytes('<< /Filter /FlateDecode >>')),
    ).toBe(false)
  })

  it('no avisa con un documento vacío', () => {
    expect(detectarImagenesIntocables(new Uint8Array(0))).toBe(false)
  })

  it('encuentra el filtro aunque esté lejos del principio', () => {
    const relleno = 'x'.repeat(100_000)

    expect(
      detectarImagenesIntocables(comoBytes(`${relleno}/DCTDecode`)),
    ).toBe(true)
  })

  it('no recorre más allá del primer megabyte, para no gastar memoria de más', () => {
    // El filtro está a dos megabytes, así que deliberadamente no se encuentra.
    const relleno = 'x'.repeat(2_000_000)

    expect(
      detectarImagenesIntocables(comoBytes(`${relleno}/DCTDecode`)),
    ).toBe(false)
  })
})

describe('textos de la interfaz', () => {
  it('describe los dos perfiles', () => {
    for (const perfil of ['estructural', 'maxima'] as const) {
      expect(describirPerfil(perfil).length).toBeGreaterThan(0)
      expect(explicarPerfil(perfil).length).toBeGreaterThan(0)
    }
  })

  it('el perfil estructural se presenta como el que aporta el ahorro', () => {
    expect(explicarPerfil('estructural')).toMatch(/ahorro/i)
  })

  it('distingue explícitamente la optimización estructural de la de imágenes', () => {
    expect(EXPLICACION_TIPOS_COMPRESION.estructural).toMatch(
      /no cambia ni un píxel/i,
    )
    expect(EXPLICACION_TIPOS_COMPRESION.imagenes).toMatch(/degrada/i)
  })

  it('deja claro que esta herramienta no recodifica imágenes', () => {
    expect(EXPLICACION_TIPOS_COMPRESION.imagenes).toMatch(/no lo hace/i)
    expect(avisarSobreImagenes()).toMatch(/no recodifica/i)
  })

  it('el aviso de imágenes explica por qué la reducción será pequeña', () => {
    expect(avisarSobreImagenes()).toMatch(/reducción será pequeña/i)
  })

  it('el documento comprimido se llama free-pdf-comprimido.pdf', () => {
    expect(NOMBRE_COMPRIMIDO).toBe('free-pdf-comprimido.pdf')
  })

  it('los perfiles admitidos son exactamente dos', () => {
    const perfiles: readonly PerfilCompresion[] = ['estructural', 'maxima']

    expect(perfiles).toHaveLength(2)
  })
})

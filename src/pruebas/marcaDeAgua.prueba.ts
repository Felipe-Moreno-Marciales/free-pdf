import { describe, expect, it } from 'vitest'
import {
  aplicarMarcaDeAgua,
  ESCALA_MAXIMA,
  LONGITUD_MAXIMA_TEXTO,
  MAXIMO_COPIAS_MOSAICO,
  NOMBRE_MARCA_DE_AGUA,
  OPACIDAD_MAXIMA,
  OPACIDAD_MINIMA,
} from '../funcionalidades/marca-de-agua/aplicarMarcaDeAgua'
import type {
  ConfiguracionMarcaDeAgua,
  ImagenMarca,
} from '../funcionalidades/marca-de-agua/tipos'
import { CONFIGURACION_PREDETERMINADA } from '../funcionalidades/marca-de-agua/useMarcaDeAgua'
import { ErrorPdf } from '../pdf/erroresPdf'
import { abrirBytes, bytesDeBlob, crearArchivoPdf } from './ayudas/crearPdfPrueba'
import { crearArchivoImagen } from './ayudas/crearImagenPrueba'

/** Construye una configuración partiendo de la predeterminada. */
function configurar(
  cambios: Partial<ConfiguracionMarcaDeAgua> = {},
): ConfiguracionMarcaDeAgua {
  return { ...CONFIGURACION_PREDETERMINADA, ...cambios }
}

/** Construye la imagen de marca a partir de un PNG de prueba. */
function crearImagenMarca(ancho = 200, alto = 100): ImagenMarca {
  const archivo = crearArchivoImagen('marca', ancho, alto, 'png')

  return {
    contenido: archivo,
    nombre: archivo.name,
    formato: 'png',
    tamano: archivo.size,
  }
}

/** Aplica la marca a un documento de prueba. */
async function aplicar(
  numeroPaginas: number,
  cambios: Partial<ConfiguracionMarcaDeAgua> = {},
  imagenMarca: ImagenMarca | null = null,
) {
  const archivo = await crearArchivoPdf('documento.pdf', numeroPaginas)

  return await aplicarMarcaDeAgua({
    archivo,
    configuracion: configurar(cambios),
    imagenMarca,
  })
}

/** Indica, para cada página, si tiene contenido dibujado. */
async function leerPaginasConContenido(
  bytes: Uint8Array,
): Promise<readonly boolean[]> {
  const documento = await abrirBytes(bytes)

  return documento
    .getPages()
    .map((pagina) => pagina.node.Contents() !== undefined)
}

describe('aplicarMarcaDeAgua: marca de texto', () => {
  it('genera un documento válido con el nombre esperado', async () => {
    const resultado = await aplicar(2)

    expect(resultado.nombreArchivo).toBe(NOMBRE_MARCA_DE_AGUA)
    expect(resultado.nombreArchivo).toBe('free-pdf-marca-de-agua.pdf')
    expect(resultado.blob.type).toBe('application/pdf')
    expect(resultado.numeroPaginas).toBe(2)
  })

  it('conserva el número de páginas y sus medidas', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 3)
    const original = await abrirBytes(new Uint8Array(await archivo.arrayBuffer()))
    const medidasOriginales = original
      .getPages()
      .map((pagina) => [pagina.getWidth(), pagina.getHeight()])

    const resultado = await aplicarMarcaDeAgua({
      archivo,
      configuracion: configurar(),
      imagenMarca: null,
    })
    const marcado = await abrirBytes(await bytesDeBlob(resultado.blob))

    expect(marcado.getPageCount()).toBe(3)
    expect(
      marcado.getPages().map((pagina) => [pagina.getWidth(), pagina.getHeight()]),
    ).toEqual(medidasOriginales)
  })

  it('exige un texto no vacío', async () => {
    await expect(
      aplicar(1, { texto: { ...CONFIGURACION_PREDETERMINADA.texto, texto: '' } }),
    ).rejects.toThrow(ErrorPdf)
  })

  it('rechaza un texto solo con espacios', async () => {
    await expect(
      aplicar(1, {
        texto: { ...CONFIGURACION_PREDETERMINADA.texto, texto: '   ' },
      }),
    ).rejects.toThrow(ErrorPdf)
  })

  it('rechaza un texto demasiado largo', async () => {
    await expect(
      aplicar(1, {
        texto: {
          ...CONFIGURACION_PREDETERMINADA.texto,
          texto: 'x'.repeat(LONGITUD_MAXIMA_TEXTO + 1),
        },
      }),
    ).rejects.toThrow(ErrorPdf)
  })

  it('rechaza los caracteres que la tipografía estándar no cubre', async () => {
    await expect(
      aplicar(1, {
        texto: { ...CONFIGURACION_PREDETERMINADA.texto, texto: 'BORRADOR 文' },
      }),
    ).rejects.toThrow(/文/)
  })

  it('acepta los acentos y los signos del español', async () => {
    const resultado = await aplicar(1, {
      texto: {
        ...CONFIGURACION_PREDETERMINADA.texto,
        texto: 'COPIA — año «2024»',
      },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })
})

describe('aplicarMarcaDeAgua: opacidad y giro', () => {
  it('acepta la opacidad mínima', async () => {
    const resultado = await aplicar(1, {
      opacidadPorcentaje: OPACIDAD_MINIMA,
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('acepta la opacidad máxima', async () => {
    const resultado = await aplicar(1, {
      opacidadPorcentaje: OPACIDAD_MAXIMA,
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('limita una opacidad fuera de rango en lugar de fallar', async () => {
    const resultado = await aplicar(1, { opacidadPorcentaje: 500 })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('acepta un giro positivo', async () => {
    const resultado = await aplicar(1, { rotacionGrados: 45 })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('acepta un giro negativo', async () => {
    const resultado = await aplicar(1, { rotacionGrados: -30 })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('acepta el giro sin inclinación', async () => {
    const resultado = await aplicar(1, { rotacionGrados: 0 })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('limita un giro fuera de rango', async () => {
    const resultado = await aplicar(1, { rotacionGrados: 900 })

    expect(resultado.numeroPaginas).toBe(1)
  })
})

describe('aplicarMarcaDeAgua: posiciones', () => {
  it('acepta las nueve posiciones', async () => {
    const posiciones = [
      'superior-izquierda',
      'superior-centro',
      'superior-derecha',
      'centro-izquierda',
      'centro',
      'centro-derecha',
      'inferior-izquierda',
      'inferior-centro',
      'inferior-derecha',
    ] as const

    for (const posicion of posiciones) {
      const resultado = await aplicar(1, { posicion, modo: 'unica' })

      expect(resultado.numeroPaginas).toBe(1)
    }
  })

  it('acepta un margen de cero', async () => {
    const resultado = await aplicar(1, { margenMm: 0 })

    expect(resultado.numeroPaginas).toBe(1)
  })
})

describe('aplicarMarcaDeAgua: modo mosaico', () => {
  it('genera un documento válido en modo mosaico', async () => {
    const resultado = await aplicar(1, {
      modo: 'mosaico',
      separacionHorizontalMm: 30,
      separacionVerticalMm: 30,
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('un mosaico pesa más que una marca única', async () => {
    const unica = await aplicar(1, { modo: 'unica' })
    const mosaico = await aplicar(1, {
      modo: 'mosaico',
      separacionHorizontalMm: 10,
      separacionVerticalMm: 10,
    })

    expect(mosaico.tamano).toBeGreaterThan(unica.tamano)
  })

  it('rechaza un mosaico con demasiadas copias', async () => {
    await expect(
      aplicar(1, {
        modo: 'mosaico',
        separacionHorizontalMm: 0,
        separacionVerticalMm: 0,
        texto: {
          ...CONFIGURACION_PREDETERMINADA.texto,
          texto: '.',
          tamanoFuente: 8,
        },
      }),
    ).rejects.toThrow(/demasiadas/)
  })

  it('el límite de copias está documentado', () => {
    expect(MAXIMO_COPIAS_MOSAICO).toBeGreaterThan(0)
  })

  it('una separación amplia evita el aviso de exceso de copias', async () => {
    const resultado = await aplicar(1, {
      modo: 'mosaico',
      separacionHorizontalMm: 50,
      separacionVerticalMm: 50,
      texto: { ...CONFIGURACION_PREDETERMINADA.texto, tamanoFuente: 10 },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })
})

describe('aplicarMarcaDeAgua: páginas afectadas', () => {
  it('marca todas las páginas', async () => {
    const resultado = await aplicar(4, { alcance: 'todas' })

    expect(
      await leerPaginasConContenido(await bytesDeBlob(resultado.blob)),
    ).toEqual([true, true, true, true])
  })

  it('marca solo las páginas pares', async () => {
    const resultado = await aplicar(4, { alcance: 'pares' })

    expect(
      await leerPaginasConContenido(await bytesDeBlob(resultado.blob)),
    ).toEqual([false, true, false, true])
  })

  it('marca solo las páginas impares', async () => {
    const resultado = await aplicar(4, { alcance: 'impares' })

    expect(
      await leerPaginasConContenido(await bytesDeBlob(resultado.blob)),
    ).toEqual([true, false, true, false])
  })

  it('marca un rango personalizado', async () => {
    const resultado = await aplicar(5, {
      alcance: 'rango',
      expresion: '2,4',
    })

    expect(
      await leerPaginasConContenido(await bytesDeBlob(resultado.blob)),
    ).toEqual([false, true, false, true, false])
  })

  it('las páginas no seleccionadas quedan sin modificar', async () => {
    const resultado = await aplicar(3, { alcance: 'rango', expresion: '1' })
    const conContenido = await leerPaginasConContenido(
      await bytesDeBlob(resultado.blob),
    )

    expect(conContenido[1]).toBe(false)
    expect(conContenido[2]).toBe(false)
  })

  it('rechaza una selección que no incluye ninguna página', async () => {
    await expect(
      aplicar(3, { alcance: 'rango', expresion: '' }),
    ).rejects.toThrow(ErrorPdf)
  })
})

describe('aplicarMarcaDeAgua: marca de imagen', () => {
  it('exige una imagen cuando el tipo es imagen', async () => {
    await expect(aplicar(1, { tipo: 'imagen' }, null)).rejects.toThrow(ErrorPdf)
  })

  it('incrusta una imagen PNG como marca', async () => {
    const resultado = await aplicar(2, { tipo: 'imagen' }, crearImagenMarca())

    expect(resultado.numeroPaginas).toBe(2)
    expect(resultado.blob.type).toBe('application/pdf')
  })

  it('la marca de imagen añade contenido a las páginas afectadas', async () => {
    const resultado = await aplicar(
      3,
      { tipo: 'imagen', alcance: 'impares' },
      crearImagenMarca(),
    )

    expect(
      await leerPaginasConContenido(await bytesDeBlob(resultado.blob)),
    ).toEqual([true, false, true])
  })

  it('acepta la escala máxima', async () => {
    const resultado = await aplicar(
      1,
      {
        tipo: 'imagen',
        imagen: { escalaPorcentaje: ESCALA_MAXIMA },
      },
      crearImagenMarca(),
    )

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('limita una escala fuera de rango', async () => {
    const resultado = await aplicar(
      1,
      { tipo: 'imagen', imagen: { escalaPorcentaje: 5000 } },
      crearImagenMarca(),
    )

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('acepta una marca de imagen girada', async () => {
    const resultado = await aplicar(
      1,
      { tipo: 'imagen', rotacionGrados: 30 },
      crearImagenMarca(),
    )

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('acepta una marca de imagen en mosaico', async () => {
    const resultado = await aplicar(
      1,
      {
        tipo: 'imagen',
        modo: 'mosaico',
        separacionHorizontalMm: 40,
        separacionVerticalMm: 40,
        imagen: { escalaPorcentaje: 25 },
      },
      crearImagenMarca(),
    )

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('la imagen se incrusta una sola vez aunque se repita en varias páginas', async () => {
    const unaPagina = await aplicar(
      1,
      { tipo: 'imagen' },
      crearImagenMarca(400, 400),
    )
    const cincoPaginas = await aplicar(
      5,
      { tipo: 'imagen' },
      crearImagenMarca(400, 400),
    )

    // Si la imagen se incrustase una vez por página, el documento de cinco
    // páginas pesaría alrededor de cinco veces más.
    expect(cincoPaginas.tamano).toBeLessThan(unaPagina.tamano * 2)
  })

  it('conserva las medidas de las páginas', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 2)
    const original = await abrirBytes(new Uint8Array(await archivo.arrayBuffer()))
    const anchos = original.getPages().map((pagina) => pagina.getWidth())

    const resultado = await aplicarMarcaDeAgua({
      archivo,
      configuracion: configurar({ tipo: 'imagen' }),
      imagenMarca: crearImagenMarca(),
    })
    const marcado = await abrirBytes(await bytesDeBlob(resultado.blob))

    expect(marcado.getPages().map((pagina) => pagina.getWidth())).toEqual(anchos)
  })
})

describe('aplicarMarcaDeAgua: páginas rotadas', () => {
  it('funciona con páginas giradas por su propia rotación', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 2, {
      rotacionInicial: 90,
    })

    const resultado = await aplicarMarcaDeAgua({
      archivo,
      configuracion: configurar(),
      imagenMarca: null,
    })
    const marcado = await abrirBytes(await bytesDeBlob(resultado.blob))

    expect(marcado.getPageCount()).toBe(2)
    for (const pagina of marcado.getPages()) {
      expect(pagina.getRotation().angle).toBe(90)
    }
  })

  it('el mosaico también funciona en páginas rotadas', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 1, {
      rotacionInicial: 270,
    })

    await expect(
      aplicarMarcaDeAgua({
        archivo,
        configuracion: configurar({
          modo: 'mosaico',
          separacionHorizontalMm: 40,
          separacionVerticalMm: 40,
        }),
        imagenMarca: null,
      }),
    ).resolves.toBeDefined()
  })
})

describe('aplicarMarcaDeAgua: colores', () => {
  it('acepta un color válido', async () => {
    const resultado = await aplicar(1, {
      texto: { ...CONFIGURACION_PREDETERMINADA.texto, color: '#0f6f4b' },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('no falla con un color mal escrito: recurre al negro', async () => {
    const resultado = await aplicar(1, {
      texto: { ...CONFIGURACION_PREDETERMINADA.texto, color: 'granate' },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })
})

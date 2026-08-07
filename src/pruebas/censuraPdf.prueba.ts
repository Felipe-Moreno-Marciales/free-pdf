import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  calcularEscala,
  calcularRectanguloPixeles,
  calcularZonaDesdePantalla,
  describirDensidad,
  describirPerfil,
  esZonaUtil,
  estimarPixelesTotales,
  normalizarZona,
  PUNTOS_POR_PULGADA_PERFIL,
  zonasDePagina,
} from '../seguridad/censura/coordenadasCensura'
import {
  censurarPdf,
  NOMBRE_CENSURADO,
} from '../seguridad/censura/censurarPdf'
import type {
  AdaptadorCensura,
  ComprobadorCensura,
  ConfiguracionCensura,
  PerfilCalidad,
  PeticionRasterizado,
  VerificacionCensura,
  ZonaCensura,
} from '../seguridad/censura/tipos'
import { OperacionCancelada } from '../pdf/cancelacion'
import { ErrorPdf } from '../pdf/erroresPdf'
import { bytesDeBlob } from './ayudas/crearPdfPrueba'
import { crearBytesPng } from './ayudas/crearImagenPrueba'

/** Configuración de referencia. */
const CONFIGURACION: ConfiguracionCensura = {
  calidad: 'equilibrada',
  apariencia: { color: '#000000', texto: '' },
  formato: 'png',
}

/** Construye una zona partiendo de valores razonables. */
function zona(cambios: Partial<ZonaCensura> = {}): ZonaCensura {
  return {
    id: 'z1',
    pagina: 1,
    izquierda: 0.1,
    superior: 0.1,
    ancho: 0.3,
    alto: 0.1,
    origen: 'manual',
    ...cambios,
  }
}

/** Verificación que siempre pasa. */
const VERIFICACION_CORRECTA: VerificacionCensura = {
  correcta: true,
  numeroPaginas: 0,
  sinTextoExtraible: true,
  sinFormularios: true,
  sinAnotaciones: true,
  mensaje: null,
}

/** Adaptador de prueba junto con el registro de lo que se le pidió. */
interface AdaptadorDePrueba {
  readonly adaptador: AdaptadorCensura
  readonly peticiones: readonly PeticionRasterizado[]
}

/**
 * Crea un adaptador que no usa PDF.js ni `canvas`.
 *
 * Devuelve PNG reales generados byte a byte, así que pdf-lib los incrusta de verdad
 * y el documento resultante es válido. Lo que se comprueba con esto es el canal
 * completo: orden de las páginas, medidas, reconstrucción, verificación y
 * cancelación. El pintado de los píxeles corresponde al adaptador del navegador y su
 * geometría se comprueba aparte, en `calcularRectanguloPixeles`.
 */
function crearAdaptador(
  numeroPaginas: number,
  opciones: { readonly cancelaEn?: number } = {},
): AdaptadorDePrueba {
  const peticiones: PeticionRasterizado[] = []

  const adaptador: AdaptadorCensura = {
    numeroPaginas,
    medirPaginas: async () =>
      await Promise.resolve(
        Array.from({ length: numeroPaginas }, (_, indice) => ({
          ancho: 200 + indice * 10,
          alto: 300,
        })),
      ),
    rasterizar: async (peticion) => {
      peticiones.push(peticion)

      if (peticion.numeroPagina === opciones.cancelaEn) {
        return await Promise.resolve(null)
      }

      return await Promise.resolve({
        bytes: crearBytesPng(20, 30),
        ancho: 20,
        alto: 30,
      })
    },
  }

  return { adaptador, peticiones }
}

/** Comprobador de prueba con un resultado fijo. */
function crearComprobador(
  resultado: Partial<VerificacionCensura> = {},
): ComprobadorCensura {
  return async (_contenido, paginasEsperadas) =>
    await Promise.resolve({
      ...VERIFICACION_CORRECTA,
      numeroPaginas: paginasEsperadas,
      ...resultado,
    })
}

describe('perfiles de calidad', () => {
  it('los tres perfiles tienen la densidad documentada', () => {
    expect(PUNTOS_POR_PULGADA_PERFIL.ligera).toBe(150)
    expect(PUNTOS_POR_PULGADA_PERFIL.equilibrada).toBe(200)
    expect(PUNTOS_POR_PULGADA_PERFIL.alta).toBe(300)
  })

  it('la escala se deriva de la densidad, sobre 72 puntos por pulgada', () => {
    expect(calcularEscala('ligera')).toBeCloseTo(150 / 72, 6)
    expect(calcularEscala('alta')).toBeCloseTo(300 / 72, 6)
  })

  it('la escala crece con la calidad', () => {
    expect(calcularEscala('equilibrada')).toBeGreaterThan(
      calcularEscala('ligera'),
    )
    expect(calcularEscala('alta')).toBeGreaterThan(calcularEscala('equilibrada'))
  })

  it('nombra los perfiles y su densidad en español', () => {
    const perfiles: readonly PerfilCalidad[] = ['ligera', 'equilibrada', 'alta']

    expect(perfiles.map(describirPerfil)).toEqual([
      'Ligera',
      'Equilibrada',
      'Alta',
    ])
    expect(describirDensidad('alta')).toContain('300')
  })

  it('estima los píxeles totales del documento', () => {
    const medidas = [
      { ancho: 612, alto: 792 },
      { ancho: 612, alto: 792 },
    ]
    const estimacion = estimarPixelesTotales(medidas, 'alta')

    // Cada A4 a 300 ppp son unos 2550 × 3300 píxeles.
    expect(estimacion).toBeGreaterThan(2 * 8_000_000)
  })
})

describe('normalizarZona', () => {
  it('deja intacta una zona bien formada', () => {
    const normalizada = normalizarZona(zona())

    expect(normalizada.izquierda).toBeCloseTo(0.1, 6)
    expect(normalizada.ancho).toBeCloseTo(0.3, 6)
  })

  it('corrige un rectángulo dibujado hacia la izquierda', () => {
    const normalizada = normalizarZona(
      zona({ izquierda: 0.5, ancho: -0.2 }),
    )

    expect(normalizada.izquierda).toBeCloseTo(0.3, 6)
    expect(normalizada.ancho).toBeCloseTo(0.2, 6)
  })

  it('corrige un rectángulo dibujado hacia arriba', () => {
    const normalizada = normalizarZona(zona({ superior: 0.6, alto: -0.3 }))

    expect(normalizada.superior).toBeCloseTo(0.3, 6)
    expect(normalizada.alto).toBeCloseTo(0.3, 6)
  })

  it('recorta una zona que se sale por la derecha', () => {
    const normalizada = normalizarZona(zona({ izquierda: 0.8, ancho: 0.5 }))

    expect(normalizada.izquierda + normalizada.ancho).toBeLessThanOrEqual(1)
  })

  it('descarta los valores negativos y los que no son números', () => {
    const normalizada = normalizarZona(
      zona({ izquierda: -1, superior: Number.NaN }),
    )

    expect(normalizada.izquierda).toBe(0)
    expect(normalizada.superior).toBe(0)
  })

  it('distingue las zonas con superficie de las que no la tienen', () => {
    expect(esZonaUtil(zona())).toBe(true)
    expect(esZonaUtil(zona({ ancho: 0, alto: 0 }))).toBe(false)
    expect(esZonaUtil(zona({ ancho: 0.0001, alto: 0.2 }))).toBe(false)
  })
})

describe('calcularRectanguloPixeles', () => {
  it('traduce las fracciones a píxeles', () => {
    const rectangulo = calcularRectanguloPixeles(
      zona({ izquierda: 0.25, superior: 0.5, ancho: 0.25, alto: 0.25 }),
      400,
      800,
    )

    expect(rectangulo).toEqual({ x: 100, y: 400, ancho: 100, alto: 200 })
  })

  it('redondea hacia fuera, para no dejar nada asomando', () => {
    // 0,101 × 1000 = 101, y el borde derecho cae en 301,5: debe llegar a 302.
    const rectangulo = calcularRectanguloPixeles(
      zona({ izquierda: 0.101, superior: 0, ancho: 0.2005, alto: 0.5 }),
      1000,
      1000,
    )

    expect(rectangulo.x).toBe(101)
    expect(rectangulo.x + rectangulo.ancho).toBeGreaterThanOrEqual(302)
  })

  it('nunca devuelve un rectángulo vacío', () => {
    const rectangulo = calcularRectanguloPixeles(
      zona({ ancho: 0.0000001, alto: 0.0000001 }),
      100,
      100,
    )

    expect(rectangulo.ancho).toBeGreaterThanOrEqual(1)
    expect(rectangulo.alto).toBeGreaterThanOrEqual(1)
  })

  it('el rectángulo nunca sobresale de la imagen', () => {
    const rectangulo = calcularRectanguloPixeles(
      zona({ izquierda: 0.9, superior: 0.9, ancho: 0.5, alto: 0.5 }),
      200,
      200,
    )

    expect(rectangulo.x + rectangulo.ancho).toBeLessThanOrEqual(200)
    expect(rectangulo.y + rectangulo.alto).toBeLessThanOrEqual(200)
  })

  it('la misma zona tapa la misma proporción a cualquier resolución', () => {
    const laZona = zona({ izquierda: 0.2, superior: 0.3, ancho: 0.4, alto: 0.2 })

    const pequena = calcularRectanguloPixeles(laZona, 500, 500)
    const grande = calcularRectanguloPixeles(laZona, 2000, 2000)

    expect(grande.x / 2000).toBeCloseTo(pequena.x / 500, 2)
    expect(grande.ancho / 2000).toBeCloseTo(pequena.ancho / 500, 2)
  })
})

describe('calcularZonaDesdePantalla', () => {
  it('traduce píxeles de pantalla a fracciones', () => {
    const resultado = calcularZonaDesdePantalla(50, 100, 100, 50, 200, 400)

    expect(resultado.izquierda).toBeCloseTo(0.25, 6)
    expect(resultado.superior).toBeCloseTo(0.25, 6)
    expect(resultado.ancho).toBeCloseTo(0.5, 6)
    expect(resultado.alto).toBeCloseTo(0.125, 6)
  })

  it('tolera unas medidas de pantalla nulas', () => {
    expect(calcularZonaDesdePantalla(10, 10, 10, 10, 0, 0)).toEqual({
      izquierda: 0,
      superior: 0,
      ancho: 0,
      alto: 0,
    })
  })
})

describe('zonasDePagina', () => {
  it('devuelve solo las zonas de la página pedida', () => {
    const zonas = [
      zona({ id: 'a', pagina: 1 }),
      zona({ id: 'b', pagina: 2 }),
      zona({ id: 'c', pagina: 1 }),
    ]

    expect(zonasDePagina(zonas, 1).map((z) => z.id)).toEqual(['a', 'c'])
  })

  it('descarta las zonas sin superficie', () => {
    const zonas = [zona({ id: 'a' }), zona({ id: 'b', ancho: 0, alto: 0 })]

    expect(zonasDePagina(zonas, 1).map((z) => z.id)).toEqual(['a'])
  })

  it('devuelve las zonas ya normalizadas', () => {
    const zonas = [zona({ izquierda: 0.5, ancho: -0.2 })]

    expect(zonasDePagina(zonas, 1)[0].izquierda).toBeCloseTo(0.3, 6)
  })
})

describe('censurarPdf: canal completo', () => {
  it('exige al menos una zona', async () => {
    const { adaptador } = crearAdaptador(2)

    await expect(
      censurarPdf(
        { zonas: [], configuracion: CONFIGURACION },
        { adaptador, comprobador: crearComprobador() },
      ),
    ).rejects.toThrow(ErrorPdf)
  })

  it('genera un documento válido con el nombre esperado', async () => {
    const { adaptador } = crearAdaptador(2)

    const resultado = await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      { adaptador, comprobador: crearComprobador() },
    )

    expect(resultado.nombreArchivo).toBe(NOMBRE_CENSURADO)
    expect(resultado.nombreArchivo).toBe('free-pdf-censurado.pdf')
    expect(resultado.blob.type).toBe('application/pdf')
  })

  it('rasteriza todas las páginas, no solo las censuradas', async () => {
    // Es la garantía central: si solo se rasterizaran las páginas con zonas, el
    // resto conservaría sus flujos originales.
    const { adaptador, peticiones } = crearAdaptador(4)

    await censurarPdf(
      { zonas: [zona({ pagina: 2 })], configuracion: CONFIGURACION },
      { adaptador, comprobador: crearComprobador() },
    )

    expect(peticiones.map((p) => p.numeroPagina)).toEqual([1, 2, 3, 4])
  })

  it('solo pasa a cada página sus propias zonas', async () => {
    const { adaptador, peticiones } = crearAdaptador(3)

    await censurarPdf(
      {
        zonas: [
          zona({ id: 'a', pagina: 1 }),
          zona({ id: 'b', pagina: 3 }),
          zona({ id: 'c', pagina: 3 }),
        ],
        configuracion: CONFIGURACION,
      },
      { adaptador, comprobador: crearComprobador() },
    )

    expect(peticiones[0].zonas).toHaveLength(1)
    expect(peticiones[1].zonas).toHaveLength(0)
    expect(peticiones[2].zonas).toHaveLength(2)
  })

  it('el documento resultante conserva el número de páginas', async () => {
    const { adaptador } = crearAdaptador(5)

    const resultado = await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      { adaptador, comprobador: crearComprobador() },
    )

    expect(resultado.numeroPaginas).toBe(5)
    expect(
      (await PDFDocument.load(await bytesDeBlob(resultado.blob))).getPageCount(),
    ).toBe(5)
  })

  it('las páginas conservan las medidas visibles del original', async () => {
    const { adaptador } = crearAdaptador(2)

    const resultado = await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      { adaptador, comprobador: crearComprobador() },
    )

    const documento = await PDFDocument.load(await bytesDeBlob(resultado.blob))

    expect(documento.getPage(0).getWidth()).toBeCloseTo(200, 1)
    expect(documento.getPage(1).getWidth()).toBeCloseTo(210, 1)
    expect(documento.getPage(0).getHeight()).toBeCloseTo(300, 1)
  })

  it('el documento reconstruido no tiene campos de formulario', async () => {
    const { adaptador } = crearAdaptador(2)

    const resultado = await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      { adaptador, comprobador: crearComprobador() },
    )

    const documento = await PDFDocument.load(await bytesDeBlob(resultado.blob))

    expect(documento.getForm().getFields()).toHaveLength(0)
  })

  it('el documento reconstruido no arrastra los metadatos originales', async () => {
    const { adaptador } = crearAdaptador(1)

    const resultado = await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      { adaptador, comprobador: crearComprobador() },
    )

    const documento = await PDFDocument.load(await bytesDeBlob(resultado.blob))

    expect(documento.getTitle() ?? '').toBe('')
    expect(documento.getAuthor() ?? '').toBe('')
    expect(documento.getKeywords() ?? '').toBe('')
  })

  it('traslada la escala del perfil al adaptador', async () => {
    const { adaptador, peticiones } = crearAdaptador(1)

    await censurarPdf(
      {
        zonas: [zona()],
        configuracion: { ...CONFIGURACION, calidad: 'alta' },
      },
      { adaptador, comprobador: crearComprobador() },
    )

    expect(peticiones[0].escala).toBeCloseTo(300 / 72, 6)
  })

  it('traslada la apariencia al adaptador', async () => {
    const { adaptador, peticiones } = crearAdaptador(1)
    const apariencia = { color: '#ffffff', texto: 'CENSURADO' }

    await censurarPdf(
      { zonas: [zona()], configuracion: { ...CONFIGURACION, apariencia } },
      { adaptador, comprobador: crearComprobador() },
    )

    expect(peticiones[0].apariencia).toEqual(apariencia)
  })

  it('informa del progreso una vez por página', async () => {
    const { adaptador } = crearAdaptador(3)
    const registro: [number, number][] = []

    await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      {
        adaptador,
        comprobador: crearComprobador(),
        alProgreso: (hechas, total) => registro.push([hechas, total]),
      },
    )

    expect(registro).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })
})

describe('censurarPdf: verificación', () => {
  it('devuelve la verificación junto con el resultado', async () => {
    const { adaptador } = crearAdaptador(2)

    const resultado = await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      { adaptador, comprobador: crearComprobador() },
    )

    expect(resultado.verificacion.correcta).toBe(true)
    expect(resultado.verificacion.numeroPaginas).toBe(2)
  })

  it('no entrega el archivo si queda texto extraíble', async () => {
    const { adaptador } = crearAdaptador(1)

    await expect(
      censurarPdf(
        { zonas: [zona()], configuracion: CONFIGURACION },
        {
          adaptador,
          comprobador: crearComprobador({
            correcta: false,
            sinTextoExtraible: false,
            mensaje: 'El documento todavía contiene texto extraíble.',
          }),
        },
      ),
    ).rejects.toThrow(/texto extraíble/)
  })

  it('no entrega el archivo si el número de páginas no coincide', async () => {
    const { adaptador } = crearAdaptador(3)

    await expect(
      censurarPdf(
        { zonas: [zona()], configuracion: CONFIGURACION },
        {
          adaptador,
          comprobador: crearComprobador({
            correcta: false,
            mensaje: 'El documento resultante no tiene las páginas esperadas.',
          }),
        },
      ),
    ).rejects.toThrow(/páginas esperadas/)
  })

  it('el comprobador recibe el número de páginas esperado', async () => {
    const { adaptador } = crearAdaptador(4)
    let recibidas = 0

    await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      {
        adaptador,
        comprobador: async (_contenido, paginas) => {
          recibidas = paginas

          return await Promise.resolve({
            ...VERIFICACION_CORRECTA,
            numeroPaginas: paginas,
          })
        },
      },
    )

    expect(recibidas).toBe(4)
  })

  it('el comprobador recibe los bytes del documento generado', async () => {
    const { adaptador } = crearAdaptador(1)
    let tamano = 0

    await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      {
        adaptador,
        comprobador: async (contenido, paginas) => {
          tamano = contenido.byteLength

          return await Promise.resolve({
            ...VERIFICACION_CORRECTA,
            numeroPaginas: paginas,
          })
        },
      },
    )

    expect(tamano).toBeGreaterThan(0)
  })
})

describe('censurarPdf: cancelación', () => {
  it('se detiene si la señal ya está cancelada', async () => {
    const { adaptador, peticiones } = crearAdaptador(3)
    const controlador = new AbortController()
    controlador.abort()

    await expect(
      censurarPdf(
        { zonas: [zona()], configuracion: CONFIGURACION },
        {
          adaptador,
          comprobador: crearComprobador(),
          senal: controlador.signal,
        },
      ),
    ).rejects.toThrow(OperacionCancelada)

    expect(peticiones).toHaveLength(0)
  })

  it('deja de procesar las páginas que quedaban', async () => {
    const { adaptador, peticiones } = crearAdaptador(5)
    const controlador = new AbortController()

    const promesa = censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      {
        adaptador,
        comprobador: crearComprobador(),
        senal: controlador.signal,
        alProgreso: (hechas) => {
          if (hechas === 2) {
            controlador.abort()
          }
        },
      },
    )

    await expect(promesa).rejects.toThrow(OperacionCancelada)
    expect(peticiones.length).toBeLessThan(5)
  })

  it('trata como cancelación que el adaptador devuelva nulo', async () => {
    const { adaptador } = crearAdaptador(3, { cancelaEn: 2 })

    await expect(
      censurarPdf(
        { zonas: [zona()], configuracion: CONFIGURACION },
        { adaptador, comprobador: crearComprobador() },
      ),
    ).rejects.toThrow(OperacionCancelada)
  })

  it('no entrega nada cuando se cancela', async () => {
    const { adaptador } = crearAdaptador(3, { cancelaEn: 2 })

    const resultado = await censurarPdf(
      { zonas: [zona()], configuracion: CONFIGURACION },
      { adaptador, comprobador: crearComprobador() },
    ).catch(() => null)

    expect(resultado).toBeNull()
  })
})

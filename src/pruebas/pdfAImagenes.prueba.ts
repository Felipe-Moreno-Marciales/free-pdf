import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  convertirPdfAImagenes,
  describirDensidad,
  describirResolucion,
  ESCALAS_RESOLUCION,
} from '../funcionalidades/pdf-a-imagenes/convertirPdfAImagenes'
import {
  calcularAnchoNumero,
  construirNombreImagen,
  construirNombresImagenes,
  DIGITOS_MINIMOS,
  NOMBRE_ZIP_IMAGENES,
  rellenarConCeros,
} from '../funcionalidades/pdf-a-imagenes/nombresImagenes'
import type {
  ClaveResolucion,
  ConfiguracionPdfAImagenes,
  PeticionRenderizado,
  RenderizadorPagina,
} from '../funcionalidades/pdf-a-imagenes/tipos'
import { OperacionCancelada, esCancelacion } from '../pdf/cancelacion'
import { ErrorPdf } from '../pdf/erroresPdf'

/** Configuración predeterminada de las pruebas. */
const CONFIGURACION: ConfiguracionPdfAImagenes = {
  formato: 'png',
  calidadPorcentaje: 85,
  resolucion: 'estandar',
}

/** Renderizador de prueba que registra lo que se le pide. */
interface RenderizadorDePrueba {
  readonly renderizador: RenderizadorPagina
  readonly peticiones: readonly PeticionRenderizado[]
}

/**
 * Crea un renderizador que no dibuja nada con PDF.js.
 *
 * Devuelve bytes deterministas cuyo primer valor es el número de página, así que
 * el contenido del ZIP se puede comprobar sin necesidad de descodificar imágenes.
 * No se simula que PDF.js haya dibujado: se sustituye explícitamente el
 * adaptador de dibujado, que es la pieza que necesita navegador.
 */
function crearRenderizador(
  opciones: {
    readonly fallaEn?: number
    readonly cancelaEn?: number
  } = {},
): RenderizadorDePrueba {
  const peticiones: PeticionRenderizado[] = []

  const renderizador: RenderizadorPagina = async (peticion) => {
    peticiones.push(peticion)

    if (peticion.numeroPagina === opciones.fallaEn) {
      throw new ErrorPdf(`Fallo simulado en la página ${peticion.numeroPagina}.`)
    }

    if (peticion.numeroPagina === opciones.cancelaEn) {
      return await Promise.resolve(null)
    }

    return await Promise.resolve({
      bytes: new Uint8Array([peticion.numeroPagina, 1, 2, 3]),
      ancho: 100 * peticion.escala,
      alto: 200 * peticion.escala,
    })
  }

  return { renderizador, peticiones }
}

/** Lee los nombres de los archivos que contiene un ZIP. */
async function leerNombresZip(blob: Blob): Promise<readonly string[]> {
  const bytes = new Uint8Array(await blob.arrayBuffer())

  return Object.keys(unzipSync(bytes))
}

/** Lee el contenido de un archivo concreto del ZIP. */
async function leerArchivoZip(
  blob: Blob,
  nombre: string,
): Promise<Uint8Array> {
  const bytes = new Uint8Array(await blob.arrayBuffer())

  return unzipSync(bytes)[nombre]
}

describe('rellenarConCeros', () => {
  it('rellena hasta el ancho indicado', () => {
    expect(rellenarConCeros(1, 3)).toBe('001')
    expect(rellenarConCeros(42, 3)).toBe('042')
    expect(rellenarConCeros(999, 3)).toBe('999')
  })

  it('no recorta los números más largos que el ancho', () => {
    expect(rellenarConCeros(1234, 3)).toBe('1234')
  })

  it('descarta los valores negativos', () => {
    expect(rellenarConCeros(-5, 3)).toBe('000')
  })
})

describe('calcularAnchoNumero', () => {
  it('usa al menos tres dígitos', () => {
    expect(DIGITOS_MINIMOS).toBe(3)
    expect(calcularAnchoNumero([1, 2, 3])).toBe(3)
  })

  it('crece con el número mayor, no con la cantidad de páginas', () => {
    expect(calcularAnchoNumero([5, 120])).toBe(3)
    expect(calcularAnchoNumero([1500])).toBe(4)
  })

  it('tolera una lista vacía', () => {
    expect(calcularAnchoNumero([])).toBe(3)
  })
})

describe('construirNombreImagen', () => {
  it('sigue el patrón documento-pagina-001.png', () => {
    expect(construirNombreImagen('documento.pdf', 1, 3, 'png')).toBe(
      'documento-pagina-001.png',
    )
  })

  it('usa la extensión .jpg para el formato JPEG', () => {
    expect(construirNombreImagen('documento.pdf', 7, 3, 'jpeg')).toBe(
      'documento-pagina-007.jpg',
    )
  })

  it('limpia los caracteres problemáticos del nombre original', () => {
    const nombre = construirNombreImagen('Mi informe: 2024/final.pdf', 2, 3, 'png')

    expect(nombre).not.toContain(':')
    expect(nombre).not.toContain('/')
    expect(nombre).toContain('-pagina-002.png')
  })

  it('recurre a un nombre de reserva cuando no queda nada aprovechable', () => {
    expect(construirNombreImagen('///.pdf', 1, 3, 'png')).toBe(
      'documento-pagina-001.png',
    )
  })

  it('los nombres de una lista quedan ordenados alfabéticamente', () => {
    const nombres = construirNombresImagenes(
      'informe.pdf',
      [1, 2, 10, 11, 100],
      'png',
    )

    expect([...nombres].sort()).toEqual([...nombres])
  })

  it('genera un nombre por página', () => {
    expect(
      construirNombresImagenes('a.pdf', [3, 1, 2], 'png'),
    ).toEqual([
      'a-pagina-003.png',
      'a-pagina-001.png',
      'a-pagina-002.png',
    ])
  })
})

describe('resoluciones', () => {
  it('cada resolución tiene su escala documentada', () => {
    expect(ESCALAS_RESOLUCION.estandar).toBe(1.5)
    expect(ESCALAS_RESOLUCION.alta).toBe(3)
    expect(ESCALAS_RESOLUCION['muy-alta']).toBe(4)
  })

  it('las escalas crecen con la calidad', () => {
    expect(ESCALAS_RESOLUCION.alta).toBeGreaterThan(ESCALAS_RESOLUCION.estandar)
    expect(ESCALAS_RESOLUCION['muy-alta']).toBeGreaterThan(
      ESCALAS_RESOLUCION.alta,
    )
  })

  it('los nombres son comprensibles y no engañosos', () => {
    const resoluciones: readonly ClaveResolucion[] = [
      'estandar',
      'alta',
      'muy-alta',
    ]
    const nombres = resoluciones.map(describirResolucion)

    expect(nombres).toEqual(['Estándar', 'Alta', 'Muy alta'])
    expect(nombres.join(' ')).not.toContain('infinita')
  })

  it('describe la densidad aproximada de cada resolución', () => {
    expect(describirDensidad('estandar')).toContain('108')
    expect(describirDensidad('alta')).toContain('216')
    expect(describirDensidad('muy-alta')).toContain('288')
  })

  it('la escala llega al renderizador', async () => {
    const { renderizador, peticiones } = crearRenderizador()

    await convertirPdfAImagenes(
      {
        numerosPagina: [1],
        nombreDocumento: 'a.pdf',
        configuracion: { ...CONFIGURACION, resolucion: 'alta' },
      },
      { renderizador },
    )

    expect(peticiones[0].escala).toBe(ESCALAS_RESOLUCION.alta)
  })
})

describe('convertirPdfAImagenes: selección de páginas', () => {
  it('exige al menos una página', async () => {
    const { renderizador } = crearRenderizador()

    await expect(
      convertirPdfAImagenes(
        {
          numerosPagina: [],
          nombreDocumento: 'a.pdf',
          configuracion: CONFIGURACION,
        },
        { renderizador },
      ),
    ).rejects.toThrow(ErrorPdf)
  })

  it('convierte solo las páginas indicadas', async () => {
    const { renderizador, peticiones } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [2, 4],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )

    expect(peticiones.map((peticion) => peticion.numeroPagina)).toEqual([2, 4])
    expect(resultado.imagenes).toHaveLength(2)
  })

  it('conserva el orden de las páginas que recibe', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [1, 2, 3],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )

    expect(resultado.imagenes.map((imagen) => imagen.numeroPagina)).toEqual([
      1, 2, 3,
    ])
  })

  it('guarda las medidas de cada imagen generada', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [1],
        nombreDocumento: 'a.pdf',
        configuracion: { ...CONFIGURACION, resolucion: 'alta' },
      },
      { renderizador },
    )

    expect(resultado.imagenes[0].ancho).toBe(300)
    expect(resultado.imagenes[0].alto).toBe(600)
  })
})

describe('convertirPdfAImagenes: una sola página', () => {
  it('descarga la imagen suelta, sin ZIP', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [3],
        nombreDocumento: 'informe.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )

    expect(resultado.esPaquete).toBe(false)
    expect(resultado.nombreArchivo).toBe('informe-pagina-003.png')
    expect(resultado.blob.type).toBe('image/png')
  })

  it('usa el tipo MIME del JPEG cuando corresponde', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [1],
        nombreDocumento: 'informe.pdf',
        configuracion: { ...CONFIGURACION, formato: 'jpeg' },
      },
      { renderizador },
    )

    expect(resultado.blob.type).toBe('image/jpeg')
    expect(resultado.nombreArchivo).toBe('informe-pagina-001.jpg')
  })

  it('el contenido descargado es el que devolvió el renderizador', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [5],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )
    const bytes = new Uint8Array(await resultado.blob.arrayBuffer())

    expect([...bytes]).toEqual([5, 1, 2, 3])
  })
})

describe('convertirPdfAImagenes: varias páginas en un ZIP', () => {
  it('empaqueta todas las imágenes en un único ZIP', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [1, 2, 3],
        nombreDocumento: 'informe.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )

    expect(resultado.esPaquete).toBe(true)
    expect(resultado.nombreArchivo).toBe(NOMBRE_ZIP_IMAGENES)
    expect(resultado.nombreArchivo).toBe('free-pdf-imagenes.zip')
    expect(resultado.blob.type).toBe('application/zip')
  })

  it('el ZIP contiene exactamente una entrada por página', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [1, 2, 3, 4],
        nombreDocumento: 'informe.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )

    expect(await leerNombresZip(resultado.blob)).toHaveLength(4)
  })

  it('los nombres dentro del ZIP llevan ceros a la izquierda', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [1, 2],
        nombreDocumento: 'informe.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )

    expect(await leerNombresZip(resultado.blob)).toEqual([
      'informe-pagina-001.png',
      'informe-pagina-002.png',
    ])
  })

  it('cada entrada del ZIP guarda el contenido de su página', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [7, 8],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )

    const septima = await leerArchivoZip(resultado.blob, 'a-pagina-007.png')
    const octava = await leerArchivoZip(resultado.blob, 'a-pagina-008.png')

    expect(septima[0]).toBe(7)
    expect(octava[0]).toBe(8)
  })

  it('el resumen recoge el tamaño de cada imagen', async () => {
    const { renderizador } = crearRenderizador()

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [1, 2],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    )

    for (const imagen of resultado.imagenes) {
      expect(imagen.tamano).toBe(4)
    }
  })
})

describe('convertirPdfAImagenes: calidad del JPEG', () => {
  it('traslada la calidad al renderizador como valor de 0 a 1', async () => {
    const { renderizador, peticiones } = crearRenderizador()

    await convertirPdfAImagenes(
      {
        numerosPagina: [1],
        nombreDocumento: 'a.pdf',
        configuracion: {
          ...CONFIGURACION,
          formato: 'jpeg',
          calidadPorcentaje: 60,
        },
      },
      { renderizador },
    )

    expect(peticiones[0].calidad).toBeCloseTo(0.6, 6)
  })

  it('limita una calidad fuera de rango', async () => {
    const { renderizador, peticiones } = crearRenderizador()

    await convertirPdfAImagenes(
      {
        numerosPagina: [1],
        nombreDocumento: 'a.pdf',
        configuracion: {
          ...CONFIGURACION,
          formato: 'jpeg',
          calidadPorcentaje: 500,
        },
      },
      { renderizador },
    )

    expect(peticiones[0].calidad).toBeLessThanOrEqual(1)
  })

  it('traslada el formato elegido al renderizador', async () => {
    const { renderizador, peticiones } = crearRenderizador()

    await convertirPdfAImagenes(
      {
        numerosPagina: [1],
        nombreDocumento: 'a.pdf',
        configuracion: { ...CONFIGURACION, formato: 'jpeg' },
      },
      { renderizador },
    )

    expect(peticiones[0].formato).toBe('jpeg')
  })
})

describe('convertirPdfAImagenes: progreso', () => {
  it('informa una vez por página, con el total correcto', async () => {
    const { renderizador } = crearRenderizador()
    const registro: [number, number][] = []

    await convertirPdfAImagenes(
      {
        numerosPagina: [1, 2, 3],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador, alProgreso: (hechas, total) => registro.push([hechas, total]) },
    )

    expect(registro).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it('funciona sin función de progreso', async () => {
    const { renderizador } = crearRenderizador()

    await expect(
      convertirPdfAImagenes(
        {
          numerosPagina: [1],
          nombreDocumento: 'a.pdf',
          configuracion: CONFIGURACION,
        },
        { renderizador },
      ),
    ).resolves.toBeDefined()
  })
})

describe('convertirPdfAImagenes: cancelación entre páginas', () => {
  it('se detiene cuando la señal se cancela antes de empezar', async () => {
    const { renderizador, peticiones } = crearRenderizador()
    const controlador = new AbortController()
    controlador.abort()

    await expect(
      convertirPdfAImagenes(
        {
          numerosPagina: [1, 2, 3],
          nombreDocumento: 'a.pdf',
          configuracion: CONFIGURACION,
        },
        { renderizador, senal: controlador.signal },
      ),
    ).rejects.toThrow(OperacionCancelada)

    expect(peticiones).toHaveLength(0)
  })

  it('deja de procesar las páginas que quedaban', async () => {
    const { renderizador, peticiones } = crearRenderizador()
    const controlador = new AbortController()

    // Se cancela en cuanto termina la primera página.
    const promesa = convertirPdfAImagenes(
      {
        numerosPagina: [1, 2, 3, 4],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      {
        renderizador,
        senal: controlador.signal,
        alProgreso: (hechas) => {
          if (hechas === 1) {
            controlador.abort()
          }
        },
      },
    )

    await expect(promesa).rejects.toThrow(OperacionCancelada)
    expect(peticiones.length).toBeLessThan(4)
  })

  it('trata como cancelación que el renderizador devuelva nulo', async () => {
    const { renderizador } = crearRenderizador({ cancelaEn: 2 })

    await expect(
      convertirPdfAImagenes(
        {
          numerosPagina: [1, 2, 3],
          nombreDocumento: 'a.pdf',
          configuracion: CONFIGURACION,
        },
        { renderizador },
      ),
    ).rejects.toThrow(OperacionCancelada)
  })

  it('la cancelación se reconoce como tal y no como error', async () => {
    const { renderizador } = crearRenderizador({ cancelaEn: 1 })

    const error = await convertirPdfAImagenes(
      {
        numerosPagina: [1],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    ).catch((capturado: unknown) => capturado)

    expect(esCancelacion(error)).toBe(true)
  })

  it('no descarga nada cuando se cancela', async () => {
    const { renderizador } = crearRenderizador({ cancelaEn: 2 })

    const resultado = await convertirPdfAImagenes(
      {
        numerosPagina: [1, 2],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    ).catch(() => null)

    expect(resultado).toBeNull()
  })
})

describe('convertirPdfAImagenes: errores', () => {
  it('traduce el fallo de una página a un mensaje en español', async () => {
    const { renderizador } = crearRenderizador({ fallaEn: 2 })

    await expect(
      convertirPdfAImagenes(
        {
          numerosPagina: [1, 2],
          nombreDocumento: 'a.pdf',
          configuracion: CONFIGURACION,
        },
        { renderizador },
      ),
    ).rejects.toThrow(/página 2/)
  })

  it('un fallo no se confunde con una cancelación', async () => {
    const { renderizador } = crearRenderizador({ fallaEn: 1 })

    const error = await convertirPdfAImagenes(
      {
        numerosPagina: [1],
        nombreDocumento: 'a.pdf',
        configuracion: CONFIGURACION,
      },
      { renderizador },
    ).catch((capturado: unknown) => capturado)

    expect(esCancelacion(error)).toBe(false)
    expect(error).toBeInstanceOf(ErrorPdf)
  })
})

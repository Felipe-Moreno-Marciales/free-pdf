import { describe, expect, it } from 'vitest'
import {
  crearPdfDesdeImagenes,
  MINIMO_IMAGENES,
  NOMBRE_IMAGENES_A_PDF,
} from '../funcionalidades/imagenes-a-pdf/crearPdfDesdeImagenes'
import type { EntradaImagen } from '../funcionalidades/imagenes-a-pdf/tipos'
import {
  calcularMargenPuntos,
  CONFIGURACION_PAGINA_PREDETERMINADA,
  TAMANOS_PAGINA,
} from '../imagenes/calcularAjusteImagen'
import { AJUSTES_NEUTROS } from '../imagenes/aplicarFiltrosImagen'
import type {
  ConfiguracionPaginaImagen,
  DimensionesImagen,
} from '../imagenes/tipos'
import { ErrorPdf } from '../pdf/erroresPdf'
import { pixelesAPuntos } from '../utilidades/unidades'
import { abrirBytes, bytesDeBlob } from './ayudas/crearPdfPrueba'
import {
  comoEntradaImagen,
  crearAdaptadorDePrueba,
  crearArchivoImagen,
} from './ayudas/crearImagenPrueba'

/** Holgura con la que se comparan medidas en punto flotante. */
const HOLGURA = 0.05

/** Construye una configuración partiendo de la predeterminada. */
function configurar(
  cambios: Partial<ConfiguracionPaginaImagen> = {},
): ConfiguracionPaginaImagen {
  return { ...CONFIGURACION_PAGINA_PREDETERMINADA, ...cambios }
}

/** Crea una entrada de imagen con las medidas indicadas. */
function crearEntrada(
  nombre: string,
  dimensiones: DimensionesImagen,
  extra: Partial<EntradaImagen> = {},
): EntradaImagen {
  const archivo = crearArchivoImagen(
    nombre,
    dimensiones.ancho,
    dimensiones.alto,
  )

  return comoEntradaImagen(archivo, 'png', dimensiones, extra)
}

/** Crea el adaptador de prueba a partir de las entradas. */
function crearAdaptador(entradas: readonly EntradaImagen[]) {
  return crearAdaptadorDePrueba(
    new Map(
      entradas.map((entrada) => [
        entrada.nombre,
        entrada.dimensiones ?? { ancho: 100, alto: 100 },
      ]),
    ),
  )
}

/** Genera el documento y devuelve el resultado junto con el adaptador usado. */
async function generar(
  entradas: readonly EntradaImagen[],
  configuracion = configurar(),
) {
  const adaptador = crearAdaptador(entradas)
  const resultado = await crearPdfDesdeImagenes(
    { imagenes: entradas, configuracion },
    { adaptador },
  )

  return { resultado, adaptador }
}

/** Devuelve las medidas de cada página del documento generado. */
async function leerMedidasPaginas(blob: Blob) {
  const documento = await abrirBytes(await bytesDeBlob(blob))

  return documento
    .getPages()
    .map((pagina) => ({ ancho: pagina.getWidth(), alto: pagina.getHeight() }))
}

describe('crearPdfDesdeImagenes: casos básicos', () => {
  it('exige al menos una imagen', async () => {
    expect(MINIMO_IMAGENES).toBe(1)

    await expect(
      crearPdfDesdeImagenes(
        { imagenes: [], configuracion: configurar() },
        { adaptador: crearAdaptador([]) },
      ),
    ).rejects.toThrow(ErrorPdf)
  })

  it('crea un documento de una página con una imagen', async () => {
    const entradas = [crearEntrada('a', { ancho: 800, alto: 600 })]

    const { resultado } = await generar(entradas)

    expect(resultado.numeroPaginas).toBe(1)
    expect(resultado.nombreArchivo).toBe(NOMBRE_IMAGENES_A_PDF)
    expect(resultado.nombreArchivo).toBe('free-pdf-imagenes.pdf')
    expect(resultado.blob.type).toBe('application/pdf')
  })

  it('crea una página por imagen', async () => {
    const entradas = [
      crearEntrada('a', { ancho: 800, alto: 600 }),
      crearEntrada('b', { ancho: 600, alto: 800 }),
      crearEntrada('c', { ancho: 500, alto: 500 }),
    ]

    const { resultado } = await generar(entradas)

    expect(resultado.numeroPaginas).toBe(3)
  })

  it('genera un documento válido que se puede volver a abrir', async () => {
    const entradas = [crearEntrada('a', { ancho: 800, alto: 600 })]

    const { resultado } = await generar(entradas)
    const documento = await abrirBytes(await bytesDeBlob(resultado.blob))

    expect(documento.getPageCount()).toBe(1)
  })

  it('informa del tamaño del documento generado', async () => {
    const entradas = [crearEntrada('a', { ancho: 400, alto: 300 })]

    const { resultado } = await generar(entradas)

    expect(resultado.tamano).toBeGreaterThan(0)
    expect(resultado.tamano).toBe(resultado.blob.size)
  })

  it('permite cambiar el nombre del archivo resultante', async () => {
    const entradas = [crearEntrada('a', { ancho: 400, alto: 300 })]
    const adaptador = crearAdaptador(entradas)

    const resultado = await crearPdfDesdeImagenes(
      {
        imagenes: entradas,
        configuracion: configurar(),
        nombreArchivo: 'otro-nombre.pdf',
      },
      { adaptador },
    )

    expect(resultado.nombreArchivo).toBe('otro-nombre.pdf')
  })
})

describe('crearPdfDesdeImagenes: orden', () => {
  it('respeta el orden en el que llegan las imágenes', async () => {
    // Cada imagen tiene una proporción distinta, así que el orden se puede leer
    // en las medidas de las páginas resultantes.
    const entradas = [
      crearEntrada('ancha', { ancho: 1600, alto: 400 }),
      crearEntrada('alta', { ancho: 400, alto: 1600 }),
    ]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'original', margen: 'sin-margen' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeGreaterThan(medidas[0].alto)
    expect(medidas[1].alto).toBeGreaterThan(medidas[1].ancho)
  })

  it('invertir la lista invierte las páginas', async () => {
    const ancha = crearEntrada('ancha', { ancho: 1600, alto: 400 })
    const alta = crearEntrada('alta', { ancho: 400, alto: 1600 })
    const configuracion = configurar({
      tamano: 'original',
      margen: 'sin-margen',
    })

    const directo = await generar([ancha, alta], configuracion)
    const invertido = await generar([alta, ancha], configuracion)

    const medidasDirectas = await leerMedidasPaginas(directo.resultado.blob)
    const medidasInvertidas = await leerMedidasPaginas(
      invertido.resultado.blob,
    )

    expect(medidasDirectas[0].ancho).toBeCloseTo(medidasInvertidas[1].ancho, 2)
    expect(medidasDirectas[1].ancho).toBeCloseTo(medidasInvertidas[0].ancho, 2)
  })

  it('prepara las imágenes en el orden de la lista', async () => {
    const entradas = [
      crearEntrada('primera', { ancho: 100, alto: 100 }),
      crearEntrada('segunda', { ancho: 100, alto: 100 }),
      crearEntrada('tercera', { ancho: 100, alto: 100 }),
    ]

    const { adaptador } = await generar(entradas)

    expect(adaptador.registro.map((peticion) => peticion.nombre)).toEqual([
      'primera.png',
      'segunda.png',
      'tercera.png',
    ])
  })

  it('informa del progreso una vez por imagen', async () => {
    const entradas = [
      crearEntrada('a', { ancho: 100, alto: 100 }),
      crearEntrada('b', { ancho: 100, alto: 100 }),
    ]
    const avisos: readonly [number, number][] = []
    const registro: [number, number][] = [...avisos]

    await crearPdfDesdeImagenes(
      { imagenes: entradas, configuracion: configurar() },
      {
        adaptador: crearAdaptador(entradas),
        alProgreso: (procesadas, total) => registro.push([procesadas, total]),
      },
    )

    expect(registro).toEqual([
      [1, 2],
      [2, 2],
    ])
  })
})

describe('crearPdfDesdeImagenes: tamaños de página', () => {
  it('usa las medidas de A4', async () => {
    const entradas = [crearEntrada('a', { ancho: 600, alto: 800 })]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'vertical' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeCloseTo(TAMANOS_PAGINA.a4.ancho, 1)
    expect(medidas[0].alto).toBeCloseTo(TAMANOS_PAGINA.a4.alto, 1)
  })

  it('usa las medidas de Carta', async () => {
    const entradas = [crearEntrada('a', { ancho: 600, alto: 800 })]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'carta', orientacion: 'vertical' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeCloseTo(612, 1)
    expect(medidas[0].alto).toBeCloseTo(792, 1)
  })

  it('usa las medidas de Legal', async () => {
    const entradas = [crearEntrada('a', { ancho: 600, alto: 800 })]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'legal', orientacion: 'vertical' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].alto).toBeCloseTo(1008, 1)
  })

  it('con el tamaño original la página se deriva de la imagen', async () => {
    const entradas = [crearEntrada('a', { ancho: 960, alto: 480 })]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'original', margen: 'sin-margen' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeCloseTo(pixelesAPuntos(960), 1)
    expect(medidas[0].alto).toBeCloseTo(pixelesAPuntos(480), 1)
  })

  it('cada página se calcula con las medidas de su propia imagen', async () => {
    const entradas = [
      crearEntrada('pequena', { ancho: 480, alto: 480 }),
      crearEntrada('grande', { ancho: 960, alto: 960 }),
    ]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'original', margen: 'sin-margen' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[1].ancho).toBeCloseTo(medidas[0].ancho * 2, 1)
  })
})

describe('crearPdfDesdeImagenes: orientación', () => {
  it('con «automática» una imagen horizontal produce una página horizontal', async () => {
    const entradas = [crearEntrada('a', { ancho: 1600, alto: 900 })]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'automatica' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeGreaterThan(medidas[0].alto)
  })

  it('con «vertical» la página es vertical aunque la imagen no lo sea', async () => {
    const entradas = [crearEntrada('a', { ancho: 1600, alto: 900 })]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'vertical' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].alto).toBeGreaterThan(medidas[0].ancho)
  })

  it('con «horizontal» la página es horizontal aunque la imagen sea vertical', async () => {
    const entradas = [crearEntrada('a', { ancho: 900, alto: 1600 })]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'horizontal' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeGreaterThan(medidas[0].alto)
  })

  it('mezcla orientaciones dentro del mismo documento con «automática»', async () => {
    const entradas = [
      crearEntrada('ancha', { ancho: 1600, alto: 900 }),
      crearEntrada('alta', { ancho: 900, alto: 1600 }),
    ]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'automatica' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeGreaterThan(medidas[0].alto)
    expect(medidas[1].alto).toBeGreaterThan(medidas[1].ancho)
  })
})

describe('crearPdfDesdeImagenes: márgenes', () => {
  it('con el tamaño original el margen agranda la página', async () => {
    const entradas = [crearEntrada('a', { ancho: 480, alto: 480 })]
    const configuracion = configurar({
      tamano: 'original',
      margen: 'mediano',
    })
    const margen = calcularMargenPuntos(configuracion)

    const { resultado } = await generar(entradas, configuracion)
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeCloseTo(pixelesAPuntos(480) + margen * 2, 1)
  })

  it('con un tamaño con nombre el margen no cambia la página', async () => {
    const entradas = [crearEntrada('a', { ancho: 600, alto: 800 })]

    const sinMargen = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'vertical', margen: 'sin-margen' }),
    )
    const conMargen = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'vertical', margen: 'grande' }),
    )

    const primeras = await leerMedidasPaginas(sinMargen.resultado.blob)
    const segundas = await leerMedidasPaginas(conMargen.resultado.blob)

    expect(primeras[0].ancho).toBeCloseTo(segundas[0].ancho, 1)
  })

  it('acepta un margen personalizado en milímetros', async () => {
    const entradas = [crearEntrada('a', { ancho: 480, alto: 480 })]
    const configuracion = configurar({
      tamano: 'original',
      margen: 'personalizado',
      margenPersonalizadoMm: 25.4,
    })

    const { resultado } = await generar(entradas, configuracion)
    const medidas = await leerMedidasPaginas(resultado.blob)

    // 25,4 mm son exactamente 72 puntos por cada lado.
    expect(medidas[0].ancho).toBeCloseTo(pixelesAPuntos(480) + 144, 1)
  })
})

describe('crearPdfDesdeImagenes: modos de ajuste', () => {
  it('el modo contener no pide ningún recorte', async () => {
    const entradas = [crearEntrada('a', { ancho: 1600, alto: 900 })]

    const { adaptador } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'contener' }),
    )

    expect(adaptador.registro[0].recorte).toBeNull()
  })

  it('el modo cubrir pide el recorte que iguala la proporción', async () => {
    const entradas = [crearEntrada('a', { ancho: 1600, alto: 900 })]

    const { adaptador } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'cubrir' }),
    )
    const recorte = adaptador.registro[0].recorte as {
      readonly izquierda: number
      readonly derecha: number
    } | null

    expect(recorte).not.toBeNull()
    expect(recorte?.izquierda).toBeGreaterThan(0)
    expect(recorte?.izquierda).toBeCloseTo(recorte?.derecha ?? -1, 6)
  })

  it('el modo cubrir no pide recorte si la proporción ya coincide', async () => {
    const entradas = [crearEntrada('a', { ancho: 800, alto: 600 })]

    const { adaptador } = await generar(
      entradas,
      configurar({
        tamano: 'original',
        margen: 'sin-margen',
        ajuste: 'cubrir',
      }),
    )

    expect(adaptador.registro[0].recorte).toBeNull()
  })

  it('el modo cubrir compone su recorte con el que ya venía puesto', async () => {
    const entradas = [
      crearEntrada('a', { ancho: 1600, alto: 900 }, {
        recorte: { izquierda: 0.1, superior: 0, derecha: 0.1, inferior: 0 },
      }),
    ]

    const { adaptador } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'vertical', ajuste: 'cubrir' }),
    )
    const recorte = adaptador.registro[0].recorte as {
      readonly izquierda: number
    } | null

    // El recorte final descarta más que el 10 % que ya venía indicado.
    expect(recorte?.izquierda).toBeGreaterThan(0.1)
  })
})

describe('crearPdfDesdeImagenes: rotaciones', () => {
  it('traslada la rotación al preparador', async () => {
    const entradas = [
      crearEntrada('a', { ancho: 800, alto: 600 }, { rotacion: 90 }),
    ]

    const { adaptador } = await generar(entradas)

    expect(adaptador.registro[0].rotacion).toBe(90)
  })

  it('una imagen girada un cuarto de vuelta produce una página girada', async () => {
    const configuracion = configurar({
      tamano: 'original',
      margen: 'sin-margen',
    })

    const sinGirar = await generar(
      [crearEntrada('a', { ancho: 960, alto: 480 })],
      configuracion,
    )
    const girada = await generar(
      [crearEntrada('a', { ancho: 960, alto: 480 }, { rotacion: 90 })],
      configuracion,
    )

    const primeras = await leerMedidasPaginas(sinGirar.resultado.blob)
    const segundas = await leerMedidasPaginas(girada.resultado.blob)

    expect(primeras[0].ancho).toBeCloseTo(segundas[0].alto, HOLGURA)
    expect(primeras[0].alto).toBeCloseTo(segundas[0].ancho, HOLGURA)
  })

  it('media vuelta no cambia las medidas de la página', async () => {
    const configuracion = configurar({
      tamano: 'original',
      margen: 'sin-margen',
    })

    const sinGirar = await generar(
      [crearEntrada('a', { ancho: 960, alto: 480 })],
      configuracion,
    )
    const girada = await generar(
      [crearEntrada('a', { ancho: 960, alto: 480 }, { rotacion: 180 })],
      configuracion,
    )

    const primeras = await leerMedidasPaginas(sinGirar.resultado.blob)
    const segundas = await leerMedidasPaginas(girada.resultado.blob)

    expect(primeras[0].ancho).toBeCloseTo(segundas[0].ancho, HOLGURA)
  })

  it('con «automática» una imagen girada cambia la orientación de la página', async () => {
    const entradas = [
      crearEntrada('a', { ancho: 1600, alto: 900 }, { rotacion: 90 }),
    ]

    const { resultado } = await generar(
      entradas,
      configurar({ tamano: 'a4', orientacion: 'automatica' }),
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].alto).toBeGreaterThan(medidas[0].ancho)
  })
})

describe('crearPdfDesdeImagenes: ajustes de color', () => {
  it('no pide ajustes cuando no se han indicado', async () => {
    const entradas = [crearEntrada('a', { ancho: 100, alto: 100 })]

    const { adaptador } = await generar(entradas)

    expect(adaptador.registro[0].ajustes).toBeNull()
  })

  it('traslada los ajustes al preparador', async () => {
    const ajustes = { ...AJUSTES_NEUTROS, filtro: 'grises' as const }
    const entradas = [
      crearEntrada('a', { ancho: 100, alto: 100 }, { ajustes }),
    ]

    const { adaptador } = await generar(entradas)

    expect(adaptador.registro[0].ajustes).toEqual(ajustes)
  })
})

describe('crearPdfDesdeImagenes: cancelación', () => {
  it('se interrumpe antes de procesar si la señal ya está cancelada', async () => {
    const entradas = [crearEntrada('a', { ancho: 100, alto: 100 })]
    const controlador = new AbortController()
    controlador.abort()

    await expect(
      crearPdfDesdeImagenes(
        { imagenes: entradas, configuracion: configurar() },
        { adaptador: crearAdaptador(entradas), senal: controlador.signal },
      ),
    ).rejects.toThrow()
  })

  it('no prepara ninguna imagen si se cancela de entrada', async () => {
    const entradas = [crearEntrada('a', { ancho: 100, alto: 100 })]
    const adaptador = crearAdaptador(entradas)
    const controlador = new AbortController()
    controlador.abort()

    await crearPdfDesdeImagenes(
      { imagenes: entradas, configuracion: configurar() },
      { adaptador, senal: controlador.signal },
    ).catch(() => undefined)

    expect(adaptador.registro).toHaveLength(0)
  })
})

describe('crearPdfDesdeImagenes: colores de fondo', () => {
  it('acepta un color de fondo válido', async () => {
    const entradas = [crearEntrada('a', { ancho: 100, alto: 100 })]

    const { resultado } = await generar(
      entradas,
      configurar({ colorFondo: '#112233' }),
    )

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('no falla con un color mal escrito: recurre al blanco', async () => {
    const entradas = [crearEntrada('a', { ancho: 100, alto: 100 })]

    const { resultado } = await generar(
      entradas,
      configurar({ colorFondo: 'no es un color' }),
    )

    expect(resultado.numeroPaginas).toBe(1)
  })
})

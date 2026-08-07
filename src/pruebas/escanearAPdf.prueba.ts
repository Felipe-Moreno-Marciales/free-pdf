import { describe, expect, it } from 'vitest'
import {
  admiteCamara,
  construirRestricciones,
  describirEstadoCamara,
  detenerFlujo,
  elegirCamaraTrasera,
  etiquetarCamara,
  reemplazarFlujo,
  traducirErrorCamara,
  type DispositivoCamara,
  type EstadoCamara,
  type FlujoDetenible,
} from '../funcionalidades/escanear-a-pdf/controlarCamara'
import {
  convertirEnEntrada,
  crearPdfEscaneado,
  NOMBRE_ESCANEADO,
} from '../funcionalidades/escanear-a-pdf/crearPdfEscaneado'
import type { CapturaEscaneada } from '../funcionalidades/escanear-a-pdf/tipos'
import { AJUSTES_NEUTROS } from '../imagenes/aplicarFiltrosImagen'
import {
  CONFIGURACION_PAGINA_PREDETERMINADA,
} from '../imagenes/calcularAjusteImagen'
import type {
  ConfiguracionPaginaImagen,
  DimensionesImagen,
} from '../imagenes/tipos'
import { ErrorPdf } from '../pdf/erroresPdf'
import { pixelesAPuntos } from '../utilidades/unidades'
import { abrirBytes, bytesDeBlob } from './ayudas/crearPdfPrueba'
import {
  crearAdaptadorDePrueba,
  crearArchivoImagen,
} from './ayudas/crearImagenPrueba'

/** Pista simulada que registra si se ha detenido. */
interface PistaSimulada {
  detenida: boolean
  stop: () => void
}

/** Flujo simulado con el número de pistas indicado. */
interface FlujoSimulado extends FlujoDetenible {
  readonly pistas: readonly PistaSimulada[]
}

/**
 * Crea un flujo de cámara simulado.
 *
 * No hace falta una cámara física: lo que hay que comprobar es que se llame a
 * `stop` en todas las pistas, que es lo que apaga la cámara de verdad.
 */
function crearFlujoSimulado(numeroPistas = 1): FlujoSimulado {
  const pistas: PistaSimulada[] = Array.from(
    { length: numeroPistas },
    () => {
      const pista: PistaSimulada = {
        detenida: false,
        stop: () => {
          pista.detenida = true
        },
      }

      return pista
    },
  )

  return { pistas, getTracks: () => pistas }
}

/** Construye una captura de prueba. */
function crearCaptura(
  nombre: string,
  dimensiones: DimensionesImagen,
  extra: Partial<CapturaEscaneada> = {},
): CapturaEscaneada {
  const archivo = crearArchivoImagen(
    nombre,
    dimensiones.ancho,
    dimensiones.alto,
  )

  return {
    id: nombre,
    nombre: archivo.name,
    contenido: archivo,
    formato: 'png',
    origen: 'camara',
    tamano: archivo.size,
    rotacion: 0,
    recorte: null,
    ajustes: AJUSTES_NEUTROS,
    dimensiones,
    ...extra,
  }
}

/** Crea el adaptador de prueba para las capturas indicadas. */
function crearAdaptador(capturas: readonly CapturaEscaneada[]) {
  return crearAdaptadorDePrueba(
    new Map(
      capturas.map((captura) => [
        captura.nombre,
        captura.dimensiones ?? { ancho: 100, alto: 100 },
      ]),
    ),
  )
}

/** Genera el documento escaneado con el adaptador de prueba. */
async function escanear(
  capturas: readonly CapturaEscaneada[],
  configuracion: ConfiguracionPaginaImagen = CONFIGURACION_PAGINA_PREDETERMINADA,
) {
  const adaptador = crearAdaptador(capturas)
  const resultado = await crearPdfEscaneado(
    { capturas, configuracion },
    { adaptador },
  )

  return { resultado, adaptador }
}

/** Lee las medidas de cada página del documento generado. */
async function leerMedidasPaginas(blob: Blob) {
  const documento = await abrirBytes(await bytesDeBlob(blob))

  return documento
    .getPages()
    .map((pagina) => ({ ancho: pagina.getWidth(), alto: pagina.getHeight() }))
}

describe('detenerFlujo', () => {
  it('detiene todas las pistas del flujo', () => {
    const flujo = crearFlujoSimulado(3)

    detenerFlujo(flujo)

    for (const pista of flujo.pistas) {
      expect(pista.detenida).toBe(true)
    }
  })

  it('tolera un flujo nulo', () => {
    expect(() => detenerFlujo(null)).not.toThrow()
  })

  it('tolera un flujo sin pistas', () => {
    expect(() => detenerFlujo({ getTracks: () => [] })).not.toThrow()
  })

  it('sigue deteniendo el resto aunque una pista falle', () => {
    const buena = crearFlujoSimulado(1).pistas[0]
    const flujo: FlujoDetenible = {
      getTracks: () => [
        {
          stop: () => {
            throw new Error('la pista ya estaba detenida')
          },
        },
        buena,
      ],
    }

    expect(() => detenerFlujo(flujo)).not.toThrow()
    expect(buena.detenida).toBe(true)
  })

  it('tolera que el propio flujo falle al enumerar sus pistas', () => {
    const flujo: FlujoDetenible = {
      getTracks: () => {
        throw new Error('flujo no disponible')
      },
    }

    expect(() => detenerFlujo(flujo)).not.toThrow()
  })
})

describe('reemplazarFlujo', () => {
  it('detiene el flujo anterior y devuelve el nuevo', () => {
    const anterior = crearFlujoSimulado(2)
    const siguiente = crearFlujoSimulado(1)

    const resultado = reemplazarFlujo(anterior, siguiente)

    expect(resultado).toBe(siguiente)
    expect(anterior.pistas.every((pista) => pista.detenida)).toBe(true)
    expect(siguiente.pistas[0].detenida).toBe(false)
  })

  it('funciona cuando no había flujo anterior', () => {
    const siguiente = crearFlujoSimulado(1)

    expect(reemplazarFlujo(null, siguiente)).toBe(siguiente)
    expect(siguiente.pistas[0].detenida).toBe(false)
  })

  it('no detiene el flujo si es el mismo que ya estaba', () => {
    const flujo = crearFlujoSimulado(1)

    reemplazarFlujo(flujo, flujo)

    expect(flujo.pistas[0].detenida).toBe(false)
  })
})

describe('traducirErrorCamara', () => {
  /** Construye un error con el nombre que usan las API del navegador. */
  function errorConNombre(nombre: string): Error {
    const error = new Error('simulado')
    error.name = nombre

    return error
  }

  it('trata el permiso rechazado como denegado', () => {
    const traducido = traducirErrorCamara(errorConNombre('NotAllowedError'))

    expect(traducido.estado).toBe('denegada')
    expect(traducido.mensaje).toContain('permiso')
    expect(traducido.mensaje).toContain('cargar fotografías')
  })

  it('trata el nombre antiguo del permiso rechazado igual', () => {
    expect(traducirErrorCamara(errorConNombre('PermissionDeniedError')).estado).toBe(
      'denegada',
    )
  })

  it('trata un contexto no seguro como permiso denegado', () => {
    expect(traducirErrorCamara(errorConNombre('SecurityError')).estado).toBe(
      'denegada',
    )
  })

  it('trata la ausencia de cámara como no disponible', () => {
    const traducido = traducirErrorCamara(errorConNombre('NotFoundError'))

    expect(traducido.estado).toBe('no-disponible')
    expect(traducido.mensaje).toContain('No se encontró ninguna cámara')
  })

  it('trata unas restricciones imposibles como no disponible', () => {
    expect(
      traducirErrorCamara(errorConNombre('OverconstrainedError')).estado,
    ).toBe('no-disponible')
  })

  it('explica que otra aplicación está usando la cámara', () => {
    const traducido = traducirErrorCamara(errorConNombre('NotReadableError'))

    expect(traducido.estado).toBe('error')
    expect(traducido.mensaje).toContain('otra aplicación')
  })

  it('trata la interrupción del navegador como error recuperable', () => {
    expect(traducirErrorCamara(errorConNombre('AbortError')).estado).toBe('error')
  })

  it('recurre a un mensaje general con un error desconocido', () => {
    const traducido = traducirErrorCamara(errorConNombre('AlgoRaro'))

    expect(traducido.estado).toBe('error')
    expect(traducido.mensaje).toContain('HTTPS')
  })

  it('tolera valores que no son errores', () => {
    expect(traducirErrorCamara('texto suelto').estado).toBe('error')
    expect(traducirErrorCamara(null).estado).toBe('error')
    expect(traducirErrorCamara({ name: 'NotAllowedError' }).estado).toBe(
      'denegada',
    )
  })

  it('todos los mensajes están en español y no traen jerga técnica', () => {
    const nombres = [
      'NotAllowedError',
      'NotFoundError',
      'NotReadableError',
      'AbortError',
      'Desconocido',
    ]

    for (const nombre of nombres) {
      const mensaje = traducirErrorCamara(errorConNombre(nombre)).mensaje

      expect(mensaje).not.toContain('Error:')
      expect(mensaje.length).toBeGreaterThan(20)
      expect(mensaje.endsWith('.')).toBe(true)
    }
  })
})

describe('elegirCamaraTrasera', () => {
  /** Construye una lista de cámaras a partir de sus etiquetas. */
  function camaras(...etiquetas: readonly string[]): DispositivoCamara[] {
    return etiquetas.map((etiqueta, posicion) => ({
      id: `id-${posicion}`,
      etiqueta,
    }))
  }

  it('devuelve nulo cuando no hay cámaras', () => {
    expect(elegirCamaraTrasera([])).toBeNull()
  })

  it('prefiere una cámara con la palabra «back»', () => {
    const elegida = elegirCamaraTrasera(
      camaras('Front Camera', 'Back Camera'),
    )

    expect(elegida?.etiqueta).toBe('Back Camera')
  })

  it('reconoce la palabra en español', () => {
    const elegida = elegirCamaraTrasera(
      camaras('Cámara frontal', 'Cámara trasera'),
    )

    expect(elegida?.etiqueta).toBe('Cámara trasera')
  })

  it('reconoce «environment», que es el término de la especificación', () => {
    expect(
      elegirCamaraTrasera(camaras('user camera', 'environment camera'))?.etiqueta,
    ).toBe('environment camera')
  })

  it('descarta las frontales cuando no puede identificar la trasera', () => {
    const elegida = elegirCamaraTrasera(camaras('Front camera', 'Camera 2'))

    expect(elegida?.etiqueta).toBe('Camera 2')
  })

  it('recurre a la primera cuando todas parecen frontales', () => {
    const elegida = elegirCamaraTrasera(camaras('Front A', 'Selfie B'))

    expect(elegida?.etiqueta).toBe('Front A')
  })

  it('no distingue mayúsculas de minúsculas', () => {
    expect(elegirCamaraTrasera(camaras('a', 'BACK'))?.etiqueta).toBe('BACK')
  })

  it('con una sola cámara devuelve esa', () => {
    expect(elegirCamaraTrasera(camaras('La única'))?.etiqueta).toBe('La única')
  })
})

describe('etiquetarCamara', () => {
  it('conserva la etiqueta del navegador cuando existe', () => {
    expect(etiquetarCamara('Cámara integrada', 0)).toBe('Cámara integrada')
  })

  it('genera un nombre cuando el navegador la oculta', () => {
    expect(etiquetarCamara('', 0)).toBe('Cámara 1')
    expect(etiquetarCamara('   ', 2)).toBe('Cámara 3')
  })
})

describe('construirRestricciones', () => {
  it('sin identificador pide la cámara orientada al entorno', () => {
    const restricciones = construirRestricciones(null)

    expect(restricciones.audio).toBe(false)
    expect(restricciones.video).toEqual({ facingMode: { ideal: 'environment' } })
  })

  it('con identificador pide esa cámara concreta', () => {
    const restricciones = construirRestricciones('camara-2')

    expect(restricciones.video).toEqual({
      deviceId: { exact: 'camara-2' },
    })
  })

  it('nunca pide audio', () => {
    expect(construirRestricciones(null).audio).toBe(false)
    expect(construirRestricciones('x').audio).toBe(false)
  })
})

describe('admiteCamara y describirEstadoCamara', () => {
  it('en Node, sin navegador, la cámara no está disponible', () => {
    expect(admiteCamara()).toBe(false)
  })

  it('describe los seis estados en español', () => {
    const estados: readonly EstadoCamara[] = [
      'sin-solicitar',
      'solicitando',
      'activa',
      'denegada',
      'no-disponible',
      'error',
    ]
    const descripciones = estados.map(describirEstadoCamara)

    expect(new Set(descripciones).size).toBe(estados.length)
    for (const descripcion of descripciones) {
      expect(descripcion.length).toBeGreaterThan(10)
    }
  })
})

describe('convertirEnEntrada', () => {
  it('traslada el giro, el recorte y las medidas', () => {
    const captura = crearCaptura('a', { ancho: 100, alto: 80 }, {
      rotacion: 90,
      recorte: { izquierda: 0.1, superior: 0, derecha: 0, inferior: 0 },
    })

    const entrada = convertirEnEntrada(captura)

    expect(entrada.rotacion).toBe(90)
    expect(entrada.recorte).toEqual(captura.recorte)
    expect(entrada.dimensiones).toEqual({ ancho: 100, alto: 80 })
  })

  it('omite los ajustes cuando no modifican nada', () => {
    const captura = crearCaptura('a', { ancho: 100, alto: 80 })

    expect(convertirEnEntrada(captura).ajustes).toBeNull()
  })

  it('conserva los ajustes cuando sí modifican la imagen', () => {
    const ajustes = { ...AJUSTES_NEUTROS, filtro: 'grises' as const }
    const captura = crearCaptura('a', { ancho: 100, alto: 80 }, { ajustes })

    expect(convertirEnEntrada(captura).ajustes).toEqual(ajustes)
  })

  it('conserva unos ajustes con brillo o contraste', () => {
    const ajustes = { ...AJUSTES_NEUTROS, brillo: 20 }
    const captura = crearCaptura('a', { ancho: 100, alto: 80 }, { ajustes })

    expect(convertirEnEntrada(captura).ajustes).toEqual(ajustes)
  })
})

describe('crearPdfEscaneado', () => {
  it('exige al menos una captura', async () => {
    await expect(
      crearPdfEscaneado(
        { capturas: [], configuracion: CONFIGURACION_PAGINA_PREDETERMINADA },
        { adaptador: crearAdaptador([]) },
      ),
    ).rejects.toThrow(ErrorPdf)
  })

  it('genera un documento válido con el nombre esperado', async () => {
    const capturas = [crearCaptura('a', { ancho: 800, alto: 600 })]

    const { resultado } = await escanear(capturas)

    expect(resultado.nombreArchivo).toBe(NOMBRE_ESCANEADO)
    expect(resultado.nombreArchivo).toBe('free-pdf-escaneado.pdf')
    expect(resultado.blob.type).toBe('application/pdf')
    expect(resultado.numeroPaginas).toBe(1)
  })

  it('crea una página por captura', async () => {
    const capturas = [
      crearCaptura('a', { ancho: 800, alto: 600 }),
      crearCaptura('b', { ancho: 600, alto: 800 }),
      crearCaptura('c', { ancho: 500, alto: 500 }),
    ]

    const { resultado } = await escanear(capturas)

    expect(resultado.numeroPaginas).toBe(3)
  })

  it('respeta el orden de las capturas', async () => {
    const capturas = [
      crearCaptura('ancha', { ancho: 1600, alto: 400 }),
      crearCaptura('alta', { ancho: 400, alto: 1600 }),
    ]

    const { adaptador } = await escanear(capturas)

    expect(adaptador.registro.map((peticion) => peticion.nombre)).toEqual([
      'ancha.png',
      'alta.png',
    ])
  })

  it('mezcla capturas de cámara e imágenes cargadas', async () => {
    const capturas = [
      crearCaptura('camara', { ancho: 800, alto: 600 }),
      crearCaptura('archivo', { ancho: 800, alto: 600 }, { origen: 'archivo' }),
    ]

    const { resultado } = await escanear(capturas)

    expect(resultado.numeroPaginas).toBe(2)
  })
})

describe('crearPdfEscaneado: rotaciones, recortes y filtros', () => {
  it('traslada la rotación al preparador', async () => {
    const capturas = [
      crearCaptura('a', { ancho: 800, alto: 600 }, { rotacion: 270 }),
    ]

    const { adaptador } = await escanear(capturas)

    expect(adaptador.registro[0].rotacion).toBe(270)
  })

  it('una captura girada produce una página girada', async () => {
    const configuracion: ConfiguracionPaginaImagen = {
      ...CONFIGURACION_PAGINA_PREDETERMINADA,
      tamano: 'original',
      margen: 'sin-margen',
    }

    const sinGirar = await escanear(
      [crearCaptura('a', { ancho: 960, alto: 480 })],
      configuracion,
    )
    const girada = await escanear(
      [crearCaptura('a', { ancho: 960, alto: 480 }, { rotacion: 90 })],
      configuracion,
    )

    const primeras = await leerMedidasPaginas(sinGirar.resultado.blob)
    const segundas = await leerMedidasPaginas(girada.resultado.blob)

    expect(primeras[0].ancho).toBeCloseTo(segundas[0].alto, 1)
  })

  it('traslada el recorte al preparador', async () => {
    const recorte = {
      izquierda: 0.1,
      superior: 0.2,
      derecha: 0.1,
      inferior: 0,
    }
    const capturas = [
      crearCaptura('a', { ancho: 1000, alto: 1000 }, { recorte }),
    ]

    const { adaptador } = await escanear(capturas, {
      ...CONFIGURACION_PAGINA_PREDETERMINADA,
      tamano: 'original',
      margen: 'sin-margen',
    })

    expect(adaptador.registro[0].recorte).toEqual(recorte)
  })

  it('el recorte reduce las medidas de la página', async () => {
    const configuracion: ConfiguracionPaginaImagen = {
      ...CONFIGURACION_PAGINA_PREDETERMINADA,
      tamano: 'original',
      margen: 'sin-margen',
    }

    const { resultado } = await escanear(
      [
        crearCaptura('a', { ancho: 1000, alto: 1000 }, {
          recorte: {
            izquierda: 0.25,
            superior: 0,
            derecha: 0.25,
            inferior: 0,
          },
        }),
      ],
      configuracion,
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeCloseTo(pixelesAPuntos(500), 1)
    expect(medidas[0].alto).toBeCloseTo(pixelesAPuntos(1000), 1)
  })

  it('traslada el filtro al preparador', async () => {
    const ajustes = {
      ...AJUSTES_NEUTROS,
      filtro: 'blanco-y-negro' as const,
      contraste: 30,
    }
    const capturas = [
      crearCaptura('a', { ancho: 800, alto: 600 }, { ajustes }),
    ]

    const { adaptador } = await escanear(capturas)

    expect(adaptador.registro[0].ajustes).toEqual(ajustes)
  })

  it('el recorte se compone con el del modo cubrir', async () => {
    const capturas = [
      crearCaptura('a', { ancho: 1600, alto: 900 }, {
        recorte: {
          izquierda: 0.1,
          superior: 0,
          derecha: 0.1,
          inferior: 0,
        },
      }),
    ]

    const { adaptador } = await escanear(capturas, {
      ...CONFIGURACION_PAGINA_PREDETERMINADA,
      tamano: 'a4',
      orientacion: 'vertical',
      ajuste: 'cubrir',
    })
    const recorte = adaptador.registro[0].recorte as {
      readonly izquierda: number
    } | null

    expect(recorte?.izquierda).toBeGreaterThan(0.1)
  })
})

describe('crearPdfEscaneado: configuración de página', () => {
  it('usa el tamaño A4', async () => {
    const { resultado } = await escanear(
      [crearCaptura('a', { ancho: 600, alto: 800 })],
      {
        ...CONFIGURACION_PAGINA_PREDETERMINADA,
        tamano: 'a4',
        orientacion: 'vertical',
      },
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeCloseTo(595.28, 1)
    expect(medidas[0].alto).toBeCloseTo(841.89, 1)
  })

  it('usa el tamaño Carta', async () => {
    const { resultado } = await escanear(
      [crearCaptura('a', { ancho: 600, alto: 800 })],
      {
        ...CONFIGURACION_PAGINA_PREDETERMINADA,
        tamano: 'carta',
        orientacion: 'vertical',
      },
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeCloseTo(612, 1)
  })

  it('con orientación automática cada página adopta la de su captura', async () => {
    const { resultado } = await escanear(
      [
        crearCaptura('ancha', { ancho: 1600, alto: 900 }),
        crearCaptura('alta', { ancho: 900, alto: 1600 }),
      ],
      {
        ...CONFIGURACION_PAGINA_PREDETERMINADA,
        tamano: 'a4',
        orientacion: 'automatica',
      },
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeGreaterThan(medidas[0].alto)
    expect(medidas[1].alto).toBeGreaterThan(medidas[1].ancho)
  })

  it('el modo contener es el predeterminado y no recorta', async () => {
    const { adaptador } = await escanear([
      crearCaptura('a', { ancho: 1600, alto: 900 }),
    ])

    expect(CONFIGURACION_PAGINA_PREDETERMINADA.ajuste).toBe('contener')
    expect(adaptador.registro[0].recorte).toBeNull()
  })

  it('aplica los márgenes al tamaño original', async () => {
    const { resultado } = await escanear(
      [crearCaptura('a', { ancho: 480, alto: 480 })],
      {
        ...CONFIGURACION_PAGINA_PREDETERMINADA,
        tamano: 'original',
        margen: 'mediano',
      },
    )
    const medidas = await leerMedidasPaginas(resultado.blob)

    expect(medidas[0].ancho).toBeGreaterThan(pixelesAPuntos(480))
  })
})

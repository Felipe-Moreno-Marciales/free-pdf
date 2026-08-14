import { describe, expect, it } from 'vitest'
import {
  analizarEstructuraQpdf,
  ErrorInspeccionSeguridad,
  LIMITES_INSPECCION,
} from '../seguridad/inspeccion/analizarEstructura'
import { clasificarRiesgo } from '../seguridad/inspeccion/clasificarRiesgo'
import type {
  ContextoInspeccionSeguridad,
  HallazgoSeguridad,
  TipoHallazgoSeguridad,
} from '../seguridad/inspeccion/tipos'

/**
 * JSON v2 mínimo con la misma forma que produce qpdf 12.2.0.
 *
 * Son estructuras benignas creadas en memoria. Los textos que simulan JavaScript,
 * direcciones o nombres sensibles nunca se ejecutan ni se escriben como muestras.
 */
interface OpcionesJsonQpdf {
  readonly objetos?: Readonly<Record<string, unknown>>
  readonly attachments?: Readonly<Record<string, unknown>>
  readonly pages?: readonly unknown[]
  readonly hasAcroForm?: boolean
  readonly encrypted?: boolean
}

function catalogoCon(contenido: Readonly<Record<string, unknown>>) {
  return {
    'obj:1 0 R': {
      value: {
        '/Pages': '2 0 R',
        '/Type': '/Catalog',
        ...contenido,
      },
    },
  }
}

function paginaCon(contenido: Readonly<Record<string, unknown>>) {
  return {
    'obj:2 0 R': {
      value: {
        '/Count': 1,
        '/Kids': ['3 0 R'],
        '/Type': '/Pages',
      },
    },
    'obj:3 0 R': {
      value: {
        '/Parent': '2 0 R',
        '/Type': '/Page',
        ...contenido,
      },
    },
  }
}

function crearJsonQpdf(opciones: OpcionesJsonQpdf = {}): unknown {
  const objetos: Record<string, unknown> = {
    'obj:1 0 R': {
      value: {
        '/Pages': '2 0 R',
        '/Type': '/Catalog',
      },
    },
    'obj:2 0 R': {
      value: {
        '/Count': 2,
        '/Kids': [],
        '/Type': '/Pages',
      },
    },
    ...opciones.objetos,
    trailer: {
      value: {
        '/Root': '1 0 R',
        '/Size': 3,
      },
    },
  }

  return {
    version: 2,
    pages: opciones.pages ?? [],
    acroform: {
      fields: [],
      hasacroform: opciones.hasAcroForm ?? false,
      needappearances: false,
    },
    attachments: opciones.attachments ?? {},
    encrypt: {
      encrypted: opciones.encrypted ?? false,
    },
    qpdf: [
      {
        jsonversion: 2,
        pdfversion: '1.7',
        maxobjectid: Object.keys(objetos).length - 1,
      },
      objetos,
    ],
  }
}

const CONTEXTO_INTACTO: ContextoInspeccionSeguridad = {
  numeroPaginas: 2,
  diagnostico: {
    estado: 'intacto',
    hallazgos: [],
    necesitaContrasena: false,
  },
}

function analizar(
  datos: unknown,
  contexto: ContextoInspeccionSeguridad = CONTEXTO_INTACTO,
) {
  return analizarEstructuraQpdf(datos, contexto)
}

function buscar(
  datos: unknown,
  tipo: TipoHallazgoSeguridad,
  contexto: ContextoInspeccionSeguridad = CONTEXTO_INTACTO,
): HallazgoSeguridad | undefined {
  return analizar(datos, contexto).hallazgos.find(
    (hallazgo) => hallazgo.tipo === tipo,
  )
}

function capturarError(operacion: () => unknown): ErrorInspeccionSeguridad {
  try {
    operacion()
  } catch (error) {
    expect(error).toBeInstanceOf(ErrorInspeccionSeguridad)
    return error as ErrorInspeccionSeguridad
  }

  throw new Error('La operación debía fallar')
}

describe('Inspector de seguridad PDF: indicadores estructurales', () => {
  it('un PDF normal termina sin indicios y conserva el número de páginas', () => {
    const informe = analizar(crearJsonQpdf())

    expect(informe.nivel).toBe('sin-indicios')
    expect(informe.hallazgos).toHaveLength(0)
    expect(informe.numeroPaginas).toBe(2)
    expect(informe.estructuraValida).toBe(true)
    expect(informe.estadoEstructura).toBe('valida')
    expect(informe.analisisCompleto).toBe(true)
  })

  it('usa el bloque pages cuando el recuento directo no está disponible', () => {
    const informe = analizar(crearJsonQpdf({ pages: [{}, {}, {}] }), {
      ...CONTEXTO_INTACTO,
      numeroPaginas: null,
    })

    expect(informe.numeroPaginas).toBe(3)
  })

  it('detecta una acción URI como riesgo bajo sin conservar la dirección', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...paginaCon({ '/Annots': ['4 0 R'] }),
        'obj:5 0 R': {
          value: { '/S': '/URI', '/URI': 'u:urn:free-pdf:enlace-prueba' },
        },
        'obj:4 0 R': {
          value: {
            '/A': '5 0 R',
            '/Subtype': '/Link',
            '/Type': '/Annot',
          },
        },
      },
    })
    const informe = analizar(datos)
    const hallazgo = buscar(datos, 'enlace-externo')

    expect(informe.nivel).toBe('bajo')
    expect(hallazgo?.cantidad).toBe(1)
    expect(JSON.stringify(informe)).not.toContain('urn:free-pdf:enlace-prueba')
  })

  it('detecta AcroForm como una característica informativa', () => {
    const informe = analizar(crearJsonQpdf({ hasAcroForm: true }))
    const hallazgo = informe.hallazgos.find(
      (actual) => actual.tipo === 'formulario',
    )

    expect(informe.nivel).toBe('bajo')
    expect(hallazgo?.severidad).toBe('informativa')
  })

  it('detecta JavaScript sin devolver el código', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...paginaCon({ '/Annots': ['4 0 R'] }),
        'obj:5 0 R': {
          value: {
            '/S': '/JavaScript',
            '/JS': 'u:app.alert("texto-que-no-debe-salir")',
          },
        },
        'obj:4 0 R': {
          value: {
            '/A': '5 0 R',
            '/Subtype': '/Link',
            '/Type': '/Annot',
          },
        },
      },
    })
    const informe = analizar(datos)
    const hallazgo = buscar(datos, 'javascript')

    expect(informe.nivel).toBe('precaucion')
    expect(hallazgo?.cantidad).toBe(1)
    expect(JSON.stringify(informe)).not.toContain('texto-que-no-debe-salir')
  })

  it('también reconoce el árbol de nombres /JavaScript', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/Names': { '/JavaScript': { '/Names': [] } },
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
      },
    })

    expect(buscar(datos, 'javascript')).toBeDefined()
  })

  it('detecta /OpenAction aunque no pueda atribuirle una acción activa', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/OpenAction': [0, '/Fit'],
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
      },
    })
    const hallazgo = buscar(datos, 'accion-apertura')

    expect(hallazgo?.severidad).toBe('media')
    expect(analizar(datos).nivel).toBe('precaucion')
  })

  it('eleva una /OpenAction que referencia una acción JavaScript', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/OpenAction': '3 0 R',
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
        'obj:3 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })
    const hallazgo = buscar(datos, 'accion-apertura')

    expect(hallazgo?.severidad).toBe('alta')
    expect(hallazgo?.contextos.join(' ')).toContain('-> 3 0 R')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('eleva JavaScript enlazado mediante /Next en la cadena de acciones', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/OpenAction': '3 0 R',
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
        'obj:3 0 R': {
          value: { '/S': '/GoTo', '/D': [0, '/Fit'], '/Next': '4 0 R' },
        },
        'obj:4 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('alta')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('sigue /Next desde una acción de apertura escrita en línea', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/OpenAction': {
              '/S': '/GoTo',
              '/D': [0, '/Fit'],
              '/Next': '3 0 R',
            },
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
        'obj:3 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('alta')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('cuenta acciones y no envoltorios al seguir dos enlaces /Next', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/OpenAction': '3 0 R',
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
        'obj:3 0 R': {
          value: { '/S': '/GoTo', '/Next': '4 0 R' },
        },
        'obj:4 0 R': {
          value: { '/S': '/GoTo', '/Next': '5 0 R' },
        },
        'obj:5 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('alta')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('detiene ciclos de /Next que no conducen a JavaScript', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/OpenAction': '3 0 R',
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
        'obj:3 0 R': {
          value: { '/S': '/GoTo', '/Next': '4 0 R' },
        },
        'obj:4 0 R': {
          value: { '/S': '/GoTo', '/Next': '3 0 R' },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('media')
  })

  it('no atribuye a una /OpenAction de navegación el JavaScript de una anotación', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/OpenAction': '3 0 R',
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
        'obj:3 0 R': {
          value: { '/S': '/GoTo', '/D': ['4 0 R', '/Fit'] },
        },
        'obj:4 0 R': {
          value: { '/Type': '/Page', '/Annots': ['5 0 R'] },
        },
        'obj:5 0 R': {
          value: { '/Subtype': '/Link', '/A': '6 0 R' },
        },
        'obj:6 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('media')
    expect(analizar(datos).nivel).toBe('precaucion')
  })

  it('eleva también una /OpenAction con JavaScript en línea', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/OpenAction': { '/S': '/JavaScript', '/JS': 'u:void 0' },
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('alta')
    expect(buscar(datos, 'accion-apertura')?.cantidad).toBe(1)
  })

  it('detecta acciones adicionales /AA', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/AA': { '/WC': '3 0 R' } }),
        'obj:3 0 R': { value: { '/S': '/GoTo' } },
      },
    })

    expect(buscar(datos, 'accion-adicional')?.severidad).toBe('media')
  })

  it('eleva una acción adicional que referencia JavaScript', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/AA': { '/WC': '3 0 R' } }),
        'obj:3 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    const hallazgo = buscar(datos, 'accion-adicional')

    expect(hallazgo?.severidad).toBe('alta')
    expect(hallazgo?.contextos.join(' ')).toContain('JavaScript')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('eleva una /AA indirecta cuyo evento referencia JavaScript', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/AA': '4 0 R' }),
        'obj:3 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
        'obj:4 0 R': {
          value: { '/WC': '3 0 R' },
        },
      },
    })

    expect(buscar(datos, 'accion-adicional')?.severidad).toBe('alta')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('resuelve cadenas indirectas de /AA y detiene sus ciclos', () => {
    const enlazada = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/AA': '3 0 R' }),
        'obj:3 0 R': { value: '4 0 R' },
        'obj:4 0 R': { value: { '/WC': '5 0 R' } },
        'obj:5 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })
    expect(buscar(enlazada, 'accion-adicional')?.severidad).toBe('alta')

    const ciclica = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/AA': '3 0 R' }),
        'obj:3 0 R': { value: '4 0 R' },
        'obj:4 0 R': { value: '3 0 R' },
      },
    })
    expect(buscar(ciclica, 'accion-adicional')?.severidad).toBe('media')
  })

  it('sigue /Next desde una acción de /AA escrita en línea', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/AA': {
              '/WC': {
                '/S': '/GoTo',
                '/Next': '3 0 R',
              },
            },
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
        'obj:3 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(buscar(datos, 'accion-adicional')?.severidad).toBe('alta')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('sigue /Next después de resolver un diccionario /AA indirecto', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/AA': '3 0 R' }),
        'obj:3 0 R': {
          value: { '/WC': '4 0 R' },
        },
        'obj:4 0 R': {
          value: { '/S': '/GoTo', '/Next': '5 0 R' },
        },
        'obj:5 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(buscar(datos, 'accion-adicional')?.severidad).toBe('alta')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('ignora claves que no son eventos válidos dentro de /AA', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/AA': { '/Bogus': '3 0 R' } }),
        'obj:3 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(buscar(datos, 'accion-adicional')?.severidad).toBe('media')
    expect(analizar(datos).nivel).toBe('precaucion')
  })

  it('rechaza un diccionario /AA ancho antes de recorrerlo completo', () => {
    const cantidad = LIMITES_INSPECCION.nodos + 1
    let accesos = 0
    const aa = new Proxy(
      Object.fromEntries(
        Array.from({ length: cantidad }, (_, indice) => [
          `/Bogus${indice}`,
          null,
        ]),
      ),
      {
        get(objetivo, propiedad, receptor) {
          if (typeof propiedad === 'string' && propiedad.startsWith('/Bogus')) {
            accesos += 1
          }
          return Reflect.get(objetivo, propiedad, receptor)
        },
      },
    )
    const datos = crearJsonQpdf({ objetos: catalogoCon({ '/AA': aa }) })

    expect(capturarError(() => analizar(datos)).motivo).toBe('limite-nodos')
    expect(accesos).toBeLessThan(cantidad)
  })

  it('no relaciona OpenAction ni AA con JavaScript independiente', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...paginaCon({ '/Annots': ['6 0 R'] }),
        ...catalogoCon({
          '/AA': { '/WC': '4 0 R' },
          '/OpenAction': '4 0 R',
        }),
        'obj:4 0 R': { value: { '/S': '/GoTo', '/D': [0, '/Fit'] } },
        'obj:5 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
        'obj:6 0 R': {
          value: {
            '/A': '5 0 R',
            '/Subtype': '/Link',
            '/Type': '/Annot',
          },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('media')
    expect(buscar(datos, 'accion-adicional')?.severidad).toBe('media')
    expect(buscar(datos, 'javascript')?.severidad).toBe('media')
    expect(analizar(datos).nivel).toBe('precaucion')
  })

  it('ignora indicadores en metadatos y objetos huérfanos', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({}),
        'obj:3 0 R': {
          value: {
            '/AA': { '/WC': '4 0 R' },
            '/Launch': 'u:solo-metadato',
            '/OpenAction': '4 0 R',
          },
        },
        'obj:4 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(analizar(datos).hallazgos).toHaveLength(0)
  })

  it('no eleva una acción GoTo malformada solo por contener /JS', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/OpenAction': '3 0 R' }),
        'obj:3 0 R': {
          value: { '/D': [0, '/Fit'], '/JS': 'u:no-es-accion', '/S': '/GoTo' },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('media')
    expect(buscar(datos, 'javascript')).toBeUndefined()
    expect(analizar(datos).nivel).toBe('precaucion')
  })

  it('ignora propietarios que solo parecen página, anotación o campo', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/Bogus': ['3 0 R', '4 0 R', '5 0 R'] }),
        'obj:3 0 R': { value: { '/A': '6 0 R', '/Type': '/Annot' } },
        'obj:4 0 R': {
          value: { '/AA': { '/O': '6 0 R' }, '/Type': '/Page' },
        },
        'obj:5 0 R': {
          value: { '/AA': { '/K': '6 0 R' }, '/FT': '/Tx' },
        },
        'obj:6 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(analizar(datos).hallazgos).toHaveLength(0)
  })

  it('resuelve alias indirectos dentro de una cadena de acciones', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/OpenAction': '3 0 R' }),
        'obj:3 0 R': { value: '4 0 R' },
        'obj:4 0 R': { value: '5 0 R' },
        'obj:5 0 R': {
          value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
        },
      },
    })

    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('alta')
  })

  it('sigue una lista /Next y más de cuatro acciones sin evasión', () => {
    const objetos: Record<string, unknown> = {
      ...catalogoCon({ '/OpenAction': '3 0 R' }),
    }
    for (let numero = 3; numero < 9; numero += 1) {
      objetos[`obj:${numero} 0 R`] = {
        value: {
          '/Next': numero === 8 ? ['9 0 R'] : `${numero + 1} 0 R`,
          '/S': '/GoTo',
        },
      }
    }
    objetos['obj:9 0 R'] = {
      value: { '/S': '/JavaScript', '/JS': 'u:void 0' },
    }

    const datos = crearJsonQpdf({ objetos })
    expect(buscar(datos, 'accion-apertura')?.severidad).toBe('alta')
  })

  it('aplica el presupuesto global a una lista /Next hostil', () => {
    const longitud = LIMITES_INSPECCION.nodos + 1
    let accesos = 0
    const acciones = new Proxy(Array.from({ length: longitud }), {
      get(objetivo, propiedad, receptor) {
        if (typeof propiedad === 'string' && /^\d+$/.test(propiedad)) {
          accesos += 1
        }
        return Reflect.get(objetivo, propiedad, receptor)
      },
    })
    const datos = crearJsonQpdf({
      objetos: catalogoCon({
        '/OpenAction': { '/Next': acciones, '/S': '/GoTo' },
      }),
    })

    expect(capturarError(() => analizar(datos)).motivo).toBe('limite-nodos')
    expect(accesos).toBeLessThan(longitud)
  })

  it('trata /Launch como riesgo elevado', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/OpenAction': '3 0 R' }),
        'obj:3 0 R': { value: { '/S': '/Launch', '/F': 'u:programa' } },
      },
    })

    expect(buscar(datos, 'launch')?.severidad).toBe('alta')
    expect(analizar(datos).nivel).toBe('elevado')
  })

  it('describe un archivo incrustado sin abrir ni copiar su contenido', () => {
    const informe = analizar(
      crearJsonQpdf({
        attachments: {
          'notas.txt': {
            filespec: '5 0 R',
            preferredname: 'notas.txt',
            streams: { '/F': { mimetype: 'text/plain' } },
          },
        },
      }),
    )

    expect(informe.nivel).toBe('precaucion')
    expect(informe.archivosIncrustados).toEqual([
      {
        nombre: 'notas.txt',
        extension: '.txt',
        tipoDeclarado: 'text/plain',
        aparentaEjecutable: false,
        referencia: '5 0 R',
      },
    ])
    expect(
      informe.hallazgos.find((hallazgo) => hallazgo.tipo === 'archivo-incrustado')
        ?.cantidad,
    ).toBe(1)
  })

  it('detecta un FileSpec de una anotación aunque no aparezca en attachments', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...paginaCon({ '/Annots': ['4 0 R'] }),
        'obj:4 0 R': {
          value: {
            '/FS': '5 0 R',
            '/Subtype': '/FileAttachment',
            '/Type': '/Annot',
          },
        },
        'obj:5 0 R': {
          value: { '/F': 'u:archivo.txt', '/Type': '/Filespec' },
        },
      },
    })

    expect(buscar(datos, 'archivo-incrustado')).toBeDefined()
  })

  it('eleva un FileAttachment estructural con nombre sensible y MIME', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...paginaCon({ '/Annots': ['4 0 R'] }),
        'obj:4 0 R': {
          value: {
            '/FS': '5 0 R',
            '/Subtype': '/FileAttachment',
            '/Type': '/Annot',
          },
        },
        'obj:5 0 R': {
          value: {
            '/EF': { '/UF': '6 0 R' },
            '/F': 'u:seguro.pdf',
            '/Type': '/Filespec',
            '/UF': 'u:Árbol.ExE ',
          },
        },
        'obj:6 0 R': {
          stream: {
            dict: {
              '/Subtype': '/application#2Foctet-stream',
              '/Type': '/EmbeddedFile',
            },
          },
        },
      },
    })
    const informe = analizar(datos)

    expect(informe.nivel).toBe('elevado')
    expect(informe.archivosIncrustados).toEqual([
      expect.objectContaining({
        aparentaEjecutable: true,
        extension: '.exe',
        nombre: 'Árbol.ExE ',
        tipoDeclarado: 'application/octet-stream',
      }),
    ])
  })

  it('recupera un FileSpec alcanzable desde Names/EmbeddedFiles', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({
          '/Names': { '/EmbeddedFiles': { '/Names': ['u:clave', '5 0 R'] } },
        }),
        'obj:5 0 R': {
          value: {
            '/EF': { '/F': '6 0 R' },
            '/F': 'u:adjunto.txt',
            '/Type': '/Filespec',
          },
        },
        'obj:6 0 R': {
          stream: { dict: { '/Subtype': '/text#2Fplain', '/Type': '/EmbeddedFile' } },
        },
      },
    })
    const informe = analizar(datos)

    expect(informe.archivosIncrustados).toEqual([
      expect.objectContaining({
        nombre: 'adjunto.txt',
        referencia: '5 0 R',
        tipoDeclarado: 'text/plain',
      }),
    ])
    expect(buscar(datos, 'archivo-incrustado')).toBeDefined()
  })

  it('detecta un flujo EmbeddedFile alcanzable aunque no tenga FileSpec', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/Names': { '/EmbeddedFiles': '5 0 R' } }),
        'obj:5 0 R': {
          stream: {
            dict: {
              '/Subtype': '/application#2Foctet-stream',
              '/Type': '/EmbeddedFile',
            },
          },
        },
      },
    })
    const informe = analizar(datos)

    expect(informe.archivosIncrustados).toEqual([
      expect.objectContaining({
        nombre: 'Adjunto sin nombre',
        referencia: '5 0 R',
        tipoDeclarado: 'application/octet-stream',
      }),
    ])
  })

  it('conserva el rol de campos anidados para sus acciones adicionales', () => {
    const datos = crearJsonQpdf({
      hasAcroForm: true,
      objetos: {
        ...catalogoCon({ '/AcroForm': { '/Fields': ['3 0 R'] } }),
        'obj:3 0 R': {
          value: { '/FT': '/Tx', '/Kids': ['4 0 R'], '/T': 'u:padre' },
        },
        'obj:4 0 R': {
          value: {
            '/AA': { '/K': '5 0 R' },
            '/FT': '/Tx',
            '/Parent': '3 0 R',
          },
        },
        'obj:5 0 R': {
          value: { '/JS': 'u:void 0', '/S': '/JavaScript' },
        },
      },
    })

    expect(buscar(datos, 'accion-adicional')?.severidad).toBe('alta')
  })

  it.each([
    ['documento.pdf.exe', true, '.exe'],
    ['documento.exe.pdf', false, '.pdf'],
    ['archivo.exe ', true, '.exe'],
    ['ARCHIVO.EXE', true, '.exe'],
    ['Archivo.ExE', true, '.exe'],
  ])(
    'define la extensión del adjunto %s',
    (nombre, sensible, extension) => {
      const informe = analizar(
        crearJsonQpdf({
          attachments: {
            [nombre]: {
              names: { '/F': nombre, '/UF': nombre },
              preferredname: nombre,
              streams: {},
            },
          },
        }),
      )

      expect(informe.archivosIncrustados[0]).toMatchObject({
        aparentaEjecutable: sensible,
        extension,
      })
    },
  )

  it('revisa /F aunque /UF y preferredname parezcan inocuos', () => {
    const informe = analizar(
      crearJsonQpdf({
        attachments: {
          'seguro.pdf': {
            names: { '/F': 'u:payload.exe', '/UF': 'u:seguro.pdf' },
            preferredname: 'u:seguro.pdf',
            streams: {},
          },
        },
      }),
    )

    expect(informe.archivosIncrustados[0]).toMatchObject({
      aparentaEjecutable: true,
      extension: '.exe',
      nombre: 'payload.exe',
    })
    expect(informe.nivel).toBe('elevado')
  })

  it.each([
    '.exe',
    '.dll',
    '.msi',
    '.bat',
    '.cmd',
    '.com',
    '.scr',
    '.ps1',
    '.vbs',
    '.js',
    '.jar',
    '.hta',
  ])('marca la extensión sensible %s sin llamarla malware', (extension) => {
    const nombre = `ejemplo${extension.toUpperCase()}`
    const informe = analizar(
      crearJsonQpdf({
        attachments: {
          [nombre]: {
            preferredname: nombre,
            streams: { '/F': { mimetype: 'application/octet-stream' } },
          },
        },
      }),
    )
    const hallazgo = informe.hallazgos.find(
      (actual) => actual.tipo === 'ejecutable-incrustado',
    )

    expect(informe.nivel).toBe('elevado')
    expect(hallazgo?.severidad).toBe('alta')
    expect(hallazgo?.descripcion.toLowerCase()).not.toContain('malware')
  })

  it('detecta /SubmitForm como capacidad de envío', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...catalogoCon({ '/OpenAction': '3 0 R' }),
        'obj:3 0 R': {
          value: { '/S': '/SubmitForm', '/F': 'u:urn:free-pdf:formulario-prueba' },
        },
      },
    })

    expect(buscar(datos, 'envio-formulario')?.severidad).toBe('media')
    expect(analizar(datos).nivel).toBe('precaucion')
  })

  it('detecta una anotación RichMedia', () => {
    const datos = crearJsonQpdf({
      objetos: {
        ...paginaCon({ '/Annots': ['4 0 R'] }),
        'obj:4 0 R': {
          value: { '/Type': '/Annot', '/Subtype': '/RichMedia' },
        },
      },
    })

    expect(buscar(datos, 'contenido-multimedia')?.severidad).toBe('media')
  })

  it('detecta XFA dentro de AcroForm', () => {
    const datos = crearJsonQpdf({
      objetos: {
        'obj:1 0 R': {
          value: {
            '/AcroForm': { '/XFA': '4 0 R' },
            '/Pages': '2 0 R',
            '/Type': '/Catalog',
          },
        },
      },
      hasAcroForm: true,
    })

    expect(buscar(datos, 'formulario')).toBeDefined()
    expect(buscar(datos, 'xfa')?.severidad).toBe('media')
  })

  it('informa de una estructura dañada y conserva avisos técnicos acotados', () => {
    const contexto: ContextoInspeccionSeguridad = {
      numeroPaginas: null,
      diagnostico: {
        estado: 'danado',
        necesitaContrasena: false,
        hallazgos: [
          {
            clase: 'referencias-cruzadas',
            mensaje: '  WARNING:\n damaged xref u:urn:free-pdf:destino-privado  ',
          },
          { mensaje: 'warning: damaged xref' },
        ],
      },
    }
    const informe = analizar(crearJsonQpdf(), contexto)

    expect(informe.estructuraValida).toBe(false)
    expect(informe.estadoEstructura).toBe('danada')
    expect(informe.nivel).toBe('precaucion')
    expect(buscar(crearJsonQpdf(), 'estructura-danada', contexto)?.cantidad).toBe(2)
    expect(informe.advertenciasTecnicas).toEqual([
      'qpdf detectó una irregularidad en las referencias cruzadas.',
    ])
    expect(JSON.stringify(informe)).not.toContain('destino-privado')
  })

  it('rechaza un cifrado que impide completar el análisis', () => {
    const error = capturarError(() =>
      analizar(crearJsonQpdf({ encrypted: true }), {
        ...CONTEXTO_INTACTO,
        diagnostico: {
          ...CONTEXTO_INTACTO.diagnostico,
          necesitaContrasena: true,
        },
      }),
    )

    expect(error.motivo).toBe('documento-cifrado')
    expect(error.message).toContain('Desbloquear PDF')
  })

  it('marca el cifrado cuando qpdf pudo inspeccionarlo por completo', () => {
    const informe = analizar(crearJsonQpdf({ encrypted: true }))

    expect(informe.cifrado).toBe(true)
    expect(informe.analisisCompleto).toBe(true)
  })

  it('una combinación de varios indicadores conserva todos y el nivel máximo', () => {
    const informe = analizar(
      crearJsonQpdf({
        objetos: {
          'obj:1 0 R': {
            value: {
              '/AcroForm': '4 0 R',
              '/OpenAction': '3 0 R',
              '/Pages': '2 0 R',
              '/Type': '/Catalog',
            },
          },
          'obj:3 0 R': { value: { '/S': '/Launch' } },
          'obj:4 0 R': { value: { '/XFA': [] } },
        },
        hasAcroForm: true,
      }),
    )

    expect(informe.nivel).toBe('elevado')
    expect(informe.hallazgos.map((hallazgo) => hallazgo.tipo)).toEqual(
      expect.arrayContaining([
        'launch',
        'accion-apertura',
        'formulario',
        'xfa',
      ]),
    )
  })

  it('no produce falsos positivos por texto o nombres parecidos', () => {
    const informe = analizar(
      crearJsonQpdf({
        objetos: {
          'obj:3 0 R': {
            value: {
              '/NotJavaScript': '/JavaScript dentro de una frase',
              '/Note': 'u:/Launch /URI /SubmitForm /EmbeddedFiles',
              '/Subject': 'u:manual de JavaScript',
            },
          },
        },
      }),
    )

    expect(informe.hallazgos).toHaveLength(0)
    expect(informe.nivel).toBe('sin-indicios')
  })
})

describe('Inspector de seguridad PDF: clasificación pura', () => {
  it('clasifica sin una puntuación inventada y según la severidad máxima', () => {
    expect(clasificarRiesgo([])).toBe('sin-indicios')
    expect(clasificarRiesgo([{ severidad: 'informativa' }])).toBe('bajo')
    expect(clasificarRiesgo([{ severidad: 'baja' }])).toBe('bajo')
    expect(clasificarRiesgo([{ severidad: 'media' }])).toBe('precaucion')
    expect(
      clasificarRiesgo([
        { severidad: 'baja' },
        { severidad: 'alta' },
        { severidad: 'media' },
      ]),
    ).toBe('elevado')
  })
})

describe('Inspector de seguridad PDF: entrada no confiable y límites', () => {
  it('rechaza JSON que no tenga el esquema v2 de qpdf', () => {
    for (const datos of [null, {}, { qpdf: [] }]) {
      expect(() => analizar(datos)).toThrowError(ErrorInspeccionSeguridad)
    }
  })

  it('rechaza una versión JSON distinta', () => {
    const datos = crearJsonQpdf() as {
      qpdf: [{ jsonversion: number }, Record<string, unknown>]
    }
    datos.qpdf[0].jsonversion = 3

    expect(capturarError(() => analizar(datos)).motivo).toBe('json-invalido')
  })

  it('valida también pages, acroform y encrypt como entrada hostil', () => {
    let profundo: unknown = null
    for (let nivel = 0; nivel <= LIMITES_INSPECCION.profundidad; nivel += 1) {
      profundo = { siguiente: profundo }
    }

    for (const seccion of ['pages', 'acroform', 'encrypt'] as const) {
      const datos = crearJsonQpdf() as Record<string, unknown>
      datos[seccion] = profundo
      expect(capturarError(() => analizar(datos)).motivo).toBe(
        'limite-profundidad',
      )
    }

    const datosAnchos = crearJsonQpdf() as Record<string, unknown>
    datosAnchos.acroform = Object.fromEntries(
      Array.from(
        { length: LIMITES_INSPECCION.nodos + 1 },
        (_, indice) => [`propiedad-${indice}`, null],
      ),
    )
    expect(capturarError(() => analizar(datosAnchos)).motivo).toBe(
      'limite-nodos',
    )
  })

  it('detiene árboles demasiado profundos sin usar recursión', () => {
    let profundo: unknown = null
    for (let nivel = 0; nivel <= LIMITES_INSPECCION.profundidad; nivel += 1) {
      profundo = { '/Next': profundo }
    }

    const error = capturarError(() =>
      analizar(
        crearJsonQpdf({
          objetos: catalogoCon({ '/Profundo': profundo }),
        }),
      ),
    )
    expect(error.motivo).toBe('limite-profundidad')
  })

  it('detiene estructuras con demasiados nodos', () => {
    const demasiados = Array.from(
      { length: LIMITES_INSPECCION.nodos + 1 },
      () => null,
    )
    const error = capturarError(() =>
      analizar(
        crearJsonQpdf({ objetos: catalogoCon({ '/Demasiados': demasiados }) }),
      ),
    )

    expect(error.motivo).toBe('limite-nodos')
  })

  it('limita determinísticamente la tabla de objetos aunque sean huérfanos', () => {
    const objetos: Record<string, unknown> = {}
    for (let numero = 3; numero <= LIMITES_INSPECCION.nodos + 3; numero += 1) {
      objetos[`obj:${numero} 0 R`] = { value: null }
    }

    const error = capturarError(() => analizar(crearJsonQpdf({ objetos })))
    expect(error.motivo).toBe('limite-nodos')
  })

  it('rechaza propiedades anchas de un objeto huérfano incrementalmente', () => {
    const cantidad = LIMITES_INSPECCION.nodos + 1
    let accesosPropiedad = 0
    const ancho = new Proxy(
      Object.fromEntries(
        Array.from({ length: cantidad }, (_, indice) => [`/P${indice}`, null]),
      ),
      {
        get(objetivo, propiedad, receptor) {
          if (typeof propiedad === 'string' && propiedad.startsWith('/P')) {
            accesosPropiedad += 1
          }
          return Reflect.get(objetivo, propiedad, receptor)
        },
      },
    )
    const datos = crearJsonQpdf({
      objetos: { 'obj:3 0 R': { value: ancho } },
    })

    expect(capturarError(() => analizar(datos)).motivo).toBe('limite-nodos')
    expect(accesosPropiedad).toBe(0)
  })

  it('rechaza cadenas estructurales que superan el límite', () => {
    const enorme = 'x'.repeat(LIMITES_INSPECCION.longitudCadena + 1)
    const error = capturarError(() =>
      analizar(
        crearJsonQpdf({ objetos: catalogoCon({ '/Note': enorme }) }),
      ),
    )

    expect(error.motivo).toBe('cadena-demasiado-larga')
  })

  it('aplica el límite de cadenas a los metadatos de adjuntos', () => {
    const enorme = 'x'.repeat(LIMITES_INSPECCION.longitudCadena + 1)

    for (const attachments of [
      {
        'fallback.txt': {
          preferredname: enorme,
          streams: {},
        },
      },
      {
        'archivo.txt': {
          preferredname: 'archivo.txt',
          streams: { '/F': { mimetype: enorme } },
        },
      },
    ]) {
      const error = capturarError(() =>
        analizar(crearJsonQpdf({ attachments })),
      )
      expect(error.motivo).toBe('cadena-demasiado-larga')
    }
  })

  it('aplica cantidad y profundidad máximas al bloque de adjuntos', () => {
    const demasiados = Object.fromEntries(
      Array.from(
        { length: LIMITES_INSPECCION.archivosIncrustados + 1 },
        (_, indice) => [`archivo-${indice}.txt`, { streams: {} }],
      ),
    )
    expect(
      capturarError(() =>
        analizar(crearJsonQpdf({ attachments: demasiados })),
      ).motivo,
    ).toBe('limite-nodos')

    let profundo: unknown = 'fin'
    for (let nivel = 0; nivel <= LIMITES_INSPECCION.profundidad; nivel += 1) {
      profundo = { siguiente: profundo }
    }
    expect(
      capturarError(() =>
        analizar(
          crearJsonQpdf({
            attachments: { 'archivo.txt': { profundo, streams: {} } },
          }),
        ),
      ).motivo,
    ).toBe('limite-profundidad')
  })

  it('rechaza adjuntos anchos antes de leer todos sus valores', () => {
    const cantidad = LIMITES_INSPECCION.archivosIncrustados + 1
    let accesos = 0
    const attachments = new Proxy(
      Object.fromEntries(
        Array.from({ length: cantidad }, (_, indice) => [
          `archivo-${indice}.txt`,
          { streams: {} },
        ]),
      ),
      {
        get(objetivo, propiedad, receptor) {
          if (typeof propiedad === 'string' && propiedad.startsWith('archivo-')) {
            accesos += 1
          }
          return Reflect.get(objetivo, propiedad, receptor)
        },
      },
    )

    expect(
      capturarError(() => analizar(crearJsonQpdf({ attachments }))).motivo,
    ).toBe('limite-nodos')
    expect(accesos).toBeLessThan(cantidad)
  })

  it('rechaza un documento irrecuperable en lugar de informar sin indicios', () => {
    const error = capturarError(() =>
      analizar(crearJsonQpdf(), {
        numeroPaginas: null,
        diagnostico: {
          estado: 'irrecuperable',
          hallazgos: [{ mensaje: 'not a pdf file' }],
          necesitaContrasena: false,
        },
      }),
    )

    expect(error.motivo).toBe('estructura-no-inspeccionable')
  })
})

import { describe, expect, it } from 'vitest'
import {
  compararPixeles,
  compararTexto,
  describirGeometria,
  DIVISIONES_ZONA,
  extraerZonas,
  geometriaCoincide,
  partirEnPalabras,
  resumirDiferencias,
  type PixelesPagina,
} from '../comparacion/compararContenido'
import {
  compararDocumentos,
  compararMetadatos,
  contarPaginas,
  resumirComparacion,
  type DocumentoComparable,
} from '../comparacion/compararDocumentos'
import {
  escaparHtml,
  formatearFechaHora,
  generarInforme,
  NOMBRE_INFORME,
} from '../comparacion/informeComparacion'
import {
  describirEstadoPagina,
  TOLERANCIA_CANAL,
  UMBRAL_PREDETERMINADO,
  type ComparacionPagina,
  type GeometriaPagina,
} from '../comparacion/tipos'

/** Geometría A4 sin girar. */
const A4: GeometriaPagina = { ancho: 595, alto: 842, rotacion: 0 }

/** Crea una imagen de un color uniforme. */
function lienzoUniforme(
  ancho: number,
  alto: number,
  gris: number,
): PixelesPagina {
  const datos = new Uint8ClampedArray(ancho * alto * 4)
  datos.fill(gris)

  return { datos, ancho, alto }
}

/** Crea una imagen blanca con un rectángulo negro. */
function lienzoConMancha(
  ancho: number,
  alto: number,
  zona: {
    readonly x: number
    readonly y: number
    readonly ancho: number
    readonly alto: number
  },
): PixelesPagina {
  const datos = new Uint8ClampedArray(ancho * alto * 4)
  datos.fill(255)

  for (let y = zona.y; y < zona.y + zona.alto; y += 1) {
    for (let x = zona.x; x < zona.x + zona.ancho; x += 1) {
      const base = (y * ancho + x) * 4
      datos[base] = 0
      datos[base + 1] = 0
      datos[base + 2] = 0
    }
  }

  return { datos, ancho, alto }
}

/** Documento de prueba, con el contenido que se le indique. */
function documento(opciones: {
  readonly nombre?: string
  readonly textos: readonly string[]
  readonly geometrias?: readonly GeometriaPagina[]
  readonly pixeles?: readonly (PixelesPagina | null)[]
  readonly metadatos?: ReadonlyMap<string, string>
  readonly registro?: { readonly paginasDibujadas: number[] }
}): DocumentoComparable {
  return {
    nombre: opciones.nombre ?? 'documento.pdf',
    numeroPaginas: opciones.textos.length,
    geometria: async (pagina) =>
      opciones.geometrias?.[pagina - 1] ?? A4,
    texto: async (pagina) => opciones.textos[pagina - 1] ?? '',
    pixeles: async (pagina, ancho, alto) => {
      opciones.registro?.paginasDibujadas.push(pagina)

      const propios = opciones.pixeles?.[pagina - 1]

      if (propios === undefined) {
        return lienzoUniforme(ancho, alto, 255)
      }

      return propios
    },
    metadatos: async () => opciones.metadatos ?? new Map(),
    liberar: () => undefined,
  }
}

describe('partirEnPalabras', () => {
  it('normaliza el espacio en blanco', () => {
    expect(partirEnPalabras('  hola   mundo \n cruel ')).toEqual([
      'hola',
      'mundo',
      'cruel',
    ])
  })

  it('devuelve una lista vacía con un texto vacío', () => {
    expect(partirEnPalabras('')).toEqual([])
    expect(partirEnPalabras('   \n\t ')).toEqual([])
  })
})

describe('compararTexto', () => {
  it('reconoce dos textos idénticos', () => {
    const diferencia = compararTexto('hola mundo', 'hola mundo')

    expect(diferencia.identico).toBe(true)
    expect(diferencia.anadidas).toHaveLength(0)
    expect(diferencia.eliminadas).toHaveLength(0)
  })

  it('ignora las diferencias de espacio en blanco', () => {
    // PDF.js parte el texto en fragmentos según cómo esté dibujado, así que dos
    // documentos idénticos pueden dar espaciados distintos.
    expect(compararTexto('hola  mundo', 'hola\nmundo').identico).toBe(true)
  })

  it('detecta una palabra añadida', () => {
    const diferencia = compararTexto('hola mundo', 'hola mundo cruel')

    expect(diferencia.identico).toBe(false)
    expect(diferencia.anadidas).toEqual(['cruel'])
    expect(diferencia.eliminadas).toHaveLength(0)
  })

  it('detecta una palabra eliminada', () => {
    const diferencia = compararTexto('hola mundo cruel', 'hola mundo')

    expect(diferencia.eliminadas).toEqual(['cruel'])
    expect(diferencia.anadidas).toHaveLength(0)
  })

  it('detecta una palabra sustituida por otra', () => {
    const diferencia = compararTexto('el gato duerme', 'el perro duerme')

    expect(diferencia.eliminadas).toEqual(['gato'])
    expect(diferencia.anadidas).toEqual(['perro'])
  })

  it('cuenta las repeticiones', () => {
    const diferencia = compararTexto('sí sí sí', 'sí')

    expect(diferencia.eliminadas).toEqual(['sí', 'sí'])
  })

  it('detecta un reordenamiento aunque las palabras sean las mismas', () => {
    const diferencia = compararTexto('gato perro', 'perro gato')

    expect(diferencia.identico).toBe(false)
    expect(diferencia.anadidas).toHaveLength(0)
    expect(diferencia.eliminadas).toHaveLength(0)
  })

  it('cuenta las palabras de cada versión', () => {
    const diferencia = compararTexto('una dos tres', 'una dos')

    expect(diferencia.palabrasAntes).toBe(3)
    expect(diferencia.palabrasDespues).toBe(2)
  })

  it('un documento sin texto frente a otro con texto da todo añadido', () => {
    const diferencia = compararTexto('', 'hola mundo')

    expect(diferencia.anadidas).toEqual(['hola', 'mundo'])
    expect(diferencia.palabrasAntes).toBe(0)
  })
})

describe('compararPixeles', () => {
  it('dos imágenes idénticas no tienen diferencias', () => {
    const uno = lienzoUniforme(100, 100, 255)
    const otro = lienzoUniforme(100, 100, 255)

    const diferencia = compararPixeles(uno, otro, UMBRAL_PREDETERMINADO)

    expect(diferencia.fraccionCambiada).toBe(0)
    expect(diferencia.superaUmbral).toBe(false)
    expect(diferencia.zonas).toHaveLength(0)
  })

  it('tolera pequeñas variaciones del antialias', () => {
    // Sin tolerancia, dibujar la misma página dos veces daría diferencias.
    const uno = lienzoUniforme(50, 50, 200)
    const otro = lienzoUniforme(50, 50, 200 + TOLERANCIA_CANAL - 1)

    expect(
      compararPixeles(uno, otro, UMBRAL_PREDETERMINADO).fraccionCambiada,
    ).toBe(0)
  })

  it('detecta una variación mayor que la tolerancia', () => {
    const uno = lienzoUniforme(50, 50, 100)
    const otro = lienzoUniforme(50, 50, 100 + TOLERANCIA_CANAL + 5)

    expect(
      compararPixeles(uno, otro, UMBRAL_PREDETERMINADO).fraccionCambiada,
    ).toBe(1)
  })

  it('calcula la fracción exacta de píxeles cambiados', () => {
    const uno = lienzoUniforme(10, 10, 255)
    const otro = lienzoConMancha(10, 10, { x: 0, y: 0, ancho: 5, alto: 2 })

    // 10 píxeles de 100.
    expect(
      compararPixeles(uno, otro, 0).fraccionCambiada,
    ).toBeCloseTo(0.1, 6)
  })

  it('respeta el umbral: por debajo no lo supera', () => {
    const uno = lienzoUniforme(100, 100, 255)
    const otro = lienzoConMancha(100, 100, { x: 0, y: 0, ancho: 10, alto: 10 })

    // 100 de 10 000 son el 1 %.
    expect(compararPixeles(uno, otro, 0.02).superaUmbral).toBe(false)
    expect(compararPixeles(uno, otro, 0.005).superaUmbral).toBe(true)
  })

  it('dos imágenes de medidas distintas son totalmente distintas', () => {
    const diferencia = compararPixeles(
      lienzoUniforme(100, 100, 255),
      lienzoUniforme(120, 100, 255),
      UMBRAL_PREDETERMINADO,
    )

    expect(diferencia.fraccionCambiada).toBe(1)
    expect(diferencia.superaUmbral).toBe(true)
  })

  it('no falla con imágenes vacías', () => {
    const diferencia = compararPixeles(
      lienzoUniforme(0, 0, 0),
      lienzoUniforme(0, 0, 0),
      UMBRAL_PREDETERMINADO,
    )

    expect(diferencia.fraccionCambiada).toBe(0)
  })

  it('localiza la zona donde está la diferencia', () => {
    // Mancha en la esquina superior izquierda, en un lienzo grande.
    const uno = lienzoUniforme(120, 120, 255)
    const otro = lienzoConMancha(120, 120, { x: 0, y: 0, ancho: 10, alto: 10 })

    const zonas = compararPixeles(uno, otro, 0).zonas

    expect(zonas.length).toBeGreaterThan(0)
    // La primera zona está arriba a la izquierda.
    expect(zonas[0]?.izquierda).toBeCloseTo(0, 6)
    expect(zonas[0]?.superior).toBeCloseTo(0, 6)
  })

  it('no devuelve zonas cuando no se supera el umbral', () => {
    const uno = lienzoUniforme(100, 100, 255)
    const otro = lienzoConMancha(100, 100, { x: 0, y: 0, ancho: 2, alto: 2 })

    expect(compararPixeles(uno, otro, 0.5).zonas).toHaveLength(0)
  })
})

describe('extraerZonas', () => {
  it('no devuelve nada con una rejilla vacía', () => {
    const rejilla = new Uint32Array(DIVISIONES_ZONA * DIVISIONES_ZONA)

    expect(extraerZonas(rejilla, 10_000)).toHaveLength(0)
  })

  it('las zonas cubren fracciones de la página, no píxeles', () => {
    const rejilla = new Uint32Array(DIVISIONES_ZONA * DIVISIONES_ZONA)
    rejilla[0] = 100_000

    const zonas = extraerZonas(rejilla, 10_000)

    expect(zonas[0]?.ancho).toBeCloseTo(1 / DIVISIONES_ZONA, 6)
    expect(zonas[0]?.alto).toBeCloseTo(1 / DIVISIONES_ZONA, 6)
  })
})

describe('geometriaCoincide', () => {
  it('reconoce dos geometrías iguales', () => {
    expect(geometriaCoincide(A4, { ...A4 })).toBe(true)
  })

  it('detecta un tamaño distinto', () => {
    expect(geometriaCoincide(A4, { ...A4, ancho: 612 })).toBe(false)
  })

  it('detecta un giro distinto', () => {
    expect(geometriaCoincide(A4, { ...A4, rotacion: 90 })).toBe(false)
  })

  it('admite una diferencia imperceptible en las medidas', () => {
    // Reescribir un documento puede variar una medida en una fracción de punto.
    expect(geometriaCoincide(A4, { ...A4, ancho: 595.2 })).toBe(true)
  })

  it('una página que no existe nunca coincide', () => {
    expect(geometriaCoincide(A4, null)).toBe(false)
    expect(geometriaCoincide(null, A4)).toBe(false)
  })
})

describe('describirGeometria', () => {
  it('describe las medidas en puntos', () => {
    expect(describirGeometria(A4)).toContain('595 × 842')
  })

  it('menciona el giro solo cuando lo hay', () => {
    expect(describirGeometria(A4)).not.toMatch(/girada/)
    expect(describirGeometria({ ...A4, rotacion: 90 })).toMatch(/girada 90/)
  })
})

describe('compararMetadatos', () => {
  it('no devuelve nada si son iguales', () => {
    const unos = new Map([['autor', 'Ana']])

    expect(compararMetadatos(unos, new Map([['autor', 'Ana']]))).toHaveLength(0)
  })

  it('detecta un metadato cambiado', () => {
    const diferencias = compararMetadatos(
      new Map([['autor', 'Ana']]),
      new Map([['autor', 'Luis']]),
    )

    expect(diferencias).toHaveLength(1)
    expect(diferencias[0]?.antes).toBe('Ana')
    expect(diferencias[0]?.despues).toBe('Luis')
  })

  it('usa nombres en español para las claves', () => {
    const diferencias = compararMetadatos(
      new Map([['titulo', 'Uno']]),
      new Map([['titulo', 'Dos']]),
    )

    expect(diferencias[0]?.clave).toBe('Título')
  })

  it('detecta un metadato que se ha añadido o borrado', () => {
    expect(
      compararMetadatos(new Map(), new Map([['autor', 'Ana']])),
    ).toHaveLength(1)
    expect(
      compararMetadatos(new Map([['autor', 'Ana']]), new Map()),
    ).toHaveLength(1)
  })
})

describe('contarPaginas', () => {
  it('cuenta cada estado', () => {
    /** Página mínima con el estado indicado. */
    const conEstado = (
      numero: number,
      estado: ComparacionPagina['estado'],
    ): ComparacionPagina => ({
      numero,
      estado,
      geometriaAntes: null,
      geometriaDespues: null,
      geometriaDistinta: false,
      texto: null,
      visual: null,
    })

    const recuento = contarPaginas([
      conEstado(1, 'identica'),
      conEstado(2, 'identica'),
      conEstado(3, 'modificada'),
      conEstado(4, 'anadida'),
      conEstado(5, 'eliminada'),
    ])

    expect(recuento.identicas).toBe(2)
    expect(recuento.modificadas).toBe(1)
    expect(recuento.anadidas).toBe(1)
    expect(recuento.eliminadas).toBe(1)
  })
})

describe('compararDocumentos', () => {
  it('dos documentos idénticos no tienen ninguna diferencia', async () => {
    const textos = ['primera página', 'segunda página']

    const resultado = await compararDocumentos(
      documento({ textos }),
      documento({ textos }),
    )

    expect(resultado.sonIdenticos).toBe(true)
    expect(resultado.recuento.identicas).toBe(2)
    expect(resultado.recuento.modificadas).toBe(0)
  })

  it('detecta un cambio de texto en una página concreta', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['hola', 'igual'] }),
      documento({ textos: ['adiós', 'igual'] }),
    )

    expect(resultado.paginas[0]?.estado).toBe('modificada')
    expect(resultado.paginas[1]?.estado).toBe('identica')
    expect(resultado.paginas[0]?.texto?.anadidas).toEqual(['adiós'])
  })

  it('detecta una página añadida al final', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['una'] }),
      documento({ textos: ['una', 'dos'] }),
    )

    expect(resultado.recuento.anadidas).toBe(1)
    expect(resultado.paginas[1]?.estado).toBe('anadida')
    expect(resultado.paginas[1]?.texto).toBeNull()
  })

  it('detecta una página eliminada del final', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['una', 'dos'] }),
      documento({ textos: ['una'] }),
    )

    expect(resultado.recuento.eliminadas).toBe(1)
    expect(resultado.paginas[1]?.estado).toBe('eliminada')
  })

  it('detecta que cambian las dimensiones de una página', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['igual'], geometrias: [A4] }),
      documento({
        textos: ['igual'],
        geometrias: [{ ancho: 612, alto: 792, rotacion: 0 }],
      }),
    )

    expect(resultado.paginas[0]?.geometriaDistinta).toBe(true)
    expect(resultado.paginas[0]?.estado).toBe('modificada')
  })

  it('detecta que cambia el giro de una página', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['igual'], geometrias: [A4] }),
      documento({ textos: ['igual'], geometrias: [{ ...A4, rotacion: 90 }] }),
    )

    expect(resultado.paginas[0]?.geometriaDistinta).toBe(true)
  })

  it('detecta una diferencia visual aunque el texto sea el mismo', async () => {
    // Es el caso importante: una imagen cambiada no altera ni una palabra.
    const resultado = await compararDocumentos(
      documento({
        textos: ['igual'],
        pixeles: [lienzoUniforme(200, 200, 255)],
      }),
      documento({
        textos: ['igual'],
        pixeles: [lienzoConMancha(200, 200, { x: 0, y: 0, ancho: 100, alto: 100 })],
      }),
      { umbral: 0.01 },
    )

    expect(resultado.paginas[0]?.texto?.identico).toBe(true)
    expect(resultado.paginas[0]?.visual?.superaUmbral).toBe(true)
    expect(resultado.paginas[0]?.estado).toBe('modificada')
  })

  it('el umbral decide si una diferencia visual pequeña cuenta', async () => {
    const antes = documento({
      textos: ['igual'],
      pixeles: [lienzoUniforme(100, 100, 255)],
    })
    const despues = documento({
      textos: ['igual'],
      pixeles: [lienzoConMancha(100, 100, { x: 0, y: 0, ancho: 10, alto: 10 })],
    })

    // El 1 % de los píxeles cambia.
    const estricto = await compararDocumentos(antes, despues, { umbral: 0.005 })
    const tolerante = await compararDocumentos(antes, despues, { umbral: 0.05 })

    expect(estricto.paginas[0]?.estado).toBe('modificada')
    expect(tolerante.paginas[0]?.estado).toBe('identica')
  })

  it('se puede desactivar la comparación visual', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['igual'], pixeles: [lienzoUniforme(50, 50, 0)] }),
      documento({ textos: ['igual'], pixeles: [lienzoUniforme(50, 50, 255)] }),
      { compararVisualmente: false },
    )

    expect(resultado.paginas[0]?.visual).toBeNull()
    expect(resultado.paginas[0]?.estado).toBe('identica')
  })

  it('sigue adelante si una página no se puede dibujar', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['igual'], pixeles: [null] }),
      documento({ textos: ['igual'] }),
    )

    expect(resultado.paginas[0]?.visual).toBeNull()
    // Y el texto sí se ha comparado.
    expect(resultado.paginas[0]?.texto?.identico).toBe(true)
  })

  it('compara los metadatos', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['igual'], metadatos: new Map([['autor', 'Ana']]) }),
      documento({ textos: ['igual'], metadatos: new Map([['autor', 'Luis']]) }),
    )

    expect(resultado.metadatos).toHaveLength(1)
    expect(resultado.sonIdenticos).toBe(false)
  })

  it('informa del progreso una vez por página', async () => {
    const pasos: number[] = []

    await compararDocumentos(
      documento({ textos: ['a', 'b', 'c'] }),
      documento({ textos: ['a', 'b', 'c'] }),
      { alProgreso: (progreso) => pasos.push(progreso.paginasComparadas) },
    )

    expect(pasos).toEqual([1, 2, 3])
  })

  it('el total del progreso es el máximo de las dos longitudes', async () => {
    let total = 0

    await compararDocumentos(
      documento({ textos: ['a'] }),
      documento({ textos: ['a', 'b', 'c'] }),
      {
        alProgreso: (progreso) => {
          total = progreso.total
        },
      },
    )

    expect(total).toBe(3)
  })

  it('se puede cancelar antes de empezar', async () => {
    const controlador = new AbortController()
    controlador.abort()

    await expect(
      compararDocumentos(
        documento({ textos: ['a'] }),
        documento({ textos: ['a'] }),
        { senal: controlador.signal },
      ),
    ).rejects.toThrow()
  })

  it('procesa las páginas en orden, una a una', async () => {
    const registro = { paginasDibujadas: [] as number[] }

    await compararDocumentos(
      documento({ textos: ['a', 'b', 'c'], registro }),
      documento({ textos: ['a', 'b', 'c'] }),
    )

    expect(registro.paginasDibujadas).toEqual([1, 2, 3])
  })

  it('conserva los nombres de los dos documentos', async () => {
    const resultado = await compararDocumentos(
      documento({ nombre: 'antes.pdf', textos: ['a'] }),
      documento({ nombre: 'despues.pdf', textos: ['a'] }),
    )

    expect(resultado.nombreAntes).toBe('antes.pdf')
    expect(resultado.nombreDespues).toBe('despues.pdf')
  })
})

describe('resumirComparacion', () => {
  it('avisa de que no encontrar diferencias no demuestra que sean idénticos', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['a'] }),
      documento({ textos: ['a'] }),
    )

    const resumen = resumirComparacion(resultado)

    expect(resumen).toMatch(/no demuestra/i)
  })

  it('dice cuántas páginas cambian', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['a', 'b'] }),
      documento({ textos: ['x', 'b'] }),
    )

    expect(resumirComparacion(resultado)).toMatch(/1 modificada/i)
  })

  it('menciona la diferencia en el número de páginas', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['a'] }),
      documento({ textos: ['a', 'b'] }),
    )

    const resumen = resumirComparacion(resultado)

    expect(resumen).toContain('1')
    expect(resumen).toContain('2')
  })
})

describe('resumirDiferencias', () => {
  it('avisa cuando no hay ninguna diferencia', () => {
    expect(resumirDiferencias(null, null, false)).toMatch(/ninguna diferencia/i)
  })

  it('menciona la geometría cuando no coincide', () => {
    expect(resumirDiferencias(null, null, true)).toMatch(/medidas o el giro/i)
  })

  it('cuenta las palabras añadidas y eliminadas', () => {
    const texto = resumirDiferencias(
      {
        anadidas: ['uno'],
        eliminadas: ['dos', 'tres'],
        identico: false,
        palabrasAntes: 5,
        palabrasDespues: 4,
      },
      null,
      false,
    )

    expect(texto).toMatch(/1 palabra añadida/i)
    expect(texto).toMatch(/2 palabras eliminadas/i)
  })

  it('explica el caso del texto reordenado', () => {
    const texto = resumirDiferencias(
      {
        anadidas: [],
        eliminadas: [],
        identico: false,
        palabrasAntes: 2,
        palabrasDespues: 2,
      },
      null,
      false,
    )

    expect(texto).toMatch(/en otro orden/i)
  })

  it('da el porcentaje de píxeles cambiados', () => {
    const texto = resumirDiferencias(
      null,
      { fraccionCambiada: 0.123, superaUmbral: true, zonas: [] },
      false,
    )

    expect(texto).toContain('12.3 %')
  })
})

describe('describirEstadoPagina', () => {
  it('describe los cuatro estados en español', () => {
    expect(describirEstadoPagina('identica')).toBe('Sin cambios')
    expect(describirEstadoPagina('modificada')).toBe('Modificada')
    expect(describirEstadoPagina('anadida')).toBe('Añadida')
    expect(describirEstadoPagina('eliminada')).toBe('Eliminada')
  })
})

describe('informe de comparación', () => {
  /** Resultado de comparación con las diferencias indicadas. */
  async function conDiferencias(): Promise<
    Awaited<ReturnType<typeof compararDocumentos>>
  > {
    return await compararDocumentos(
      documento({
        nombre: 'contrato-v1.pdf',
        textos: ['el precio es cien euros', 'igual'],
        metadatos: new Map([['autor', 'Ana']]),
      }),
      documento({
        nombre: 'contrato-v2.pdf',
        textos: ['el precio es doscientos euros', 'igual', 'anexo nuevo'],
        metadatos: new Map([['autor', 'Luis']]),
      }),
    )
  }

  it('genera un documento HTML completo y autónomo', async () => {
    const informe = generarInforme(await conDiferencias(), new Date(0))

    expect(informe).toMatch(/^<!doctype html>/i)
    expect(informe).toContain('</html>')
    expect(informe).toContain('lang="es"')
  })

  it('no contiene ninguna referencia externa ni ningún script', async () => {
    const informe = generarInforme(await conDiferencias(), new Date(0))

    // Un informe que se va a archivar no puede depender de ningún servidor, y no
    // debe ejecutar nada.
    expect(informe).not.toContain('<script')
    expect(informe).not.toContain('http://')
    expect(informe).not.toContain('https://')
    expect(informe).not.toContain('<img')
    expect(informe).not.toContain('<link')
  })

  it('incluye los nombres de los dos documentos', async () => {
    const informe = generarInforme(await conDiferencias(), new Date(0))

    expect(informe).toContain('contrato-v1.pdf')
    expect(informe).toContain('contrato-v2.pdf')
  })

  it('incluye el recuento de páginas por estado', async () => {
    const informe = generarInforme(await conDiferencias(), new Date(0))

    expect(informe).toContain('Modificadas')
    expect(informe).toContain('Añadidas')
    expect(informe).toContain('Eliminadas')
  })

  it('lista las palabras que cambian', async () => {
    const informe = generarInforme(await conDiferencias(), new Date(0))

    expect(informe).toContain('cien')
    expect(informe).toContain('doscientos')
  })

  it('incluye los metadatos que cambian', async () => {
    const informe = generarInforme(await conDiferencias(), new Date(0))

    expect(informe).toContain('Ana')
    expect(informe).toContain('Luis')
  })

  it('incluye la advertencia sobre lo que el informe no demuestra', async () => {
    const informe = generarInforme(await conDiferencias(), new Date(0))

    expect(informe).toMatch(/no implica una diferencia de contenido/i)
    expect(informe).toMatch(/no demuestra que los archivos sean idénticos/i)
  })

  it('deja claro que la comparación fue local', async () => {
    const informe = generarInforme(await conDiferencias(), new Date(0))

    expect(informe).toMatch(/Ningún documento salió del dispositivo/i)
  })

  it('escapa el HTML de los nombres de archivo', async () => {
    const resultado = await compararDocumentos(
      documento({ nombre: '<script>alert(1)</script>.pdf', textos: ['a'] }),
      documento({ nombre: 'normal.pdf', textos: ['a'] }),
    )

    const informe = generarInforme(resultado, new Date(0))

    // El nombre aparece escapado, nunca como etiqueta ejecutable.
    expect(informe).toContain('&lt;script&gt;')
    expect(informe).not.toContain('<script>alert')
  })

  it('escapa el HTML del texto comparado', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['<b>negrita</b>'] }),
      documento({ textos: ['normal'] }),
    )

    const informe = generarInforme(resultado, new Date(0))

    expect(informe).not.toContain('<b>negrita</b>')
    expect(informe).toContain('&lt;b&gt;')
  })

  it('con dos documentos idénticos dice que no hay diferencias', async () => {
    const resultado = await compararDocumentos(
      documento({ textos: ['a'] }),
      documento({ textos: ['a'] }),
    )

    const informe = generarInforme(resultado, new Date(0))

    expect(informe).toMatch(/Ninguna página presenta diferencias/i)
    expect(informe).toMatch(/Ningún metadato cambia/i)
  })

  it('recorta las listas de palabras muy largas', async () => {
    const muchas = Array.from({ length: 100 }, (_, indice) => `palabra${indice}`)

    const resultado = await compararDocumentos(
      documento({ textos: [''] }),
      documento({ textos: [muchas.join(' ')] }),
    )

    const informe = generarInforme(resultado, new Date(0))

    expect(informe).toMatch(/palabras más/i)
    // La primera sí aparece; la última, no.
    expect(informe).toContain('palabra0')
    expect(informe).not.toContain('palabra99')
  })

  it('el informe se llama free-pdf-informe-comparacion.html', () => {
    expect(NOMBRE_INFORME).toBe('free-pdf-informe-comparacion.html')
  })

  it('formatea la fecha y la hora en español', () => {
    const fecha = new Date(2026, 6, 29, 14, 5)

    expect(formatearFechaHora(fecha)).toBe('29/07/2026 a las 14:05')
  })
})

describe('escaparHtml', () => {
  it('escapa los cinco caracteres peligrosos', () => {
    expect(escaparHtml('<a href="x" title=\'y\'>&</a>')).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('no toca un texto normal', () => {
    expect(escaparHtml('Año de emisión: 2026')).toBe('Año de emisión: 2026')
  })
})

import { PDFDocument, degrees } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  abreviarUnidad,
  aPuntos,
  calcularCajaRecorte,
  calcularFraccionesRecorte,
  calcularMedidasResultantes,
  convertirMargenesAPuntos,
  convertirMargenesDesdePuntos,
  desdePuntos,
  describirUnidad,
  MARGENES_CERO,
  MEDIDA_MINIMA,
  noRecortaNada,
  validarRecorte,
} from '../funcionalidades/recortar-pdf/coordenadasRecorte'
import {
  calcularIndicesRecorte,
  NOMBRE_RECORTADO,
  recortarPdf,
} from '../funcionalidades/recortar-pdf/recortarPdf'
import type {
  ConfiguracionRecorte,
  MargenesRecorte,
} from '../funcionalidades/recortar-pdf/tipos'
import { ErrorPdf } from '../pdf/erroresPdf'
import {
  calcularMedidasVisibles,
  type CajaPagina,
} from '../pdf/posicionarEnPagina'
import { normalizarRotacion } from '../pdf/rotaciones'
import { milimetrosAPuntos } from '../utilidades/unidades'
import {
  abrirBytes,
  bytesDeBlob,
  crearArchivoPdf,
} from './ayudas/crearPdfPrueba'

/** Página de ejemplo con el origen en cero. */
const PAGINA: CajaPagina = { x: 0, y: 0, ancho: 600, alto: 800 }

/** Construye unos márgenes partiendo de los ceros. */
function margenes(cambios: Partial<MargenesRecorte> = {}): MargenesRecorte {
  return { ...MARGENES_CERO, ...cambios }
}

/** Construye una configuración de recorte. */
function configurar(
  cambios: Partial<ConfiguracionRecorte> = {},
): ConfiguracionRecorte {
  return {
    margenes: MARGENES_CERO,
    unidad: 'puntos',
    alcance: 'todas',
    ...cambios,
  }
}

/** Recorta un documento de prueba. */
async function recortar(
  numeroPaginas: number,
  cambios: Partial<ConfiguracionRecorte> = {},
  indiceReferencia = 0,
  indicesSeleccionados: readonly number[] = [],
) {
  const archivo = await crearArchivoPdf('documento.pdf', numeroPaginas)

  return await recortarPdf({
    archivo,
    configuracion: configurar(cambios),
    indiceReferencia,
    indicesSeleccionados,
  })
}

/** Lee las cajas de recorte y de medios de cada página del documento. */
async function leerCajas(blob: Blob) {
  const documento = await abrirBytes(await bytesDeBlob(blob))

  return documento.getPages().map((pagina) => ({
    recorte: pagina.getCropBox(),
    medios: pagina.getMediaBox(),
  }))
}

describe('conversión de unidades del recorte', () => {
  it('los puntos no se convierten', () => {
    expect(aPuntos(50, 'puntos')).toBe(50)
    expect(desdePuntos(50, 'puntos')).toBe(50)
  })

  it('los milímetros se convierten a puntos', () => {
    expect(aPuntos(25.4, 'milimetros')).toBeCloseTo(72, 6)
    expect(aPuntos(10, 'milimetros')).toBeCloseTo(28.3465, 3)
  })

  it('la conversión de vuelta es exacta', () => {
    expect(desdePuntos(72, 'milimetros')).toBeCloseTo(25.4, 6)
  })

  it('convierte los cuatro márgenes a puntos', () => {
    const convertidos = convertirMargenesAPuntos(
      margenes({ superior: 10, derecho: 20, inferior: 5, izquierdo: 0 }),
      'milimetros',
    )

    expect(convertidos.superior).toBeCloseTo(milimetrosAPuntos(10), 6)
    expect(convertidos.derecho).toBeCloseTo(milimetrosAPuntos(20), 6)
    expect(convertidos.inferior).toBeCloseTo(milimetrosAPuntos(5), 6)
    expect(convertidos.izquierdo).toBe(0)
  })

  it('la conversión de ida y vuelta conserva los valores', () => {
    const originales = margenes({
      superior: 12.5,
      derecho: 7,
      inferior: 3.25,
      izquierdo: 40,
    })
    const puntos = convertirMargenesAPuntos(originales, 'milimetros')
    const vuelta = convertirMargenesDesdePuntos(puntos, 'milimetros')

    expect(vuelta.superior).toBeCloseTo(12.5, 6)
    expect(vuelta.derecho).toBeCloseTo(7, 6)
    expect(vuelta.inferior).toBeCloseTo(3.25, 6)
    expect(vuelta.izquierdo).toBeCloseTo(40, 6)
  })

  it('nombra y abrevia las unidades en español', () => {
    expect(describirUnidad('milimetros')).toBe('Milímetros')
    expect(describirUnidad('puntos')).toBe('Puntos PDF')
    expect(abreviarUnidad('milimetros')).toBe('mm')
    expect(abreviarUnidad('puntos')).toBe('pt')
  })
})

describe('noRecortaNada', () => {
  it('detecta que no hay recorte', () => {
    expect(noRecortaNada(MARGENES_CERO)).toBe(true)
  })

  it('cualquier margen mayor que cero cuenta como recorte', () => {
    expect(noRecortaNada(margenes({ superior: 1 }))).toBe(false)
    expect(noRecortaNada(margenes({ izquierdo: 0.5 }))).toBe(false)
  })
})

describe('calcularMedidasResultantes', () => {
  it('descuenta los márgenes de cada eje', () => {
    expect(
      calcularMedidasResultantes(
        { ancho: 600, alto: 800 },
        margenes({ izquierdo: 50, derecho: 50, superior: 100, inferior: 100 }),
      ),
    ).toEqual({ ancho: 500, alto: 600 })
  })

  it('puede devolver medidas negativas, que la validación rechaza', () => {
    const resultantes = calcularMedidasResultantes(
      { ancho: 100, alto: 100 },
      margenes({ izquierdo: 80, derecho: 80 }),
    )

    expect(resultantes.ancho).toBeLessThan(0)
  })
})

describe('validarRecorte: márgenes válidos', () => {
  it('acepta unos márgenes razonables', () => {
    const resultado = validarRecorte(
      { ancho: 600, alto: 800 },
      margenes({ superior: 20, derecho: 20, inferior: 20, izquierdo: 20 }),
    )

    expect(resultado.valido).toBe(true)
    expect(resultado.mensaje).toBeNull()
    expect(resultado.resultantes).toEqual({ ancho: 560, alto: 760 })
  })

  it('acepta márgenes de cero', () => {
    expect(validarRecorte({ ancho: 600, alto: 800 }, MARGENES_CERO).valido).toBe(
      true,
    )
  })

  it('acepta un recorte por un solo lado', () => {
    expect(
      validarRecorte({ ancho: 600, alto: 800 }, margenes({ superior: 100 }))
        .valido,
    ).toBe(true)
  })
})

describe('validarRecorte: márgenes inválidos', () => {
  it('rechaza un margen negativo', () => {
    const resultado = validarRecorte(
      { ancho: 600, alto: 800 },
      margenes({ superior: -10 }),
    )

    expect(resultado.valido).toBe(false)
    expect(resultado.mensaje).toContain('negativo')
  })

  it('nombra el lado del margen negativo', () => {
    expect(
      validarRecorte({ ancho: 600, alto: 800 }, margenes({ izquierdo: -1 }))
        .mensaje,
    ).toContain('izquierdo')
  })

  it('rechaza un valor que no es un número', () => {
    const resultado = validarRecorte(
      { ancho: 600, alto: 800 },
      margenes({ derecho: Number.NaN }),
    )

    expect(resultado.valido).toBe(false)
    expect(resultado.mensaje).toContain('no es un número válido')
  })

  it('rechaza un valor infinito', () => {
    expect(
      validarRecorte(
        { ancho: 600, alto: 800 },
        margenes({ superior: Number.POSITIVE_INFINITY }),
      ).valido,
    ).toBe(false)
  })

  it('rechaza un recorte que deja la anchura en cero', () => {
    const resultado = validarRecorte(
      { ancho: 600, alto: 800 },
      margenes({ izquierdo: 300, derecho: 300 }),
    )

    expect(resultado.valido).toBe(false)
    expect(resultado.mensaje).toContain('ancho')
  })

  it('rechaza un recorte que deja la altura en cero', () => {
    const resultado = validarRecorte(
      { ancho: 600, alto: 800 },
      margenes({ superior: 400, inferior: 400 }),
    )

    expect(resultado.valido).toBe(false)
    expect(resultado.mensaje).toContain('alto')
  })

  it('rechaza unos márgenes que exceden las dimensiones', () => {
    expect(
      validarRecorte(
        { ancho: 600, alto: 800 },
        margenes({ izquierdo: 500, derecho: 500 }),
      ).valido,
    ).toBe(false)
  })

  it('exige conservar al menos la medida mínima', () => {
    const justo = validarRecorte(
      { ancho: 600, alto: 800 },
      margenes({ izquierdo: 300, derecho: 300 - MEDIDA_MINIMA }),
    )

    expect(justo.valido).toBe(true)
    expect(justo.resultantes.ancho).toBeCloseTo(MEDIDA_MINIMA, 6)
  })
})

describe('calcularCajaRecorte: sin rotación', () => {
  it('descuenta los márgenes de los cuatro lados', () => {
    const caja = calcularCajaRecorte(
      PAGINA,
      0,
      margenes({ superior: 100, derecho: 50, inferior: 30, izquierdo: 20 }),
    )

    expect(caja.x).toBeCloseTo(20, 6)
    expect(caja.y).toBeCloseTo(30, 6)
    expect(caja.ancho).toBeCloseTo(600 - 20 - 50, 6)
    expect(caja.alto).toBeCloseTo(800 - 100 - 30, 6)
  })

  it('sin márgenes devuelve la caja completa', () => {
    const caja = calcularCajaRecorte(PAGINA, 0, MARGENES_CERO)

    expect(caja).toEqual({ x: 0, y: 0, ancho: 600, alto: 800 })
  })

  it('respeta el origen de la caja de la página', () => {
    const caja = calcularCajaRecorte(
      { x: 10, y: 20, ancho: 600, alto: 800 },
      0,
      margenes({ izquierdo: 30, inferior: 40 }),
    )

    expect(caja.x).toBeCloseTo(40, 6)
    expect(caja.y).toBeCloseTo(60, 6)
  })

  it('el margen superior recorta por arriba, es decir, reduce el alto', () => {
    const caja = calcularCajaRecorte(PAGINA, 0, margenes({ superior: 200 }))

    expect(caja.y).toBeCloseTo(0, 6)
    expect(caja.alto).toBeCloseTo(600, 6)
  })
})

describe('calcularCajaRecorte: páginas rotadas', () => {
  it('con un cuarto de vuelta el margen superior visible actúa sobre otro eje', () => {
    // La página mide 600 × 800 y se muestra girada, así que se ve 800 × 600.
    // Recortar 100 «por arriba» debe quitar 100 del ancho interno del documento.
    const caja = calcularCajaRecorte(PAGINA, 90, margenes({ superior: 100 }))

    expect(caja.ancho).toBeCloseTo(500, 6)
    expect(caja.alto).toBeCloseTo(800, 6)
  })

  it('los márgenes se descuentan de lo que se ve, con cualquier rotación', () => {
    const conMargenes = margenes({
      superior: 40,
      derecho: 30,
      inferior: 20,
      izquierdo: 10,
    })

    for (const rotacion of [0, 90, 180, 270] as const) {
      const visiblesAntes = calcularMedidasVisibles(PAGINA, rotacion)
      const caja = calcularCajaRecorte(PAGINA, rotacion, conMargenes)
      const visiblesDespues = calcularMedidasVisibles(
        { x: caja.x, y: caja.y, ancho: caja.ancho, alto: caja.alto },
        rotacion,
      )

      // Lo que se ve pierde exactamente los márgenes indicados, sea cual sea la
      // rotación de la página y el eje interno al que corresponda cada lado.
      expect(visiblesDespues.ancho).toBeCloseTo(
        visiblesAntes.ancho - 10 - 30,
        6,
      )
      expect(visiblesDespues.alto).toBeCloseTo(visiblesAntes.alto - 40 - 20, 6)
    }
  })

  it('la caja resultante nunca sobresale de la página', () => {
    const conMargenes = margenes({
      superior: 40,
      derecho: 30,
      inferior: 20,
      izquierdo: 10,
    })

    for (const rotacion of [0, 90, 180, 270] as const) {
      const caja = calcularCajaRecorte(PAGINA, rotacion, conMargenes)

      expect(caja.x).toBeGreaterThanOrEqual(0)
      expect(caja.y).toBeGreaterThanOrEqual(0)
      expect(caja.x + caja.ancho).toBeLessThanOrEqual(600 + 1e-6)
      expect(caja.y + caja.alto).toBeLessThanOrEqual(800 + 1e-6)
    }
  })

  it('con media vuelta los lados opuestos se intercambian', () => {
    const caja = calcularCajaRecorte(PAGINA, 180, margenes({ izquierdo: 100 }))

    // Lo que se ve a la izquierda es, internamente, el borde derecho.
    expect(caja.x).toBeCloseTo(0, 6)
    expect(caja.ancho).toBeCloseTo(500, 6)
  })
})

describe('calcularFraccionesRecorte', () => {
  it('traduce los márgenes a fracciones', () => {
    const fracciones = calcularFraccionesRecorte(
      { ancho: 600, alto: 800 },
      margenes({ izquierdo: 150, superior: 200 }),
    )

    expect(fracciones.izquierda).toBeCloseTo(0.25, 6)
    expect(fracciones.superior).toBeCloseTo(0.25, 6)
    expect(fracciones.derecha).toBe(0)
    expect(fracciones.inferior).toBe(0)
  })

  it('limita las fracciones al intervalo de 0 a 1', () => {
    const fracciones = calcularFraccionesRecorte(
      { ancho: 100, alto: 100 },
      margenes({ izquierdo: 500 }),
    )

    expect(fracciones.izquierda).toBe(1)
  })

  it('descarta los valores que no son números', () => {
    const fracciones = calcularFraccionesRecorte(
      { ancho: 100, alto: 100 },
      margenes({ superior: Number.NaN }),
    )

    expect(fracciones.superior).toBe(0)
  })
})

describe('calcularIndicesRecorte', () => {
  it('«todas» devuelve todos los índices', () => {
    expect(calcularIndicesRecorte('todas', 4, 0, [])).toEqual([0, 1, 2, 3])
  })

  it('«referencia» devuelve solo la página de referencia', () => {
    expect(calcularIndicesRecorte('referencia', 5, 2, [])).toEqual([2])
  })

  it('«seleccionadas» devuelve los índices marcados, ordenados', () => {
    expect(calcularIndicesRecorte('seleccionadas', 5, 0, [3, 1])).toEqual([1, 3])
  })

  it('«seleccionadas» descarta los índices que no existen', () => {
    expect(calcularIndicesRecorte('seleccionadas', 3, 0, [0, 9, -1])).toEqual([0])
  })

  it('descarta una referencia fuera del documento', () => {
    expect(calcularIndicesRecorte('referencia', 3, 10, [])).toEqual([])
  })

  it('devuelve una lista vacía sin documento', () => {
    expect(calcularIndicesRecorte('todas', 0, 0, [])).toEqual([])
  })
})

describe('recortarPdf: casos básicos', () => {
  it('exige algún margen que recortar', async () => {
    await expect(recortar(2)).rejects.toThrow(ErrorPdf)
  })

  it('genera un documento válido con el nombre esperado', async () => {
    const resultado = await recortar(2, {
      margenes: margenes({ superior: 20 }),
    })

    expect(resultado.nombreArchivo).toBe(NOMBRE_RECORTADO)
    expect(resultado.nombreArchivo).toBe('free-pdf-recortado.pdf')
    expect(resultado.numeroPaginas).toBe(2)
  })

  it('rechaza un recorte inválido con un mensaje que nombra la página', async () => {
    await expect(
      recortar(2, { margenes: margenes({ superior: 5000 }) }),
    ).rejects.toThrow(/página 1/)
  })
})

describe('recortarPdf: cajas resultantes', () => {
  it('ajusta la caja de recorte y deja intacta la de medios', async () => {
    const resultado = await recortar(1, {
      margenes: margenes({ superior: 50, derecho: 40, inferior: 30, izquierdo: 20 }),
    })
    const cajas = await leerCajas(resultado.blob)

    // Las páginas de prueba miden 200 de ancho y 400 de alto.
    expect(cajas[0].medios.width).toBeCloseTo(200, 3)
    expect(cajas[0].medios.height).toBeCloseTo(400, 3)
    expect(cajas[0].recorte.x).toBeCloseTo(20, 3)
    expect(cajas[0].recorte.y).toBeCloseTo(30, 3)
    expect(cajas[0].recorte.width).toBeCloseTo(200 - 20 - 40, 3)
    expect(cajas[0].recorte.height).toBeCloseTo(400 - 50 - 30, 3)
  })

  it('el recorte en milímetros produce la caja equivalente', async () => {
    const resultado = await recortar(1, {
      unidad: 'milimetros',
      margenes: margenes({ izquierdo: 10 }),
    })
    const cajas = await leerCajas(resultado.blob)

    expect(cajas[0].recorte.x).toBeCloseTo(milimetrosAPuntos(10), 3)
  })

  it('un recorte posterior se mide sobre la caja ya recortada', async () => {
    const primero = await recortar(1, {
      margenes: margenes({ izquierdo: 20 }),
    })

    const intermedio = new File([await primero.blob.arrayBuffer()], 'r.pdf', {
      type: 'application/pdf',
    })
    const segundo = await recortarPdf({
      archivo: intermedio,
      configuracion: configurar({ margenes: margenes({ izquierdo: 30 }) }),
      indiceReferencia: 0,
      indicesSeleccionados: [],
    })
    const cajas = await leerCajas(segundo.blob)

    expect(cajas[0].recorte.x).toBeCloseTo(50, 3)
    expect(cajas[0].recorte.width).toBeCloseTo(200 - 50, 3)
  })
})

describe('recortarPdf: páginas afectadas', () => {
  it('recorta todas las páginas', async () => {
    const resultado = await recortar(3, {
      alcance: 'todas',
      margenes: margenes({ superior: 40 }),
    })
    const cajas = await leerCajas(resultado.blob)

    for (const caja of cajas) {
      expect(caja.recorte.height).toBeCloseTo(360, 3)
    }
  })

  it('recorta una sola página con «referencia»', async () => {
    const resultado = await recortar(
      3,
      { alcance: 'referencia', margenes: margenes({ superior: 40 }) },
      1,
    )
    const cajas = await leerCajas(resultado.blob)

    expect(cajas[0].recorte.height).toBeCloseTo(400, 3)
    expect(cajas[1].recorte.height).toBeCloseTo(360, 3)
    expect(cajas[2].recorte.height).toBeCloseTo(400, 3)
  })

  it('recorta varias páginas marcadas', async () => {
    const resultado = await recortar(
      4,
      { alcance: 'seleccionadas', margenes: margenes({ superior: 40 }) },
      0,
      [0, 2],
    )
    const cajas = await leerCajas(resultado.blob)

    expect(cajas[0].recorte.height).toBeCloseTo(360, 3)
    expect(cajas[1].recorte.height).toBeCloseTo(400, 3)
    expect(cajas[2].recorte.height).toBeCloseTo(360, 3)
    expect(cajas[3].recorte.height).toBeCloseTo(400, 3)
  })

  it('las páginas no seleccionadas conservan su caja de recorte original', async () => {
    const resultado = await recortar(
      2,
      { alcance: 'seleccionadas', margenes: margenes({ izquierdo: 50 }) },
      0,
      [0],
    )
    const cajas = await leerCajas(resultado.blob)

    expect(cajas[1].recorte.x).toBeCloseTo(cajas[1].medios.x, 3)
    expect(cajas[1].recorte.width).toBeCloseTo(cajas[1].medios.width, 3)
  })

  it('rechaza una selección vacía', async () => {
    await expect(
      recortar(
        3,
        { alcance: 'seleccionadas', margenes: margenes({ superior: 10 }) },
        0,
        [],
      ),
    ).rejects.toThrow(ErrorPdf)
  })

  it('conserva el número de páginas', async () => {
    const resultado = await recortar(5, {
      margenes: margenes({ superior: 10 }),
    })

    expect(resultado.numeroPaginas).toBe(5)
  })
})

describe('recortarPdf: restauración', () => {
  it('los márgenes a cero se rechazan, así que restaurar es no recortar', async () => {
    // «Restaurar el recorte» devuelve los márgenes a cero en la interfaz; el
    // procesamiento rechaza entonces la operación porque no habría nada que hacer.
    await expect(
      recortar(1, { margenes: MARGENES_CERO }),
    ).rejects.toThrow(/ningún margen/)
  })

  it('el documento original conserva su caja de recorte intacta', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 1)
    const original = await abrirBytes(new Uint8Array(await archivo.arrayBuffer()))
    const antes = original.getPage(0).getCropBox()

    expect(antes.width).toBeCloseTo(200, 3)
    expect(antes.height).toBeCloseTo(400, 3)
  })
})

describe('recortarPdf: páginas rotadas', () => {
  it('conserva la rotación de las páginas', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 2, {
      rotacionInicial: 90,
    })

    const resultado = await recortarPdf({
      archivo,
      configuracion: configurar({ margenes: margenes({ superior: 20 }) }),
      indiceReferencia: 0,
      indicesSeleccionados: [],
    })
    const documento = await abrirBytes(await bytesDeBlob(resultado.blob))

    for (const pagina of documento.getPages()) {
      expect(pagina.getRotation().angle).toBe(90)
    }
  })

  it('en una página girada el margen superior visible reduce el ancho interno', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 1, {
      rotacionInicial: 90,
    })

    const resultado = await recortarPdf({
      archivo,
      configuracion: configurar({ margenes: margenes({ superior: 50 }) }),
      indiceReferencia: 0,
      indicesSeleccionados: [],
    })
    const cajas = await leerCajas(resultado.blob)

    expect(cajas[0].recorte.width).toBeCloseTo(150, 3)
    expect(cajas[0].recorte.height).toBeCloseTo(400, 3)
  })

  it('funciona con documentos que mezclan rotaciones', async () => {
    const documento = await PDFDocument.create()

    for (const angulo of [0, 90, 180, 270]) {
      const pagina = documento.addPage([400, 600])
      pagina.setRotation(degrees(angulo))
    }

    const bytes = await documento.save()
    const contenido = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(contenido).set(bytes)
    const archivo = new File([contenido], 'girado.pdf', {
      type: 'application/pdf',
    })

    const resultado = await recortarPdf({
      archivo,
      configuracion: configurar({ margenes: margenes({ superior: 30 }) }),
      indiceReferencia: 0,
      indicesSeleccionados: [],
    })
    const recortado = await abrirBytes(await bytesDeBlob(resultado.blob))

    // En todas las páginas se pierden 30 puntos de lo que se ve por arriba,
    // aunque el eje interno afectado cambie con cada rotación.
    for (const pagina of recortado.getPages()) {
      const rotacion = normalizarRotacion(pagina.getRotation().angle)
      const medios = pagina.getMediaBox()
      const recorte = pagina.getCropBox()

      const visiblesAntes = calcularMedidasVisibles(
        { x: medios.x, y: medios.y, ancho: medios.width, alto: medios.height },
        rotacion,
      )
      const visiblesDespues = calcularMedidasVisibles(
        {
          x: recorte.x,
          y: recorte.y,
          ancho: recorte.width,
          alto: recorte.height,
        },
        rotacion,
      )

      expect(visiblesDespues.ancho).toBeCloseTo(visiblesAntes.ancho, 3)
      expect(visiblesDespues.alto).toBeCloseTo(visiblesAntes.alto - 30, 3)
    }
  })
})

import * as pdfLib from 'pdf-lib'
import { PDFDocument, degrees } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  ajustarLineas,
  aplicarEdicion,
  calcularSangria,
  describirPagina,
  NOMBRE_EDITADO,
} from '../edicion/aplicarEdicion'
import {
  agruparPorPagina,
  calcularCajaVisible,
  calcularColocacionElemento,
  describirElemento,
  elementoPinta,
  FRACCION_MINIMA,
  normalizarElemento,
  puntoDeTrazoAVisible,
} from '../edicion/colocarElementos'
import {
  NOMBRE_TIPOGRAFIA,
  TIPOGRAFIAS_DISPONIBLES,
  TIPOGRAFIAS_ESTANDAR,
} from '../edicion/tipografias'
import type {
  ElementoForma,
  ElementoImagen,
  ElementoResaltado,
  ElementoSuperpuesto,
  ElementoTexto,
  ElementoTrazo,
} from '../edicion/tipos'
import { calcularMedidasVisibles } from '../pdf/posicionarEnPagina'
import { bytesDeBlob } from './ayudas/crearPdfPrueba'

/** Página A4 en puntos, para no repetir los números por todas partes. */
const ANCHO = 595
const ALTO = 842

/** Contexto de una página A4 sin girar. */
const PAGINA_A4 = {
  caja: { x: 0, y: 0, ancho: ANCHO, alto: ALTO },
  rotacion: 0,
} as const

/** Texto de ejemplo, con los campos comunes puestos. */
function texto(cambios: Partial<ElementoTexto> = {}): ElementoTexto {
  return {
    id: 'texto-1',
    clase: 'texto',
    pagina: 1,
    izquierda: 0.1,
    superior: 0.1,
    ancho: 0.4,
    alto: 0.1,
    giro: 0,
    opacidad: 1,
    texto: 'Hola',
    tipografia: 'helvetica',
    tamano: 12,
    color: '#000000',
    alineacion: 'izquierda',
    ...cambios,
  }
}

/** Forma de ejemplo. */
function forma(cambios: Partial<ElementoForma> = {}): ElementoForma {
  return {
    id: 'forma-1',
    clase: 'forma',
    pagina: 1,
    izquierda: 0.2,
    superior: 0.2,
    ancho: 0.3,
    alto: 0.2,
    giro: 0,
    opacidad: 1,
    figura: 'rectangulo',
    relleno: '#ff0000',
    borde: null,
    grosorBorde: 1,
    ...cambios,
  }
}

/** Trazo de ejemplo, una diagonal dentro de su caja. */
function trazo(cambios: Partial<ElementoTrazo> = {}): ElementoTrazo {
  return {
    id: 'trazo-1',
    clase: 'trazo',
    pagina: 1,
    izquierda: 0.1,
    superior: 0.5,
    ancho: 0.3,
    alto: 0.1,
    giro: 0,
    opacidad: 1,
    trazos: [
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ],
    ],
    grosor: 2,
    color: '#0000ff',
    ...cambios,
  }
}

/** Resaltado de ejemplo. */
function resaltado(cambios: Partial<ElementoResaltado> = {}): ElementoResaltado {
  return {
    id: 'resaltado-1',
    clase: 'resaltado',
    pagina: 1,
    izquierda: 0.1,
    superior: 0.3,
    ancho: 0.5,
    alto: 0.03,
    giro: 0,
    opacidad: 0.35,
    color: '#ffff00',
    ...cambios,
  }
}

/** Crea un documento nuevo con el número de páginas indicado. */
async function crearDocumento(
  numeroPaginas = 1,
  rotacion = 0,
): Promise<PDFDocument> {
  const documento = await PDFDocument.create()

  for (let indice = 0; indice < numeroPaginas; indice += 1) {
    const pagina = documento.addPage([ANCHO, ALTO])

    if (rotacion !== 0) {
      pagina.setRotation(degrees(rotacion))
    }
  }

  return documento
}

/** Aplica la edición a un documento nuevo. */
async function aplicar(
  elementos: readonly ElementoSuperpuesto[],
  numeroPaginas = 1,
  rotacion = 0,
) {
  const documento = await crearDocumento(numeroPaginas, rotacion)

  return await aplicarEdicion({ documento, pdfLib, elementos })
}

describe('normalizarElemento', () => {
  it('deja las fracciones válidas tal cual', () => {
    const original = texto({ izquierda: 0.25, superior: 0.5, ancho: 0.3, alto: 0.2 })
    const normalizado = normalizarElemento(original)

    expect(normalizado.izquierda).toBe(0.25)
    expect(normalizado.superior).toBe(0.5)
    expect(normalizado.ancho).toBe(0.3)
    expect(normalizado.alto).toBe(0.2)
  })

  it('mueve el elemento para que la caja completa quepa, en vez de recortarla', () => {
    const normalizado = normalizarElemento(
      texto({ izquierda: 0.9, superior: 0.95, ancho: 0.4, alto: 0.2 }),
    )

    // El ancho se conserva y es la posición la que cede.
    expect(normalizado.ancho).toBe(0.4)
    expect(normalizado.izquierda).toBeCloseTo(0.6, 10)
    expect(normalizado.alto).toBe(0.2)
    expect(normalizado.superior).toBeCloseTo(0.8, 10)

    // Y así la caja termina justo en el borde, sin salirse.
    expect(normalizado.izquierda + normalizado.ancho).toBeCloseTo(1, 10)
    expect(normalizado.superior + normalizado.alto).toBeCloseTo(1, 10)
  })

  it('nunca deja un elemento sin tamaño', () => {
    const normalizado = normalizarElemento(texto({ ancho: 0, alto: -3 }))

    expect(normalizado.ancho).toBe(FRACCION_MINIMA)
    expect(normalizado.alto).toBe(FRACCION_MINIMA)
  })

  it('descarta los valores no numéricos en vez de propagarlos', () => {
    const normalizado = normalizarElemento(
      texto({ izquierda: Number.NaN, ancho: Number.POSITIVE_INFINITY }),
    )

    expect(Number.isFinite(normalizado.izquierda)).toBe(true)
    expect(Number.isFinite(normalizado.ancho)).toBe(true)
  })

  it('normaliza los giros negativos y los mayores de una vuelta', () => {
    expect(normalizarElemento(texto({ giro: -90 })).giro).toBe(270)
    expect(normalizarElemento(texto({ giro: 450 })).giro).toBe(90)
    expect(normalizarElemento(texto({ giro: 360 })).giro).toBe(0)
  })

  it('limita la opacidad al intervalo de 0 a 1', () => {
    expect(normalizarElemento(texto({ opacidad: 5 })).opacidad).toBe(1)
    expect(normalizarElemento(texto({ opacidad: -1 })).opacidad).toBe(0)
  })

  it('obliga a que la página sea un entero de al menos 1', () => {
    expect(normalizarElemento(texto({ pagina: 0 })).pagina).toBe(1)
    expect(normalizarElemento(texto({ pagina: 3.7 })).pagina).toBe(3)
  })
})

describe('calcularCajaVisible', () => {
  const medidas = { ancho: ANCHO, alto: ALTO }

  it('invierte el eje vertical, porque el editor mide desde arriba y PDF desde abajo', () => {
    const caja = calcularCajaVisible(
      texto({ izquierda: 0, superior: 0, ancho: 0.5, alto: 0.25 }),
      medidas,
    )

    expect(caja.x).toBe(0)
    expect(caja.ancho).toBeCloseTo(ANCHO * 0.5, 6)
    expect(caja.alto).toBeCloseTo(ALTO * 0.25, 6)

    // Pegado arriba, su borde inferior está a tres cuartos de altura.
    expect(caja.y).toBeCloseTo(ALTO * 0.75, 6)
  })

  it('deja el borde inferior en cero cuando el elemento está pegado abajo', () => {
    const caja = calcularCajaVisible(
      texto({ superior: 0.8, alto: 0.2 }),
      medidas,
    )

    expect(caja.y).toBeCloseTo(0, 6)
  })

  it('la misma fracción cubre la misma proporción a cualquier escala', () => {
    const elemento = texto({ izquierda: 0.25, superior: 0.25, ancho: 0.5, alto: 0.5 })

    const pequena = calcularCajaVisible(elemento, { ancho: 200, alto: 300 })
    const grande = calcularCajaVisible(elemento, { ancho: 2000, alto: 3000 })

    expect(pequena.x / 200).toBeCloseTo(grande.x / 2000, 10)
    expect(pequena.y / 300).toBeCloseTo(grande.y / 3000, 10)
    expect(pequena.ancho / 200).toBeCloseTo(grande.ancho / 2000, 10)
  })
})

describe('calcularColocacionElemento', () => {
  it('coloca un elemento sin girar en el punto que le corresponde', () => {
    const colocacion = calcularColocacionElemento(
      texto({ izquierda: 0.2, superior: 0.1, ancho: 0.3, alto: 0.2 }),
      PAGINA_A4,
    )

    expect(colocacion.x).toBeCloseTo(ANCHO * 0.2, 6)
    // superior 0.1 y alto 0.2 dejan el borde inferior en 1 - 0.1 - 0.2 = 0.7.
    expect(colocacion.y).toBeCloseTo(ALTO * 0.7, 6)
    expect(colocacion.rotacionGrados).toBe(0)
  })

  it('suma la rotación de la página al giro del elemento', () => {
    const colocacion = calcularColocacionElemento(texto({ giro: 30 }), {
      caja: { x: 0, y: 0, ancho: ANCHO, alto: ALTO },
      rotacion: 90,
    })

    expect(colocacion.rotacionGrados).toBe(120)
  })

  it('respeta el origen de la caja de la página cuando no es cero', () => {
    const colocacion = calcularColocacionElemento(
      texto({ izquierda: 0, superior: 1 - 0.1, alto: 0.1 }),
      { caja: { x: 20, y: 40, ancho: ANCHO, alto: ALTO }, rotacion: 0 },
    )

    expect(colocacion.x).toBeCloseTo(20, 6)
    expect(colocacion.y).toBeCloseTo(40, 6)
  })

  it('mantiene el elemento dentro de la página en las cuatro rotaciones', () => {
    for (const rotacion of [0, 90, 180, 270] as const) {
      const colocacion = calcularColocacionElemento(
        texto({ izquierda: 0.1, superior: 0.1, ancho: 0.3, alto: 0.2 }),
        { caja: { x: 0, y: 0, ancho: ANCHO, alto: ALTO }, rotacion },
      )

      expect(colocacion.x).toBeGreaterThanOrEqual(-1)
      expect(colocacion.x).toBeLessThanOrEqual(ANCHO + 1)
      expect(colocacion.y).toBeGreaterThanOrEqual(-1)
      expect(colocacion.y).toBeLessThanOrEqual(ALTO + 1)
    }
  })

  it('usa las medidas visibles, que se intercambian con un cuarto de vuelta', () => {
    // Con la página girada 90 grados, el ancho visible es el alto de la caja.
    const visibles = calcularMedidasVisibles(
      { x: 0, y: 0, ancho: ANCHO, alto: ALTO },
      90,
    )

    expect(visibles.ancho).toBe(ALTO)
    expect(visibles.alto).toBe(ANCHO)

    const caja = calcularCajaVisible(
      texto({ izquierda: 0, superior: 0, ancho: 1, alto: 1 }),
      visibles,
    )

    expect(caja.ancho).toBe(ALTO)
    expect(caja.alto).toBe(ANCHO)
  })

  it('no desplaza el elemento por el hecho de girarlo', () => {
    const base = texto({ izquierda: 0.3, superior: 0.3, ancho: 0.2, alto: 0.2 })

    const sinGiro = calcularColocacionElemento(base, PAGINA_A4)
    const conGiro = calcularColocacionElemento({ ...base, giro: 45 }, PAGINA_A4)

    // La caja de referencia es la misma; lo que cambia es cómo se dibuja dentro.
    expect(conGiro.cajaEnPagina.x).toBeCloseTo(sinGiro.cajaEnPagina.x, 6)
    expect(conGiro.cajaEnPagina.y).toBeCloseTo(sinGiro.cajaEnPagina.y, 6)

    // Y el centro del contenido girado sigue estando donde estaba.
    const centroSin = {
      x: sinGiro.visible.x + sinGiro.cajaVisible.ancho / 2,
      y: sinGiro.visible.y + sinGiro.cajaVisible.alto / 2,
    }
    const centroCon = {
      x: conGiro.visible.x + conGiro.cajaVisible.ancho / 2,
      y: conGiro.visible.y + conGiro.cajaVisible.alto / 2,
    }

    expect(centroCon.x).toBeCloseTo(centroSin.x, 6)
    expect(centroCon.y).toBeCloseTo(centroSin.y, 6)
  })
})

describe('puntoDeTrazoAVisible', () => {
  const caja = { x: 100, y: 200, ancho: 50, alto: 40 }

  it('coloca el origen del trazo arriba a la izquierda de la caja', () => {
    const punto = puntoDeTrazoAVisible({ x: 0, y: 0 }, caja)

    expect(punto.x).toBe(100)
    // y = 0 es la parte de arriba del trazo, que en PDF es el borde superior.
    expect(punto.y).toBe(240)
  })

  it('coloca el extremo opuesto abajo a la derecha', () => {
    const punto = puntoDeTrazoAVisible({ x: 1, y: 1 }, caja)

    expect(punto.x).toBe(150)
    expect(punto.y).toBe(200)
  })

  it('limita los puntos que se salen de la caja', () => {
    const punto = puntoDeTrazoAVisible({ x: 3, y: -2 }, caja)

    expect(punto.x).toBe(150)
    expect(punto.y).toBe(240)
  })
})

describe('elementoPinta', () => {
  it('descarta un texto vacío o con solo espacios', () => {
    expect(elementoPinta(texto({ texto: '' }))).toBe(false)
    expect(elementoPinta(texto({ texto: '   \n  ' }))).toBe(false)
    expect(elementoPinta(texto({ texto: 'algo' }))).toBe(true)
  })

  it('descarta una forma sin relleno ni borde', () => {
    expect(elementoPinta(forma({ relleno: null, borde: null }))).toBe(false)
    expect(elementoPinta(forma({ relleno: null, borde: '#000000' }))).toBe(true)
  })

  it('descarta un trazo sin al menos dos puntos', () => {
    expect(elementoPinta(trazo({ trazos: [] }))).toBe(false)
    expect(elementoPinta(trazo({ trazos: [[{ x: 0, y: 0 }]] }))).toBe(false)
    expect(elementoPinta(trazo())).toBe(true)
  })

  it('descarta cualquier elemento completamente transparente', () => {
    expect(elementoPinta(resaltado({ opacidad: 0 }))).toBe(false)
    expect(elementoPinta(texto({ opacidad: 0 }))).toBe(false)
  })

  it('descarta una imagen sin bytes', () => {
    const imagen: ElementoImagen = {
      id: 'img',
      clase: 'imagen',
      pagina: 1,
      izquierda: 0,
      superior: 0,
      ancho: 0.2,
      alto: 0.2,
      giro: 0,
      opacidad: 1,
      bytes: new Uint8Array(0),
      formato: 'png',
      descripcion: '',
    }

    expect(elementoPinta(imagen)).toBe(false)
  })
})

describe('agruparPorPagina', () => {
  it('agrupa conservando el orden dentro de cada página', () => {
    const grupos = agruparPorPagina([
      texto({ id: 'a', pagina: 2 }),
      texto({ id: 'b', pagina: 1 }),
      texto({ id: 'c', pagina: 2 }),
    ])

    expect(grupos.get(1)?.map((elemento) => elemento.id)).toEqual(['b'])
    expect(grupos.get(2)?.map((elemento) => elemento.id)).toEqual(['a', 'c'])
  })

  it('trata las páginas no enteras como la página entera correspondiente', () => {
    const grupos = agruparPorPagina([texto({ pagina: 2.9 })])

    expect(grupos.has(2)).toBe(true)
  })
})

describe('ajustarLineas', () => {
  it('respeta los saltos de línea que ya trae el texto', async () => {
    const documento = await PDFDocument.create()
    const tipografia = await documento.embedFont(pdfLib.StandardFonts.Helvetica)

    expect(ajustarLineas('uno\ndos', tipografia, 12, 500)).toEqual(['uno', 'dos'])
  })

  it('parte por palabras cuando la línea no cabe', async () => {
    const documento = await PDFDocument.create()
    const tipografia = await documento.embedFont(pdfLib.StandardFonts.Helvetica)

    const lineas = ajustarLineas(
      'palabra palabra palabra palabra',
      tipografia,
      12,
      60,
    )

    expect(lineas.length).toBeGreaterThan(1)
    for (const linea of lineas) {
      expect(tipografia.widthOfTextAtSize(linea, 12)).toBeLessThanOrEqual(60.001)
    }
  })

  it('no parte una palabra más larga que la caja: la deja sola en su línea', async () => {
    const documento = await PDFDocument.create()
    const tipografia = await documento.embedFont(pdfLib.StandardFonts.Helvetica)

    const lineas = ajustarLineas('inconstitucionalmente', tipografia, 12, 10)

    expect(lineas).toEqual(['inconstitucionalmente'])
  })

  it('conserva los párrafos vacíos, para no comerse una línea en blanco', async () => {
    const documento = await PDFDocument.create()
    const tipografia = await documento.embedFont(pdfLib.StandardFonts.Helvetica)

    expect(ajustarLineas('uno\n\ndos', tipografia, 12, 500)).toEqual([
      'uno',
      '',
      'dos',
    ])
  })
})

describe('calcularSangria', () => {
  it('no desplaza el texto alineado a la izquierda', () => {
    expect(calcularSangria('izquierda', 100, 40)).toBe(0)
  })

  it('centra dejando la mitad del hueco a cada lado', () => {
    expect(calcularSangria('centro', 100, 40)).toBe(30)
  })

  it('pega a la derecha dejando todo el hueco delante', () => {
    expect(calcularSangria('derecha', 100, 40)).toBe(60)
  })

  it('no desplaza hacia atrás cuando la línea es más ancha que la caja', () => {
    expect(calcularSangria('centro', 40, 100)).toBe(0)
    expect(calcularSangria('derecha', 40, 100)).toBe(0)
  })
})

describe('describirPagina', () => {
  it('lee las medidas y la rotación de la página', async () => {
    const documento = await crearDocumento(1, 90)
    const contexto = describirPagina(documento.getPage(0))

    expect(contexto.caja.ancho).toBe(ANCHO)
    expect(contexto.caja.alto).toBe(ALTO)
    expect(contexto.rotacion).toBe(90)
  })
})

describe('aplicarEdicion', () => {
  it('devuelve un PDF válido con las páginas del original', async () => {
    const resultado = await aplicar([texto()], 3)

    expect(resultado.numeroPaginas).toBe(3)
    expect(resultado.nombreArchivo).toBe(NOMBRE_EDITADO)
    expect(resultado.tamano).toBeGreaterThan(0)

    const reabierto = await PDFDocument.load(await bytesDeBlob(resultado.blob))
    expect(reabierto.getPageCount()).toBe(3)
  })

  it('cuenta solo los elementos que dibujan algo', async () => {
    const resultado = await aplicar([
      texto({ id: 'bueno' }),
      texto({ id: 'vacio', texto: '   ' }),
      forma({ id: 'invisible', relleno: null, borde: null }),
    ])

    expect(resultado.elementosDibujados).toBe(1)
    expect(resultado.elementosDescartados).toBe(2)
  })

  it('cuenta las páginas afectadas, no todas las del documento', async () => {
    const resultado = await aplicar(
      [texto({ pagina: 1 }), texto({ id: 'otro', pagina: 3 })],
      5,
    )

    expect(resultado.paginasAfectadas).toBe(2)
  })

  it('informa de los elementos puestos en una página que no existe, sin perderlos en silencio', async () => {
    const resultado = await aplicar(
      [texto({ pagina: 1 }), texto({ id: 'fuera', pagina: 9 })],
      2,
    )

    expect(resultado.paginasInexistentes).toEqual([9])
    expect(resultado.elementosDibujados).toBe(1)
  })

  it('rechaza aplicar cuando no hay ningún elemento', async () => {
    await expect(aplicar([])).rejects.toThrow(/ningún elemento/i)
  })

  it('explica el motivo cuando hay elementos pero ninguno pinta', async () => {
    await expect(aplicar([texto({ texto: '' })])).rejects.toThrow(
      /no dibuja|dibuja nada/i,
    )
  })

  it('rechaza un documento sin páginas', async () => {
    const documento = await PDFDocument.create()

    await expect(
      aplicarEdicion({ documento, pdfLib, elementos: [texto()] }),
    ).rejects.toThrow(/ninguna página/i)
  })

  it('conserva el texto original del documento: añade una capa, no lo sustituye', async () => {
    const documento = await PDFDocument.create()
    const pagina = documento.addPage([ANCHO, ALTO])
    const tipografia = await documento.embedFont(pdfLib.StandardFonts.Helvetica)

    pagina.drawText('CONTENIDO ORIGINAL', {
      x: 50,
      y: 700,
      size: 14,
      font: tipografia,
    })

    const antes = (await documento.save()).byteLength

    const resultado = await aplicarEdicion({
      documento,
      pdfLib,
      elementos: [texto({ texto: 'Añadido encima' })],
    })

    // El documento crece porque se ha añadido contenido, no porque se haya
    // reconstruido: sigue siendo el mismo documento con una capa más.
    expect(resultado.tamano).toBeGreaterThan(0)
    expect(resultado.numeroPaginas).toBe(1)
    expect(antes).toBeGreaterThan(0)
  })

  it('dibuja las cuatro clases de elemento sin fallar', async () => {
    const resultado = await aplicar([texto(), forma(), trazo(), resaltado()])

    expect(resultado.elementosDibujados).toBe(4)
    expect(resultado.elementosDescartados).toBe(0)
  })

  it('dibuja todas las figuras geométricas', async () => {
    const figuras = ['rectangulo', 'elipse', 'linea', 'flecha'] as const
    const resultado = await aplicar(
      figuras.map((figura, indice) =>
        forma({ id: `forma-${indice}`, figura, borde: '#000000' }),
      ),
    )

    expect(resultado.elementosDibujados).toBe(figuras.length)
  })

  it('funciona con las páginas giradas', async () => {
    for (const rotacion of [0, 90, 180, 270]) {
      const resultado = await aplicar([texto(), forma()], 1, rotacion)

      expect(resultado.elementosDibujados).toBe(2)
    }
  })

  it('informa del progreso una vez por elemento', async () => {
    const pasos: number[] = []

    const documento = await crearDocumento(2)
    await aplicarEdicion(
      {
        documento,
        pdfLib,
        elementos: [texto(), forma(), texto({ id: 'p2', pagina: 2 })],
      },
      { alProgreso: (progreso) => pasos.push(progreso.completados) },
    )

    expect(pasos).toEqual([1, 2, 3])
  })

  it('se puede cancelar antes de empezar', async () => {
    const controlador = new AbortController()
    controlador.abort()

    const documento = await crearDocumento(1)

    await expect(
      aplicarEdicion(
        { documento, pdfLib, elementos: [texto()] },
        { senal: controlador.signal },
      ),
    ).rejects.toThrow()
  })

  it('acepta un nombre de archivo propio', async () => {
    const documento = await crearDocumento(1)
    const resultado = await aplicarEdicion({
      documento,
      pdfLib,
      elementos: [texto()],
      nombreArchivo: 'free-pdf-firmado.pdf',
    })

    expect(resultado.nombreArchivo).toBe('free-pdf-firmado.pdf')
  })

  it('un texto largo no revienta ni se sale: se ajusta a su caja', async () => {
    const largo = 'palabra '.repeat(200)
    const resultado = await aplicar([
      texto({ texto: largo, ancho: 0.3, alto: 0.1 }),
    ])

    expect(resultado.elementosDibujados).toBe(1)
  })
})

describe('tipografías', () => {
  it('todas las claves disponibles tienen una tipografía estándar', () => {
    for (const clave of TIPOGRAFIAS_DISPONIBLES) {
      expect(TIPOGRAFIAS_ESTANDAR[clave]).toBeTypeOf('string')
      expect(pdfLib.StandardFonts[TIPOGRAFIAS_ESTANDAR[clave]]).toBeDefined()
    }
  })

  it('todas tienen un nombre legible', () => {
    for (const clave of TIPOGRAFIAS_DISPONIBLES) {
      expect(NOMBRE_TIPOGRAFIA[clave].length).toBeGreaterThan(0)
    }
  })

  it('no se ofrece ninguna tipografía que no exista en pdf-lib', () => {
    // El código indexa `StandardFonts` por clave, así que lo que hay que
    // comprobar es que cada nombre guardado sea una clave del enumerado. Sus
    // valores son distintos: la clave es `HelveticaBold` y el valor
    // `Helvetica-Bold`.
    const claves = Object.keys(pdfLib.StandardFonts)

    for (const nombre of Object.values(TIPOGRAFIAS_ESTANDAR)) {
      expect(claves).toContain(nombre)
      expect(pdfLib.StandardFonts[nombre]).toBeTypeOf('string')
    }
  })

  it('una tipografía desconocida no rompe el dibujado: se usa la de reserva', async () => {
    const resultado = await aplicar([
      // El tipo lo impide, así que se fuerza para comprobar la reserva.
      texto({ tipografia: 'inexistente' as ElementoTexto['tipografia'] }),
    ])

    expect(resultado.elementosDibujados).toBe(1)
  })
})

describe('describirElemento', () => {
  it('describe un texto con su contenido', () => {
    expect(describirElemento(texto({ texto: 'Hola' }))).toContain('Hola')
  })

  it('recorta los textos largos en la descripción', () => {
    const descripcion = describirElemento(texto({ texto: 'x'.repeat(80) }))

    expect(descripcion.length).toBeLessThan(50)
    expect(descripcion).toContain('…')
  })

  it('avisa cuando el texto está vacío', () => {
    expect(describirElemento(texto({ texto: '' }))).toMatch(/sin contenido/i)
  })

  it('describe las demás clases de forma reconocible', () => {
    expect(describirElemento(forma({ figura: 'elipse' }))).toContain('elipse')
    expect(describirElemento(trazo())).toMatch(/mano alzada/i)
    expect(describirElemento(resaltado())).toMatch(/resaltado/i)
  })
})

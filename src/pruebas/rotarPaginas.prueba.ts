import { describe, expect, it } from 'vitest'
import {
  aplicarGiro,
  NOMBRE_ROTADO,
  rotarPaginas,
} from '../funcionalidades/rotar-paginas/rotarPaginas'
import { ErrorPdf } from '../pdf/erroresPdf'
import {
  CUARTO_DE_VUELTA,
  MEDIA_VUELTA,
  gradosDelGiro,
  normalizarRotacion,
  sumarRotacion,
} from '../pdf/rotaciones'
import type { GradosRotacion } from '../pdf/tipos'
import {
  bytesDeBlob,
  contarPaginas,
  crearArchivoPdf,
  leerOrdenOriginal,
  leerRotaciones,
} from './ayudas/crearPdfPrueba'

describe('normalizarRotacion', () => {
  it('deja intactos los cuartos de vuelta admitidos', () => {
    expect(normalizarRotacion(0)).toBe(0)
    expect(normalizarRotacion(90)).toBe(90)
    expect(normalizarRotacion(180)).toBe(180)
    expect(normalizarRotacion(270)).toBe(270)
  })

  it('normaliza los ángulos que superan una vuelta', () => {
    expect(normalizarRotacion(360)).toBe(0)
    expect(normalizarRotacion(450)).toBe(90)
    expect(normalizarRotacion(720)).toBe(0)
  })

  it('normaliza los ángulos negativos', () => {
    expect(normalizarRotacion(-90)).toBe(270)
    expect(normalizarRotacion(-180)).toBe(180)
    expect(normalizarRotacion(-450)).toBe(270)
  })

  it('redondea los ángulos que no son múltiplos de 90', () => {
    expect(normalizarRotacion(80)).toBe(90)
    expect(normalizarRotacion(100)).toBe(90)
    expect(normalizarRotacion(140)).toBe(180)
  })

  it('devuelve 0 ante un valor no numérico', () => {
    expect(normalizarRotacion(Number.NaN)).toBe(0)
    expect(normalizarRotacion(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('suma rotaciones normalizando el resultado', () => {
    expect(sumarRotacion(270, 90)).toBe(0)
    expect(sumarRotacion(180, 180)).toBe(0)
    expect(sumarRotacion(90, 90)).toBe(180)
  })

  it('traduce el sentido del giro a grados', () => {
    expect(gradosDelGiro('derecha')).toBe(CUARTO_DE_VUELTA)
    expect(gradosDelGiro('izquierda')).toBe(270)
  })
})

describe('aplicarGiro', () => {
  const vacio: ReadonlyMap<number, GradosRotacion> = new Map()

  it('gira las páginas indicadas', () => {
    const resultado = aplicarGiro(vacio, [0, 2], CUARTO_DE_VUELTA)

    expect(resultado.get(0)).toBe(90)
    expect(resultado.get(2)).toBe(90)
    expect(resultado.has(1)).toBe(false)
  })

  it('acumula giros consecutivos', () => {
    let rotaciones = aplicarGiro(vacio, [0], CUARTO_DE_VUELTA)
    rotaciones = aplicarGiro(rotaciones, [0], CUARTO_DE_VUELTA)

    expect(rotaciones.get(0)).toBe(180)

    rotaciones = aplicarGiro(rotaciones, [0], MEDIA_VUELTA)
    expect(rotaciones.has(0)).toBe(false)
  })

  it('elimina la entrada cuando la página vuelve a su posición original', () => {
    const rotaciones = aplicarGiro(vacio, [1], 360)

    expect(rotaciones.has(1)).toBe(false)
  })

  it('gira a la izquierda igual que tres cuartos a la derecha', () => {
    const izquierda = aplicarGiro(vacio, [0], gradosDelGiro('izquierda'))

    expect(izquierda.get(0)).toBe(270)
  })

  it('no modifica el mapa que recibe', () => {
    const original = new Map<number, GradosRotacion>([[0, 90]])
    aplicarGiro(original, [0], CUARTO_DE_VUELTA)

    expect(original.get(0)).toBe(90)
  })
})

describe('rotarPaginas', () => {
  it('aplica una rotación de 90 grados', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    const resultado = await rotarPaginas({
      archivo,
      rotaciones: new Map([[0, 90]]),
    })

    expect(resultado.nombreArchivo).toBe('free-pdf-rotado.pdf')
    expect(NOMBRE_ROTADO).toBe('free-pdf-rotado.pdf')
    expect(await leerRotaciones(await bytesDeBlob(resultado.blob))).toEqual([
      90, 0, 0,
    ])
  })

  it('aplica rotaciones de 180 y 270 grados', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    const resultado = await rotarPaginas({
      archivo,
      rotaciones: new Map([
        [0, 180],
        [2, 270],
      ]),
    })

    expect(await leerRotaciones(await bytesDeBlob(resultado.blob))).toEqual([
      180, 0, 270,
    ])
  })

  it('acumula la rotación sobre la que ya tenía el documento', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 2, {
      rotacionInicial: 90,
    })

    const resultado = await rotarPaginas({
      archivo,
      rotaciones: new Map([[0, 90]]),
    })

    // La página 0 pasa de 90 a 180; la página 1 conserva sus 90 originales.
    expect(await leerRotaciones(await bytesDeBlob(resultado.blob))).toEqual([
      180, 90,
    ])
  })

  it('normaliza una rotación que da la vuelta completa', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 1, {
      rotacionInicial: 270,
    })

    const resultado = await rotarPaginas({
      archivo,
      rotaciones: new Map([[0, 90]]),
    })

    expect(await leerRotaciones(await bytesDeBlob(resultado.blob))).toEqual([0])
  })

  it('deja intactas las páginas que no se han girado', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 4)

    const resultado = await rotarPaginas({
      archivo,
      rotaciones: new Map([[1, 90]]),
    })

    expect(await leerRotaciones(await bytesDeBlob(resultado.blob))).toEqual([
      0, 90, 0, 0,
    ])
  })

  it('conserva el orden y el número de páginas', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 5)

    const resultado = await rotarPaginas({
      archivo,
      rotaciones: new Map([[3, 180]]),
    })

    expect(resultado.numeroPaginas).toBe(5)
    expect(await contarPaginas(await bytesDeBlob(resultado.blob))).toBe(5)
    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([
      0, 1, 2, 3, 4,
    ])
  })

  it('rechaza guardar cuando no hay ningún giro pendiente', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 2)

    await expect(
      rotarPaginas({ archivo, rotaciones: new Map() }),
    ).rejects.toThrow(ErrorPdf)
    await expect(
      rotarPaginas({ archivo, rotaciones: new Map([[0, 0]]) }),
    ).rejects.toThrow(/no has girado ninguna página/)
  })
})

import { describe, expect, it } from 'vitest'
import {
  agruparSeleccionadas,
  crearOrdenInicial,
  estaOrdenAlterado,
  moverAlFinal,
  moverAlInicio,
  moverAPosicion,
  moverDerecha,
  moverIzquierda,
} from '../funcionalidades/organizar-paginas/ordenPaginas'
import {
  NOMBRE_ORGANIZADO,
  organizarPaginas,
} from '../funcionalidades/organizar-paginas/organizarPaginas'
import { ErrorPdf } from '../pdf/erroresPdf'
import {
  bytesDeBlob,
  contarPaginas,
  crearArchivoPdf,
  leerOrdenOriginal,
} from './ayudas/crearPdfPrueba'

describe('ordenPaginas: operaciones puras', () => {
  it('crea el orden inicial del documento', () => {
    expect(crearOrdenInicial(4)).toEqual([0, 1, 2, 3])
  })

  it('mueve una página a otra posición desplazando el resto', () => {
    expect(moverAPosicion([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3])
    expect(moverAPosicion([0, 1, 2, 3], 3, 0)).toEqual([3, 0, 1, 2])
  })

  it('intercambia con la página anterior y con la siguiente', () => {
    expect(moverIzquierda([0, 1, 2], 1)).toEqual([1, 0, 2])
    expect(moverDerecha([0, 1, 2], 1)).toEqual([0, 2, 1])
  })

  it('lleva una página al inicio y al final', () => {
    expect(moverAlInicio([0, 1, 2], 2)).toEqual([2, 0, 1])
    expect(moverAlFinal([0, 1, 2], 0)).toEqual([1, 2, 0])
  })

  it('no altera el orden cuando el movimiento sale de los límites', () => {
    const orden = [0, 1, 2]

    expect(moverIzquierda(orden, 0)).toBe(orden)
    expect(moverDerecha(orden, 2)).toBe(orden)
    expect(moverAPosicion(orden, 1, 1)).toBe(orden)
    expect(moverAPosicion(orden, 9, 0)).toBe(orden)
  })

  it('no modifica la lista que recibe', () => {
    const orden = [0, 1, 2]
    moverAlFinal(orden, 0)

    expect(orden).toEqual([0, 1, 2])
  })

  it('agrupa las páginas marcadas al inicio conservando su orden relativo', () => {
    expect(agruparSeleccionadas([0, 1, 2, 3], new Set([1, 3]), 'inicio')).toEqual([
      1, 3, 0, 2,
    ])
  })

  it('agrupa las páginas marcadas al final conservando su orden relativo', () => {
    expect(agruparSeleccionadas([0, 1, 2, 3], new Set([0, 2]), 'final')).toEqual([
      1, 3, 0, 2,
    ])
  })

  it('no agrupa si no hay selección o si están todas marcadas', () => {
    const orden = [0, 1, 2]

    expect(agruparSeleccionadas(orden, new Set(), 'inicio')).toBe(orden)
    expect(agruparSeleccionadas(orden, new Set([0, 1, 2]), 'final')).toBe(orden)
  })

  it('detecta si el orden difiere del original', () => {
    expect(estaOrdenAlterado([0, 1, 2])).toBe(false)
    expect(estaOrdenAlterado([1, 0, 2])).toBe(true)
    expect(estaOrdenAlterado([])).toBe(false)
  })
})

describe('organizarPaginas', () => {
  it('genera el documento con el nuevo orden', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 4)

    const resultado = await organizarPaginas({ archivo, orden: [3, 1, 2, 0] })

    expect(resultado.nombreArchivo).toBe('free-pdf-organizado.pdf')
    expect(NOMBRE_ORGANIZADO).toBe('free-pdf-organizado.pdf')
    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([
      3, 1, 2, 0,
    ])
  })

  it('conserva el número total de páginas', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 6)

    const resultado = await organizarPaginas({
      archivo,
      orden: [5, 4, 3, 2, 1, 0],
    })

    expect(resultado.numeroPaginas).toBe(6)
    expect(await contarPaginas(await bytesDeBlob(resultado.blob))).toBe(6)
  })

  it('mantiene el documento intacto con el orden original', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    const resultado = await organizarPaginas({
      archivo,
      orden: crearOrdenInicial(3),
    })

    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([
      0, 1, 2,
    ])
  })

  it('restablecer el orden devuelve el documento original', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 4)
    const alterado = moverAlFinal(crearOrdenInicial(4), 0)
    const restablecido = crearOrdenInicial(4)

    expect(estaOrdenAlterado(alterado)).toBe(true)
    expect(estaOrdenAlterado(restablecido)).toBe(false)

    const resultado = await organizarPaginas({ archivo, orden: restablecido })
    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([
      0, 1, 2, 3,
    ])
  })

  it('rechaza un orden con un número de páginas distinto', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 4)

    await expect(
      organizarPaginas({ archivo, orden: [0, 1] }),
    ).rejects.toThrow(ErrorPdf)
  })

  it('rechaza un orden que repite páginas', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    await expect(
      organizarPaginas({ archivo, orden: [0, 0, 1] }),
    ).rejects.toThrow(/repite o se salta/)
  })

  it('rechaza un orden con una página que no existe', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    await expect(
      organizarPaginas({ archivo, orden: [0, 1, 9] }),
    ).rejects.toThrow(ErrorPdf)
  })
})

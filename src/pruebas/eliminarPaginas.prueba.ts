import { describe, expect, it } from 'vitest'
import {
  calcularIndicesConservados,
  eliminarPaginas,
  NOMBRE_PAGINAS_ELIMINADAS,
} from '../funcionalidades/eliminar-paginas/eliminarPaginas'
import { ErrorPdf } from '../pdf/erroresPdf'
import {
  bytesDeBlob,
  contarPaginas,
  crearArchivoPdf,
  leerOrdenOriginal,
} from './ayudas/crearPdfPrueba'

describe('calcularIndicesConservados', () => {
  it('devuelve las páginas que no se eliminan, en orden', () => {
    expect(calcularIndicesConservados([1, 3], 5)).toEqual([0, 2, 4])
  })

  it('devuelve todas las páginas si no se elimina ninguna', () => {
    expect(calcularIndicesConservados([], 3)).toEqual([0, 1, 2])
  })

  it('devuelve una lista vacía si se eliminan todas', () => {
    expect(calcularIndicesConservados([0, 1, 2], 3)).toEqual([])
  })

  it('ignora los índices repetidos y los que están fuera del documento', () => {
    expect(calcularIndicesConservados([1, 1, 99], 3)).toEqual([0, 2])
  })
})

describe('eliminarPaginas', () => {
  it('genera un documento sin las páginas marcadas', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 6)

    const resultado = await eliminarPaginas({ archivo, indicesAEliminar: [1, 4] })

    expect(resultado.numeroPaginas).toBe(4)
    expect(resultado.nombreArchivo).toBe('free-pdf-paginas-eliminadas.pdf')
    expect(NOMBRE_PAGINAS_ELIMINADAS).toBe('free-pdf-paginas-eliminadas.pdf')
    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([
      0, 2, 3, 5,
    ])
  })

  it('mantiene el orden original de las páginas restantes', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 5)

    const resultado = await eliminarPaginas({
      archivo,
      indicesAEliminar: [4, 0],
    })

    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([
      1, 2, 3,
    ])
  })

  it('genera un documento válido que se puede reabrir', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 4)

    const resultado = await eliminarPaginas({ archivo, indicesAEliminar: [0] })

    expect(await contarPaginas(await bytesDeBlob(resultado.blob))).toBe(3)
    expect(resultado.blob.type).toBe('application/pdf')
  })

  it('permite dejar una sola página', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    const resultado = await eliminarPaginas({
      archivo,
      indicesAEliminar: [0, 1],
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('rechaza eliminar todas las páginas', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    await expect(
      eliminarPaginas({ archivo, indicesAEliminar: [0, 1, 2] }),
    ).rejects.toThrow(ErrorPdf)
    await expect(
      eliminarPaginas({ archivo, indicesAEliminar: [0, 1, 2] }),
    ).rejects.toThrow(/no se pueden eliminar todas las páginas/i)
  })

  it('exige marcar al menos una página', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    await expect(
      eliminarPaginas({ archivo, indicesAEliminar: [] }),
    ).rejects.toThrow(/al menos una página/)
  })
})

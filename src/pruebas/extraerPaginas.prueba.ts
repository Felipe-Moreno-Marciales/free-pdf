import { describe, expect, it } from 'vitest'
import {
  extraerPaginas,
  NOMBRE_PAGINAS_EXTRAIDAS,
} from '../funcionalidades/extraer-paginas/extraerPaginas'
import { ErrorPdf } from '../pdf/erroresPdf'
import {
  bytesDeBlob,
  contarPaginas,
  crearArchivoPdf,
  leerOrdenOriginal,
} from './ayudas/crearPdfPrueba'

describe('extraerPaginas', () => {
  it('crea un documento con las páginas indicadas', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 10)

    const resultado = await extraerPaginas({ archivo, indices: [0, 2, 4] })

    expect(resultado.numeroPaginas).toBe(3)
    expect(resultado.nombreArchivo).toBe('free-pdf-paginas-extraidas.pdf')
    expect(NOMBRE_PAGINAS_EXTRAIDAS).toBe('free-pdf-paginas-extraidas.pdf')
    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([
      0, 2, 4,
    ])
  })

  it('respeta el orden original aunque los índices lleguen desordenados', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 6)

    const resultado = await extraerPaginas({ archivo, indices: [5, 1, 3] })

    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([
      1, 3, 5,
    ])
  })

  it('elimina los índices duplicados', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 5)

    const resultado = await extraerPaginas({ archivo, indices: [2, 2, 2] })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('ignora los índices que no existen en el documento', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    const resultado = await extraerPaginas({ archivo, indices: [0, 99, -1] })

    expect(resultado.numeroPaginas).toBe(1)
    expect(await leerOrdenOriginal(await bytesDeBlob(resultado.blob))).toEqual([0])
  })

  it('genera un documento válido que se puede reabrir', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 8)

    const resultado = await extraerPaginas({ archivo, indices: [1, 2, 3, 4] })

    expect(await contarPaginas(await bytesDeBlob(resultado.blob))).toBe(4)
    expect(resultado.blob.type).toBe('application/pdf')
  })

  it('permite extraer el documento completo', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 4)

    const resultado = await extraerPaginas({ archivo, indices: [0, 1, 2, 3] })

    expect(resultado.numeroPaginas).toBe(4)
  })

  it('exige al menos una página', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 4)

    await expect(extraerPaginas({ archivo, indices: [] })).rejects.toThrow(ErrorPdf)
    await expect(extraerPaginas({ archivo, indices: [] })).rejects.toThrow(
      /al menos una página/,
    )
  })
})

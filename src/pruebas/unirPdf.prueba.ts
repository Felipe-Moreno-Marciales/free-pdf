import { describe, expect, it } from 'vitest'
import {
  MINIMO_ARCHIVOS_PARA_UNIR,
  NOMBRE_ARCHIVO_UNIDO,
  unirArchivosPdf,
} from '../funcionalidades/unir-pdf/unirPdf'
import { ErrorPdf } from '../pdf/erroresPdf'
import type { PdfSeleccionado } from '../pdf/tipos'
import {
  bytesDeBlob,
  comoArchivo,
  contarPaginas,
  crearArchivoPdf,
  leerOrdenOriginal,
} from './ayudas/crearPdfPrueba'

/** Envuelve un archivo como entrada de la selección. */
function comoSeleccionado(archivo: File, id: string): PdfSeleccionado {
  return { id, archivo, nombre: archivo.name, tamano: archivo.size }
}

describe('unirArchivosPdf', () => {
  it('suma las páginas de todos los documentos', async () => {
    const primero = await crearArchivoPdf('a.pdf', 2)
    const segundo = await crearArchivoPdf('b.pdf', 3)

    const resultado = await unirArchivosPdf([
      comoSeleccionado(primero, 'a'),
      comoSeleccionado(segundo, 'b'),
    ])

    expect(resultado.numeroPaginas).toBe(5)
    expect(resultado.nombreArchivo).toBe('free-pdf-unido.pdf')
    expect(NOMBRE_ARCHIVO_UNIDO).toBe('free-pdf-unido.pdf')
    expect(resultado.blob.type).toBe('application/pdf')
  })

  it('genera un documento válido que se puede volver a abrir', async () => {
    const primero = await crearArchivoPdf('a.pdf', 1)
    const segundo = await crearArchivoPdf('b.pdf', 1)

    const resultado = await unirArchivosPdf([
      comoSeleccionado(primero, 'a'),
      comoSeleccionado(segundo, 'b'),
    ])

    expect(await contarPaginas(await bytesDeBlob(resultado.blob))).toBe(2)
  })

  it('respeta el orden en que se reciben los documentos', async () => {
    // El primer documento aporta las páginas 0 y 1; el segundo, solo la 0.
    const primero = await crearArchivoPdf('a.pdf', 2)
    const segundo = await crearArchivoPdf('b.pdf', 1)

    const directo = await unirArchivosPdf([
      comoSeleccionado(primero, 'a'),
      comoSeleccionado(segundo, 'b'),
    ])
    const invertido = await unirArchivosPdf([
      comoSeleccionado(segundo, 'b'),
      comoSeleccionado(primero, 'a'),
    ])

    expect(await leerOrdenOriginal(await bytesDeBlob(directo.blob))).toEqual([
      0, 1, 0,
    ])
    expect(await leerOrdenOriginal(await bytesDeBlob(invertido.blob))).toEqual([
      0, 0, 1,
    ])
  })

  it('exige al menos dos documentos', async () => {
    const unico = await crearArchivoPdf('a.pdf', 3)

    await expect(
      unirArchivosPdf([comoSeleccionado(unico, 'a')]),
    ).rejects.toThrow(ErrorPdf)
    await expect(
      unirArchivosPdf([comoSeleccionado(unico, 'a')]),
    ).rejects.toThrow(new RegExp(`al menos ${MINIMO_ARCHIVOS_PARA_UNIR}`))
  })

  it('avisa en español del archivo dañado indicando su nombre', async () => {
    const valido = await crearArchivoPdf('a.pdf', 1)
    const danado = comoArchivo(new Uint8Array([1, 2, 3, 4, 5]), 'roto.pdf')

    await expect(
      unirArchivosPdf([
        comoSeleccionado(valido, 'a'),
        comoSeleccionado(danado, 'roto'),
      ]),
    ).rejects.toThrow(/«roto\.pdf».*dañado/)
  })

  it('une más de dos documentos', async () => {
    const documentos = await Promise.all([
      crearArchivoPdf('a.pdf', 1),
      crearArchivoPdf('b.pdf', 2),
      crearArchivoPdf('c.pdf', 3),
    ])

    const resultado = await unirArchivosPdf(
      documentos.map((archivo, indice) => comoSeleccionado(archivo, `${indice}`)),
    )

    expect(resultado.numeroPaginas).toBe(6)
  })
})

import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  dividirPdf,
  NOMBRE_ZIP_DIVIDIDO,
} from '../funcionalidades/dividir-pdf/dividirPdf'
import { calcularGruposPrevistos } from '../funcionalidades/dividir-pdf/interpretarRangos'
import { ErrorRangoPaginas } from '../utilidades/rangosPaginas'
import {
  bytesDeBlob,
  contarPaginas,
  crearArchivoPdf,
  leerOrdenOriginal,
} from './ayudas/crearPdfPrueba'

/** Abre el ZIP resultante y devuelve sus archivos. */
async function abrirZip(blob: Blob): Promise<Record<string, Uint8Array>> {
  return unzipSync(await bytesDeBlob(blob))
}

describe('calcularGruposPrevistos', () => {
  it('crea un grupo por cada rango, con nombres descriptivos', () => {
    const grupos = calcularGruposPrevistos('rangos', '1-3,5', 'informe.pdf', 10)

    expect(grupos.map((grupo) => grupo.nombreArchivo)).toEqual([
      'informe-paginas-1-3.pdf',
      'informe-pagina-5.pdf',
    ])
    expect(grupos[0].indices).toEqual([0, 1, 2])
    expect(grupos[1].indices).toEqual([4])
  })

  it('crea un grupo por página con numeración ordenada', () => {
    const grupos = calcularGruposPrevistos('cada-pagina', '', 'informe.pdf', 12)

    expect(grupos).toHaveLength(12)
    expect(grupos[0].nombreArchivo).toBe('informe-pagina-01.pdf')
    expect(grupos[11].nombreArchivo).toBe('informe-pagina-12.pdf')
  })

  it('normaliza los nombres con caracteres problemáticos', () => {
    const grupos = calcularGruposPrevistos(
      'cada-pagina',
      '',
      'mi informe: final/v2.pdf',
      1,
    )

    expect(grupos[0].nombreArchivo).toBe('mi-informe-final-v2-pagina-1.pdf')
  })

  it('propaga los errores de la expresión de rangos', () => {
    expect(() =>
      calcularGruposPrevistos('rangos', '3-1', 'informe.pdf', 10),
    ).toThrow(ErrorRangoPaginas)
  })
})

describe('dividirPdf: por rangos', () => {
  it('genera un documento por rango con el número correcto de páginas', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 10)

    const resultado = await dividirPdf({
      archivo,
      totalPaginas: 10,
      modo: 'rangos',
      expresion: '1-3,5,8-10',
    })

    expect(resultado.nombreArchivo).toBe('free-pdf-dividido.zip')
    expect(NOMBRE_ZIP_DIVIDIDO).toBe('free-pdf-dividido.zip')
    expect(resultado.documentos).toHaveLength(3)
    expect(resultado.documentos.map((doc) => doc.numeroPaginas)).toEqual([3, 1, 3])

    const contenido = await abrirZip(resultado.blob)
    expect(Object.keys(contenido).sort()).toEqual([
      'informe-pagina-5.pdf',
      'informe-paginas-1-3.pdf',
      'informe-paginas-8-10.pdf',
    ])
  })

  it('cada documento contiene exactamente las páginas de su rango', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 10)

    const resultado = await dividirPdf({
      archivo,
      totalPaginas: 10,
      modo: 'rangos',
      expresion: '2-4,9',
    })

    const contenido = await abrirZip(resultado.blob)

    expect(await leerOrdenOriginal(contenido['informe-paginas-2-4.pdf'])).toEqual([
      1, 2, 3,
    ])
    expect(await leerOrdenOriginal(contenido['informe-pagina-9.pdf'])).toEqual([8])
  })

  it('genera documentos válidos que se pueden reabrir', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 6)

    const resultado = await dividirPdf({
      archivo,
      totalPaginas: 6,
      modo: 'rangos',
      expresion: '1-2,3-6',
    })

    const contenido = await abrirZip(resultado.blob)

    expect(await contarPaginas(contenido['informe-paginas-1-2.pdf'])).toBe(2)
    expect(await contarPaginas(contenido['informe-paginas-3-6.pdf'])).toBe(4)
  })

  it('conserva los metadatos básicos del documento original', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 4, {
      titulo: 'Informe anual',
      autor: 'Equipo de Free PDF',
    })

    const resultado = await dividirPdf({
      archivo,
      totalPaginas: 4,
      modo: 'rangos',
      expresion: '1-2',
    })

    const contenido = await abrirZip(resultado.blob)
    const { PDFDocument } = await import('pdf-lib')
    const documento = await PDFDocument.load(contenido['informe-paginas-1-2.pdf'])

    expect(documento.getTitle()).toBe('Informe anual')
    expect(documento.getAuthor()).toBe('Equipo de Free PDF')
  })

  it('rechaza una expresión de rangos inválida', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 5)

    await expect(
      dividirPdf({
        archivo,
        totalPaginas: 5,
        modo: 'rangos',
        expresion: '1-99',
      }),
    ).rejects.toThrow(/no existe/)
  })

  it('evita que dos rangos iguales se sobrescriban dentro del ZIP', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 5)

    const resultado = await dividirPdf({
      archivo,
      totalPaginas: 5,
      modo: 'rangos',
      expresion: '1-2,1-2',
    })

    const contenido = await abrirZip(resultado.blob)

    expect(Object.keys(contenido)).toHaveLength(2)
    expect(Object.keys(contenido)).toContain('informe-paginas-1-2-2.pdf')
  })
})

describe('dividirPdf: cada página', () => {
  it('genera tantos documentos como páginas, con una página cada uno', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 7)

    const resultado = await dividirPdf({
      archivo,
      totalPaginas: 7,
      modo: 'cada-pagina',
      expresion: '',
    })

    expect(resultado.documentos).toHaveLength(7)
    expect(
      resultado.documentos.every((documento) => documento.numeroPaginas === 1),
    ).toBe(true)

    const contenido = await abrirZip(resultado.blob)
    expect(Object.keys(contenido)).toHaveLength(7)
  })

  it('numera los archivos de forma ordenada y respeta la página de origen', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 3)

    const resultado = await dividirPdf({
      archivo,
      totalPaginas: 3,
      modo: 'cada-pagina',
      expresion: '',
    })

    const contenido = await abrirZip(resultado.blob)

    expect(await leerOrdenOriginal(contenido['informe-pagina-1.pdf'])).toEqual([0])
    expect(await leerOrdenOriginal(contenido['informe-pagina-2.pdf'])).toEqual([1])
    expect(await leerOrdenOriginal(contenido['informe-pagina-3.pdf'])).toEqual([2])
  })

  it('ignora la expresión de rangos en este modo', async () => {
    const archivo = await crearArchivoPdf('informe.pdf', 2)

    const resultado = await dividirPdf({
      archivo,
      totalPaginas: 2,
      modo: 'cada-pagina',
      expresion: 'esto no es válido',
    })

    expect(resultado.documentos).toHaveLength(2)
  })
})

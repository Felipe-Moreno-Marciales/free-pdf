import type { PDFDocumentProxy } from 'pdfjs-dist'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { deducirEstructura, deducirPagina } from '../extraccion/deducirEstructura'
import {
  crearArchivoMarkdown,
  escaparMarkdown,
  generarMarkdown,
  normalizarDestinoEnlace,
} from '../extraccion/generarMarkdown'
import { extraerTextoPdf } from '../extraccion/textoPdf'
import type {
  DocumentoEstructurado,
  FragmentoTextoPdf,
  PaginaTextoPdf,
} from '../extraccion/tipos'
import { OperacionCancelada } from '../pdf/cancelacion'
import { interpretarRangosComoIndices } from '../utilidades/rangosPaginas'

function fragmento(
  texto: string,
  x: number,
  y: number,
  tamanoFuente = 12,
  enlace: string | null = null,
): FragmentoTextoPdf {
  return {
    texto,
    x,
    y,
    ancho: texto.length * tamanoFuente * 0.5,
    alto: tamanoFuente,
    tamanoFuente,
    nombreFuente: 'FuentePrueba',
    finLinea: true,
    enlace,
  }
}

function pagina(
  fragmentos: readonly FragmentoTextoPdf[],
  numero = 1,
): PaginaTextoPdf {
  return { numero, ancho: 600, alto: 800, fragmentos }
}

const OPCIONES = {
  conservarSaltosLinea: false,
  separadoresPagina: true,
} as const

/** Abre PDF.js con su compilación para Node, solo dentro de estas pruebas. */
async function abrirPdfDePrueba(bytes: Uint8Array): Promise<{
  readonly documento: PDFDocumentProxy
  readonly cerrar: () => Promise<void>
}> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const copia = new Uint8Array(bytes)
  const tarea = pdfjs.getDocument({ data: copia })
  const documento = await tarea.promise
  return {
    documento,
    cerrar: async () => {
      await tarea.destroy()
    },
  }
}

describe('deducción de la estructura de PDF', () => {
  it('reconstruye encabezados según el tamaño de la fuente', () => {
    const resultado = deducirPagina(
      pagina([
        fragmento('Título principal', 40, 740, 25),
        fragmento('Un párrafo normal.', 40, 700, 12),
      ]),
      12,
    )

    expect(resultado.bloques[0]).toMatchObject({
      tipo: 'encabezado',
      nivel: 1,
    })
    expect(generarMarkdown({ paginas: [resultado], contieneTexto: true }, OPCIONES))
      .toContain('# Título principal')
  })

  it('agrupa líneas cercanas como un párrafo', () => {
    const resultado = deducirPagina(
      pagina([
        fragmento('Primera línea', 40, 700),
        fragmento('segunda línea.', 40, 685),
      ]),
      12,
    )

    expect(resultado.bloques).toHaveLength(1)
    expect(
      generarMarkdown(
        { paginas: [resultado], contieneTexto: true },
        OPCIONES,
      ),
    ).toContain('Primera línea segunda línea\\.')
  })

  it('reconstruye listas numeradas y con viñetas', () => {
    const documento = deducirEstructura([
      pagina([
        fragmento('1. Uno', 40, 700),
        fragmento('2. Dos', 40, 680),
        fragmento('• Tres', 40, 640),
        fragmento('• Cuatro', 40, 620),
      ]),
    ])
    const markdown = generarMarkdown(documento, OPCIONES)

    expect(markdown).toContain('1. Uno\n2. Dos')
    expect(markdown).toContain('- Tres\n- Cuatro')
  })

  it('conserva enlaces seguros y rechaza protocolos ejecutables', () => {
    const documento = deducirEstructura([
      pagina([
        fragmento('Sitio', 40, 700, 12, 'https://example.com/guia'),
        fragmento('Peligro', 40, 660, 12, 'javascript:alert(1)'),
      ]),
    ])
    const markdown = generarMarkdown(documento, OPCIONES)

    expect(markdown).toContain('[Sitio](https://example.com/guia)')
    expect(markdown).toContain('Peligro')
    expect(markdown).not.toContain('javascript:')
    expect(normalizarDestinoEnlace('mailto:persona@example.com')).not.toBeNull()
  })

  it('detecta una tabla sencilla por sus columnas alineadas', () => {
    const documento = deducirEstructura([
      pagina([
        fragmento('Nombre', 40, 700),
        fragmento('Cantidad', 250, 700),
        fragmento('Café', 40, 680),
        fragmento('2', 250, 680),
      ]),
    ])
    const markdown = generarMarkdown(documento, OPCIONES)

    expect(markdown).toContain('| Nombre | Cantidad |')
    expect(markdown).toContain('| --- | --- |')
    expect(markdown).toContain('| Café | 2 |')
  })

  it('separa varias páginas de forma opcional', () => {
    const documento = deducirEstructura([
      pagina([fragmento('Primera', 40, 700)], 1),
      pagina([fragmento('Segunda', 40, 700)], 2),
    ])

    expect(generarMarkdown(documento, OPCIONES)).toContain(
      'Primera\n\n---\n\nSegunda',
    )
    expect(
      generarMarkdown(documento, {
        ...OPCIONES,
        separadoresPagina: false,
      }),
    ).not.toContain('---')
  })

  it('detecta un documento sin capa de texto', () => {
    const documento = deducirEstructura([pagina([])])
    expect(documento.contieneTexto).toBe(false)
    expect(generarMarkdown(documento, OPCIONES)).toBe('\n')
  })
})

describe('generación segura de Markdown', () => {
  it('escapa todos los caracteres de control de Markdown', () => {
    expect(escaparMarkdown('# [hola] *mundo* | x > y')).toBe(
      '\\# \\[hola\\] \\*mundo\\* \\| x \\> y',
    )
  })

  it('genera un archivo Markdown UTF-8 válido', async () => {
    const blob = crearArchivoMarkdown('# Título\n\nTexto con ñ.\n')
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    expect(await blob.text()).toBe('# Título\n\nTexto con ñ.\n')
  })

  it('permite conservar saltos de línea de los párrafos', () => {
    const estructura: DocumentoEstructurado = {
      contieneTexto: true,
      paginas: [
        {
          numero: 1,
          bloques: [
            {
              tipo: 'parrafo',
              lineas: [
                [{ texto: 'Uno', enlace: null }],
                [{ texto: 'Dos', enlace: null }],
              ],
            },
          ],
        },
      ],
    }

    expect(
      generarMarkdown(estructura, {
        conservarSaltosLinea: true,
        separadoresPagina: false,
      }),
    ).toBe('Uno  \nDos\n')
  })
})

describe('extracción real con PDF.js', () => {
  it('extrae solo las páginas elegidas mediante rangos', async () => {
    const pdf = await PDFDocument.create()
    const fuente = await pdf.embedFont(StandardFonts.Helvetica)
    for (const texto of ['Primera', 'Segunda', 'Tercera']) {
      const hoja = pdf.addPage([300, 300])
      hoja.drawText(texto, { x: 30, y: 240, size: 14, font: fuente })
    }
    const bytes = await pdf.save()
    const abierto = await abrirPdfDePrueba(bytes)

    try {
      const indices = interpretarRangosComoIndices('1, 3', 3)
      const paginas = await extraerTextoPdf(abierto.documento, indices)
      expect(paginas.map((actual) => actual.numero)).toEqual([1, 3])
      expect(paginas[0]?.fragmentos.map((f) => f.texto).join('')).toContain(
        'Primera',
      )
      expect(paginas[1]?.fragmentos.map((f) => f.texto).join('')).toContain(
        'Tercera',
      )
    } finally {
      await abierto.cerrar()
    }
  })

  it('deduce un encabezado en el canal completo', async () => {
    const pdf = await PDFDocument.create()
    const hoja = pdf.addPage([400, 400])
    hoja.drawText('Encabezado real', {
      x: 30,
      y: 340,
      size: 28,
      color: rgb(0, 0, 0),
    })
    hoja.drawText('Este es el cuerpo del documento.', {
      x: 30,
      y: 300,
      size: 12,
    })
    const abierto = await abrirPdfDePrueba(await pdf.save())

    try {
      const extraidas = await extraerTextoPdf(abierto.documento, [0])
      const markdown = generarMarkdown(deducirEstructura(extraidas), OPCIONES)
      expect(markdown).toContain('# Encabezado real')
      expect(markdown).toContain('Este es el cuerpo del documento\\.')
    } finally {
      await abierto.cerrar()
    }
  })

  it('permite cancelar entre páginas y limpia cada página terminada', async () => {
    const controlador = new AbortController()
    const limpiar = vi.fn(async () => undefined)
    const paginaSimulada = {
      getAnnotations: vi.fn(async () => []),
      getTextContent: vi.fn(async () => ({ items: [], styles: new Map() })),
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      cleanup: limpiar,
    }
    const documento = {
      getPage: vi.fn(async () => paginaSimulada),
    } as unknown as PDFDocumentProxy

    await expect(
      extraerTextoPdf(documento, [0, 1], {
        senal: controlador.signal,
        alProgreso: () => controlador.abort(),
      }),
    ).rejects.toBeInstanceOf(OperacionCancelada)

    expect(documento.getPage).toHaveBeenCalledTimes(1)
    expect(limpiar).toHaveBeenCalledTimes(1)
  })
})

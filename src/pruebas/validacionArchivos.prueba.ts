import { describe, expect, it } from 'vitest'
import { validarArchivoPdf } from '../pdf/validarDocumentoPdf'
import {
  anadirArchivosASeleccion,
  describirDescartes,
} from '../funcionalidades/unir-pdf/seleccion'
import {
  construirIdArchivo,
  esArchivoPdf,
} from '../utilidades/validacionArchivos'
import { comoArchivo, crearArchivoPdf, crearBytesPdf } from './ayudas/crearPdfPrueba'

describe('esArchivoPdf', () => {
  it('acepta un PDF con extensión y tipo MIME correctos', async () => {
    expect(esArchivoPdf(await crearArchivoPdf('informe.pdf', 1))).toBe(true)
  })

  it('acepta la extensión en mayúsculas', async () => {
    const bytes = await crearBytesPdf(1)

    expect(esArchivoPdf(comoArchivo(bytes, 'INFORME.PDF'))).toBe(true)
  })

  it('acepta un PDF sin tipo MIME informado', async () => {
    const bytes = await crearBytesPdf(1)

    expect(esArchivoPdf(comoArchivo(bytes, 'informe.pdf', ''))).toBe(true)
  })

  it('acepta el tipo MIME alternativo application/x-pdf', async () => {
    const bytes = await crearBytesPdf(1)

    expect(esArchivoPdf(comoArchivo(bytes, 'informe.pdf', 'application/x-pdf'))).toBe(
      true,
    )
  })

  it('rechaza una extensión distinta de .pdf', () => {
    expect(esArchivoPdf(new File(['texto'], 'notas.txt', { type: 'text/plain' }))).toBe(
      false,
    )
  })

  it('rechaza un archivo sin extensión', () => {
    expect(esArchivoPdf(new File(['texto'], 'notas'))).toBe(false)
  })

  it('rechaza un tipo MIME que no corresponde a un PDF', async () => {
    const bytes = await crearBytesPdf(1)

    expect(esArchivoPdf(comoArchivo(bytes, 'trampa.pdf', 'image/png'))).toBe(false)
  })
})

describe('validarArchivoPdf', () => {
  it('acepta un PDF válido', async () => {
    const resultado = validarArchivoPdf(await crearArchivoPdf('informe.pdf', 2))

    expect(resultado.valido).toBe(true)
    expect(resultado.mensaje).toBeNull()
  })

  it('rechaza una extensión inválida con un mensaje en español', () => {
    const resultado = validarArchivoPdf(
      new File(['texto'], 'notas.txt', { type: 'text/plain' }),
    )

    expect(resultado.valido).toBe(false)
    expect(resultado.motivo).toBe('no-es-pdf')
    expect(resultado.mensaje).toContain('no es un archivo PDF')
  })

  it('rechaza un tipo MIME inválido', async () => {
    const bytes = await crearBytesPdf(1)
    const resultado = validarArchivoPdf(comoArchivo(bytes, 'trampa.pdf', 'image/png'))

    expect(resultado.valido).toBe(false)
    expect(resultado.motivo).toBe('no-es-pdf')
  })

  it('rechaza un archivo vacío', () => {
    const resultado = validarArchivoPdf(
      new File([], 'vacio.pdf', { type: 'application/pdf' }),
    )

    expect(resultado.valido).toBe(false)
    expect(resultado.motivo).toBe('vacio')
    expect(resultado.mensaje).toContain('está vacío')
  })
})

describe('construirIdArchivo', () => {
  it('cambia si cambia la fecha de modificación', () => {
    const primero = new File(['a'], 'informe.pdf', { lastModified: 1000 })
    const segundo = new File(['a'], 'informe.pdf', { lastModified: 2000 })

    expect(construirIdArchivo(primero)).not.toBe(construirIdArchivo(segundo))
  })

  it('coincide para dos referencias al mismo archivo', () => {
    const primero = new File(['abc'], 'informe.pdf', { lastModified: 1000 })
    const segundo = new File(['abc'], 'informe.pdf', { lastModified: 1000 })

    expect(construirIdArchivo(primero)).toBe(construirIdArchivo(segundo))
  })
})

describe('anadirArchivosASeleccion', () => {
  it('acepta los PDF válidos y conserva el orden de llegada', async () => {
    const primero = await crearArchivoPdf('a.pdf', 1)
    const segundo = await crearArchivoPdf('b.pdf', 2)

    const actualizacion = anadirArchivosASeleccion([], [primero, segundo])

    expect(actualizacion.numeroAnadidos).toBe(2)
    expect(actualizacion.archivos.map((archivo) => archivo.nombre)).toEqual([
      'a.pdf',
      'b.pdf',
    ])
  })

  it('descarta los archivos que no son PDF, los vacíos y los duplicados', async () => {
    const valido = await crearArchivoPdf('a.pdf', 1)
    const noPdf = new File(['texto'], 'notas.txt', { type: 'text/plain' })
    const vacio = new File([], 'vacio.pdf', { type: 'application/pdf' })

    const primeraPasada = anadirArchivosASeleccion([], [valido, noPdf, vacio])
    expect(primeraPasada.numeroAnadidos).toBe(1)
    expect(primeraPasada.descartados.map((descarte) => descarte.motivo)).toEqual([
      'no-es-pdf',
      'vacio',
    ])

    const segundaPasada = anadirArchivosASeleccion(primeraPasada.archivos, [valido])
    expect(segundaPasada.numeroAnadidos).toBe(0)
    expect(segundaPasada.descartados[0]?.motivo).toBe('duplicado')
    expect(segundaPasada.archivos).toHaveLength(1)
  })

  it('no considera duplicado un archivo con el mismo nombre y otra fecha', async () => {
    const bytes = await crearBytesPdf(1)
    const primero = comoArchivo(bytes, 'a.pdf')
    const segundo = new File([bytes.slice().buffer], 'a.pdf', {
      type: 'application/pdf',
      lastModified: primero.lastModified + 1,
    })

    const primeraPasada = anadirArchivosASeleccion([], [primero])
    const segundaPasada = anadirArchivosASeleccion(primeraPasada.archivos, [segundo])

    expect(segundaPasada.numeroAnadidos).toBe(1)
  })

  it('devuelve la misma selección cuando no se añade nada', async () => {
    const valido = await crearArchivoPdf('a.pdf', 1)
    const primeraPasada = anadirArchivosASeleccion([], [valido])
    const segundaPasada = anadirArchivosASeleccion(primeraPasada.archivos, [valido])

    expect(segundaPasada.archivos).toBe(primeraPasada.archivos)
  })
})

describe('describirDescartes', () => {
  it('devuelve null cuando no se descartó nada', () => {
    expect(describirDescartes([])).toBeNull()
  })

  it('describe un único descarte en singular', () => {
    const aviso = describirDescartes([{ nombre: 'notas.txt', motivo: 'no-es-pdf' }])

    expect(aviso).toContain('Se descartó 1 archivo')
    expect(aviso).toContain('no es un archivo PDF')
  })

  it('resume los descartes que superan el máximo detallado', () => {
    const aviso = describirDescartes([
      { nombre: 'a.txt', motivo: 'no-es-pdf' },
      { nombre: 'b.txt', motivo: 'no-es-pdf' },
      { nombre: 'c.txt', motivo: 'no-es-pdf' },
      { nombre: 'd.txt', motivo: 'no-es-pdf' },
      { nombre: 'e.txt', motivo: 'no-es-pdf' },
    ])

    expect(aviso).toContain('Se descartaron 5 archivos')
    expect(aviso).toContain('2 archivos más')
  })
})

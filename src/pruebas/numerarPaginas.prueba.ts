import { PDFDocument, degrees } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  calcularNumeroDePagina,
  calcularTotalNumerado,
  limitar,
  NOMBRE_NUMERADO,
  numerarPaginas,
} from '../funcionalidades/numerar-paginas/numerarPaginas'
import {
  aplicarPlantilla,
  describirPlantilla,
  LONGITUD_MAXIMA_PLANTILLA,
  MARCADOR_PAGINA,
  MARCADOR_TOTAL,
  PLANTILLAS,
  resolverPlantilla,
  validarPlantilla,
  type ClavePlantilla,
} from '../funcionalidades/numerar-paginas/plantillaNumeracion'
import type { ConfiguracionNumeracion } from '../funcionalidades/numerar-paginas/tipos'
import { APARIENCIA_PREDETERMINADA } from '../funcionalidades/numerar-paginas/useNumerarPaginas'
import { calcularIndicesAfectados, describirAlcance, interpretarAlcance } from '../pdf/paginasAfectadas'
import { ErrorPdf } from '../pdf/erroresPdf'
import {
  abrirBytes,
  bytesDeBlob,
  crearArchivoPdf,
} from './ayudas/crearPdfPrueba'

/** Configuración predeterminada de las pruebas. */
const BASE: ConfiguracionNumeracion = {
  plantilla: 'numero',
  plantillaPropia: 'Página {pagina} de {total}',
  numeroInicial: 1,
  alcance: 'todas',
  expresion: '',
  posicion: 'inferior-centro',
  apariencia: APARIENCIA_PREDETERMINADA,
}

/** Construye una configuración partiendo de la base. */
function configurar(
  cambios: Partial<ConfiguracionNumeracion> = {},
): ConfiguracionNumeracion {
  return { ...BASE, ...cambios }
}

/** Numera un documento de prueba y devuelve el resultado. */
async function numerar(
  numeroPaginas: number,
  cambios: Partial<ConfiguracionNumeracion> = {},
) {
  const archivo = await crearArchivoPdf('documento.pdf', numeroPaginas)

  return await numerarPaginas({ archivo, configuracion: configurar(cambios) })
}

/**
 * Indica, para cada página, si tiene contenido dibujado.
 *
 * Las páginas de los documentos de prueba se crean vacías, sin ningún flujo de
 * contenido. En cuanto una recibe texto, pdf-lib le añade uno. Comprobar la
 * existencia de ese flujo es, por tanto, una forma directa y fiable de distinguir
 * las páginas que se han numerado de las que se han dejado intactas.
 */
async function leerPaginasConContenido(
  bytes: Uint8Array,
): Promise<readonly boolean[]> {
  const documento = await abrirBytes(bytes)

  return documento
    .getPages()
    .map((pagina) => pagina.node.Contents() !== undefined)
}

describe('calcularNumeroDePagina y calcularTotalNumerado', () => {
  it('la primera página recibe el número inicial', () => {
    expect(calcularNumeroDePagina(0, 1)).toBe(1)
    expect(calcularNumeroDePagina(0, 5)).toBe(5)
  })

  it('a partir de ahí se cuenta de uno en uno', () => {
    expect(calcularNumeroDePagina(3, 5)).toBe(8)
  })

  it('el total es el número de la última página del documento', () => {
    expect(calcularTotalNumerado(10, 1)).toBe(10)
    expect(calcularTotalNumerado(10, 5)).toBe(14)
  })

  it('con una sola página el total coincide con el número inicial', () => {
    expect(calcularTotalNumerado(1, 7)).toBe(7)
  })
})

describe('limitar', () => {
  it('respeta los valores dentro del intervalo', () => {
    expect(limitar(5, 0, 10)).toBe(5)
  })

  it('limita por los dos extremos', () => {
    expect(limitar(-5, 0, 10)).toBe(0)
    expect(limitar(50, 0, 10)).toBe(10)
  })

  it('descarta los valores que no son números', () => {
    expect(limitar(Number.NaN, 2, 10)).toBe(2)
  })
})

describe('validarPlantilla', () => {
  it('acepta las plantillas con nombre', () => {
    const claves: readonly Exclude<ClavePlantilla, 'personalizada'>[] = [
      'numero',
      'pagina-numero',
      'numero-de-total',
      'pagina-numero-de-total',
    ]

    for (const clave of claves) {
      expect(validarPlantilla(PLANTILLAS[clave]).valida).toBe(true)
    }
  })

  it('rechaza una plantilla vacía', () => {
    expect(validarPlantilla('').valida).toBe(false)
    expect(validarPlantilla('   ').valida).toBe(false)
  })

  it('exige el marcador de la página', () => {
    const resultado = validarPlantilla('Documento de {total} páginas')

    expect(resultado.valida).toBe(false)
    expect(resultado.mensaje).toContain(MARCADOR_PAGINA)
  })

  it('rechaza un marcador desconocido', () => {
    const resultado = validarPlantilla('{pagina} de {paginas}')

    expect(resultado.valida).toBe(false)
    expect(resultado.mensaje).toContain('{paginas}')
  })

  it('rechaza los marcadores en inglés', () => {
    expect(validarPlantilla('{page} de {total}').valida).toBe(false)
  })

  it('rechaza una llave sin cerrar', () => {
    const resultado = validarPlantilla('Página {pagina} de {total')

    expect(resultado.valida).toBe(false)
    expect(resultado.mensaje).toContain('llave')
  })

  it('rechaza un texto demasiado largo', () => {
    const largo = `{pagina}${'x'.repeat(LONGITUD_MAXIMA_PLANTILLA)}`

    expect(validarPlantilla(largo).valida).toBe(false)
  })

  it('rechaza los caracteres que la tipografía estándar no cubre', () => {
    const resultado = validarPlantilla('{pagina} 文')

    expect(resultado.valida).toBe(false)
    expect(resultado.mensaje).toContain('文')
  })

  it('acepta los acentos y los signos del español', () => {
    expect(validarPlantilla('Página {pagina} de {total} — año').valida).toBe(true)
  })

  it('admite el mismo marcador varias veces', () => {
    expect(validarPlantilla('{pagina} / {pagina}').valida).toBe(true)
  })
})

describe('aplicarPlantilla', () => {
  it('sustituye el número de página', () => {
    expect(aplicarPlantilla('{pagina}', 7, 10)).toBe('7')
  })

  it('sustituye el total', () => {
    expect(aplicarPlantilla('{pagina} de {total}', 3, 12)).toBe('3 de 12')
  })

  it('conserva el texto que rodea a los marcadores', () => {
    expect(aplicarPlantilla('Página {pagina} de {total}', 2, 5)).toBe(
      'Página 2 de 5',
    )
  })

  it('sustituye todas las apariciones de un marcador', () => {
    expect(aplicarPlantilla('{pagina}-{pagina}', 4, 9)).toBe('4-4')
  })
})

describe('resolverPlantilla y describirPlantilla', () => {
  it('devuelve el texto de la plantilla con nombre', () => {
    expect(resolverPlantilla('numero', 'lo que sea')).toBe(MARCADOR_PAGINA)
    expect(resolverPlantilla('numero-de-total', '')).toBe(
      `${MARCADOR_PAGINA} de ${MARCADOR_TOTAL}`,
    )
  })

  it('devuelve el texto propio cuando la plantilla es personalizada', () => {
    expect(resolverPlantilla('personalizada', 'Hoja {pagina}')).toBe(
      'Hoja {pagina}',
    )
  })

  it('nombra las plantillas en español', () => {
    expect(describirPlantilla('numero')).toBe('Solo el número')
    expect(describirPlantilla('personalizada')).toBe('Texto propio')
  })
})

describe('numerarPaginas: documento resultante', () => {
  it('genera un documento válido con el nombre esperado', async () => {
    const resultado = await numerar(3)

    expect(resultado.nombreArchivo).toBe(NOMBRE_NUMERADO)
    expect(resultado.nombreArchivo).toBe('free-pdf-numerado.pdf')
    expect(resultado.blob.type).toBe('application/pdf')
    expect(resultado.numeroPaginas).toBe(3)
  })

  it('conserva el número de páginas del original', async () => {
    const resultado = await numerar(7)
    const documento = await abrirBytes(await bytesDeBlob(resultado.blob))

    expect(documento.getPageCount()).toBe(7)
  })

  it('conserva las medidas de cada página', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 3)
    const original = await abrirBytes(new Uint8Array(await archivo.arrayBuffer()))
    const medidasOriginales = original
      .getPages()
      .map((pagina) => [pagina.getWidth(), pagina.getHeight()])

    const resultado = await numerarPaginas({
      archivo,
      configuracion: configurar(),
    })
    const numerado = await abrirBytes(await bytesDeBlob(resultado.blob))
    const medidas = numerado
      .getPages()
      .map((pagina) => [pagina.getWidth(), pagina.getHeight()])

    expect(medidas).toEqual(medidasOriginales)
  })

  it('conserva la rotación original de las páginas', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 2, {
      rotacionInicial: 90,
    })

    const resultado = await numerarPaginas({
      archivo,
      configuracion: configurar(),
    })
    const documento = await abrirBytes(await bytesDeBlob(resultado.blob))

    for (const pagina of documento.getPages()) {
      expect(pagina.getRotation().angle).toBe(90)
    }
  })

  it('funciona con las páginas apaisadas por su propia rotación', async () => {
    const archivo = await crearArchivoPdf('documento.pdf', 2, {
      rotacionInicial: 270,
    })

    await expect(
      numerarPaginas({ archivo, configuracion: configurar() }),
    ).resolves.toBeDefined()
  })
})

describe('numerarPaginas: páginas afectadas', () => {
  it('numera todas las páginas', async () => {
    const resultado = await numerar(4, { alcance: 'todas' })
    const conContenido = await leerPaginasConContenido(
      await bytesDeBlob(resultado.blob),
    )

    expect(conContenido).toEqual([true, true, true, true])
  })

  it('numera solo las páginas pares', async () => {
    const resultado = await numerar(4, { alcance: 'pares' })
    const conContenido = await leerPaginasConContenido(
      await bytesDeBlob(resultado.blob),
    )

    // Las páginas 1 y 3 —índices 0 y 2— no se tocan.
    expect(conContenido).toEqual([false, true, false, true])
  })

  it('numera solo las páginas impares', async () => {
    const resultado = await numerar(4, { alcance: 'impares' })
    const conContenido = await leerPaginasConContenido(
      await bytesDeBlob(resultado.blob),
    )

    expect(conContenido).toEqual([true, false, true, false])
  })

  it('numera un rango personalizado', async () => {
    const resultado = await numerar(5, { alcance: 'rango', expresion: '2-3' })
    const conContenido = await leerPaginasConContenido(
      await bytesDeBlob(resultado.blob),
    )

    expect(conContenido).toEqual([false, true, true, false, false])
  })

  it('las páginas no seleccionadas no reciben ningún contenido', async () => {
    const resultado = await numerar(3, { alcance: 'rango', expresion: '2' })
    const conContenido = await leerPaginasConContenido(
      await bytesDeBlob(resultado.blob),
    )

    expect(conContenido[0]).toBe(false)
    expect(conContenido[2]).toBe(false)
  })

  it('rechaza un rango que no incluye ninguna página del documento', async () => {
    await expect(
      numerar(3, { alcance: 'rango', expresion: '' }),
    ).rejects.toThrow(ErrorPdf)
  })

  it('traduce un rango inválido a un mensaje comprensible', async () => {
    await expect(
      numerar(3, { alcance: 'rango', expresion: '99' }),
    ).rejects.toThrow(/no existe/)
  })
})

describe('numerarPaginas: apariencia y posición', () => {
  it('acepta las seis posiciones', async () => {
    const posiciones = [
      'superior-izquierda',
      'superior-centro',
      'superior-derecha',
      'inferior-izquierda',
      'inferior-centro',
      'inferior-derecha',
    ] as const

    for (const posicion of posiciones) {
      const resultado = await numerar(1, { posicion })

      expect(resultado.numeroPaginas).toBe(1)
    }
  })

  it('acepta un tamaño de tipografía grande', async () => {
    const resultado = await numerar(1, {
      apariencia: { ...APARIENCIA_PREDETERMINADA, tamanoFuente: 60 },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('limita un tamaño fuera de rango en lugar de fallar', async () => {
    const resultado = await numerar(1, {
      apariencia: { ...APARIENCIA_PREDETERMINADA, tamanoFuente: 9999 },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('acepta una opacidad parcial', async () => {
    const resultado = await numerar(1, {
      apariencia: { ...APARIENCIA_PREDETERMINADA, opacidadPorcentaje: 40 },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('no falla con un color mal escrito: recurre al negro', async () => {
    const resultado = await numerar(1, {
      apariencia: { ...APARIENCIA_PREDETERMINADA, color: 'no es un color' },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })

  it('acepta márgenes de cero', async () => {
    const resultado = await numerar(1, {
      apariencia: {
        ...APARIENCIA_PREDETERMINADA,
        margenHorizontalMm: 0,
        margenVerticalMm: 0,
      },
    })

    expect(resultado.numeroPaginas).toBe(1)
  })
})

describe('numerarPaginas: número inicial y plantillas', () => {
  it('acepta un número inicial distinto de uno', async () => {
    const resultado = await numerar(3, { numeroInicial: 5 })

    expect(resultado.numeroPaginas).toBe(3)
  })

  it('acepta el cero como número inicial', async () => {
    const resultado = await numerar(2, { numeroInicial: 0 })

    expect(resultado.numeroPaginas).toBe(2)
  })

  it('limita un número inicial negativo', async () => {
    const resultado = await numerar(2, { numeroInicial: -50 })

    expect(resultado.numeroPaginas).toBe(2)
  })

  it('acepta una plantilla personalizada válida', async () => {
    const resultado = await numerar(2, {
      plantilla: 'personalizada',
      plantillaPropia: 'Hoja {pagina} de {total}',
    })

    expect(resultado.numeroPaginas).toBe(2)
  })

  it('rechaza una plantilla personalizada con marcadores inválidos', async () => {
    await expect(
      numerar(2, {
        plantilla: 'personalizada',
        plantillaPropia: '{pagina} de {paginas}',
      }),
    ).rejects.toThrow(/no es un marcador válido/)
  })

  it('rechaza una plantilla personalizada vacía', async () => {
    await expect(
      numerar(2, { plantilla: 'personalizada', plantillaPropia: '' }),
    ).rejects.toThrow(ErrorPdf)
  })

  it('rechaza una plantilla con caracteres no representables', async () => {
    await expect(
      numerar(2, {
        plantilla: 'personalizada',
        plantillaPropia: 'Página {pagina} 🙂',
      }),
    ).rejects.toThrow(ErrorPdf)
  })

  it('acepta las cuatro plantillas con nombre', async () => {
    const claves: readonly Exclude<ClavePlantilla, 'personalizada'>[] = [
      'numero',
      'pagina-numero',
      'numero-de-total',
      'pagina-numero-de-total',
    ]

    for (const plantilla of claves) {
      const resultado = await numerar(2, { plantilla })

      expect(resultado.numeroPaginas).toBe(2)
    }
  })
})

describe('paginasAfectadas', () => {
  it('«todas» devuelve todos los índices', () => {
    expect(calcularIndicesAfectados('todas', 4, '')).toEqual([0, 1, 2, 3])
  })

  it('«pares» se refiere al número de página, no al índice', () => {
    expect(calcularIndicesAfectados('pares', 5, '')).toEqual([1, 3])
  })

  it('«impares» incluye la primera página', () => {
    expect(calcularIndicesAfectados('impares', 5, '')).toEqual([0, 2, 4])
  })

  it('«rango» delega en la utilidad compartida', () => {
    expect(calcularIndicesAfectados('rango', 10, '1-3,7')).toEqual([0, 1, 2, 6])
  })

  it('devuelve una lista vacía sin documento', () => {
    expect(calcularIndicesAfectados('todas', 0, '')).toEqual([])
  })

  it('interpretarAlcance no lanza errores con una expresión inválida', () => {
    const resultado = interpretarAlcance('rango', 5, '99')

    expect(resultado.indices).toEqual([])
    expect(resultado.mensajeError).toContain('no existe')
  })

  it('interpretarAlcance no protesta con una expresión vacía', () => {
    const resultado = interpretarAlcance('rango', 5, '   ')

    expect(resultado.indices).toEqual([])
    expect(resultado.mensajeError).toBeNull()
  })

  it('nombra los cuatro alcances en español', () => {
    expect(describirAlcance('todas')).toBe('Todas las páginas')
    expect(describirAlcance('pares')).toBe('Páginas pares')
    expect(describirAlcance('impares')).toBe('Páginas impares')
    expect(describirAlcance('rango')).toBe('Rango personalizado')
  })
})

describe('numerarPaginas: documentos con rotaciones mezcladas', () => {
  it('numera correctamente un documento con páginas giradas de distinta forma', async () => {
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

    const resultado = await numerarPaginas({
      archivo,
      configuracion: configurar(),
    })
    const numerado = await abrirBytes(await bytesDeBlob(resultado.blob))

    expect(numerado.getPageCount()).toBe(4)
    expect(
      numerado.getPages().map((pagina) => pagina.getRotation().angle),
    ).toEqual([0, 90, 180, 270])
  })
})

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ControladorDocumentoPdf,
  DocumentoCargado,
} from '../ganchos/useDocumentoPdf'

/**
 * Documento de mentira: solo tiene lo que las herramientas leen de él.
 *
 * Lo que importa de estas pruebas es la **identidad** del documento, no su contenido:
 * es lo que dispara el reinicio de la capa.
 */
function documentoFalso(nombre: string): DocumentoCargado {
  return {
    seleccionado: {
      id: nombre,
      nombre,
      tamano: 1024,
      archivo: new File([], nombre, { type: 'application/pdf' }),
    },
    abierto: {} as DocumentoCargado['abierto'],
    numeroPaginas: 4,
  }
}

/** Documento que devuelve el gancho simulado en cada render. */
let documentoActual: DocumentoCargado | null = null

vi.mock('../ganchos/useDocumentoPdf', () => ({
  useDocumentoPdf: (): ControladorDocumentoPdf => ({
    documento: documentoActual,
    cargando: false,
    mensajeError: null,
    mensajeAviso: null,
    seleccionarArchivos: () => {},
    restablecer: () => {
      documentoActual = null
    },
  }),
}))

/** Resultado de la preparación de imágenes simulada. */
const PREPARADA = {
  bytes: new Uint8Array([1, 2, 3]),
  formato: 'png' as const,
  dimensiones: { ancho: 800, alto: 400 },
}

/** Hace fallar la preparación, para probar el camino de error. */
let fallaLaPreparacion = false

/** Compuerta para dejar la preparación a medias y controlar cuándo termina. */
let compuerta: Promise<void> | null = null
let abrirCompuerta: (() => void) | null = null

vi.mock('../imagenes/normalizarImagen', () => ({
  prepararImagenParaPdf: async () => {
    if (compuerta !== null) {
      await compuerta
    }

    if (fallaLaPreparacion) {
      throw new Error('El archivo está dañado.')
    }

    return PREPARADA
  },
}))

const { useEditarPdf } = await import(
  '../funcionalidades/editar-pdf/useEditarPdf'
)
const { useFirmaVisual } = await import(
  '../funcionalidades/firma-visual/useFirmaVisual'
)

/** Archivo de imagen de mentira; la preparación real está simulada. */
function imagenFalsa(nombre = 'logo.png'): File {
  return new File([new Uint8Array([1, 2, 3])], nombre, { type: 'image/png' })
}

beforeEach(() => {
  documentoActual = documentoFalso('primero.pdf')
  fallaLaPreparacion = false
  compuerta = null
  abrirCompuerta = null
})

describe('cambiar de documento en las herramientas de edición', () => {
  it('descarta las correcciones del documento anterior al cargar otro', () => {
    // «Cambiar documento» carga otro archivo sin pasar por restablecer. Sin reiniciar
    // la capa, las correcciones del primer PDF se dibujarían sobre las páginas del
    // segundo, en las posiciones del primero.
    const { result, rerender } = renderHook(() => useEditarPdf())

    act(() => result.current.anadirTexto())

    expect(result.current.capa.elementos).toHaveLength(1)

    documentoActual = documentoFalso('segundo.pdf')
    rerender()

    expect(result.current.capa.elementos).toHaveLength(0)
  })

  it('no deja deshacer hasta el documento anterior', () => {
    const { result, rerender } = renderHook(() => useEditarPdf())

    act(() => result.current.anadirTexto())

    documentoActual = documentoFalso('segundo.pdf')
    rerender()

    expect(result.current.capa.puedeDeshacer).toBe(false)

    act(() => result.current.capa.deshacer())

    expect(result.current.capa.elementos).toHaveLength(0)
  })

  it('vuelve a la primera página al cambiar de documento', () => {
    const { result, rerender } = renderHook(() => useEditarPdf())

    act(() => result.current.cambiarPaginaActiva(3))

    expect(result.current.paginaActiva).toBe(3)

    documentoActual = documentoFalso('segundo.pdf')
    rerender()

    expect(result.current.paginaActiva).toBe(1)
  })

  it('conserva la capa mientras el documento sea el mismo', () => {
    const { result, rerender } = renderHook(() => useEditarPdf())

    act(() => result.current.anadirTexto())
    rerender()
    rerender()

    expect(result.current.capa.elementos).toHaveLength(1)
  })

  it('descarta también las firmas del documento anterior', () => {
    const { result, rerender } = renderHook(() => useFirmaVisual())

    act(() => result.current.cambiarModo('escrita'))
    act(() => result.current.cambiarTextoFirma('Nombre'))
    act(() => result.current.colocarFirma())

    expect(result.current.capa.elementos).toHaveLength(1)

    documentoActual = documentoFalso('segundo.pdf')
    rerender()

    expect(result.current.capa.elementos).toHaveLength(0)
    expect(result.current.capa.puedeDeshacer).toBe(false)
  })
})

describe('insertar imágenes en «Editar y anotar»', () => {
  it('coloca la imagen conservando su proporción', async () => {
    const { result } = renderHook(() => useEditarPdf())

    await act(async () => {
      await result.current.anadirImagen(imagenFalsa())
    })

    const elemento = result.current.capa.seleccionado

    expect(elemento?.clase).toBe('imagen')
    expect(result.current.mensajeError).toBeNull()

    if (elemento?.clase !== 'imagen') {
      throw new Error('Se esperaba un elemento de imagen.')
    }

    expect(elemento.formato).toBe('png')
    expect(elemento.descripcion).toBe('logo.png')
    // La imagen mide 800×400. Su caja se guarda en fracciones de la página, así que
    // hay que devolverla a puntos de un A4 para comprobar que no sale deformada:
    // tiene que quedar el doble de ancha que de alta.
    expect((elemento.ancho * 595) / (elemento.alto * 842)).toBeCloseTo(2, 6)
  })

  it('rechaza un archivo que no es una imagen sin tocar la capa', async () => {
    const { result } = renderHook(() => useEditarPdf())

    await act(async () => {
      await result.current.anadirImagen(
        new File(['hola'], 'notas.txt', { type: 'text/plain' }),
      )
    })

    expect(result.current.capa.elementos).toHaveLength(0)
    expect(result.current.mensajeError).toContain('notas.txt')
  })

  it('informa cuando la imagen no se puede preparar', async () => {
    fallaLaPreparacion = true
    const { result } = renderHook(() => useEditarPdf())

    await act(async () => {
      await result.current.anadirImagen(imagenFalsa())
    })

    expect(result.current.capa.elementos).toHaveLength(0)
    expect(result.current.mensajeError).toBe('El archivo está dañado.')
  })

  it('no coloca la imagen si se cambió de documento mientras se preparaba', async () => {
    // Convertir una fotografía grande lleva su tiempo. Colocarla después de haber
    // cambiado de documento la pondría en el sitio equivocado de otro archivo.
    compuerta = new Promise<void>((resolver) => {
      abrirCompuerta = resolver
    })

    const { result, rerender } = renderHook(() => useEditarPdf())

    let pendiente: Promise<void> = Promise.resolve()

    act(() => {
      pendiente = result.current.anadirImagen(imagenFalsa())
    })

    documentoActual = documentoFalso('segundo.pdf')
    rerender()

    await act(async () => {
      abrirCompuerta?.()
      await pendiente
    })

    await waitFor(() => {
      expect(result.current.preparandoImagen).toBe(false)
    })

    expect(result.current.capa.elementos).toHaveLength(0)
  })
})

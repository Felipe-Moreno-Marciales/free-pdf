import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Preparación del entorno de las pruebas de interfaz.
 *
 * `jsdom` implementa el documento y los eventos, pero no el `canvas` ni la
 * descodificación de imágenes, que dependen de código nativo. Aquí se sustituyen
 * esas API por dobles mínimos.
 *
 * Conviene tener claro qué comprueban y qué no comprueban estas pruebas: sirven
 * para verificar que los componentes se montan, que los controles responden y que
 * los textos y los nombres accesibles son los correctos. **No** comprueban que una
 * imagen se dibuje bien, porque aquí no se dibuja nada de verdad: eso se verifica
 * abriendo la aplicación en un navegador. Los dobles existen para que el árbol de
 * componentes pueda montarse, no para simular un resultado visual.
 */

/** Medidas que devuelve el doble de `createImageBitmap`. */
export const MEDIDAS_SIMULADAS = { ancho: 800, alto: 600 }

/** Contexto de dibujo mínimo, con lo que usan los componentes. */
function crearContextoSimulado(): CanvasRenderingContext2D {
  const contexto = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillStyle: '#000000',
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    fillRect: () => undefined,
    drawImage: () => undefined,
    getImageData: (_x: number, _y: number, ancho: number, alto: number) => ({
      data: new Uint8ClampedArray(Math.max(1, ancho * alto) * 4),
      width: ancho,
      height: alto,
      colorSpace: 'srgb',
    }),
    putImageData: () => undefined,
  }

  return contexto as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  // Las URL temporales se usan para las vistas previas y para las descargas.
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:simulada')
    URL.revokeObjectURL = vi.fn()
  }

  // `createImageBitmap` no existe en jsdom; el doble devuelve unas medidas
  // conocidas para que la lista de imágenes pueda mostrarlas.
  Object.defineProperty(globalThis, 'createImageBitmap', {
    configurable: true,
    writable: true,
    value: vi.fn(async () =>
      Promise.resolve({
        width: MEDIDAS_SIMULADAS.ancho,
        height: MEDIDAS_SIMULADAS.alto,
        close: () => undefined,
      } as unknown as ImageBitmap),
    ),
  })

  // jsdom devuelve `null` en `getContext`, lo que haría fallar el dibujado de las
  // miniaturas antes de poder comprobar nada de la interfaz.
  HTMLCanvasElement.prototype.getContext = vi.fn(() =>
    crearContextoSimulado(),
  ) as unknown as HTMLCanvasElement['getContext']

  HTMLCanvasElement.prototype.toBlob = vi.fn(
    (retorno: BlobCallback) => {
      retorno(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
    },
  ) as unknown as HTMLCanvasElement['toBlob']
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // El hash se comparte entre pruebas, así que se limpia para que cada una
  // arranque en el listado de herramientas.
  window.location.hash = ''
})

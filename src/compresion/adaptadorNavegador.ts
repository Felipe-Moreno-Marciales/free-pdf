import { liberarLienzo } from '../pdf/liberarDocumentoPdf'
import type { AdaptadorImagen } from './recomprimirImagenes'

/**
 * Adaptador que recomprime imágenes con las API del navegador.
 *
 * Es la única parte de la compresión de imágenes que no se puede probar sin un
 * navegador, y por eso está aislada aquí: lo demás —qué imágenes se tocan, a qué
 * tamaño, si el resultado merece la pena y cómo se sustituye el flujo— vive en
 * módulos que sí se prueban.
 *
 * No hay ninguna petición de red. `createImageBitmap` descodifica desde los bytes que
 * ya están en memoria y `canvas` codifica de vuelta: el JPEG nunca sale del hilo.
 */

/** Crea el adaptador que usa la aplicación. */
export function crearAdaptadorNavegador(): AdaptadorImagen {
  return {
    recomprimir: async (bytes, destino, calidad) => {
      // `createImageBitmap` necesita un Blob o un ArrayBuffer propio; se le da una
      // copia para no dejar los bytes originales en un estado transferido.
      const copia = new Uint8Array(bytes.byteLength)
      copia.set(bytes)

      let mapa: ImageBitmap

      try {
        mapa = await createImageBitmap(
          new Blob([copia as BlobPart], { type: 'image/jpeg' }),
        )
      } catch {
        // Un JPEG en CMYK, progresivo con alguna variante rara o simplemente dañado
        // puede no ser descodificable. Devolver `null` deja la imagen intacta.
        return null
      }

      try {
        return await codificar(mapa, destino, calidad)
      } finally {
        // El mapa de bits ocupa ancho × alto × 4 bytes; cerrarlo cuanto antes es lo
        // que permite procesar un documento con muchas fotografías sin agotar la
        // memoria.
        mapa.close()
      }
    },
  }
}

/** Redibuja el mapa de bits al tamaño pedido y lo codifica como JPEG. */
async function codificar(
  mapa: ImageBitmap,
  destino: { readonly ancho: number; readonly alto: number },
  calidad: number,
): Promise<Uint8Array | null> {
  const lienzo = document.createElement('canvas')
  lienzo.width = destino.ancho
  lienzo.height = destino.alto

  const contexto = lienzo.getContext('2d')

  if (contexto === null) {
    liberarLienzo(lienzo)

    return null
  }

  // Se pinta un fondo blanco antes de la imagen porque el JPEG no tiene canal alfa:
  // sin esto, una imagen con transparencia saldría con el fondo en negro.
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, destino.ancho, destino.alto)

  contexto.imageSmoothingEnabled = true
  contexto.imageSmoothingQuality = 'high'
  contexto.drawImage(mapa, 0, 0, destino.ancho, destino.alto)

  const blob = await new Promise<Blob | null>((resolver) => {
    lienzo.toBlob((generado) => resolver(generado), 'image/jpeg', calidad)
  })

  liberarLienzo(lienzo)

  if (blob === null) {
    return null
  }

  return new Uint8Array(await blob.arrayBuffer())
}

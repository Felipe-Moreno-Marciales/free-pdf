import { ErrorImagen } from './erroresImagen'
import { admiteMapaDeBits, opcionesOrientacion } from './orientacionImagen'
import type { DimensionesImagen, ImagenDescodificada } from './tipos'

/**
 * Descodificación de imágenes con las API del propio navegador.
 *
 * Se prefiere `createImageBitmap`, que descodifica sin bloquear el hilo
 * principal y admite respetar la orientación declarada por la imagen. Cuando no
 * está disponible se recurre a un elemento `<img>` con una URL temporal, que se
 * libera siempre.
 *
 * Nada de esto sale del dispositivo: no hay peticiones de red ni servicios
 * externos, y la imagen no se guarda en `localStorage`, `sessionStorage`,
 * `IndexedDB` ni cookies.
 */

/** Milisegundos que se espera como máximo a que una imagen se descodifique. */
const TIEMPO_MAXIMO_MS = 30_000

/**
 * Descodifica una imagen y devuelve una fuente lista para dibujar.
 *
 * Quien la use debe llamar a `liberar` en cuanto termine, para devolver la
 * memoria del mapa de bits y revocar la URL temporal si se creó alguna.
 */
export async function descodificarImagen(
  contenido: Blob,
  nombreVisible: string,
): Promise<ImagenDescodificada> {
  if (contenido.size === 0) {
    throw new ErrorImagen(
      `«${nombreVisible}» está vacío, así que no se puede descodificar.`,
    )
  }

  if (admiteMapaDeBits()) {
    return await descodificarComoMapaDeBits(contenido, nombreVisible)
  }

  return await descodificarComoElemento(contenido, nombreVisible)
}

/** Descodifica la imagen con `createImageBitmap`. */
async function descodificarComoMapaDeBits(
  contenido: Blob,
  nombreVisible: string,
): Promise<ImagenDescodificada> {
  let mapa: ImageBitmap

  try {
    mapa = await createImageBitmap(contenido, opcionesOrientacion())
  } catch (error) {
    // Algunos navegadores rechazan las opciones antes que el propio formato,
    // así que se reintenta sin ellas antes de dar la imagen por perdida.
    try {
      mapa = await createImageBitmap(contenido)
    } catch {
      throw crearErrorDescodificacion(nombreVisible, error)
    }
  }

  if (mapa.width === 0 || mapa.height === 0) {
    mapa.close()
    throw crearErrorDescodificacion(nombreVisible, null)
  }

  return {
    fuente: mapa,
    dimensiones: { ancho: mapa.width, alto: mapa.height },
    liberar: () => {
      mapa.close()
    },
  }
}

/** Descodifica la imagen con un elemento `<img>` y una URL temporal. */
async function descodificarComoElemento(
  contenido: Blob,
  nombreVisible: string,
): Promise<ImagenDescodificada> {
  const url = URL.createObjectURL(contenido)
  const elemento = new Image()

  const liberar = (): void => {
    elemento.removeAttribute('src')
    URL.revokeObjectURL(url)
  }

  try {
    await esperarCarga(elemento, url, nombreVisible)
  } catch (error) {
    liberar()
    throw error
  }

  const dimensiones: DimensionesImagen = {
    ancho: elemento.naturalWidth,
    alto: elemento.naturalHeight,
  }

  if (dimensiones.ancho === 0 || dimensiones.alto === 0) {
    liberar()
    throw crearErrorDescodificacion(nombreVisible, null)
  }

  return { fuente: elemento, dimensiones, liberar }
}

/** Espera a que el elemento `<img>` termine de cargar la URL indicada. */
function esperarCarga(
  elemento: HTMLImageElement,
  url: string,
  nombreVisible: string,
): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const temporizador = window.setTimeout(() => {
      limpiar()
      rechazar(
        new ErrorImagen(
          `«${nombreVisible}» tardó demasiado en descodificarse. Prueba con una imagen más pequeña.`,
        ),
      )
    }, TIEMPO_MAXIMO_MS)

    const limpiar = (): void => {
      window.clearTimeout(temporizador)
      elemento.removeEventListener('load', alCargar)
      elemento.removeEventListener('error', alFallar)
    }

    const alCargar = (): void => {
      limpiar()
      resolver()
    }

    const alFallar = (): void => {
      limpiar()
      rechazar(crearErrorDescodificacion(nombreVisible, null))
    }

    elemento.addEventListener('load', alCargar)
    elemento.addEventListener('error', alFallar)
    elemento.src = url
  })
}

/** Construye el error que se muestra cuando una imagen no se puede leer. */
function crearErrorDescodificacion(
  nombreVisible: string,
  causa: unknown,
): ErrorImagen {
  return new ErrorImagen(
    `No se pudo descodificar «${nombreVisible}». Puede estar dañado o usar una variante que este navegador no admite.`,
    causa === null ? undefined : { cause: causa },
  )
}

/**
 * Lee las medidas de una imagen y libera de inmediato la memoria usada.
 *
 * Es la forma más económica de conocer el ancho y el alto para mostrarlos en la
 * lista de imágenes sin conservar los píxeles.
 */
export async function leerDimensiones(
  contenido: Blob,
  nombreVisible: string,
): Promise<DimensionesImagen> {
  const imagen = await descodificarImagen(contenido, nombreVisible)

  try {
    return imagen.dimensiones
  } finally {
    imagen.liberar()
  }
}

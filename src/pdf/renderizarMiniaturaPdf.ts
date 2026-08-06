import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ErrorPdf } from './erroresPdf'
import { opcionesRecursosPdfJs } from './recursosPdfJs'
import { normalizarRotacion } from './rotaciones'
import type { GradosRotacion } from './tipos'

/** Módulo PDF.js tal y como se obtiene al cargarlo de forma diferida. */
type ModuloPdfJs = typeof import('pdfjs-dist')

/** Módulo PDF.js ya cargado y configurado, para no volver a descargarlo. */
let moduloEnMemoria: ModuloPdfJs | null = null

/** Densidad de píxeles máxima que se usa al dibujar, para no gastar memoria. */
const DENSIDAD_MAXIMA = 2

/**
 * Documento abierto con PDF.js junto a la forma de liberarlo.
 *
 * En PDF.js el método que libera el worker vive en la tarea de carga, no en el
 * documento, así que se guarda aquí encerrado en `liberar` para que quien use
 * el documento no tenga que conocer ese detalle.
 */
export interface DocumentoPdfJs {
  readonly documento: PDFDocumentProxy
  readonly numeroPaginas: number
  readonly liberar: () => Promise<void>
}

/**
 * Carga PDF.js y configura su worker.
 *
 * El worker se importa con el sufijo `?url`, así que Vite lo empaqueta como un
 * recurso más del proyecto y respeta la ruta base de GitHub Pages. No se usa
 * ninguna CDN ni se realiza ninguna petición a un servicio externo.
 */
export async function cargarPdfJs(): Promise<ModuloPdfJs> {
  if (moduloEnMemoria !== null) {
    return moduloEnMemoria
  }

  try {
    const [modulo, recursoTrabajador] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])

    modulo.GlobalWorkerOptions.workerSrc = recursoTrabajador.default
    moduloEnMemoria = modulo
    return modulo
  } catch (error) {
    throw new ErrorPdf(
      'No se pudo cargar el visor de páginas. Comprueba tu conexión y recarga la página.',
      { cause: error },
    )
  }
}

/**
 * Abre un documento con PDF.js para poder dibujar sus páginas.
 *
 * Los recursos auxiliares —tablas de caracteres, tipografías estándar, módulos
 * WebAssembly y perfiles de color— se sirven desde la propia aplicación, en el
 * mismo origen y respetando la ruta base de GitHub Pages. No se realiza ninguna
 * petición a una CDN ni a ningún servicio externo, y esas peticiones locales no
 * contienen ningún dato del documento: solo traen tablas y descodificadores.
 */
export async function abrirDocumentoPdfJs(
  archivo: File,
): Promise<DocumentoPdfJs> {
  const pdfjs = await cargarPdfJs()

  let contenido: ArrayBuffer
  try {
    contenido = await archivo.arrayBuffer()
  } catch (error) {
    throw new ErrorPdf(
      `No se pudo leer «${archivo.name}». Comprueba que el archivo siga disponible en tu dispositivo.`,
      { cause: error },
    )
  }

  // PDF.js transfiere estos bytes al worker, por lo que se le entrega una copia
  // recién leída y no se conserva ninguna referencia en este hilo.
  const tarea = pdfjs.getDocument({
    data: new Uint8Array(contenido),
    ...opcionesRecursosPdfJs(),
  })

  const liberar = async (): Promise<void> => {
    await tarea.destroy()
  }

  try {
    const documento = await tarea.promise

    if (documento.numPages === 0) {
      await liberar()
      throw new ErrorPdf(
        `El archivo «${archivo.name}» no contiene ninguna página.`,
      )
    }

    return { documento, numeroPaginas: documento.numPages, liberar }
  } catch (error) {
    if (error instanceof ErrorPdf) {
      throw error
    }

    await tarea.destroy().catch(() => undefined)

    if (error instanceof pdfjs.PasswordException) {
      throw new ErrorPdf(
        `El archivo «${archivo.name}» está protegido con contraseña, así que no se puede abrir.`,
        { cause: error },
      )
    }

    throw new ErrorPdf(
      `El archivo «${archivo.name}» está dañado o no es un PDF válido, así que no se puede abrir.`,
      { cause: error },
    )
  }
}

/** Medidas en píxeles CSS de una miniatura ya dibujada. */
export interface DimensionesMiniatura {
  readonly ancho: number
  readonly alto: number
}

/**
 * Dibuja una página en un `canvas`, ajustada al ancho indicado.
 *
 * Devuelve `null` si el dibujado se canceló mediante la señal, de modo que la
 * cancelación no se trata como un error. La rotación adicional se suma a la
 * que el propio documento ya declara para esa página.
 */
export async function renderizarPaginaEnLienzo(
  documento: PDFDocumentProxy,
  numeroPagina: number,
  lienzo: HTMLCanvasElement,
  anchoObjetivo: number,
  rotacionAdicional: GradosRotacion,
  senal: AbortSignal,
): Promise<DimensionesMiniatura | null> {
  if (senal.aborted) {
    return null
  }

  const pagina = await documento.getPage(numeroPagina)

  try {
    if (senal.aborted) {
      return null
    }

    const rotacionTotal = normalizarRotacion(pagina.rotate + rotacionAdicional)
    const vistaBase = pagina.getViewport({ scale: 1, rotation: rotacionTotal })
    const escala = anchoObjetivo / vistaBase.width

    const densidad = Math.min(
      typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      DENSIDAD_MAXIMA,
    )
    const vista = pagina.getViewport({
      scale: escala * densidad,
      rotation: rotacionTotal,
    })

    lienzo.width = Math.max(1, Math.round(vista.width))
    lienzo.height = Math.max(1, Math.round(vista.height))

    const tarea = pagina.render({ canvas: lienzo, viewport: vista })
    const cancelar = (): void => {
      tarea.cancel()
    }
    senal.addEventListener('abort', cancelar, { once: true })

    try {
      await tarea.promise
    } finally {
      senal.removeEventListener('abort', cancelar)
    }

    if (senal.aborted) {
      return null
    }

    return {
      ancho: Math.round(vista.width / densidad),
      alto: Math.round(vista.height / densidad),
    }
  } catch (error) {
    if (senal.aborted) {
      return null
    }

    throw new ErrorPdf(
      `No se pudo dibujar la miniatura de la página ${numeroPagina}.`,
      { cause: error },
    )
  } finally {
    // Libera los recursos internos que PDF.js reserva para la página.
    await pagina.cleanup()
  }
}

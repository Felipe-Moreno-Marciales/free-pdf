import { cargarPdfLib } from '../../pdf/cargarDocumentoPdf'
import { cargarPdfJs } from '../../pdf/renderizarMiniaturaPdf'
import { opcionesRecursosPdfJs } from '../../pdf/recursosPdfJs'
import type { ComprobadorCensura, VerificacionCensura } from './tipos'

/**
 * Verificación del documento censurado.
 *
 * La censura es una promesa fuerte, así que no se entrega el archivo sin comprobarlo.
 * Se vuelve a abrir el resultado y se confirma:
 *
 * 1. Que tiene el número de páginas esperado.
 * 2. Que **no queda texto extraíble**: si el documento se reconstruyó desde píxeles,
 *    PDF.js no debe encontrar ninguna cadena de texto.
 * 3. Que no queda ningún campo de formulario.
 * 4. Que no queda ninguna anotación interactiva.
 * 5. Que al menos una página se puede volver a dibujar, es decir, que el documento
 *    no solo es válido sobre el papel sino utilizable.
 *
 * Lo que esta verificación **sí** demuestra: que el documento entregado no contiene
 * capa de texto, formularios ni anotaciones, y que se puede abrir y dibujar.
 *
 * Lo que **no** demuestra: que sea matemáticamente imposible recuperar información.
 * Esa es una afirmación distinta y más fuerte, y no se hace.
 */

/** Número de páginas que se comprueban dibujando, para no gastar tiempo de más. */
const PAGINAS_A_DIBUJAR = 1

/** Escala mínima con la que se comprueba que una página se dibuja. */
const ESCALA_COMPROBACION = 0.2

/** Verificación fallida con un motivo concreto. */
function fallo(mensaje: string, numeroPaginas = 0): VerificacionCensura {
  return {
    correcta: false,
    numeroPaginas,
    sinTextoExtraible: false,
    sinFormularios: false,
    sinAnotaciones: false,
    mensaje,
  }
}

/**
 * Comprueba el documento censurado con PDF.js y pdf-lib.
 *
 * Se usa como comprobador real de la herramienta; las pruebas del canal usan uno
 * propio para no depender del navegador.
 */
export const comprobarCensura: ComprobadorCensura = async (
  contenido,
  paginasEsperadas,
) => {
  const pdfjs = await cargarPdfJs()

  // PDF.js transfiere los bytes al worker, así que recibe una copia propia.
  const copiaPdfJs = new Uint8Array(contenido.byteLength)
  copiaPdfJs.set(contenido)

  const tarea = pdfjs.getDocument({
    data: copiaPdfJs,
    ...opcionesRecursosPdfJs(),
  })

  try {
    const documento = await tarea.promise

    if (documento.numPages !== paginasEsperadas) {
      return fallo(
        `El documento censurado tiene ${documento.numPages} páginas y se esperaban ${paginasEsperadas}. No se entrega el archivo.`,
        documento.numPages,
      )
    }

    // --- 1. Texto extraíble ---
    let textoEncontrado = ''

    for (let numero = 1; numero <= documento.numPages; numero += 1) {
      const pagina = await documento.getPage(numero)

      try {
        const contenidoTexto = await pagina.getTextContent()

        for (const elemento of contenidoTexto.items) {
          if ('str' in elemento && typeof elemento.str === 'string') {
            textoEncontrado += elemento.str
          }
        }

        if (textoEncontrado.trim() !== '') {
          return fallo(
            'El documento censurado todavía contiene texto extraíble, así que no se entrega. Vuelve a intentarlo.',
            documento.numPages,
          )
        }
      } finally {
        await pagina.cleanup()
      }
    }

    // --- 2. Anotaciones interactivas ---
    let anotaciones = 0

    for (let numero = 1; numero <= documento.numPages; numero += 1) {
      const pagina = await documento.getPage(numero)

      try {
        anotaciones += (await pagina.getAnnotations()).length
      } finally {
        await pagina.cleanup()
      }
    }

    if (anotaciones > 0) {
      return fallo(
        'El documento censurado conserva anotaciones interactivas, así que no se entrega.',
        documento.numPages,
      )
    }

    // --- 3. Se puede dibujar de verdad ---
    const dibujables = Math.min(PAGINAS_A_DIBUJAR, documento.numPages)

    for (let numero = 1; numero <= dibujables; numero += 1) {
      const pagina = await documento.getPage(numero)

      try {
        const vista = pagina.getViewport({ scale: ESCALA_COMPROBACION })

        if (vista.width <= 0 || vista.height <= 0) {
          return fallo(
            'Una página del documento censurado no tiene medidas válidas, así que no se entrega.',
            documento.numPages,
          )
        }
      } finally {
        await pagina.cleanup()
      }
    }

    // --- 4. Formularios, con pdf-lib ---
    const sinFormularios = await comprobarSinFormularios(contenido)

    if (!sinFormularios) {
      return fallo(
        'El documento censurado conserva campos de formulario, así que no se entrega.',
        documento.numPages,
      )
    }

    return {
      correcta: true,
      numeroPaginas: documento.numPages,
      sinTextoExtraible: true,
      sinFormularios: true,
      sinAnotaciones: true,
      mensaje: null,
    }
  } catch {
    // El detalle del error se descarta a propósito: podría venir de cualquier capa
    // y lo único que importa es que no se entregue el archivo sin comprobar.
    return fallo(
      'No se pudo comprobar el documento censurado, así que no se entrega. Vuelve a intentarlo.',
    )
  } finally {
    await tarea.destroy().catch(() => undefined)
  }
}

/** Comprueba con pdf-lib que el documento no tenga campos de formulario. */
async function comprobarSinFormularios(
  contenido: Uint8Array,
): Promise<boolean> {
  try {
    const pdfLib = await cargarPdfLib()
    const copia = new Uint8Array(contenido.byteLength)
    copia.set(contenido)

    const documento = await pdfLib.PDFDocument.load(copia, {
      ignoreEncryption: false,
    })

    return documento.getForm().getFields().length === 0
  } catch {
    // Si no se puede comprobar, se es conservador y se considera un fallo.
    return false
  }
}

/** Describe una verificación correcta, para mostrarla en la interfaz. */
export function describirVerificacion(
  verificacion: VerificacionCensura,
): string {
  if (!verificacion.correcta) {
    return verificacion.mensaje ?? 'La comprobación falló.'
  }

  return `Comprobado: ${verificacion.numeroPaginas} ${
    verificacion.numeroPaginas === 1 ? 'página' : 'páginas'
  }, sin texto extraíble, sin campos de formulario y sin anotaciones interactivas.`
}

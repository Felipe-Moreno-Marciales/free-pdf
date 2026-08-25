import type { PDFDocumentProxy } from 'pdfjs-dist'
import { lienzoABlob } from '../imagenes/convertirCanvas'
import { comprobarCancelacion, OperacionCancelada } from '../pdf/cancelacion'
import { liberarLienzo } from '../pdf/liberarDocumentoPdf'
import { renderizarPaginaAEscala } from '../pdf/renderizarPaginaCompleta'
import { crearMotorOcr, type MensajeProgresoMotor } from './motorOcr'

export interface PalabraDetectadaPagina {
  readonly texto: string
  readonly confianza: number
  readonly izquierda: number
  readonly superior: number
  readonly ancho: number
  readonly alto: number
}

/** Resolución suficiente para reconocer texto pequeño sin disparar la memoria. */
const ESCALA_OCR_EDITOR = 2.5

/** Confianza mínima: evita cajas vacías, pero conserva palabras dudosas editables. */
const CONFIANZA_MINIMA = 15

/** Detecta palabras y sus posiciones en una sola página escaneada. */
export async function detectarPalabrasPagina(
  documento: PDFDocumentProxy,
  numeroPagina: number,
  senal: AbortSignal,
  alProgreso?: (mensaje: MensajeProgresoMotor) => void,
): Promise<readonly PalabraDetectadaPagina[]> {
  comprobarCancelacion(senal)
  const dibujada = await renderizarPaginaAEscala(
    documento,
    numeroPagina,
    ESCALA_OCR_EDITOR,
    senal,
  )

  if (dibujada === null) {
    throw new OperacionCancelada()
  }

  let motor: Awaited<ReturnType<typeof crearMotorOcr>> | null = null

  try {
    const blob = await lienzoABlob(dibujada.lienzo, 'png')
    comprobarCancelacion(senal)
    motor = await crearMotorOcr(
      'espanol-ingles',
      alProgreso ?? (() => undefined),
    )
    const activo = motor
    const alAbortar = (): void => {
      void activo.destruir()
    }
    senal.addEventListener('abort', alAbortar, { once: true })

    try {
      if (activo.reconocerPalabras === undefined) {
        return []
      }

      const resultado = await activo.reconocerPalabras(blob)
      comprobarCancelacion(senal)

      return resultado.palabras
        .filter(
          (palabra) =>
            palabra.texto.trim() !== '' &&
            palabra.confianza >= CONFIANZA_MINIMA &&
            palabra.derecha > palabra.izquierda &&
            palabra.inferior > palabra.superior,
        )
        .map((palabra) => ({
          texto: palabra.texto.trim(),
          confianza: palabra.confianza,
          izquierda: palabra.izquierda / dibujada.ancho,
          superior: palabra.superior / dibujada.alto,
          ancho: (palabra.derecha - palabra.izquierda) / dibujada.ancho,
          alto: (palabra.inferior - palabra.superior) / dibujada.alto,
        }))
    } finally {
      senal.removeEventListener('abort', alAbortar)
    }
  } finally {
    await motor?.destruir()
    liberarLienzo(dibujada.lienzo)
  }
}

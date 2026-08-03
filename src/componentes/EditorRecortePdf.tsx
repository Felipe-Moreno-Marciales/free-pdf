import type { PDFDocumentProxy } from 'pdfjs-dist'
import { calcularFraccionesRecorte } from '../funcionalidades/recortar-pdf/coordenadasRecorte'
import type {
  MargenesRecorte,
  MedidasRecorte,
} from '../funcionalidades/recortar-pdf/tipos'
import { formatearMilimetros, puntosAMilimetros } from '../utilidades/unidades'
import { MiniaturaPaginaPdf } from './MiniaturaPaginaPdf'

interface PropiedadesEditorRecortePdf {
  /** Documento abierto con PDF.js. */
  readonly documento: PDFDocumentProxy
  /** Número de la página de referencia, empezando en 1. */
  readonly numeroPagina: number
  /** Medidas visibles actuales de la página, en puntos. */
  readonly visibles: MedidasRecorte
  /** Márgenes del recorte, ya convertidos a puntos. */
  readonly margenesPuntos: MargenesRecorte
  /** Medidas que tendrá el área visible, en puntos. */
  readonly resultantes: MedidasRecorte
  /** Mensaje de advertencia cuando el recorte no es válido, o `null`. */
  readonly mensajeError: string | null
}

/**
 * Vista previa del recorte sobre la página de referencia.
 *
 * Muestra la página con un rectángulo que marca la zona que se conservará y
 * atenúa lo que quedará fuera, así que se entiende de un vistazo qué desaparece
 * de la vista. La zona sombreada no es la única señal: debajo se indican siempre
 * las medidas actuales y las resultantes en texto, de modo que el editor se puede
 * usar sin ver la imagen.
 *
 * El recorte se ajusta con los campos numéricos que acompañan al editor: aquí solo
 * se representa el resultado. Es una decisión deliberada, porque unos controles
 * numéricos son accesibles con el teclado y con lector de pantalla, mientras que
 * arrastrar un rectángulo no lo sería sin añadir una dependencia pesada.
 */
export function EditorRecortePdf({
  documento,
  numeroPagina,
  visibles,
  margenesPuntos,
  resultantes,
  mensajeError,
}: PropiedadesEditorRecortePdf) {
  const fracciones = calcularFraccionesRecorte(visibles, margenesPuntos)
  const esValido = mensajeError === null

  return (
    <figure className="editor-recorte">
      <div className="editor-recorte__lienzo">
        <MiniaturaPaginaPdf
          documento={documento}
          numeroPagina={numeroPagina}
          rotacion={0}
        />

        {esValido && (
          <div
            className="editor-recorte__marco"
            style={{
              left: `${fracciones.izquierda * 100}%`,
              right: `${fracciones.derecha * 100}%`,
              top: `${fracciones.superior * 100}%`,
              bottom: `${fracciones.inferior * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
      </div>

      <figcaption className="editor-recorte__texto">
        <span>
          Página {numeroPagina}. Área visible actual:{' '}
          {formatearMilimetros(puntosAMilimetros(visibles.ancho))} ×{' '}
          {formatearMilimetros(puntosAMilimetros(visibles.alto))}.
        </span>

        {esValido ? (
          <span>
            Área visible resultante:{' '}
            {formatearMilimetros(puntosAMilimetros(resultantes.ancho))} ×{' '}
            {formatearMilimetros(puntosAMilimetros(resultantes.alto))}.
          </span>
        ) : (
          <span className="editor-recorte__error">{mensajeError}</span>
        )}
      </figcaption>
    </figure>
  )
}

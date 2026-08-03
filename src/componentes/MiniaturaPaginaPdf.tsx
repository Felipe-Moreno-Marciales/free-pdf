import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { liberarLienzo } from '../pdf/liberarDocumentoPdf'
import { renderizarPaginaEnLienzo } from '../pdf/renderizarMiniaturaPdf'
import type { GradosRotacion } from '../pdf/tipos'

/** Ancho en píxeles CSS con el que se dibujan las miniaturas. */
const ANCHO_MINIATURA = 220

/** Margen alrededor de la ventana en el que ya se empieza a dibujar. */
const MARGEN_ANTICIPACION = '400px'

/** Estado del dibujado de una miniatura. */
type EstadoMiniatura = 'pendiente' | 'dibujando' | 'lista' | 'error'

interface PropiedadesMiniaturaPaginaPdf {
  /** Documento abierto con PDF.js. */
  readonly documento: PDFDocumentProxy
  /** Número de página dentro del documento, empezando en 1. */
  readonly numeroPagina: number
  /** Rotación adicional que se aplica sobre la del propio documento. */
  readonly rotacion: GradosRotacion
}

/**
 * Miniatura de una página, dibujada en un `canvas` con PDF.js.
 *
 * El dibujado es diferido: solo se lanza cuando la miniatura está cerca de la
 * ventana, de modo que un documento de cientos de páginas no bloquea la
 * interfaz. Al desmontarse se cancela el dibujado pendiente y se vacía el
 * lienzo para devolver la memoria.
 *
 * El `canvas` se marca como decorativo: toda la información de la página se
 * facilita como texto en el componente que lo envuelve.
 */
export function MiniaturaPaginaPdf({
  documento,
  numeroPagina,
  rotacion,
}: PropiedadesMiniaturaPaginaPdf) {
  const refLienzo = useRef<HTMLCanvasElement>(null)
  const refContenedor = useRef<HTMLDivElement>(null)
  const [visible, establecerVisible] = useState(false)
  const [estado, establecerEstado] = useState<EstadoMiniatura>('pendiente')

  // Vacía el lienzo cuando la miniatura desaparece de la página.
  useEffect(() => {
    const lienzo = refLienzo.current

    return () => {
      if (lienzo !== null) {
        liberarLienzo(lienzo)
      }
    }
  }, [])

  // Carga diferida: espera a que la miniatura se acerque a la ventana.
  useEffect(() => {
    if (visible) {
      return
    }

    const contenedor = refContenedor.current
    if (contenedor === null) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      establecerVisible(true)
      return
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          establecerVisible(true)
          observador.disconnect()
        }
      },
      { rootMargin: MARGEN_ANTICIPACION },
    )

    observador.observe(contenedor)

    return () => {
      observador.disconnect()
    }
  }, [visible])

  // Dibuja la página y cancela el dibujado si cambian los datos o se desmonta.
  useEffect(() => {
    if (!visible) {
      return
    }

    const lienzo = refLienzo.current
    if (lienzo === null) {
      return
    }

    const controlador = new AbortController()
    establecerEstado('dibujando')

    const dibujar = async (): Promise<void> => {
      try {
        const dimensiones = await renderizarPaginaEnLienzo(
          documento,
          numeroPagina,
          lienzo,
          ANCHO_MINIATURA,
          rotacion,
          controlador.signal,
        )

        if (dimensiones !== null) {
          establecerEstado('lista')
        }
      } catch {
        if (!controlador.signal.aborted) {
          establecerEstado('error')
        }
      }
    }

    void dibujar()

    return () => {
      controlador.abort()
    }
  }, [documento, numeroPagina, rotacion, visible])

  return (
    <div className="miniatura" data-estado={estado} ref={refContenedor}>
      <canvas className="miniatura__lienzo" ref={refLienzo} aria-hidden="true" />

      {estado !== 'lista' && (
        <span className="miniatura__aviso">
          {estado === 'error' ? 'No se pudo dibujar' : 'Cargando…'}
        </span>
      )}
    </div>
  )
}

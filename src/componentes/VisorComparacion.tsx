import { useEffect, useRef, useState } from 'react'
import type { ZonaDiferencia } from '../comparacion/tipos'
import { liberarLienzo } from '../pdf/liberarDocumentoPdf'
import { opcionesRecursosPdfJs } from '../pdf/recursosPdfJs'
import { cargarPdfJs } from '../pdf/renderizarMiniaturaPdf'

interface PropiedadesVisorComparacion {
  /** Documento del que se dibuja la página. */
  readonly archivo: File
  /** Página que se dibuja, empezando en 1. */
  readonly numeroPagina: number
  /** Rótulo accesible de esta vista. */
  readonly etiqueta: string
  /** Zonas con diferencias que hay que resaltar, en fracciones. */
  readonly zonas?: readonly ZonaDiferencia[]
  /** Opacidad con la que se dibuja, para el modo superpuesto. */
  readonly opacidad?: number
}

/** Ancho al que se dibuja la vista previa, en píxeles. */
const ANCHO_VISTA = 700

/**
 * Dibuja una página de un documento para compararla.
 *
 * Abre el documento, dibuja la página pedida y **cierra el documento inmediatamente**.
 * Mantener dos documentos de PDF.js abiertos mientras se navega entre páginas
 * consumiría memoria sin ganar nada apreciable: volver a abrirlo para cambiar de
 * página tarda unas décimas y libera todo lo demás.
 *
 * Las zonas con diferencias se dibujan **encima**, con HTML, no sobre el lienzo. Así se
 * pueden mostrar y ocultar sin volver a dibujar la página.
 */
export function VisorComparacion({
  archivo,
  numeroPagina,
  etiqueta,
  zonas = [],
  opacidad = 1,
}: PropiedadesVisorComparacion) {
  const referencia = useRef<HTMLCanvasElement | null>(null)
  const [dibujando, establecerDibujando] = useState(true)
  const [fallo, establecerFallo] = useState(false)
  const [medidas, establecerMedidas] = useState<{
    readonly ancho: number
    readonly alto: number
  } | null>(null)

  useEffect(() => {
    let vigente = true

    establecerDibujando(true)
    establecerFallo(false)

    const dibujar = async (): Promise<void> => {
      const pdfjs = await cargarPdfJs()
      const bytes = new Uint8Array(await archivo.arrayBuffer())

      const tarea = pdfjs.getDocument({
        data: bytes,
        ...opcionesRecursosPdfJs(),
      })

      try {
        const documento = await tarea.promise

        if (numeroPagina > documento.numPages) {
          establecerFallo(true)
          return
        }

        const pagina = await documento.getPage(numeroPagina)

        try {
          const natural = pagina.getViewport({ scale: 1 })
          const escala = ANCHO_VISTA / Math.max(1, natural.width)
          const vista = pagina.getViewport({ scale: escala })

          const lienzo = referencia.current

          if (lienzo === null || !vigente) {
            return
          }

          lienzo.width = Math.round(vista.width)
          lienzo.height = Math.round(vista.height)

          const contexto = lienzo.getContext('2d')

          if (contexto === null) {
            establecerFallo(true)
            return
          }

          contexto.fillStyle = '#ffffff'
          contexto.fillRect(0, 0, lienzo.width, lienzo.height)

          await pagina.render({
            canvas: lienzo,
            canvasContext: contexto,
            viewport: vista,
          }).promise

          if (vigente) {
            establecerMedidas({ ancho: lienzo.width, alto: lienzo.height })
          }
        } finally {
          await pagina.cleanup()
        }
      } finally {
        // El documento se cierra siempre, también si el dibujado falló.
        await tarea.destroy().catch(() => undefined)
      }
    }

    void dibujar()
      .catch(() => {
        if (vigente) {
          establecerFallo(true)
        }
      })
      .finally(() => {
        if (vigente) {
          establecerDibujando(false)
        }
      })

    // La ref se copia aquí, no en la limpieza: cuando esta se ejecute, `current` ya
    // puede apuntar a otro lienzo y liberaríamos el equivocado.
    const lienzoActual = referencia.current

    return () => {
      vigente = false

      if (lienzoActual !== null) {
        liberarLienzo(lienzoActual)
      }
    }
  }, [archivo, numeroPagina])

  return (
    <figure className="visor-comparacion">
      <div className="visor-comparacion__lienzo" style={{ opacity: opacidad }}>
        <canvas
          className="visor-comparacion__pagina"
          ref={referencia}
          role="img"
          aria-label={`${etiqueta}, página ${numeroPagina}`}
        />

        {medidas !== null &&
          zonas.map((zona, indice) => (
            <span
              className="visor-comparacion__zona"
              // Las zonas no cambian de orden dentro de una misma comparación.
              key={indice}
              aria-hidden="true"
              style={{
                left: `${zona.izquierda * 100}%`,
                top: `${zona.superior * 100}%`,
                width: `${zona.ancho * 100}%`,
                height: `${zona.alto * 100}%`,
              }}
            />
          ))}
      </div>

      <figcaption className="visor-comparacion__pie">
        {dibujando
          ? `Dibujando ${etiqueta}…`
          : fallo
            ? `No se pudo dibujar la página ${numeroPagina} de ${etiqueta}.`
            : `${etiqueta} · página ${numeroPagina}`}
      </figcaption>
    </figure>
  )
}

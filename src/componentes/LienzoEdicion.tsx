import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useCallback, useRef, useState, type PointerEvent } from 'react'
import { describirElemento, normalizarElemento } from '../edicion/colocarElementos'
import type { ElementoSuperpuesto } from '../edicion/tipos'
import type { GradosRotacion } from '../pdf/tipos'
import { MiniaturaPaginaPdf } from './MiniaturaPaginaPdf'

interface PropiedadesLienzoEdicion {
  readonly documento: PDFDocumentProxy
  /** Página que se está viendo, empezando en 1. */
  readonly numeroPagina: number
  /** Rotación con la que se muestra la página. */
  readonly rotacion?: GradosRotacion
  /** Elementos de esta página, en orden de dibujado. */
  readonly elementos: readonly ElementoSuperpuesto[]
  readonly idSeleccionado: string | null
  readonly deshabilitado: boolean
  readonly alSeleccionar: (id: string | null) => void
  readonly alMover: (
    id: string,
    posicion: { readonly izquierda: number; readonly superior: number },
  ) => void
}

/** Paso con el que las flechas del teclado mueven un elemento. */
const PASO_TECLADO = 0.005

/** Paso mayor, con la tecla de mayúsculas pulsada. */
const PASO_TECLADO_GRANDE = 0.05

/**
 * Superficie de edición sobre una página.
 *
 * Los elementos se pueden arrastrar con el ratón o el dedo, **y también mover con las
 * flechas del teclado**. Lo segundo no es un extra: una interfaz que solo se pueda
 * usar arrastrando deja fuera a quien navega con teclado, y el panel de propiedades
 * con campos numéricos cubre además el caso de querer una medida exacta.
 *
 * Lo que se ve aquí es una vista previa: las posiciones se guardan en fracciones de la
 * página, así que coinciden con el documento final aunque la miniatura sea pequeña.
 */
export function LienzoEdicion({
  documento,
  numeroPagina,
  rotacion = 0,
  elementos,
  idSeleccionado,
  deshabilitado,
  alSeleccionar,
  alMover,
}: PropiedadesLienzoEdicion) {
  const referencia = useRef<HTMLDivElement | null>(null)
  const [arrastrando, establecerArrastrando] = useState<string | null>(null)
  const desplazamiento = useRef({ x: 0, y: 0 })

  /** Convierte la posición del puntero a fracciones de la página. */
  const aFracciones = useCallback(
    (evento: PointerEvent<HTMLElement>): { x: number; y: number } | null => {
      const contenedor = referencia.current

      if (contenedor === null) {
        return null
      }

      const medidas = contenedor.getBoundingClientRect()

      if (medidas.width === 0 || medidas.height === 0) {
        return null
      }

      return {
        x: (evento.clientX - medidas.left) / medidas.width,
        y: (evento.clientY - medidas.top) / medidas.height,
      }
    },
    [],
  )

  const empezarArrastre = useCallback(
    (evento: PointerEvent<HTMLElement>, elemento: ElementoSuperpuesto): void => {
      if (deshabilitado) {
        return
      }

      const punto = aFracciones(evento)

      if (punto === null) {
        return
      }

      // Se guarda dónde se agarró el elemento para que no salte al empezar a mover.
      desplazamiento.current = {
        x: punto.x - elemento.izquierda,
        y: punto.y - elemento.superior,
      }

      alSeleccionar(elemento.id)
      establecerArrastrando(elemento.id)
      evento.currentTarget.setPointerCapture(evento.pointerId)
    },
    [aFracciones, alSeleccionar, deshabilitado],
  )

  const continuarArrastre = useCallback(
    (evento: PointerEvent<HTMLElement>): void => {
      if (arrastrando === null) {
        return
      }

      const punto = aFracciones(evento)

      if (punto === null) {
        return
      }

      alMover(arrastrando, {
        izquierda: punto.x - desplazamiento.current.x,
        superior: punto.y - desplazamiento.current.y,
      })
    },
    [aFracciones, alMover, arrastrando],
  )

  const terminarArrastre = useCallback((): void => {
    establecerArrastrando(null)
  }, [])

  const moverConTeclado = useCallback(
    (evento: React.KeyboardEvent<HTMLElement>, elemento: ElementoSuperpuesto): void => {
      if (deshabilitado) {
        return
      }

      const paso = evento.shiftKey ? PASO_TECLADO_GRANDE : PASO_TECLADO
      let izquierda = elemento.izquierda
      let superior = elemento.superior

      switch (evento.key) {
        case 'ArrowLeft':
          izquierda -= paso
          break
        case 'ArrowRight':
          izquierda += paso
          break
        case 'ArrowUp':
          superior -= paso
          break
        case 'ArrowDown':
          superior += paso
          break
        default:
          return
      }

      // Se evita que la página entera se desplace al pulsar las flechas.
      evento.preventDefault()
      alSeleccionar(elemento.id)
      alMover(elemento.id, { izquierda, superior })
    },
    [alMover, alSeleccionar, deshabilitado],
  )

  return (
    <figure className="lienzo-edicion">
      <div
        className="lienzo-edicion__pagina"
        ref={referencia}
        onPointerMove={continuarArrastre}
        onPointerUp={terminarArrastre}
        onPointerCancel={terminarArrastre}
      >
        <MiniaturaPaginaPdf
          documento={documento}
          numeroPagina={numeroPagina}
          rotacion={rotacion}
        />

        {elementos.map((elemento) => {
          const normalizado = normalizarElemento(elemento)
          const seleccionado = elemento.id === idSeleccionado

          return (
            <button
              className={`lienzo-edicion__elemento${
                seleccionado ? ' lienzo-edicion__elemento--activo' : ''
              }`}
              key={elemento.id}
              type="button"
              disabled={deshabilitado}
              aria-pressed={seleccionado}
              aria-label={`${describirElemento(elemento)}. Usa las flechas para moverlo.`}
              style={{
                left: `${normalizado.izquierda * 100}%`,
                top: `${normalizado.superior * 100}%`,
                width: `${normalizado.ancho * 100}%`,
                height: `${normalizado.alto * 100}%`,
                transform:
                  normalizado.giro === 0
                    ? undefined
                    : `rotate(${-normalizado.giro}deg)`,
              }}
              onPointerDown={(evento) => empezarArrastre(evento, elemento)}
              onKeyDown={(evento) => moverConTeclado(evento, elemento)}
            >
              <span className="lienzo-edicion__vista" aria-hidden="true">
                {dibujarVistaPrevia(elemento)}
              </span>
            </button>
          )
        })}
      </div>

      <figcaption className="lienzo-edicion__pie">
        Página {numeroPagina} con {elementos.length}{' '}
        {elementos.length === 1 ? 'elemento' : 'elementos'}. Arrastra para mover, o
        selecciona uno y usa las flechas; con Mayús se mueve más rápido.
      </figcaption>
    </figure>
  )
}

/**
 * Vista previa de un elemento dentro de su caja.
 *
 * Es una aproximación deliberada: el dibujado de verdad lo hace pdf-lib con las
 * tipografías del PDF, y reproducirlo píxel a píxel en HTML no es posible. Lo que sí
 * coincide es la posición y el tamaño, que es lo que se está ajustando aquí.
 */
function dibujarVistaPrevia(elemento: ElementoSuperpuesto) {
  switch (elemento.clase) {
    case 'texto':
      return (
        <span
          className="lienzo-edicion__texto"
          style={{
            color: elemento.color,
            opacity: elemento.opacidad,
            textAlign:
              elemento.alineacion === 'centro'
                ? 'center'
                : elemento.alineacion === 'derecha'
                  ? 'right'
                  : 'left',
          }}
        >
          {elemento.texto === '' ? 'Texto vacío' : elemento.texto}
        </span>
      )

    case 'resaltado':
      return (
        <span
          className="lienzo-edicion__relleno"
          style={{
            backgroundColor: elemento.color,
            opacity: elemento.opacidad,
          }}
        />
      )

    case 'forma':
      return (
        <span
          className={`lienzo-edicion__forma lienzo-edicion__forma--${elemento.figura}`}
          style={{
            backgroundColor: elemento.relleno ?? 'transparent',
            borderColor: elemento.borde ?? 'transparent',
            borderWidth: elemento.borde === null ? 0 : 2,
            opacity: elemento.opacidad,
          }}
        />
      )

    case 'trazo':
      return (
        <svg
          className="lienzo-edicion__trazo"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ opacity: elemento.opacidad }}
        >
          {elemento.trazos.map((trazo, indice) => (
            <polyline
              // El índice sirve como clave porque los trazos no cambian de orden.
              key={indice}
              points={trazo
                .map((punto) => `${punto.x * 100},${punto.y * 100}`)
                .join(' ')}
              fill="none"
              stroke={elemento.color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )

    case 'imagen':
      return (
        <span className="lienzo-edicion__imagen" style={{ opacity: elemento.opacidad }}>
          {elemento.descripcion === '' ? 'Imagen' : elemento.descripcion}
        </span>
      )
  }
}

import type { PDFDocumentProxy } from 'pdfjs-dist'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { describirElemento, normalizarElemento } from '../edicion/colocarElementos'
import type { ElementoSuperpuesto } from '../edicion/tipos'
import {
  MARGEN_COBERTURA_PUNTOS,
  type SeleccionTextoPdf,
} from '../edicion/seleccionTexto'
import { normalizarRotacion } from '../pdf/rotaciones'
import type { GradosRotacion } from '../pdf/tipos'
import {
  CapaTextoSeleccionablePdf,
} from './CapaTextoSeleccionablePdf'
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
  readonly alRedimensionar: (
    id: string,
    tamano: { readonly ancho: number; readonly alto: number },
  ) => void
  readonly alQuitar: (id: string) => void
  /**
   * Avisa de que empieza un gesto: un arrastre o un cambio de tamaño.
   *
   * Sirve para que el historial cierre el paso anterior y no funda dos gestos
   * distintos en una sola entrada.
   */
  readonly alEmpezarGesto?: () => void
  /** Activa la selección directa de un rectángulo sobre la página. */
  readonly cubriendoArea?: boolean
  readonly alCubrirArea?: (caja: {
    readonly izquierda: number
    readonly superior: number
    readonly ancho: number
    readonly alto: number
  }) => void
  /** Activa la selección de palabras del PDF para corregirlas en su sitio. */
  readonly borrandoTexto?: boolean
  readonly alBorrarTexto?: (seleccion: SeleccionTextoPdf) => void
}

/** Paso con el que las flechas del teclado mueven un elemento. */
const PASO_TECLADO = 0.005

/** Paso mayor, con la tecla de mayúsculas pulsada. */
const PASO_TECLADO_GRANDE = 0.05

/** El editor ocupa bastante más que una miniatura de cuadrícula. */
const ANCHO_RENDERIZADO_EDITOR = 900

/**
 * Parte del cuerpo que queda por encima de la línea base al maquetar con CSS.
 *
 * CSS coloca una línea por su caja, no por su línea base, así que para dejar el texto
 * de la vista previa donde lo va a poner pdf-lib hay que descontar el ascenso de la
 * tipografía sustituta. Son las métricas de Arial, Times New Roman y Courier New con
 * un interlineado de 1,2, que es el mismo que usa el dibujado final.
 */
const ASCENSO_CSS = {
  helvetica: 0.947,
  times: 0.938,
  courier: 0.867,
} as const

/** Medidas de la página en puntos PDF, para traducir cuerpos a píxeles. */
interface MedidasPagina {
  readonly ancho: number
  readonly alto: number
}

type OperacionPuntero =
  | { readonly tipo: 'mover'; readonly id: string }
  | {
      readonly tipo: 'redimensionar'
      readonly id: string
      readonly izquierda: number
      readonly superior: number
    }

interface SeleccionArea {
  readonly inicioX: number
  readonly inicioY: number
  readonly actualX: number
  readonly actualY: number
}

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
  alRedimensionar,
  alQuitar,
  alEmpezarGesto,
  cubriendoArea = false,
  alCubrirArea,
  borrandoTexto = false,
  alBorrarTexto,
}: PropiedadesLienzoEdicion) {
  const referencia = useRef<HTMLDivElement | null>(null)
  const [operacion, establecerOperacion] = useState<OperacionPuntero | null>(null)
  const desplazamiento = useRef({ x: 0, y: 0 })
  const [seleccionArea, establecerSeleccionArea] = useState<SeleccionArea | null>(
    null,
  )
  const [medidasPagina, establecerMedidasPagina] =
    useState<MedidasPagina | null>(null)
  const [anchoLienzo, establecerAnchoLienzo] = useState(0)

  // Medidas reales de la página, en puntos, para poder dibujar la vista previa a la
  // misma escala a la que se verá el documento en lugar de a un tamaño inventado.
  useEffect(() => {
    let cancelado = false

    const medir = async (): Promise<void> => {
      const pagina = await documento.getPage(numeroPagina)
      const vista = pagina.getViewport({
        scale: 1,
        rotation: normalizarRotacion(pagina.rotate + rotacion),
      })

      if (!cancelado) {
        establecerMedidasPagina({ ancho: vista.width, alto: vista.height })
      }
    }

    void medir().catch(() => {
      if (!cancelado) {
        establecerMedidasPagina(null)
      }
    })

    return () => {
      cancelado = true
    }
  }, [documento, numeroPagina, rotacion])

  // Ancho con el que CSS acaba mostrando la página, que cambia con la ventana.
  useEffect(() => {
    const contenedor = referencia.current

    if (contenedor === null) {
      return
    }

    // `clientWidth` deja fuera el borde, que es justo la referencia contra la que CSS
    // resuelve los porcentajes de los elementos colocados encima.
    const medir = (): void => {
      establecerAnchoLienzo(contenedor.clientWidth)
    }

    medir()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observador = new ResizeObserver(medir)
    observador.observe(contenedor)

    return () => {
      observador.disconnect()
    }
  }, [])

  // Píxeles por punto PDF. Vale 0 mientras no se conozcan ambas medidas, y entonces
  // la vista previa recurre a una aproximación en lugar de dibujar un texto de 0 px.
  const escala =
    medidasPagina !== null && medidasPagina.ancho > 0 && anchoLienzo > 0
      ? anchoLienzo / medidasPagina.ancho
      : 0
  const altoLienzo =
    medidasPagina === null || medidasPagina.ancho === 0
      ? 0
      : anchoLienzo * (medidasPagina.alto / medidasPagina.ancho)

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

      // Empezar un gesto cierra el paso anterior del historial. Sin esto, dos
      // arrastres seguidos del mismo elemento se fundirían en uno y deshacer
      // desharía los dos de golpe.
      alEmpezarGesto?.()
      alSeleccionar(elemento.id)
      establecerOperacion({ tipo: 'mover', id: elemento.id })
      evento.currentTarget.setPointerCapture(evento.pointerId)
    },
    [aFracciones, alEmpezarGesto, alSeleccionar, deshabilitado],
  )

  const empezarRedimension = useCallback(
    (evento: PointerEvent<HTMLElement>, elemento: ElementoSuperpuesto): void => {
      if (deshabilitado) {
        return
      }

      alEmpezarGesto?.()
      alSeleccionar(elemento.id)
      establecerOperacion({
        tipo: 'redimensionar',
        id: elemento.id,
        izquierda: elemento.izquierda,
        superior: elemento.superior,
      })
      evento.currentTarget.setPointerCapture(evento.pointerId)
      evento.stopPropagation()
      evento.preventDefault()
    },
    [alEmpezarGesto, alSeleccionar, deshabilitado],
  )

  const continuarArrastre = useCallback(
    (evento: PointerEvent<HTMLElement>): void => {
      if (operacion === null) {
        return
      }

      const punto = aFracciones(evento)

      if (punto === null) {
        return
      }

      if (operacion.tipo === 'mover') {
        alMover(operacion.id, {
          izquierda: punto.x - desplazamiento.current.x,
          superior: punto.y - desplazamiento.current.y,
        })
      } else {
        alRedimensionar(operacion.id, {
          ancho: punto.x - operacion.izquierda,
          alto: punto.y - operacion.superior,
        })
      }
    },
    [aFracciones, alMover, alRedimensionar, operacion],
  )

  const terminarArrastre = useCallback((): void => {
    establecerOperacion(null)
  }, [])

  const empezarSeleccionArea = useCallback(
    (evento: PointerEvent<HTMLElement>): void => {
      const punto = aFracciones(evento)

      if (deshabilitado || punto === null) {
        return
      }

      alSeleccionar(null)
      establecerSeleccionArea({
        inicioX: punto.x,
        inicioY: punto.y,
        actualX: punto.x,
        actualY: punto.y,
      })
      evento.currentTarget.setPointerCapture(evento.pointerId)
      evento.preventDefault()
    },
    [aFracciones, alSeleccionar, deshabilitado],
  )

  const continuarSeleccionArea = useCallback(
    (evento: PointerEvent<HTMLElement>): void => {
      const punto = aFracciones(evento)

      if (punto === null) {
        return
      }

      establecerSeleccionArea((actual) =>
        actual === null
          ? null
          : { ...actual, actualX: punto.x, actualY: punto.y },
      )
    },
    [aFracciones],
  )

  const terminarSeleccionArea = useCallback((evento: PointerEvent<HTMLElement>): void => {
    if (seleccionArea === null) {
      return
    }

    const final = aFracciones(evento) ?? {
      x: seleccionArea.actualX,
      y: seleccionArea.actualY,
    }
    const izquierda = Math.min(seleccionArea.inicioX, final.x)
    const superior = Math.min(seleccionArea.inicioY, final.y)
    const ancho = Math.abs(final.x - seleccionArea.inicioX)
    const alto = Math.abs(final.y - seleccionArea.inicioY)

    establecerSeleccionArea(null)

    // Ignora un simple clic accidental: hace falta seleccionar una zona visible.
    if (ancho >= 0.005 && alto >= 0.005) {
      alCubrirArea?.({ izquierda, superior, ancho, alto })
    }
  }, [aFracciones, alCubrirArea, seleccionArea])

  const moverConTeclado = useCallback(
    (evento: React.KeyboardEvent<HTMLElement>, elemento: ElementoSuperpuesto): void => {
      if (deshabilitado) {
        return
      }

      const paso = evento.shiftKey ? PASO_TECLADO_GRANDE : PASO_TECLADO
      let izquierda = elemento.izquierda
      let superior = elemento.superior

      switch (evento.key) {
        case 'Backspace':
        case 'Delete':
          evento.preventDefault()
          alQuitar(elemento.id)
          return
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
    [alMover, alQuitar, alSeleccionar, deshabilitado],
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
          anchoObjetivo={ANCHO_RENDERIZADO_EDITOR}
        />

        {elementos.map((elemento) => {
          const normalizado = normalizarElemento(elemento)
          const seleccionado = elemento.id === idSeleccionado

          return (
            <button
              className={`lienzo-edicion__elemento${
                elemento.clase === 'texto-editado'
                  ? ' lienzo-edicion__elemento--texto-editado'
                  : ''
              }${
                seleccionado ? ' lienzo-edicion__elemento--activo' : ''
              }${
                elemento.guardado === true
                  ? ' lienzo-edicion__elemento--guardado'
                  : ''
              }`}
              key={elemento.id}
              type="button"
              disabled={deshabilitado}
              aria-pressed={seleccionado}
              aria-label={`${describirElemento(elemento)}. Usa las flechas para moverlo y Suprimir para quitarlo.`}
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
                {dibujarVistaPrevia(normalizado, escala, altoLienzo)}
              </span>
              {seleccionado && (
                <span
                  className="lienzo-edicion__tirador lienzo-edicion__tirador--inferior-derecho"
                  aria-hidden="true"
                  onPointerDown={(evento) => empezarRedimension(evento, elemento)}
                />
              )}
            </button>
          )
        })}

        {cubriendoArea && !deshabilitado && (
          <div
            className="lienzo-edicion__selector-area"
            role="region"
            aria-label="Arrastra sobre la zona que quieres cubrir"
            onPointerDown={empezarSeleccionArea}
            onPointerMove={continuarSeleccionArea}
            onPointerUp={terminarSeleccionArea}
            onPointerCancel={() => establecerSeleccionArea(null)}
          >
            {seleccionArea !== null && (
              <span
                className="lienzo-edicion__seleccion-area"
                aria-hidden="true"
                style={{
                  left: `${Math.min(
                    seleccionArea.inicioX,
                    seleccionArea.actualX,
                  ) * 100}%`,
                  top: `${Math.min(
                    seleccionArea.inicioY,
                    seleccionArea.actualY,
                  ) * 100}%`,
                  width: `${Math.abs(
                    seleccionArea.actualX - seleccionArea.inicioX,
                  ) * 100}%`,
                  height: `${Math.abs(
                    seleccionArea.actualY - seleccionArea.inicioY,
                  ) * 100}%`,
                }}
              />
            )}
          </div>
        )}

        {borrandoTexto && !deshabilitado && alBorrarTexto !== undefined && (
          <CapaTextoSeleccionablePdf
            documento={documento}
            numeroPagina={numeroPagina}
            rotacion={rotacion}
            alSeleccionar={alBorrarTexto}
          />
        )}
      </div>

      <figcaption className="lienzo-edicion__pie">
        Página {numeroPagina} con {elementos.length}{' '}
        {elementos.length === 1 ? 'elemento' : 'elementos'}. Arrastra para mover, o
        {cubriendoArea
          ? ' Arrastra sobre la página para cubrir esa zona.'
          : borrandoTexto
            ? ' Pulsa una palabra; su contenido se abrirá para editarlo.'
          : ' Arrastra para mover; el tirador azul cambia el tamaño y Suprimir quita el elemento.'}
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
 *
 * El cuerpo se convierte a píxeles con la escala real de la página. Antes se derivaba
 * de una fracción fija, y eso hacía que una palabra corregida se viera mucho más
 * pequeña que la original aunque el documento final saliera bien.
 */
function dibujarVistaPrevia(
  elemento: ElementoSuperpuesto,
  escala: number,
  altoLienzo: number,
) {
  switch (elemento.clase) {
    case 'texto':
      return (
        <span
          className="lienzo-edicion__texto"
          style={{
            color: elemento.color,
            ...estiloCssTipografia(elemento.tipografia),
            fontSize: cuerpoEnPixeles(elemento.tamano, escala),
            opacity: elemento.opacidad,
            textAlign: alineacionCss(elemento.alineacion),
          }}
        >
          {elemento.texto === '' ? 'Texto vacío' : elemento.texto}
        </span>
      )

    case 'texto-editado': {
      const cuerpo = elemento.tamano * escala
      const altoCaja = elemento.alto * altoLienzo
      const margen = MARGEN_COBERTURA_PUNTOS * escala

      return (
        <>
          <span
            className="lienzo-edicion__cobertura"
            style={{
              backgroundColor: elemento.colorFondo,
              boxShadow: `0 0 0 ${margen}px ${elemento.colorFondo}`,
              opacity: elemento.opacidad,
            }}
          />

          {elemento.texto !== '' && (
            <span
              className="lienzo-edicion__texto lienzo-edicion__texto--editado"
              style={{
                color: elemento.color,
                ...estiloCssTipografia(elemento.tipografia),
                fontSize: cuerpoEnPixeles(elemento.tamano, escala),
                // Se apoya el texto en la misma línea base que tenía la palabra
                // original, que es lo que hace que no baile respecto a su línea.
                top:
                  escala === 0
                    ? 0
                    : `${
                        elemento.lineaBase * altoCaja -
                        ascensoCss(elemento.tipografia) * cuerpo
                      }px`,
                opacity: elemento.opacidad,
                textAlign: alineacionCss(elemento.alineacion),
              }}
            >
              {elemento.texto}
            </span>
          )}
        </>
      )
    }

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

/**
 * Cuerpo del texto en píxeles de pantalla.
 *
 * Mientras no se conoce la escala de la página se recurre a una medida aproximada,
 * porque un cuerpo de 0 píxeles dejaría la vista previa en blanco.
 */
function cuerpoEnPixeles(tamano: number, escala: number): string {
  return escala > 0
    ? `${tamano * escala}px`
    : `${Math.min(2.5, Math.max(0.45, tamano / 17))}rem`
}

/** Ascenso CSS de la tipografía sustituta que se usa en la vista previa. */
function ascensoCss(tipografia: string): number {
  if (tipografia.startsWith('times')) {
    return ASCENSO_CSS.times
  }

  return tipografia.startsWith('courier')
    ? ASCENSO_CSS.courier
    : ASCENSO_CSS.helvetica
}

/** Traduce la alineación del editor a la de CSS. */
function alineacionCss(
  alineacion: 'izquierda' | 'centro' | 'derecha',
): 'left' | 'center' | 'right' {
  switch (alineacion) {
    case 'centro':
      return 'center'
    case 'derecha':
      return 'right'
    case 'izquierda':
      return 'left'
  }
}

function estiloCssTipografia(tipografia: string): {
  readonly fontFamily: string
  readonly fontWeight: '400' | '700'
  readonly fontStyle: 'normal' | 'italic'
} {
  return {
    fontFamily: tipografia.startsWith('times')
      ? 'Times New Roman, serif'
      : tipografia.startsWith('courier')
        ? 'Courier New, monospace'
        : 'Arial, Helvetica, sans-serif',
    fontWeight: tipografia.includes('negrita') ? '700' : '400',
    fontStyle: tipografia.includes('cursiva') ? 'italic' : 'normal',
  }
}

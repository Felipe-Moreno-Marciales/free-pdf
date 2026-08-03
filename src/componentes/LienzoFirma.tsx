import { useCallback, useRef, useState, type PointerEvent } from 'react'
import type { Punto } from '../pdf/posicionarEnPagina'
import { IconoRestablecer } from './Iconos'

interface PropiedadesLienzoFirma {
  /** Color con el que se dibuja. */
  readonly color: string
  readonly deshabilitado: boolean
  /** Se llama cada vez que cambia el dibujo. */
  readonly alCambiar: (trazos: readonly (readonly Punto[])[]) => void
}

/** Distancia mínima entre puntos guardados, en fracciones de la caja. */
const DISTANCIA_MINIMA = 0.004

/**
 * Lienzo para dibujar una firma a mano alzada.
 *
 * Los puntos se guardan en fracciones de la caja, de 0 a 1, no en píxeles: así el
 * mismo dibujo se puede colocar en cualquier tamaño sobre la página sin recalcular
 * nada, y se ve igual en un móvil y en una pantalla grande.
 *
 * Se descartan los puntos que están demasiado cerca del anterior. Un gesto de ratón
 * genera cientos de puntos por segundo y guardarlos todos no mejora el trazo: solo
 * engorda el documento con líneas de longitud cero.
 *
 * **Esto no es una firma digital.** Es un dibujo. No prueba la identidad de nadie ni
 * detecta si el documento se modifica después.
 */
export function LienzoFirma({
  color,
  deshabilitado,
  alCambiar,
}: PropiedadesLienzoFirma) {
  const referencia = useRef<HTMLDivElement | null>(null)
  const [trazos, establecerTrazos] = useState<readonly (readonly Punto[])[]>([])
  const dibujando = useRef(false)

  const aFracciones = useCallback(
    (evento: PointerEvent<HTMLElement>): Punto | null => {
      const contenedor = referencia.current

      if (contenedor === null) {
        return null
      }

      const medidas = contenedor.getBoundingClientRect()

      if (medidas.width === 0 || medidas.height === 0) {
        return null
      }

      return {
        x: Math.min(
          1,
          Math.max(0, (evento.clientX - medidas.left) / medidas.width),
        ),
        y: Math.min(
          1,
          Math.max(0, (evento.clientY - medidas.top) / medidas.height),
        ),
      }
    },
    [],
  )

  const publicar = useCallback(
    (siguientes: readonly (readonly Punto[])[]): void => {
      establecerTrazos(siguientes)
      alCambiar(siguientes)
    },
    [alCambiar],
  )

  const empezar = useCallback(
    (evento: PointerEvent<HTMLDivElement>): void => {
      if (deshabilitado) {
        return
      }

      const punto = aFracciones(evento)

      if (punto === null) {
        return
      }

      dibujando.current = true
      evento.currentTarget.setPointerCapture(evento.pointerId)
      publicar([...trazos, [punto]])
    },
    [aFracciones, deshabilitado, publicar, trazos],
  )

  const continuar = useCallback(
    (evento: PointerEvent<HTMLDivElement>): void => {
      if (!dibujando.current) {
        return
      }

      const punto = aFracciones(evento)

      if (punto === null) {
        return
      }

      const actual = trazos.at(-1)

      if (actual === undefined) {
        return
      }

      const ultimo = actual.at(-1)

      if (
        ultimo !== undefined &&
        Math.hypot(punto.x - ultimo.x, punto.y - ultimo.y) < DISTANCIA_MINIMA
      ) {
        return
      }

      publicar([...trazos.slice(0, -1), [...actual, punto]])
    },
    [aFracciones, publicar, trazos],
  )

  const terminar = useCallback((): void => {
    dibujando.current = false

    // Un toque sin arrastre deja un trazo de un solo punto, que no dibuja nada.
    // Se descarta para que el recuento de trazos sea cierto.
    const utiles = trazos.filter((trazo) => trazo.length >= 2)

    if (utiles.length !== trazos.length) {
      publicar(utiles)
    }
  }, [publicar, trazos])

  const borrar = useCallback((): void => {
    publicar([])
  }, [publicar])

  const deshacer = useCallback((): void => {
    publicar(trazos.slice(0, -1))
  }, [publicar, trazos])

  const puntos = trazos.reduce((total, trazo) => total + trazo.length, 0)

  return (
    <div className="lienzo-firma">
      <div
        className="lienzo-firma__area"
        ref={referencia}
        onPointerDown={empezar}
        onPointerMove={continuar}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        role="application"
        aria-label="Área para dibujar la firma. Arrastra el ratón o el dedo para dibujar."
      >
        <svg
          className="lienzo-firma__dibujo"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {trazos.map((trazo, indice) => (
            <polyline
              // Los trazos no cambian de orden, así que el índice es estable.
              key={indice}
              points={trazo
                .map((punto) => `${punto.x * 100},${punto.y * 100}`)
                .join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {trazos.length === 0 && (
          <p className="lienzo-firma__indicacion">
            Dibuja aquí tu firma con el ratón o el dedo.
          </p>
        )}
      </div>

      <div className="lienzo-firma__acciones">
        <button
          className="boton boton--discreto boton--pequeno"
          type="button"
          disabled={deshabilitado || trazos.length === 0}
          onClick={deshacer}
        >
          Deshacer el último trazo
        </button>

        <button
          className="boton boton--discreto boton--pequeno"
          type="button"
          disabled={deshabilitado || trazos.length === 0}
          onClick={borrar}
        >
          <IconoRestablecer className="boton__icono" />
          Borrar
        </button>

        <p className="lienzo-firma__estado" aria-live="polite">
          {trazos.length === 0
            ? 'Sin dibujar.'
            : `${trazos.length} ${
                trazos.length === 1 ? 'trazo' : 'trazos'
              }, ${puntos} ${puntos === 1 ? 'punto' : 'puntos'}.`}
        </p>
      </div>
    </div>
  )
}

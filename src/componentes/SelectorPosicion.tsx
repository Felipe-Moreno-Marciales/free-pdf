import { useId } from 'react'
import {
  describirPosicion,
  type PosicionEnPagina,
} from '../pdf/posicionarEnPagina'

interface PropiedadesSelectorPosicion {
  /** Título del grupo. */
  readonly etiqueta: string
  /** Posiciones que se ofrecen. */
  readonly posiciones: readonly PosicionEnPagina[]
  /** Posición elegida. */
  readonly valor: PosicionEnPagina
  /** Bloquea el control mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con la posición elegida. */
  readonly alCambiar: (posicion: PosicionEnPagina) => void
  /** Aclaración que se muestra bajo el control. */
  readonly ayuda?: string
}

/**
 * Selector de la posición del contenido dentro de la página.
 *
 * Se dibuja como una cuadrícula que imita una hoja de papel, lo que hace evidente
 * a qué esquina corresponde cada celda. Por debajo son campos `radio` nativos con
 * su nombre accesible completo —«Superior derecha», por ejemplo—, así que la
 * elección se entiende sin ver la cuadrícula y se puede cambiar con las flechas
 * del teclado.
 */
export function SelectorPosicion({
  etiqueta,
  posiciones,
  valor,
  deshabilitado,
  alCambiar,
  ayuda,
}: PropiedadesSelectorPosicion) {
  const nombre = useId()
  const idAyuda = useId()

  return (
    <fieldset
      className="selector-posicion"
      aria-describedby={ayuda === undefined ? undefined : idAyuda}
    >
      <legend className="selector-posicion__titulo">{etiqueta}</legend>

      {ayuda !== undefined && (
        <p className="selector-posicion__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}

      <div className="selector-posicion__cuadricula">
        {posiciones.map((posicion) => (
          <label
            className="selector-posicion__celda"
            key={posicion}
            data-posicion={posicion}
            data-elegida={posicion === valor}
            data-deshabilitada={deshabilitado}
          >
            <input
              className="selector-posicion__campo"
              type="radio"
              name={nombre}
              value={posicion}
              checked={posicion === valor}
              disabled={deshabilitado}
              onChange={() => alCambiar(posicion)}
            />
            <span className="solo-lector-pantalla">
              {describirPosicion(posicion)}
            </span>
            <span className="selector-posicion__marca" aria-hidden="true" />
          </label>
        ))}
      </div>

      <p className="selector-posicion__elegida">
        Posición elegida: {describirPosicion(valor)}.
      </p>
    </fieldset>
  )
}

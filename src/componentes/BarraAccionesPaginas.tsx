import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { ControladorSeleccionPaginas } from '../ganchos/useSeleccionPaginas'
import {
  IconoDeseleccionar,
  IconoInvertir,
  IconoSeleccionarTodas,
} from './Iconos'

interface PropiedadesBarraAccionesPaginas {
  /** Controlador de la selección de páginas. */
  readonly seleccion: ControladorSeleccionPaginas
  /** Número de páginas del documento. */
  readonly numeroPaginas: number
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitada: boolean
}

/**
 * Controles compartidos para seleccionar páginas.
 *
 * Incluye los botones de selección rápida y un campo para escribir rangos, de
 * modo que las cuatro herramientas de páginas ofrecen la misma experiencia.
 */
export function BarraAccionesPaginas({
  seleccion,
  numeroPaginas,
  deshabilitada,
}: PropiedadesBarraAccionesPaginas) {
  const idCampo = useId()
  const idAyuda = useId()
  const idError = useId()
  const [expresion, establecerExpresion] = useState('')
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)

  const aplicar = (evento: FormEvent<HTMLFormElement>): void => {
    evento.preventDefault()
    establecerMensajeError(seleccion.aplicarRangos(expresion))
  }

  return (
    <div className="acciones-paginas">
      <div className="acciones-paginas__botones">
        <button
          className="boton boton--secundario"
          type="button"
          disabled={deshabilitada}
          onClick={seleccion.seleccionarTodas}
        >
          <IconoSeleccionarTodas className="boton__icono" />
          Seleccionar todas
        </button>

        <button
          className="boton boton--secundario"
          type="button"
          disabled={deshabilitada || seleccion.numeroSeleccionadas === 0}
          onClick={seleccion.limpiarSeleccion}
        >
          <IconoDeseleccionar className="boton__icono" />
          Deseleccionar todas
        </button>

        <button
          className="boton boton--secundario"
          type="button"
          disabled={deshabilitada}
          onClick={seleccion.invertirSeleccion}
        >
          <IconoInvertir className="boton__icono" />
          Invertir selección
        </button>
      </div>

      <form className="acciones-paginas__rangos" onSubmit={aplicar}>
        <label className="acciones-paginas__etiqueta" htmlFor={idCampo}>
          Seleccionar por rangos
        </label>

        <div className="acciones-paginas__fila">
          <input
            className="campo-texto"
            id={idCampo}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1-3, 5, 8-10"
            value={expresion}
            disabled={deshabilitada}
            aria-describedby={
              mensajeError === null ? idAyuda : `${idAyuda} ${idError}`
            }
            aria-invalid={mensajeError !== null}
            onChange={(evento) => {
              establecerExpresion(evento.target.value)
              establecerMensajeError(null)
            }}
          />

          <button
            className="boton boton--secundario"
            type="submit"
            disabled={deshabilitada}
          >
            Aplicar
          </button>
        </div>

        <p className="acciones-paginas__ayuda" id={idAyuda}>
          Escribe páginas sueltas y rangos separados por comas. El documento
          tiene {numeroPaginas} {numeroPaginas === 1 ? 'página' : 'páginas'}.
        </p>

        <p className="acciones-paginas__error" id={idError} role="alert">
          {mensajeError}
        </p>
      </form>
    </div>
  )
}

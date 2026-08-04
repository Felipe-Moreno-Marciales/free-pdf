import { useId } from 'react'
import {
  describirAlcance,
  type AlcancePaginas,
} from '../pdf/paginasAfectadas'
import { resumirIndicesComoTexto } from '../utilidades/rangosPaginas'
import { GrupoOpciones, type OpcionElegible } from './GrupoOpciones'

/** Alcances que se ofrecen, en el orden en el que se muestran. */
const ALCANCES: readonly AlcancePaginas[] = [
  'todas',
  'pares',
  'impares',
  'rango',
]

/** Opciones del grupo, construidas a partir de los alcances. */
const OPCIONES: readonly OpcionElegible<AlcancePaginas>[] = ALCANCES.map(
  (alcance) => ({ valor: alcance, etiqueta: describirAlcance(alcance) }),
)

interface PropiedadesSelectorRangoPaginas {
  /** Alcance elegido. */
  readonly alcance: AlcancePaginas
  /** Expresión de rangos escrita por la persona. */
  readonly expresion: string
  /** Número de páginas del documento. */
  readonly numeroPaginas: number
  /** Índices afectados según el alcance actual. */
  readonly indicesAfectados: readonly number[]
  /** Mensaje de error de la expresión, o `null`. */
  readonly mensajeError: string | null
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con el alcance elegido. */
  readonly alCambiarAlcance: (alcance: AlcancePaginas) => void
  /** Se ejecuta con la expresión escrita. */
  readonly alCambiarExpresion: (expresion: string) => void
}

/**
 * Selector de las páginas a las que afecta una operación.
 *
 * El campo de rangos solo aparece cuando se elige «Rango personalizado», y
 * siempre se muestra el resumen de las páginas afectadas: así se puede comprobar
 * el efecto de la elección sin depender del color ni de la posición de nada.
 */
export function SelectorRangoPaginas({
  alcance,
  expresion,
  numeroPaginas,
  indicesAfectados,
  mensajeError,
  deshabilitado,
  alCambiarAlcance,
  alCambiarExpresion,
}: PropiedadesSelectorRangoPaginas) {
  const idCampo = useId()
  const idAyuda = useId()
  const idError = useId()

  const resumen = resumirIndicesComoTexto(indicesAfectados)

  return (
    <div className="paginas-afectadas">
      <GrupoOpciones
        etiqueta="Páginas afectadas"
        opciones={OPCIONES}
        valor={alcance}
        deshabilitado={deshabilitado}
        alCambiar={alCambiarAlcance}
      />

      {alcance === 'rango' && (
        <div className="paginas-afectadas__rango">
          <label className="paginas-afectadas__etiqueta" htmlFor={idCampo}>
            Páginas y rangos
          </label>

          <input
            className="campo-texto"
            id={idCampo}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1-3, 5, 8-10"
            value={expresion}
            disabled={deshabilitado}
            aria-invalid={mensajeError !== null}
            aria-describedby={
              mensajeError === null ? idAyuda : `${idAyuda} ${idError}`
            }
            onChange={(evento) => alCambiarExpresion(evento.target.value)}
          />

          <p className="paginas-afectadas__ayuda" id={idAyuda}>
            Escribe páginas sueltas y rangos separados por comas. El documento
            tiene {numeroPaginas} {numeroPaginas === 1 ? 'página' : 'páginas'}.
          </p>

          {mensajeError !== null && (
            <p className="paginas-afectadas__error" id={idError}>
              {mensajeError}
            </p>
          )}
        </div>
      )}

      <p className="paginas-afectadas__resumen">
        {indicesAfectados.length === 0
          ? 'Ninguna página quedará afectada con la selección actual.'
          : `Se aplicará a ${indicesAfectados.length} ${
              indicesAfectados.length === 1 ? 'página' : 'páginas'
            }: ${resumen}.`}
      </p>
    </div>
  )
}

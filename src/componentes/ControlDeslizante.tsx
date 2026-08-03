import { useId } from 'react'

interface PropiedadesControlDeslizante {
  /** Texto de la etiqueta. */
  readonly etiqueta: string
  /** Valor actual. */
  readonly valor: number
  /** Valor mínimo admitido. */
  readonly minimo: number
  /** Valor máximo admitido. */
  readonly maximo: number
  /** Incremento del control. */
  readonly paso?: number
  /** Texto que describe el valor actual, por ejemplo `85 %`. */
  readonly valorLegible: string
  /** Bloquea el control mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con el valor elegido. */
  readonly alCambiar: (valor: number) => void
  /** Aclaración que se muestra bajo el control. */
  readonly ayuda?: string
}

/**
 * Control deslizante con su valor en texto.
 *
 * Un deslizador por sí solo no comunica nada a quien no ve la pantalla, así que
 * el valor aparece siempre escrito al lado y se declara además en
 * `aria-valuetext`, que es lo que anuncian los lectores de pantalla al moverlo.
 * El control es un `input` de tipo `range` nativo, de modo que responde a las
 * flechas del teclado.
 */
export function ControlDeslizante({
  etiqueta,
  valor,
  minimo,
  maximo,
  paso = 1,
  valorLegible,
  deshabilitado,
  alCambiar,
  ayuda,
}: PropiedadesControlDeslizante) {
  const idCampo = useId()
  const idAyuda = useId()

  return (
    <div className="deslizante">
      <div className="deslizante__encabezado">
        <label className="deslizante__etiqueta" htmlFor={idCampo}>
          {etiqueta}
        </label>
        <output className="deslizante__valor" htmlFor={idCampo}>
          {valorLegible}
        </output>
      </div>

      <input
        className="deslizante__campo"
        id={idCampo}
        type="range"
        value={valor}
        min={minimo}
        max={maximo}
        step={paso}
        disabled={deshabilitado}
        aria-valuetext={valorLegible}
        aria-describedby={ayuda === undefined ? undefined : idAyuda}
        onChange={(evento) => {
          const leido = Number.parseFloat(evento.target.value)
          if (Number.isFinite(leido)) {
            alCambiar(leido)
          }
        }}
      />

      {ayuda !== undefined && (
        <p className="deslizante__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}
    </div>
  )
}

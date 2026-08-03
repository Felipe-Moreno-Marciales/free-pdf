import { useId } from 'react'

interface PropiedadesCampoNumero {
  /** Texto de la etiqueta. */
  readonly etiqueta: string
  /** Valor actual. */
  readonly valor: number
  /** Valor mínimo admitido. */
  readonly minimo: number
  /** Valor máximo admitido. */
  readonly maximo: number
  /** Incremento de las flechas del control. */
  readonly paso?: number
  /** Unidad que se muestra junto al campo, por ejemplo `mm`. */
  readonly unidad?: string
  /** Bloquea el campo mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con el valor escrito. */
  readonly alCambiar: (valor: number) => void
  /** Aclaración que se muestra bajo el campo. */
  readonly ayuda?: string
  /** Mensaje de error, o `null` si el valor es válido. */
  readonly mensajeError?: string | null
}

/**
 * Campo para escribir un número dentro de un rango.
 *
 * El `input` es de tipo `number`, así que el navegador aporta el teclado
 * numérico en los móviles y los botones de incremento. El valor se comunica solo
 * cuando se puede interpretar como número, y el rango se declara con `min` y
 * `max` para que la tecnología asistiva lo anuncie.
 */
export function CampoNumero({
  etiqueta,
  valor,
  minimo,
  maximo,
  paso = 1,
  unidad,
  deshabilitado,
  alCambiar,
  ayuda,
  mensajeError = null,
}: PropiedadesCampoNumero) {
  const idCampo = useId()
  const idAyuda = useId()
  const idError = useId()

  const descripciones = [
    ayuda === undefined ? null : idAyuda,
    mensajeError === null ? null : idError,
  ].filter((identificador): identificador is string => identificador !== null)

  return (
    <div className="campo-numero">
      <label className="campo-numero__etiqueta" htmlFor={idCampo}>
        {etiqueta}
      </label>

      <div className="campo-numero__fila">
        <input
          className="campo-texto campo-texto--numero"
          id={idCampo}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(valor) ? valor : ''}
          min={minimo}
          max={maximo}
          step={paso}
          disabled={deshabilitado}
          aria-invalid={mensajeError !== null}
          aria-describedby={
            descripciones.length === 0 ? undefined : descripciones.join(' ')
          }
          onChange={(evento) => {
            const leido = Number.parseFloat(evento.target.value)
            if (Number.isFinite(leido)) {
              alCambiar(leido)
            }
          }}
        />

        {unidad !== undefined && (
          <span className="campo-numero__unidad" aria-hidden="true">
            {unidad}
          </span>
        )}
      </div>

      {ayuda !== undefined && (
        <p className="campo-numero__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}

      {mensajeError !== null && (
        <p className="campo-numero__error" id={idError}>
          {mensajeError}
        </p>
      )}
    </div>
  )
}

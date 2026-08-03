import { useId, useState } from 'react'
import {
  describirFuerza,
  evaluarContrasena,
} from '../seguridad/qpdf/permisosPdf'
import { IconoOjo, IconoOjoTachado } from './Iconos'

interface PropiedadesCampoContrasena {
  /** Texto de la etiqueta. */
  readonly etiqueta: string
  /** Valor actual. */
  readonly valor: string
  /** Bloquea el campo mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con la contraseña escrita. */
  readonly alCambiar: (contrasena: string) => void
  /** Aclaración que se muestra bajo el campo. */
  readonly ayuda?: string
  /** Mensaje de error, o `null` si el valor es válido. */
  readonly mensajeError?: string | null
  /** Muestra el indicador de longitud de la contraseña. */
  readonly mostrarFuerza?: boolean
  /** Valor del atributo `autocomplete`. */
  readonly autocompletado?: 'new-password' | 'current-password' | 'off'
}

/**
 * Campo de contraseña con opción de mostrarla.
 *
 * El campo es de tipo `password`, así que el navegador lo oculta y no lo incluye
 * en los formularios que rellena automáticamente salvo que se le indique. Mostrar
 * la contraseña exige una acción explícita, y el botón anuncia su estado con
 * `aria-pressed` para que se entienda sin ver el icono.
 *
 * El indicador de fuerza solo mide la longitud: no se imponen reglas de
 * composición, que empujan a contraseñas cortas y difíciles de recordar.
 *
 * La contraseña vive únicamente en el estado de React mientras la herramienta está
 * abierta. No se guarda en `localStorage`, `sessionStorage`, `IndexedDB` ni
 * cookies, y la herramienta la borra de su estado en cuanto termina.
 */
export function CampoContrasena({
  etiqueta,
  valor,
  deshabilitado,
  alCambiar,
  ayuda,
  mensajeError = null,
  mostrarFuerza = false,
  autocompletado = 'new-password',
}: PropiedadesCampoContrasena) {
  const idCampo = useId()
  const idAyuda = useId()
  const idError = useId()
  const idFuerza = useId()

  const [visible, establecerVisible] = useState(false)

  const fuerza = evaluarContrasena(valor)

  const descripciones = [
    ayuda === undefined ? null : idAyuda,
    mostrarFuerza && valor !== '' ? idFuerza : null,
    mensajeError === null ? null : idError,
  ].filter((identificador): identificador is string => identificador !== null)

  return (
    <div className="campo-contrasena">
      <label className="campo-contrasena__etiqueta" htmlFor={idCampo}>
        {etiqueta}
      </label>

      <div className="campo-contrasena__fila">
        <input
          className="campo-texto campo-contrasena__campo"
          id={idCampo}
          type={visible ? 'text' : 'password'}
          value={valor}
          autoComplete={autocompletado}
          spellCheck={false}
          disabled={deshabilitado}
          aria-invalid={mensajeError !== null}
          aria-describedby={
            descripciones.length === 0 ? undefined : descripciones.join(' ')
          }
          onChange={(evento) => alCambiar(evento.target.value)}
        />

        <button
          className="boton-icono"
          type="button"
          disabled={deshabilitado}
          aria-pressed={visible}
          aria-label={
            visible
              ? `Ocultar ${etiqueta.toLowerCase()}`
              : `Mostrar ${etiqueta.toLowerCase()}`
          }
          onClick={() => establecerVisible((actual) => !actual)}
        >
          {visible ? (
            <IconoOjoTachado className="boton-icono__icono" />
          ) : (
            <IconoOjo className="boton-icono__icono" />
          )}
        </button>
      </div>

      {ayuda !== undefined && (
        <p className="campo-contrasena__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}

      {mostrarFuerza && valor !== '' && (
        <p className="campo-contrasena__fuerza" id={idFuerza} data-fuerza={fuerza}>
          {valor.length} {valor.length === 1 ? 'carácter' : 'caracteres'}.{' '}
          {describirFuerza(fuerza)}
        </p>
      )}

      {mensajeError !== null && (
        <p className="campo-contrasena__error" id={idError}>
          {mensajeError}
        </p>
      )}
    </div>
  )
}

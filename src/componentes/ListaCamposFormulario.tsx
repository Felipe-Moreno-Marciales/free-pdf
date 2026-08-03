import { useId } from 'react'
import {
  describirClase,
  esRellenable,
} from '../formularios/inspeccionarFormulario'
import type { CampoDetectado, ValorCampo } from '../formularios/tipos'
import { IconoRestablecer } from './Iconos'

interface PropiedadesListaCamposFormulario {
  /** Campos detectados en el documento. */
  readonly campos: readonly CampoDetectado[]
  /** Valores que la persona ha escrito, por nombre. */
  readonly valores: ReadonlyMap<string, ValorCampo>
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con el valor escrito. */
  readonly alCambiar: (nombre: string, valor: ValorCampo) => void
  /** Vacía un campo concreto. */
  readonly alLimpiar: (nombre: string) => void
}

/**
 * Lista de los campos de un formulario, con sus controles para rellenarlos.
 *
 * Cada campo se representa con el control HTML que le corresponde, así que el
 * navegador aporta el comportamiento y la accesibilidad: un campo de texto es un
 * `input`, una casilla es un `checkbox`, un grupo de opciones son `radio` dentro de
 * un `fieldset`, y una lista es un `select`.
 *
 * Se muestra siempre el nombre técnico del campo además de su tipo, porque es la
 * única forma de saber con certeza qué campo se está rellenando cuando el documento
 * no trae etiquetas legibles.
 *
 * Los campos de contraseña se muestran pero **nunca** revelan su valor original.
 */
export function ListaCamposFormulario({
  campos,
  valores,
  deshabilitado,
  alCambiar,
  alLimpiar,
}: PropiedadesListaCamposFormulario) {
  if (campos.length === 0) {
    return (
      <p className="campos-formulario__vacio">
        Este documento no contiene ningún campo de formulario. Puedes crear campos
        nuevos desde la pestaña «Crear campos».
      </p>
    )
  }

  return (
    <ol className="campos-formulario">
      {campos.map((campo) => (
        <li className="campos-formulario__elemento" key={campo.nombre}>
          <CampoFormulario
            campo={campo}
            valor={valores.get(campo.nombre) ?? campo.valor}
            modificado={valores.has(campo.nombre)}
            deshabilitado={deshabilitado}
            alCambiar={alCambiar}
            alLimpiar={alLimpiar}
          />
        </li>
      ))}
    </ol>
  )
}

interface PropiedadesCampoFormulario {
  readonly campo: CampoDetectado
  readonly valor: ValorCampo
  readonly modificado: boolean
  readonly deshabilitado: boolean
  readonly alCambiar: (nombre: string, valor: ValorCampo) => void
  readonly alLimpiar: (nombre: string) => void
}

/** Un único campo con su control y sus datos técnicos. */
function CampoFormulario({
  campo,
  valor,
  modificado,
  deshabilitado,
  alCambiar,
  alLimpiar,
}: PropiedadesCampoFormulario) {
  const idControl = useId()
  const idDatos = useId()

  const bloqueado = deshabilitado || campo.soloLectura
  const rellenable = esRellenable(campo.clase)

  return (
    <div className="campo-formulario" data-modificado={modificado}>
      <div className="campo-formulario__encabezado">
        <label className="campo-formulario__nombre" htmlFor={idControl}>
          {campo.nombre}
        </label>

        <span className="campo-formulario__etiquetas">
          <span className="etiqueta-dato">{describirClase(campo.clase)}</span>
          {campo.pagina !== null && (
            <span className="etiqueta-dato">Página {campo.pagina}</span>
          )}
          {campo.obligatorio && (
            <span className="etiqueta-dato etiqueta-dato--aviso">
              Obligatorio
            </span>
          )}
          {campo.soloLectura && (
            <span className="etiqueta-dato">Solo lectura</span>
          )}
          {modificado && (
            <span className="etiqueta-dato etiqueta-dato--activa">
              Modificado
            </span>
          )}
        </span>
      </div>

      {!rellenable ? (
        <p className="campo-formulario__ayuda" id={idDatos}>
          Esta herramienta no puede rellenar campos de este tipo. Se conservará tal
          y como está.
        </p>
      ) : (
        <>
          <ControlCampo
            idControl={idControl}
            idDatos={idDatos}
            campo={campo}
            valor={valor}
            bloqueado={bloqueado}
            alCambiar={alCambiar}
          />

          <p className="campo-formulario__ayuda" id={idDatos}>
            {campo.esContrasena
              ? 'Es un campo de contraseña. Su valor original no se muestra por seguridad.'
              : campo.longitudMaxima !== null
                ? `Admite como máximo ${campo.longitudMaxima} caracteres.`
                : campo.soloLectura
                  ? 'El documento marca este campo como solo lectura.'
                  : 'Escribe el valor que quieras guardar en el documento.'}
          </p>

          {modificado && !campo.soloLectura && (
            <button
              className="boton boton--discreto boton--pequeno"
              type="button"
              disabled={deshabilitado}
              onClick={() => alLimpiar(campo.nombre)}
              aria-label={`Vaciar el campo «${campo.nombre}»`}
            >
              <IconoRestablecer className="boton__icono" />
              Vaciar
            </button>
          )}
        </>
      )}
    </div>
  )
}

interface PropiedadesControlCampo {
  readonly idControl: string
  readonly idDatos: string
  readonly campo: CampoDetectado
  readonly valor: ValorCampo
  readonly bloqueado: boolean
  readonly alCambiar: (nombre: string, valor: ValorCampo) => void
}

/** Control HTML que corresponde a la clase del campo. */
function ControlCampo({
  idControl,
  idDatos,
  campo,
  valor,
  bloqueado,
  alCambiar,
}: PropiedadesControlCampo) {
  if (campo.clase === 'texto-multilinea') {
    return (
      <textarea
        className="campo-texto campo-texto--area"
        id={idControl}
        rows={3}
        value={valor.clase === 'texto' ? valor.texto : ''}
        maxLength={campo.longitudMaxima ?? undefined}
        disabled={bloqueado}
        aria-describedby={idDatos}
        onChange={(evento) =>
          alCambiar(campo.nombre, {
            clase: 'texto',
            texto: evento.target.value,
          })
        }
      />
    )
  }

  if (campo.clase === 'texto') {
    return (
      <input
        className="campo-texto"
        id={idControl}
        type={campo.esContrasena ? 'password' : 'text'}
        value={valor.clase === 'texto' ? valor.texto : ''}
        maxLength={campo.longitudMaxima ?? undefined}
        autoComplete="off"
        disabled={bloqueado}
        aria-describedby={idDatos}
        onChange={(evento) =>
          alCambiar(campo.nombre, {
            clase: 'texto',
            texto: evento.target.value,
          })
        }
      />
    )
  }

  if (campo.clase === 'casilla') {
    return (
      <label className="casilla">
        <input
          className="casilla__campo"
          id={idControl}
          type="checkbox"
          checked={valor.clase === 'casilla' ? valor.marcada : false}
          disabled={bloqueado}
          aria-describedby={idDatos}
          onChange={(evento) =>
            alCambiar(campo.nombre, {
              clase: 'casilla',
              marcada: evento.target.checked,
            })
          }
        />
        <span className="casilla__texto">
          <span className="casilla__etiqueta">Marcar esta casilla</span>
        </span>
      </label>
    )
  }

  if (campo.clase === 'opcion') {
    const elegida = valor.clase === 'opcion' ? valor.elegida : null

    return (
      <fieldset className="grupo-radio" aria-describedby={idDatos}>
        <legend className="solo-lector-pantalla">
          Opciones de {campo.nombre}
        </legend>

        {campo.opciones.map((opcion) => (
          <label className="grupo-radio__opcion" key={opcion}>
            <input
              type="radio"
              name={idControl}
              value={opcion}
              checked={elegida === opcion}
              disabled={bloqueado}
              onChange={() =>
                alCambiar(campo.nombre, { clase: 'opcion', elegida: opcion })
              }
            />
            <span>{opcion}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  // Desplegables y listas de opciones.
  const elegidas = valor.clase === 'seleccion' ? valor.elegidas : []

  return (
    <select
      className="campo-seleccion"
      id={idControl}
      multiple={campo.multiseleccion}
      value={campo.multiseleccion ? [...elegidas] : (elegidas[0] ?? '')}
      disabled={bloqueado}
      aria-describedby={idDatos}
      onChange={(evento) => {
        const seleccionadas = campo.multiseleccion
          ? [...evento.target.selectedOptions].map((opcion) => opcion.value)
          : evento.target.value === ''
            ? []
            : [evento.target.value]

        alCambiar(campo.nombre, {
          clase: 'seleccion',
          elegidas: seleccionadas,
        })
      }}
    >
      {!campo.multiseleccion && <option value="">(sin elegir)</option>}
      {campo.opciones.map((opcion) => (
        <option key={opcion} value={opcion}>
          {opcion}
        </option>
      ))}
    </select>
  )
}

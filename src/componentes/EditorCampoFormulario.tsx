import { useId } from 'react'
import type { CampoNuevo, ClaseCampoNuevo } from '../formularios/tipos'
import {
  TAMANO_FUENTE_MAXIMO,
  TAMANO_FUENTE_MINIMO,
} from '../formularios/validarCamposFormulario'
import { CampoNumero } from './CampoNumero'
import { GrupoOpciones, type OpcionElegible } from './GrupoOpciones'
import { IconoPapelera } from './Iconos'
import { SelectorColor } from './SelectorColor'

/** Clases de campo que se pueden crear. */
const OPCIONES_CLASE: readonly OpcionElegible<ClaseCampoNuevo>[] = [
  { valor: 'texto', etiqueta: 'Texto' },
  { valor: 'texto-multilinea', etiqueta: 'Texto de varias líneas' },
  { valor: 'casilla', etiqueta: 'Casilla' },
  { valor: 'opcion', etiqueta: 'Botones de opción' },
  { valor: 'desplegable', etiqueta: 'Lista desplegable' },
  { valor: 'lista', etiqueta: 'Lista de opciones' },
]

/** `true` cuando la clase necesita una lista de opciones. */
function necesitaOpciones(clase: ClaseCampoNuevo): boolean {
  return clase === 'opcion' || clase === 'desplegable' || clase === 'lista'
}

interface PropiedadesEditorCampoFormulario {
  /** Campo que se está definiendo. */
  readonly campo: CampoNuevo
  /** Posición del campo dentro de la lista, empezando en 1. */
  readonly posicion: number
  /** Número de páginas del documento. */
  readonly numeroPaginas: number
  /** Mensaje de error de este campo, o `null`. */
  readonly mensajeError: string | null
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con los cambios parciales del campo. */
  readonly alCambiar: (cambios: Partial<CampoNuevo>) => void
  /** Quita el campo de la lista. */
  readonly alEliminar: () => void
}

/**
 * Editor de un campo de formulario que se va a crear.
 *
 * La posición y el tamaño se indican con campos numéricos en puntos PDF, no
 * arrastrando: así funciona con el teclado y con lector de pantalla sin añadir
 * ninguna dependencia. El origen de coordenadas es la esquina inferior izquierda de
 * la página, que es el del propio formato PDF, y se explica en la ayuda para que no
 * haya que adivinarlo.
 */
export function EditorCampoFormulario({
  campo,
  posicion,
  numeroPaginas,
  mensajeError,
  deshabilitado,
  alCambiar,
  alEliminar,
}: PropiedadesEditorCampoFormulario) {
  const idNombre = useId()
  const idOpciones = useId()
  const idValor = useId()
  const idAyuda = useId()
  const idError = useId()

  return (
    <section
      className="editor-campo"
      aria-label={`Campo ${posicion}: ${campo.nombre}`}
    >
      <div className="editor-campo__encabezado">
        <h4 className="editor-campo__titulo">Campo {posicion}</h4>

        <button
          className="boton-icono boton-icono--peligro"
          type="button"
          disabled={deshabilitado}
          onClick={alEliminar}
          aria-label={`Quitar el campo ${posicion}`}
        >
          <IconoPapelera className="boton-icono__icono" />
        </button>
      </div>

      <div className="campo-texto-bloque">
        <label className="campo-texto-bloque__etiqueta" htmlFor={idNombre}>
          Nombre técnico
        </label>
        <input
          className="campo-texto"
          id={idNombre}
          type="text"
          value={campo.nombre}
          autoComplete="off"
          spellCheck={false}
          disabled={deshabilitado}
          aria-invalid={mensajeError !== null}
          aria-describedby={
            mensajeError === null ? idAyuda : `${idAyuda} ${idError}`
          }
          onChange={(evento) => alCambiar({ nombre: evento.target.value })}
        />
        <p className="campo-texto-bloque__ayuda" id={idAyuda}>
          Es la clave con la que los programas identifican el campo. Sin espacios ni
          puntos, y distinta de cualquier otro campo del documento.
        </p>
        {mensajeError !== null && (
          <p className="campo-texto-bloque__error" id={idError}>
            {mensajeError}
          </p>
        )}
      </div>

      <GrupoOpciones
        etiqueta="Tipo de campo"
        opciones={OPCIONES_CLASE}
        valor={campo.clase}
        deshabilitado={deshabilitado}
        alCambiar={(clase) => alCambiar({ clase })}
        enColumna
      />

      {necesitaOpciones(campo.clase) && (
        <div className="campo-texto-bloque">
          <label className="campo-texto-bloque__etiqueta" htmlFor={idOpciones}>
            Opciones
          </label>
          <textarea
            className="campo-texto campo-texto--area"
            id={idOpciones}
            rows={4}
            value={campo.opciones.join('\n')}
            disabled={deshabilitado}
            onChange={(evento) =>
              alCambiar({ opciones: evento.target.value.split('\n') })
            }
          />
          <p className="campo-texto-bloque__ayuda">
            Una opción por línea. Hacen falta al menos dos y no pueden repetirse.
          </p>
        </div>
      )}

      <div className="campo-texto-bloque">
        <label className="campo-texto-bloque__etiqueta" htmlFor={idValor}>
          {campo.clase === 'casilla'
            ? 'Empezar marcada'
            : 'Valor predeterminado'}
        </label>
        <input
          className="campo-texto"
          id={idValor}
          type="text"
          value={campo.valorPredeterminado}
          autoComplete="off"
          disabled={deshabilitado}
          onChange={(evento) =>
            alCambiar({ valorPredeterminado: evento.target.value })
          }
        />
        <p className="campo-texto-bloque__ayuda">
          {campo.clase === 'casilla'
            ? 'Escribe «sí» para que la casilla aparezca marcada.'
            : necesitaOpciones(campo.clase)
              ? 'Debe coincidir exactamente con una de las opciones.'
              : 'Déjalo vacío para que el campo empiece sin contenido.'}
        </p>
      </div>

      <CampoNumero
        etiqueta="Página"
        valor={campo.pagina}
        minimo={1}
        maximo={Math.max(1, numeroPaginas)}
        paso={1}
        deshabilitado={deshabilitado}
        alCambiar={(pagina) => alCambiar({ pagina: Math.trunc(pagina) })}
        ayuda={`El documento tiene ${numeroPaginas} ${
          numeroPaginas === 1 ? 'página' : 'páginas'
        }.`}
      />

      <fieldset className="editor-campo__grupo">
        <legend className="editor-campo__leyenda">Posición y tamaño</legend>

        <p className="editor-campo__ayuda">
          En puntos PDF, midiendo desde la esquina inferior izquierda de la página.
          Una pulgada son 72 puntos.
        </p>

        <div className="rejilla-campos">
          <CampoNumero
            etiqueta="Desde la izquierda"
            valor={campo.rectangulo.x}
            minimo={0}
            maximo={2000}
            unidad="pt"
            deshabilitado={deshabilitado}
            alCambiar={(x) =>
              alCambiar({ rectangulo: { ...campo.rectangulo, x } })
            }
          />
          <CampoNumero
            etiqueta="Desde abajo"
            valor={campo.rectangulo.y}
            minimo={0}
            maximo={2000}
            unidad="pt"
            deshabilitado={deshabilitado}
            alCambiar={(y) =>
              alCambiar({ rectangulo: { ...campo.rectangulo, y } })
            }
          />
          <CampoNumero
            etiqueta="Ancho"
            valor={campo.rectangulo.ancho}
            minimo={8}
            maximo={2000}
            unidad="pt"
            deshabilitado={deshabilitado}
            alCambiar={(ancho) =>
              alCambiar({ rectangulo: { ...campo.rectangulo, ancho } })
            }
          />
          <CampoNumero
            etiqueta="Alto"
            valor={campo.rectangulo.alto}
            minimo={8}
            maximo={2000}
            unidad="pt"
            deshabilitado={deshabilitado}
            alCambiar={(alto) =>
              alCambiar({ rectangulo: { ...campo.rectangulo, alto } })
            }
          />
        </div>
      </fieldset>

      <fieldset className="editor-campo__grupo">
        <legend className="editor-campo__leyenda">Apariencia</legend>

        <CampoNumero
          etiqueta="Tamaño de la tipografía"
          valor={campo.tamanoFuente}
          minimo={TAMANO_FUENTE_MINIMO}
          maximo={TAMANO_FUENTE_MAXIMO}
          unidad="pt"
          deshabilitado={deshabilitado}
          alCambiar={(tamanoFuente) => alCambiar({ tamanoFuente })}
        />

        <SelectorColor
          etiqueta="Color del texto"
          valor={campo.colorTexto}
          deshabilitado={deshabilitado}
          alCambiar={(colorTexto) => alCambiar({ colorTexto })}
        />

        <SelectorColor
          etiqueta="Color del borde"
          valor={campo.colorBorde}
          deshabilitado={deshabilitado}
          alCambiar={(colorBorde) => alCambiar({ colorBorde })}
        />

        <SelectorColor
          etiqueta="Color de fondo"
          valor={campo.colorFondo}
          deshabilitado={deshabilitado}
          alCambiar={(colorFondo) => alCambiar({ colorFondo })}
        />

        <CampoNumero
          etiqueta="Grosor del borde"
          valor={campo.grosorBorde}
          minimo={0}
          maximo={10}
          unidad="pt"
          deshabilitado={deshabilitado}
          alCambiar={(grosorBorde) => alCambiar({ grosorBorde })}
        />
      </fieldset>

      <fieldset className="editor-campo__grupo">
        <legend className="editor-campo__leyenda">Comportamiento</legend>

        <label className="casilla">
          <input
            className="casilla__campo"
            type="checkbox"
            checked={campo.soloLectura}
            disabled={deshabilitado}
            onChange={(evento) =>
              alCambiar({ soloLectura: evento.target.checked })
            }
          />
          <span className="casilla__texto">
            <span className="casilla__etiqueta">Solo lectura</span>
            <span className="casilla__ayuda">
              El campo se muestra pero no se puede rellenar.
            </span>
          </span>
        </label>

        <label className="casilla">
          <input
            className="casilla__campo"
            type="checkbox"
            checked={campo.obligatorio}
            disabled={deshabilitado}
            onChange={(evento) =>
              alCambiar({ obligatorio: evento.target.checked })
            }
          />
          <span className="casilla__texto">
            <span className="casilla__etiqueta">Obligatorio</span>
            <span className="casilla__ayuda">
              Se marca como obligatorio en el documento. Que se exija de verdad
              depende del lector.
            </span>
          </span>
        </label>
      </fieldset>
    </section>
  )
}

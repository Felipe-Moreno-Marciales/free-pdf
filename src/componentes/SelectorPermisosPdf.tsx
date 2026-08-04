import { useId } from 'react'
import {
  describirImpresion,
  PERMISOS_PREDETERMINADOS,
} from '../seguridad/qpdf/permisosPdf'
import type { NivelImpresion, PermisosPdf } from '../seguridad/qpdf/tipos'
import { GrupoOpciones, type OpcionElegible } from './GrupoOpciones'

/** Niveles de impresión que se ofrecen. */
const NIVELES: readonly NivelImpresion[] = ['completa', 'baja', 'ninguna']

/** Opciones del grupo de impresión. */
const OPCIONES_IMPRESION: readonly OpcionElegible<NivelImpresion>[] =
  NIVELES.map((nivel) => ({ valor: nivel, etiqueta: describirImpresion(nivel) }))

/** Permisos booleanos, con su etiqueta y su aclaración. */
const PERMISOS_BOOLEANOS: readonly {
  readonly clave: keyof Omit<PermisosPdf, 'impresion'>
  readonly etiqueta: string
  readonly ayuda: string
}[] = [
  {
    clave: 'extraccion',
    etiqueta: 'Copiar texto e imágenes',
    ayuda: 'Permite seleccionar y copiar el contenido del documento.',
  },
  {
    clave: 'anotaciones',
    etiqueta: 'Añadir anotaciones',
    ayuda: 'Permite comentar y resaltar el documento.',
  },
  {
    clave: 'formularios',
    etiqueta: 'Rellenar formularios',
    ayuda: 'Permite escribir en los campos de formulario que ya existan.',
  },
  {
    clave: 'ensamblado',
    etiqueta: 'Reordenar páginas',
    ayuda: 'Permite insertar, girar y reordenar páginas.',
  },
  {
    clave: 'otrasModificaciones',
    etiqueta: 'Otras modificaciones',
    ayuda: 'Permite cambiar el contenido del documento.',
  },
]

interface PropiedadesSelectorPermisosPdf {
  /** Permisos actuales. */
  readonly permisos: PermisosPdf
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Se ejecuta con los cambios parciales de los permisos. */
  readonly alCambiar: (cambios: Partial<PermisosPdf>) => void
}

/**
 * Controles de los permisos que se graban en el documento cifrado.
 *
 * El aviso que los acompaña no es opcional: los permisos son una declaración que
 * cada lector PDF decide respetar o no. Lo único que protege de verdad es la
 * contraseña de apertura, que cifra el contenido. Conviene que eso quede claro
 * antes de elegir nada.
 */
export function SelectorPermisosPdf({
  permisos,
  deshabilitado,
  alCambiar,
}: PropiedadesSelectorPermisosPdf) {
  const idAviso = useId()

  return (
    <div className="permisos-pdf">
      <div className="aviso-informativo" role="note" id={idAviso}>
        <p className="aviso-informativo__texto">
          Los permisos dependen de que el lector PDF decida respetarlos: son una
          declaración, no una barrera técnica.{' '}
          <strong>La contraseña de apertura sí cifra el contenido</strong> y sin
          ella el documento no se puede leer.
        </p>
      </div>

      <GrupoOpciones
        etiqueta="Impresión"
        opciones={OPCIONES_IMPRESION}
        valor={permisos.impresion}
        deshabilitado={deshabilitado}
        alCambiar={(impresion) => alCambiar({ impresion })}
      />

      <fieldset className="permisos-pdf__grupo">
        <legend className="permisos-pdf__titulo">Otros permisos</legend>

        <p className="permisos-pdf__nota">
          La extracción de contenido para tecnología asistiva{' '}
          <strong>se permite siempre</strong>. Con AES de 256 bits ese permiso
          desapareció de la especificación PDF, así que no se ofrece un control
          que no tendría ningún efecto: un lector de pantalla podrá leer el
          documento en cuanto se abra con la contraseña.
        </p>

        <ul className="permisos-pdf__lista">
          {PERMISOS_BOOLEANOS.map(({ clave, etiqueta, ayuda }) => (
            <li className="permisos-pdf__elemento" key={clave}>
              <label className="casilla">
                <input
                  className="casilla__campo"
                  type="checkbox"
                  checked={permisos[clave]}
                  disabled={deshabilitado}
                  onChange={(evento) =>
                    alCambiar({ [clave]: evento.target.checked })
                  }
                />
                <span className="casilla__texto">
                  <span className="casilla__etiqueta">{etiqueta}</span>
                  <span className="casilla__ayuda">{ayuda}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <button
        className="boton boton--discreto"
        type="button"
        disabled={deshabilitado}
        onClick={() => alCambiar(PERMISOS_PREDETERMINADOS)}
      >
        Volver a los permisos recomendados
      </button>
    </div>
  )
}

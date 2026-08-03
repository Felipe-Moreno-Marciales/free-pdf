import type { CapturaEscaneada } from '../funcionalidades/escanear-a-pdf/tipos'
import {
  AJUSTE_MAXIMO,
  AJUSTE_MINIMO,
  describirFiltro,
} from '../imagenes/aplicarFiltrosImagen'
import {
  dimensionesTrasRecortar,
  FRACCION_MINIMA_RESTANTE,
} from '../imagenes/recorteImagen'
import { dimensionesTrasRotar } from '../imagenes/orientacionImagen'
import type {
  AjustesImagen,
  FiltroImagen,
  RecorteRelativo,
} from '../imagenes/tipos'
import { CampoNumero } from './CampoNumero'
import { ControlDeslizante } from './ControlDeslizante'
import { GrupoOpciones, type OpcionElegible } from './GrupoOpciones'
import { IconoRestablecer } from './Iconos'
import { MiniaturaImagen } from './MiniaturaImagen'

/** Filtros que se ofrecen. */
const FILTROS: readonly FiltroImagen[] = [
  'original',
  'grises',
  'blanco-y-negro',
]

/** Opciones del grupo de filtros. */
const OPCIONES_FILTRO: readonly OpcionElegible<FiltroImagen>[] = FILTROS.map(
  (filtro) => ({ valor: filtro, etiqueta: describirFiltro(filtro) }),
)

/** Lados del recorte, con su etiqueta. */
const LADOS: readonly {
  readonly clave: keyof RecorteRelativo
  readonly etiqueta: string
}[] = [
  { clave: 'superior', etiqueta: 'Recortar por arriba' },
  { clave: 'derecha', etiqueta: 'Recortar por la derecha' },
  { clave: 'inferior', etiqueta: 'Recortar por abajo' },
  { clave: 'izquierda', etiqueta: 'Recortar por la izquierda' },
]

/** Porcentaje máximo que se admite recortar por un lado. */
const MAXIMO_POR_LADO = Math.round((1 - FRACCION_MINIMA_RESTANTE) * 100)

interface PropiedadesEditorPaginaEscaneada {
  /** Captura que se está editando. */
  readonly captura: CapturaEscaneada
  /** Posición de la captura dentro de la lista, empezando en 1. */
  readonly posicion: number
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Cambia los ajustes de color. */
  readonly alCambiarAjustes: (cambios: Partial<AjustesImagen>) => void
  /** Cambia el recorte. */
  readonly alCambiarRecorte: (cambios: Partial<RecorteRelativo>) => void
  /** Quita el recorte. */
  readonly alQuitarRecorte: () => void
  /** Cierra el editor. */
  readonly alCerrar: () => void
}

/**
 * Editor de una captura antes de generar el documento.
 *
 * El recorte se ajusta con campos numéricos en porcentaje, no arrastrando: así
 * funciona con el teclado y con lector de pantalla, y la miniatura muestra el
 * resultado en cuanto se cambia un valor.
 *
 * No hay detección automática de bordes: el recorte es siempre el que se indique
 * a mano. Los filtros se aplican con un `canvas` del propio navegador.
 */
export function EditorPaginaEscaneada({
  captura,
  posicion,
  deshabilitado,
  alCambiarAjustes,
  alCambiarRecorte,
  alQuitarRecorte,
  alCerrar,
}: PropiedadesEditorPaginaEscaneada) {
  const recorte: RecorteRelativo = captura.recorte ?? {
    izquierda: 0,
    superior: 0,
    derecha: 0,
    inferior: 0,
  }

  const dimensionesFinales =
    captura.dimensiones === null
      ? null
      : dimensionesTrasRecortar(
          dimensionesTrasRotar(captura.dimensiones, captura.rotacion),
          captura.recorte,
        )

  return (
    <section
      className="editor-captura"
      aria-label={`Ajustes de la página ${posicion}: ${captura.nombre}`}
    >
      <div className="editor-captura__vista">
        <MiniaturaImagen
          contenido={captura.contenido}
          nombre={captura.nombre}
          rotacion={captura.rotacion}
          recorte={captura.recorte}
          ajustes={captura.ajustes}
          descripcion={`Vista previa de la página ${posicion} con los ajustes aplicados.`}
        />

        <p className="editor-captura__medidas">
          {dimensionesFinales === null
            ? 'Leyendo las medidas de la captura…'
            : `La imagen final medirá ${dimensionesFinales.ancho} × ${dimensionesFinales.alto} píxeles.`}
        </p>
      </div>

      <div className="editor-captura__controles">
        <GrupoOpciones
          etiqueta="Aspecto"
          opciones={OPCIONES_FILTRO}
          valor={captura.ajustes.filtro}
          deshabilitado={deshabilitado}
          alCambiar={(filtro) => alCambiarAjustes({ filtro })}
          ayuda="El filtro se aplica en tu navegador, sobre un lienzo; la imagen no sale del dispositivo."
        />

        <ControlDeslizante
          etiqueta="Brillo"
          valor={captura.ajustes.brillo}
          minimo={AJUSTE_MINIMO}
          maximo={AJUSTE_MAXIMO}
          paso={5}
          valorLegible={formatearAjuste(captura.ajustes.brillo)}
          deshabilitado={deshabilitado}
          alCambiar={(brillo) => alCambiarAjustes({ brillo })}
        />

        <ControlDeslizante
          etiqueta="Contraste"
          valor={captura.ajustes.contraste}
          minimo={AJUSTE_MINIMO}
          maximo={AJUSTE_MAXIMO}
          paso={5}
          valorLegible={formatearAjuste(captura.ajustes.contraste)}
          deshabilitado={deshabilitado}
          alCambiar={(contraste) => alCambiarAjustes({ contraste })}
        />

        <fieldset className="editor-captura__recorte">
          <legend className="editor-captura__leyenda">Recorte</legend>

          <p className="editor-captura__ayuda">
            Indica qué porcentaje quieres descartar por cada lado. No hay
            detección automática de bordes: el recorte es el que indiques aquí.
          </p>

          <div className="rejilla-campos">
            {LADOS.map(({ clave, etiqueta }) => (
              <CampoNumero
                key={clave}
                etiqueta={etiqueta}
                valor={Math.round(recorte[clave] * 100)}
                minimo={0}
                maximo={MAXIMO_POR_LADO}
                paso={1}
                unidad="%"
                deshabilitado={deshabilitado}
                alCambiar={(valor) =>
                  alCambiarRecorte({ [clave]: valor / 100 })
                }
              />
            ))}
          </div>

          <button
            className="boton boton--discreto"
            type="button"
            disabled={deshabilitado || captura.recorte === null}
            onClick={alQuitarRecorte}
          >
            <IconoRestablecer className="boton__icono" />
            Quitar el recorte
          </button>
        </fieldset>

        <button
          className="boton boton--secundario"
          type="button"
          onClick={alCerrar}
        >
          Cerrar los ajustes de esta página
        </button>
      </div>
    </section>
  )
}

/** Da formato a un ajuste de brillo o contraste, con su signo. */
function formatearAjuste(valor: number): string {
  if (valor === 0) {
    return 'sin cambios'
  }

  return valor > 0 ? `+${valor}` : String(valor)
}

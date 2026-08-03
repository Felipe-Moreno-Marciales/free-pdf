import type { PDFDocumentProxy } from 'pdfjs-dist'
import { normalizarZona } from '../seguridad/censura/coordenadasCensura'
import type { ZonaCensura } from '../seguridad/censura/tipos'
import { CampoNumero } from './CampoNumero'
import { IconoPapelera } from './Iconos'
import { MiniaturaPaginaPdf } from './MiniaturaPaginaPdf'

interface PropiedadesEditorCensura {
  /** Documento abierto con PDF.js. */
  readonly documento: PDFDocumentProxy
  /** Página que se está viendo, empezando en 1. */
  readonly numeroPagina: number
  /** Zonas de esa página. */
  readonly zonas: readonly ZonaCensura[]
  /** Color con el que se pintarán las zonas. */
  readonly color: string
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Cambia una zona. */
  readonly alCambiar: (id: string, cambios: Partial<ZonaCensura>) => void
  /** Quita una zona. */
  readonly alEliminar: (id: string) => void
}

/**
 * Editor de las zonas de censura de una página.
 *
 * La página se muestra con su miniatura real y las zonas se superponen para poder
 * comprobar qué se va a tapar. Esa superposición es **solo la vista previa**: la
 * censura de verdad se pinta sobre los píxeles al generar el documento.
 *
 * Las zonas se ajustan con campos numéricos en porcentaje, no arrastrando. Es
 * deliberado: unos controles numéricos funcionan con el teclado y con lector de
 * pantalla, y no exigen añadir ninguna dependencia. Además, en una herramienta de
 * seguridad conviene poder indicar una medida exacta.
 */
export function EditorCensura({
  documento,
  numeroPagina,
  zonas,
  color,
  deshabilitado,
  alCambiar,
  alEliminar,
}: PropiedadesEditorCensura) {
  return (
    <div className="editor-censura">
      <figure className="editor-censura__vista">
        <div className="editor-censura__lienzo">
          <MiniaturaPaginaPdf
            documento={documento}
            numeroPagina={numeroPagina}
            rotacion={0}
          />

          {zonas.map((zona) => {
            const normalizada = normalizarZona(zona)

            return (
              <span
                className="editor-censura__zona"
                key={zona.id}
                style={{
                  left: `${normalizada.izquierda * 100}%`,
                  top: `${normalizada.superior * 100}%`,
                  width: `${normalizada.ancho * 100}%`,
                  height: `${normalizada.alto * 100}%`,
                  backgroundColor: color,
                }}
                aria-hidden="true"
              />
            )
          })}
        </div>

        <figcaption className="editor-censura__texto">
          Página {numeroPagina} con {zonas.length}{' '}
          {zonas.length === 1 ? 'zona marcada' : 'zonas marcadas'}. Es una vista
          previa: la censura se aplica sobre los píxeles al generar el documento.
        </figcaption>
      </figure>

      <div className="editor-censura__zonas">
        {zonas.length === 0 ? (
          <p className="campos-formulario__vacio">
            Esta página no tiene ninguna zona marcada.
          </p>
        ) : (
          <ol className="editor-censura__lista">
            {zonas.map((zona, indice) => (
              <li className="editor-censura__elemento" key={zona.id}>
                <div className="editor-censura__encabezado">
                  <h4 className="editor-censura__titulo">Zona {indice + 1}</h4>

                  {zona.origen === 'busqueda' &&
                    zona.textoEncontrado !== undefined && (
                      <span className="etiqueta-dato">
                        «{zona.textoEncontrado}»
                      </span>
                    )}

                  <button
                    className="boton-icono boton-icono--peligro"
                    type="button"
                    disabled={deshabilitado}
                    onClick={() => alEliminar(zona.id)}
                    aria-label={`Quitar la zona ${indice + 1} de la página ${numeroPagina}`}
                  >
                    <IconoPapelera className="boton-icono__icono" />
                  </button>
                </div>

                <div className="rejilla-campos">
                  <CampoNumero
                    etiqueta="Desde la izquierda"
                    valor={Math.round(zona.izquierda * 100)}
                    minimo={0}
                    maximo={100}
                    unidad="%"
                    deshabilitado={deshabilitado}
                    alCambiar={(valor) =>
                      alCambiar(zona.id, { izquierda: valor / 100 })
                    }
                  />
                  <CampoNumero
                    etiqueta="Desde arriba"
                    valor={Math.round(zona.superior * 100)}
                    minimo={0}
                    maximo={100}
                    unidad="%"
                    deshabilitado={deshabilitado}
                    alCambiar={(valor) =>
                      alCambiar(zona.id, { superior: valor / 100 })
                    }
                  />
                  <CampoNumero
                    etiqueta="Ancho"
                    valor={Math.round(zona.ancho * 100)}
                    minimo={1}
                    maximo={100}
                    unidad="%"
                    deshabilitado={deshabilitado}
                    alCambiar={(valor) =>
                      alCambiar(zona.id, { ancho: valor / 100 })
                    }
                  />
                  <CampoNumero
                    etiqueta="Alto"
                    valor={Math.round(zona.alto * 100)}
                    minimo={1}
                    maximo={100}
                    unidad="%"
                    deshabilitado={deshabilitado}
                    alCambiar={(valor) =>
                      alCambiar(zona.id, { alto: valor / 100 })
                    }
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

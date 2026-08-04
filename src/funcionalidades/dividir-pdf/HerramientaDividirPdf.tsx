import { useId } from 'react'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import { IconoDividir, IconoPaquete } from '../../componentes/Iconos'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import type { ModoDivision } from './tipos'
import { useDividirPdf } from './useDividirPdf'

/** Modos de división que se ofrecen, con su texto explicativo. */
const MODOS: readonly {
  readonly modo: ModoDivision
  readonly etiqueta: string
  readonly ayuda: string
}[] = [
  {
    modo: 'rangos',
    etiqueta: 'Dividir por rangos',
    ayuda: 'Cada rango que escribas se convierte en un documento independiente.',
  },
  {
    modo: 'cada-pagina',
    etiqueta: 'Dividir cada página',
    ayuda: 'Cada página del documento se convierte en un PDF independiente.',
  },
]

/** Interfaz de la herramienta para dividir un documento en varios PDF. */
export function HerramientaDividirPdf() {
  const {
    documento,
    estado,
    modo,
    expresion,
    grupos,
    mensajeRangos,
    procesando,
    resultado,
    mensajeError,
    puedeDividir,
    establecerModo,
    establecerExpresion,
    dividir,
    descargarResultado,
  } = useDividirPdf()

  const idCampoRangos = useId()
  const idAyudaRangos = useId()
  const cargado = documento.documento
  const bloqueado = procesando || documento.cargando

  return (
    <div className="herramienta__cuerpo">
      <CargadorDocumentoPdf
        documento={cargado}
        deshabilitado={bloqueado}
        alSeleccionarArchivos={documento.seleccionarArchivos}
        alRestablecer={documento.restablecer}
      />

      {cargado !== null && (
        <>
          <fieldset className="grupo-opciones" disabled={bloqueado}>
            <legend className="grupo-opciones__titulo">
              Forma de dividir el documento
            </legend>

            {MODOS.map((opcion) => (
              <label className="opcion" key={opcion.modo}>
                <input
                  className="opcion__control"
                  type="radio"
                  name="modo-division"
                  value={opcion.modo}
                  checked={modo === opcion.modo}
                  onChange={() => establecerModo(opcion.modo)}
                />
                <span className="opcion__texto">
                  <span className="opcion__etiqueta">{opcion.etiqueta}</span>
                  <span className="opcion__ayuda">{opcion.ayuda}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {modo === 'rangos' && (
            <div className="campo">
              <label className="campo__etiqueta" htmlFor={idCampoRangos}>
                Rangos de páginas
              </label>
              <input
                className="campo-texto"
                id={idCampoRangos}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="1-3, 5, 8-10"
                value={expresion}
                disabled={bloqueado}
                aria-describedby={idAyudaRangos}
                aria-invalid={mensajeRangos !== null}
                onChange={(evento) => establecerExpresion(evento.target.value)}
              />
              <p className="campo__ayuda" id={idAyudaRangos}>
                Escribe páginas sueltas y rangos separados por comas. El
                documento tiene {cargado.numeroPaginas}{' '}
                {cargado.numeroPaginas === 1 ? 'página' : 'páginas'}.
              </p>
            </div>
          )}

          <section className="previsualizacion" aria-live="polite">
            <h3 className="previsualizacion__titulo">
              Documentos que se generarán
            </h3>

            {mensajeRangos !== null ? (
              <p className="previsualizacion__vacia">{mensajeRangos}</p>
            ) : grupos.length === 0 ? (
              <p className="previsualizacion__vacia">
                {modo === 'rangos'
                  ? 'Escribe al menos un rango para ver el resultado.'
                  : 'Todavía no hay páginas que dividir.'}
              </p>
            ) : (
              <>
                <p className="previsualizacion__resumen">
                  Se generarán {grupos.length}{' '}
                  {grupos.length === 1 ? 'documento' : 'documentos'} dentro de un
                  único archivo ZIP.
                </p>
                <ol className="previsualizacion__lista">
                  {grupos.map((grupo) => (
                    <li
                      className="previsualizacion__elemento"
                      key={grupo.nombreArchivo}
                    >
                      <span className="previsualizacion__nombre">
                        {grupo.nombreArchivo}
                      </span>
                      <span className="previsualizacion__detalle">
                        {grupo.descripcion}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeDividir}
              onClick={dividir}
            >
              <IconoDividir className="boton__icono" />
              {procesando ? 'Dividiendo…' : 'Dividir PDF'}
            </button>

            {resultado !== null && (
              <button
                className="boton boton--secundario"
                type="button"
                onClick={descargarResultado}
              >
                <IconoPaquete className="boton__icono" />
                Descargar {resultado.nombreArchivo}
              </button>
            )}
          </div>
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Dividiendo el documento y preparando el ZIP.',
        )}
        textoExito={
          resultado === null
            ? null
            : `Se generaron ${resultado.documentos.length} ${
                resultado.documentos.length === 1 ? 'documento' : 'documentos'
              } en «${resultado.nombreArchivo}» (${formatearTamanoArchivo(
                resultado.tamano,
              )}). La descarga se ha iniciado automáticamente.`
        }
        textoAviso={documento.mensajeAviso}
        textoError={mensajeError}
      />
    </div>
  )
}

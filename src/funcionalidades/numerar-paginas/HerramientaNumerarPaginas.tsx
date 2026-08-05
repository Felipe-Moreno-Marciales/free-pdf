import { useId } from 'react'
import { CampoNumero } from '../../componentes/CampoNumero'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { ControlDeslizante } from '../../componentes/ControlDeslizante'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../../componentes/GrupoOpciones'
import {
  IconoDescargar,
  IconoNumerarPaginas,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { SelectorColor } from '../../componentes/SelectorColor'
import { SelectorPosicion } from '../../componentes/SelectorPosicion'
import { SelectorRangoPaginas } from '../../componentes/SelectorRangoPaginas'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { POSICIONES_NUMERACION } from '../../pdf/posicionarEnPagina'
import { NOMBRE_TIPOGRAFIA } from '../../pdf/textoEstandar'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import {
  MARGEN_MAXIMO_MM,
  NUMERO_INICIAL_MAXIMO,
  NUMERO_INICIAL_MINIMO,
  OPACIDAD_MAXIMA,
  OPACIDAD_MINIMA,
  TAMANO_MAXIMO,
  TAMANO_MINIMO,
} from './numerarPaginas'
import {
  describirPlantilla,
  LONGITUD_MAXIMA_PLANTILLA,
  MARCADOR_PAGINA,
  MARCADOR_TOTAL,
  PLANTILLAS,
  type ClavePlantilla,
} from './plantillaNumeracion'
import { useNumerarPaginas } from './useNumerarPaginas'

/** Plantillas que se ofrecen, en el orden en el que se muestran. */
const CLAVES_PLANTILLA: readonly ClavePlantilla[] = [
  'numero',
  'pagina-numero',
  'numero-de-total',
  'pagina-numero-de-total',
  'personalizada',
]

/** Opciones del grupo de plantillas, con su texto como aclaración. */
const OPCIONES_PLANTILLA: readonly OpcionElegible<ClavePlantilla>[] =
  CLAVES_PLANTILLA.map((clave) => ({
    valor: clave,
    etiqueta: describirPlantilla(clave),
    descripcion:
      clave === 'personalizada'
        ? `Escribe tu propio texto con ${MARCADOR_PAGINA} y ${MARCADOR_TOTAL}.`
        : PLANTILLAS[clave],
  }))

/** Interfaz de la herramienta para numerar páginas. */
export function HerramientaNumerarPaginas() {
  const idPlantillaPropia = useId()
  const idAyudaPlantilla = useId()
  const idErrorPlantilla = useId()

  const {
    documento,
    proceso,
    configuracion,
    estado,
    bloqueado,
    mensajeError,
    indicesAfectados,
    mensajeRangos,
    vistaPrevia,
    puedeNumerar,
    cambiarConfiguracion,
    cambiarApariencia,
    cambiarPlantilla,
    cambiarPosicion,
    cambiarAlcance,
    cambiarExpresion,
    restablecerConfiguracion,
    restablecer,
    numerar,
  } = useNumerarPaginas()

  const cargado = documento.documento

  return (
    <div className="herramienta__cuerpo">
      <CargadorDocumentoPdf
        documento={cargado}
        deshabilitado={bloqueado}
        alSeleccionarArchivos={documento.seleccionarArchivos}
        alRestablecer={restablecer}
      />

      {cargado !== null && (
        <>
          <p className="herramienta__instrucciones">
            Elige el texto, la posición y la apariencia del número. Se usa la
            tipografía {NOMBRE_TIPOGRAFIA}, que el formato PDF incluye de serie:
            no se descarga ninguna tipografía externa.
          </p>

          <div className="panel-ajustes">
            <div className="panel-ajustes__controles">
              <GrupoOpciones
                etiqueta="Texto de la numeración"
                opciones={OPCIONES_PLANTILLA}
                valor={configuracion.plantilla}
                deshabilitado={bloqueado}
                alCambiar={cambiarPlantilla}
                enColumna
              />

              {configuracion.plantilla === 'personalizada' && (
                <div className="campo-texto-bloque">
                  <label
                    className="campo-texto-bloque__etiqueta"
                    htmlFor={idPlantillaPropia}
                  >
                    Texto propio
                  </label>
                  <input
                    className="campo-texto"
                    id={idPlantillaPropia}
                    type="text"
                    value={configuracion.plantillaPropia}
                    maxLength={LONGITUD_MAXIMA_PLANTILLA}
                    autoComplete="off"
                    disabled={bloqueado}
                    aria-invalid={vistaPrevia.mensajePlantilla !== null}
                    aria-describedby={
                      vistaPrevia.mensajePlantilla === null
                        ? idAyudaPlantilla
                        : `${idAyudaPlantilla} ${idErrorPlantilla}`
                    }
                    onChange={(evento) =>
                      cambiarConfiguracion({
                        plantillaPropia: evento.target.value,
                      })
                    }
                  />
                  <p
                    className="campo-texto-bloque__ayuda"
                    id={idAyudaPlantilla}
                  >
                    Los únicos marcadores admitidos son {MARCADOR_PAGINA} y{' '}
                    {MARCADOR_TOTAL}.
                  </p>
                  {vistaPrevia.mensajePlantilla !== null && (
                    <p
                      className="campo-texto-bloque__error"
                      id={idErrorPlantilla}
                    >
                      {vistaPrevia.mensajePlantilla}
                    </p>
                  )}
                </div>
              )}

              <CampoNumero
                etiqueta="Número de la primera página"
                valor={configuracion.numeroInicial}
                minimo={NUMERO_INICIAL_MINIMO}
                maximo={NUMERO_INICIAL_MAXIMO}
                paso={1}
                deshabilitado={bloqueado}
                alCambiar={(numeroInicial) =>
                  cambiarConfiguracion({ numeroInicial })
                }
                ayuda={`A partir de ahí se cuenta de uno en uno. El marcador ${MARCADOR_TOTAL} valdrá ${vistaPrevia.total}, que es el número de la última página del documento.`}
              />

              <SelectorRangoPaginas
                alcance={configuracion.alcance}
                expresion={configuracion.expresion}
                numeroPaginas={cargado.numeroPaginas}
                indicesAfectados={indicesAfectados}
                mensajeError={mensajeRangos}
                deshabilitado={bloqueado}
                alCambiarAlcance={cambiarAlcance}
                alCambiarExpresion={cambiarExpresion}
              />

              <SelectorPosicion
                etiqueta="Posición en la página"
                posiciones={POSICIONES_NUMERACION}
                valor={configuracion.posicion}
                deshabilitado={bloqueado}
                alCambiar={cambiarPosicion}
                ayuda="La posición se aplica sobre la página tal y como se ve, así que en las páginas apaisadas el número aparece derecho."
              />

              <CampoNumero
                etiqueta="Tamaño de la tipografía"
                valor={configuracion.apariencia.tamanoFuente}
                minimo={TAMANO_MINIMO}
                maximo={TAMANO_MAXIMO}
                paso={1}
                unidad="pt"
                deshabilitado={bloqueado}
                alCambiar={(tamanoFuente) =>
                  cambiarApariencia({ tamanoFuente })
                }
              />

              <SelectorColor
                etiqueta="Color del número"
                valor={configuracion.apariencia.color}
                deshabilitado={bloqueado}
                alCambiar={(color) => cambiarApariencia({ color })}
              />

              <ControlDeslizante
                etiqueta="Opacidad"
                valor={configuracion.apariencia.opacidadPorcentaje}
                minimo={OPACIDAD_MINIMA}
                maximo={OPACIDAD_MAXIMA}
                paso={5}
                valorLegible={`${configuracion.apariencia.opacidadPorcentaje} %`}
                deshabilitado={bloqueado}
                alCambiar={(opacidadPorcentaje) =>
                  cambiarApariencia({ opacidadPorcentaje })
                }
              />

              <CampoNumero
                etiqueta="Margen horizontal"
                valor={configuracion.apariencia.margenHorizontalMm}
                minimo={0}
                maximo={MARGEN_MAXIMO_MM}
                paso={1}
                unidad="mm"
                deshabilitado={bloqueado}
                alCambiar={(margenHorizontalMm) =>
                  cambiarApariencia({ margenHorizontalMm })
                }
              />

              <CampoNumero
                etiqueta="Margen vertical"
                valor={configuracion.apariencia.margenVerticalMm}
                minimo={0}
                maximo={MARGEN_MAXIMO_MM}
                paso={1}
                unidad="mm"
                deshabilitado={bloqueado}
                alCambiar={(margenVerticalMm) =>
                  cambiarApariencia({ margenVerticalMm })
                }
              />
            </div>

            <div className="panel-ajustes__vista">
              <h3 className="panel-ajustes__titulo">Vista previa del texto</h3>

              {vistaPrevia.primerTexto === null ? (
                <p className="panel-ajustes__ayuda">
                  {vistaPrevia.mensajePlantilla ??
                    'Elige al menos una página para ver el texto resultante.'}
                </p>
              ) : (
                <>
                  <p
                    className="vista-previa-texto"
                    style={{
                      color: configuracion.apariencia.color,
                      opacity:
                        configuracion.apariencia.opacidadPorcentaje / 100,
                    }}
                  >
                    {vistaPrevia.primerTexto}
                  </p>

                  <p className="panel-ajustes__ayuda">
                    Es el texto de la primera página afectada.
                    {vistaPrevia.ultimoTexto !== null &&
                      ` En la última se escribirá «${vistaPrevia.ultimoTexto}».`}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeNumerar}
              onClick={numerar}
            >
              <IconoNumerarPaginas className="boton__icono" />
              {proceso.procesando ? 'Numerando…' : 'Guardar PDF numerado'}
            </button>

            {proceso.resultado !== null && (
              <button
                className="boton boton--secundario"
                type="button"
                onClick={proceso.descargarResultado}
              >
                <IconoDescargar className="boton__icono" />
                Descargar {proceso.resultado.nombreArchivo}
              </button>
            )}

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado}
              onClick={restablecerConfiguracion}
            >
              <IconoRestablecer className="boton__icono" />
              Restablecer opciones
            </button>
          </div>
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Escribiendo la numeración en el documento.',
        )}
        textoExito={
          proceso.resultado === null
            ? null
            : `Documento guardado con ${proceso.resultado.numeroPaginas} ${
                proceso.resultado.numeroPaginas === 1 ? 'página' : 'páginas'
              } y ${formatearTamanoArchivo(
                proceso.resultado.tamano,
              )}. La descarga se ha iniciado automáticamente.`
        }
        textoAviso={documento.mensajeAviso}
        textoError={mensajeError}
      />
    </div>
  )
}

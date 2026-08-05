import { BarraAccionesPaginas } from '../../componentes/BarraAccionesPaginas'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { CuadriculaPaginasPdf } from '../../componentes/CuadriculaPaginasPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import { IconoDescargar, IconoExtraer } from '../../componentes/Iconos'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useExtraerPaginas } from './useExtraerPaginas'

/** Interfaz de la herramienta para extraer páginas en un documento nuevo. */
export function HerramientaExtraerPaginas() {
  const {
    documento,
    seleccion,
    proceso,
    estado,
    bloqueado,
    mensajeError,
    paginas,
    puedeExtraer,
    extraer,
  } = useExtraerPaginas()

  const cargado = documento.documento

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
          <p className="herramienta__instrucciones">
            Marca las páginas que quieras conservar. Se reunirán en un documento
            nuevo respetando el orden original.
          </p>

          <BarraAccionesPaginas
            seleccion={seleccion}
            numeroPaginas={cargado.numeroPaginas}
            deshabilitada={bloqueado}
          />

          <p className="herramienta__resumen">
            {seleccion.numeroSeleccionadas === 0
              ? 'No hay ninguna página marcada.'
              : `${seleccion.numeroSeleccionadas} de ${cargado.numeroPaginas} ${
                  cargado.numeroPaginas === 1 ? 'página' : 'páginas'
                } marcadas: ${seleccion.resumen}.`}
          </p>

          <CuadriculaPaginasPdf
            documento={cargado.abierto.documento}
            idDocumento={cargado.seleccionado.id}
            paginas={paginas}
            deshabilitada={bloqueado}
            alAlternarPagina={seleccion.alternarPagina}
            alReordenar={null}
            renderizarAcciones={null}
            textoSeleccion="marcada para extraer"
            mostrarPosicion={false}
          />

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeExtraer}
              onClick={extraer}
            >
              <IconoExtraer className="boton__icono" />
              {proceso.procesando ? 'Extrayendo…' : 'Extraer páginas'}
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
          </div>

          {seleccion.numeroSeleccionadas === 0 && (
            <p className="herramienta__requisito">
              Marca al menos una página para poder extraerla.
            </p>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Extrayendo las páginas marcadas.',
        )}
        textoExito={
          proceso.resultado === null
            ? null
            : `Documento creado con ${proceso.resultado.numeroPaginas} ${
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

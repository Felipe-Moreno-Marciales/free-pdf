import { BarraAccionesPaginas } from '../../componentes/BarraAccionesPaginas'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { CuadriculaPaginasPdf } from '../../componentes/CuadriculaPaginasPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoDescargar,
  IconoEliminarPaginas,
} from '../../componentes/Iconos'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useEliminarPaginas } from './useEliminarPaginas'

/** Interfaz de la herramienta para eliminar páginas de un documento. */
export function HerramientaEliminarPaginas() {
  const {
    documento,
    seleccion,
    proceso,
    estado,
    bloqueado,
    mensajeError,
    paginas,
    numeroAEliminar,
    numeroRestantes,
    seEliminarianTodas,
    puedeEliminar,
    eliminar,
  } = useEliminarPaginas()

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
            <strong>Las páginas que marques se eliminarán.</strong> El documento
            resultante conservará el resto en su orden original.
          </p>

          <BarraAccionesPaginas
            seleccion={seleccion}
            numeroPaginas={cargado.numeroPaginas}
            deshabilitada={bloqueado}
          />

          <div className="herramienta__balance">
            <p className="herramienta__balance-dato">
              <span className="herramienta__balance-numero">
                {numeroAEliminar}
              </span>
              <span>
                {numeroAEliminar === 1
                  ? 'página se eliminará'
                  : 'páginas se eliminarán'}
              </span>
            </p>
            <p className="herramienta__balance-dato">
              <span className="herramienta__balance-numero">
                {numeroRestantes}
              </span>
              <span>
                {numeroRestantes === 1
                  ? 'página permanecerá'
                  : 'páginas permanecerán'}
              </span>
            </p>
          </div>

          {numeroAEliminar > 0 && (
            <p className="herramienta__resumen">
              Se eliminarán estas páginas: {seleccion.resumen}.
            </p>
          )}

          <CuadriculaPaginasPdf
            documento={cargado.abierto.documento}
            idDocumento={cargado.seleccionado.id}
            paginas={paginas}
            deshabilitada={bloqueado}
            alAlternarPagina={seleccion.alternarPagina}
            alReordenar={null}
            renderizarAcciones={null}
            textoSeleccion="marcada para eliminar"
            mostrarPosicion={false}
          />

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeEliminar}
              onClick={eliminar}
            >
              <IconoEliminarPaginas className="boton__icono" />
              {proceso.procesando ? 'Eliminando…' : 'Eliminar páginas'}
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

          {seEliminarianTodas ? (
            <p className="herramienta__requisito">
              No se pueden eliminar todas las páginas. Deja al menos una sin
              marcar.
            </p>
          ) : (
            numeroAEliminar === 0 && (
              <p className="herramienta__requisito">
                Marca al menos una página para poder eliminarla.
              </p>
            )
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Eliminando las páginas marcadas.',
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

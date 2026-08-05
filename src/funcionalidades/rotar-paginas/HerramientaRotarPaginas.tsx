import { BarraAccionesPaginas } from '../../componentes/BarraAccionesPaginas'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { CuadriculaPaginasPdf } from '../../componentes/CuadriculaPaginasPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoDescargar,
  IconoMediaVuelta,
  IconoRestablecer,
  IconoRotarDerecha,
  IconoRotarIzquierda,
} from '../../componentes/Iconos'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useRotarPaginas } from './useRotarPaginas'

/** Interfaz de la herramienta para rotar páginas. */
export function HerramientaRotarPaginas() {
  const {
    documento,
    seleccion,
    proceso,
    estado,
    bloqueado,
    mensajeError,
    paginas,
    numeroRotadas,
    puedeRotar,
    girarSeleccionadas,
    girarMediaVuelta,
    restablecerRotaciones,
    rotar,
  } = useRotarPaginas()

  const cargado = documento.documento
  const sinSeleccion = seleccion.numeroSeleccionadas === 0

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
            Marca las páginas que quieras girar y aplica los giros. Puedes
            aplicar varios giros seguidos: las miniaturas muestran siempre la
            rotación actual.
          </p>

          <BarraAccionesPaginas
            seleccion={seleccion}
            numeroPaginas={cargado.numeroPaginas}
            deshabilitada={bloqueado}
          />

          <div
            className="grupo-botones"
            role="group"
            aria-label="Giros que se aplican a las páginas marcadas"
          >
            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado || sinSeleccion}
              onClick={() => girarSeleccionadas('izquierda')}
            >
              <IconoRotarIzquierda className="boton__icono" />
              Girar 90° a la izquierda
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado || sinSeleccion}
              onClick={() => girarSeleccionadas('derecha')}
            >
              <IconoRotarDerecha className="boton__icono" />
              Girar 90° a la derecha
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado || sinSeleccion}
              onClick={girarMediaVuelta}
            >
              <IconoMediaVuelta className="boton__icono" />
              Girar 180°
            </button>

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado || numeroRotadas === 0}
              onClick={restablecerRotaciones}
            >
              <IconoRestablecer className="boton__icono" />
              Restablecer rotaciones
            </button>
          </div>

          <p className="herramienta__resumen">
            {numeroRotadas === 0
              ? 'Ninguna página tiene rotación pendiente.'
              : `${numeroRotadas} ${
                  numeroRotadas === 1 ? 'página girada' : 'páginas giradas'
                } respecto al documento original.`}
          </p>

          <CuadriculaPaginasPdf
            documento={cargado.abierto.documento}
            idDocumento={cargado.seleccionado.id}
            paginas={paginas}
            deshabilitada={bloqueado}
            alAlternarPagina={seleccion.alternarPagina}
            alReordenar={null}
            renderizarAcciones={(pagina) => (
              <span className="tarjeta-pagina__estado">
                {pagina.rotacion === 0 ? 'Sin girar' : `${pagina.rotacion}°`}
              </span>
            )}
            textoSeleccion="marcada para girar"
            mostrarPosicion={false}
          />

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeRotar}
              onClick={rotar}
            >
              <IconoRotarDerecha className="boton__icono" />
              {proceso.procesando ? 'Aplicando giros…' : 'Guardar PDF rotado'}
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

          {numeroRotadas === 0 && (
            <p className="herramienta__requisito">
              {sinSeleccion
                ? 'Marca al menos una página y aplica un giro para poder guardar el documento.'
                : 'Aplica un giro a las páginas marcadas para poder guardar el documento.'}
            </p>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Aplicando los giros al documento.',
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

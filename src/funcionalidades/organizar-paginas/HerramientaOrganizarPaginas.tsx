import { BarraAccionesPaginas } from '../../componentes/BarraAccionesPaginas'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { CuadriculaPaginasPdf } from '../../componentes/CuadriculaPaginasPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoAlFinal,
  IconoAlInicio,
  IconoDescargar,
  IconoFlechaDerecha,
  IconoFlechaIzquierda,
  IconoOrganizar,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useOrganizarPaginas } from './useOrganizarPaginas'

/** Interfaz de la herramienta para reordenar las páginas de un documento. */
export function HerramientaOrganizarPaginas() {
  const {
    documento,
    seleccion,
    proceso,
    estado,
    bloqueado,
    mensajeError,
    paginas,
    ordenAlterado,
    puedeOrganizar,
    moverIzquierdaEn,
    moverDerechaEn,
    llevarAlInicio,
    llevarAlFinal,
    reordenarArrastrando,
    agruparMarcadas,
    restablecerOrden,
    organizar,
  } = useOrganizarPaginas()

  const cargado = documento.documento
  const sinSeleccion = seleccion.numeroSeleccionadas === 0
  const todasMarcadas =
    cargado !== null && seleccion.numeroSeleccionadas === cargado.numeroPaginas

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
            Cambia el orden de las páginas con los botones de cada miniatura o,
            si usas ratón, arrastrando una miniatura sobre otra. Cada tarjeta
            muestra su posición actual y el número de página original.
          </p>

          <BarraAccionesPaginas
            seleccion={seleccion}
            numeroPaginas={cargado.numeroPaginas}
            deshabilitada={bloqueado}
          />

          <div
            className="grupo-botones"
            role="group"
            aria-label="Movimientos que se aplican a las páginas marcadas"
          >
            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado || sinSeleccion || todasMarcadas}
              onClick={() => agruparMarcadas('inicio')}
            >
              <IconoAlInicio className="boton__icono" />
              Llevar marcadas al inicio
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado || sinSeleccion || todasMarcadas}
              onClick={() => agruparMarcadas('final')}
            >
              <IconoAlFinal className="boton__icono" />
              Llevar marcadas al final
            </button>

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado || !ordenAlterado}
              onClick={restablecerOrden}
            >
              <IconoRestablecer className="boton__icono" />
              Restablecer el orden original
            </button>
          </div>

          <p className="herramienta__resumen">
            {ordenAlterado
              ? 'El orden actual difiere del original.'
              : 'Las páginas mantienen su orden original.'}
          </p>

          <CuadriculaPaginasPdf
            documento={cargado.abierto.documento}
            idDocumento={cargado.seleccionado.id}
            paginas={paginas}
            deshabilitada={bloqueado}
            alAlternarPagina={seleccion.alternarPagina}
            alReordenar={reordenarArrastrando}
            renderizarAcciones={(pagina, posicion) => {
              const numero = pagina.indiceOriginal + 1
              const esPrimera = posicion === 0
              const esUltima = posicion === paginas.length - 1

              return (
                <>
                  <button
                    className="boton-icono boton-icono--compacto"
                    type="button"
                    disabled={bloqueado || esPrimera}
                    onClick={() => llevarAlInicio(posicion)}
                    aria-label={`Llevar la página ${numero} al inicio del documento`}
                  >
                    <IconoAlInicio className="boton-icono__icono" />
                  </button>

                  <button
                    className="boton-icono boton-icono--compacto"
                    type="button"
                    disabled={bloqueado || esPrimera}
                    onClick={() => moverIzquierdaEn(posicion)}
                    aria-label={`Mover la página ${numero} una posición hacia la izquierda`}
                  >
                    <IconoFlechaIzquierda className="boton-icono__icono" />
                  </button>

                  <button
                    className="boton-icono boton-icono--compacto"
                    type="button"
                    disabled={bloqueado || esUltima}
                    onClick={() => moverDerechaEn(posicion)}
                    aria-label={`Mover la página ${numero} una posición hacia la derecha`}
                  >
                    <IconoFlechaDerecha className="boton-icono__icono" />
                  </button>

                  <button
                    className="boton-icono boton-icono--compacto"
                    type="button"
                    disabled={bloqueado || esUltima}
                    onClick={() => llevarAlFinal(posicion)}
                    aria-label={`Llevar la página ${numero} al final del documento`}
                  >
                    <IconoAlFinal className="boton-icono__icono" />
                  </button>
                </>
              )
            }}
            textoSeleccion="marcada para moverla en grupo"
            mostrarPosicion
          />

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeOrganizar}
              onClick={organizar}
            >
              <IconoOrganizar className="boton__icono" />
              {proceso.procesando ? 'Reorganizando…' : 'Guardar PDF organizado'}
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

          {!ordenAlterado && (
            <p className="herramienta__requisito">
              Cambia el orden de alguna página para poder guardar el documento.
            </p>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Reorganizando las páginas del documento.',
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

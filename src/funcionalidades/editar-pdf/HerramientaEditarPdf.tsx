import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { CampoNumero } from '../../componentes/CampoNumero'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoDescargar,
  IconoDetener,
  IconoEditar,
  IconoElipse,
  IconoFlechaForma,
  IconoLinea,
  IconoRectangulo,
  IconoResaltar,
  IconoRestablecer,
  IconoTexto,
} from '../../componentes/Iconos'
import { LienzoEdicion } from '../../componentes/LienzoEdicion'
import { PanelElemento } from '../../componentes/PanelElemento'
import { describirElemento } from '../../edicion/colocarElementos'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useEditarPdf } from './useEditarPdf'

/** Interfaz de la herramienta «Editar y anotar». */
export function HerramientaEditarPdf() {
  const {
    documento,
    proceso,
    capa,
    paginaActiva,
    estado,
    bloqueado,
    mensajeError,
    puedeAplicar,
    cambiarPaginaActiva,
    anadirTexto,
    anadirForma,
    anadirResaltado,
    restablecer,
    aplicar,
  } = useEditarPdf()

  const cargado = documento.documento
  const elementosPagina = capa.elementosDePagina(paginaActiva)

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Qué hace y qué no hace esta herramienta">
        <p className="aviso-informativo__texto">
          Añade una <strong>capa encima</strong> de las páginas: texto, formas,
          resaltados y dibujo. El documento original se conserva por debajo, así que su
          texto sigue siendo texto, los enlaces siguen funcionando y la estructura de
          accesibilidad no se pierde.
        </p>
        <p className="aviso-informativo__texto">
          <strong>No modifica el texto que ya está en el PDF.</strong> No se puede
          corregir una palabra de un párrafo existente: hacerlo exigiría rehacer la
          tipografía, el interletraje y el reflujo del párrafo, y el resultado sería
          peor que el original. Si necesitas tapar algo, lo que buscas es «Censurar
          permanentemente»; si necesitas rellenar un formulario, «Formularios PDF».
        </p>
      </AvisoSeguridad>

      <CargadorDocumentoPdf
        documento={cargado}
        deshabilitado={bloqueado}
        alSeleccionarArchivos={documento.seleccionarArchivos}
        alRestablecer={restablecer}
      />

      {cargado !== null && (
        <>
          <div className="barra-herramientas-edicion">
            <span className="barra-herramientas-edicion__titulo">Añadir</span>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={anadirTexto}
            >
              <IconoTexto className="boton__icono" />
              Texto
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={anadirResaltado}
            >
              <IconoResaltar className="boton__icono" />
              Resaltado
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => anadirForma('rectangulo')}
            >
              <IconoRectangulo className="boton__icono" />
              Rectángulo
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => anadirForma('elipse')}
            >
              <IconoElipse className="boton__icono" />
              Elipse
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => anadirForma('linea')}
            >
              <IconoLinea className="boton__icono" />
              Línea
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => anadirForma('flecha')}
            >
              <IconoFlechaForma className="boton__icono" />
              Flecha
            </button>

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado || capa.elementos.length === 0}
              onClick={capa.vaciar}
            >
              <IconoRestablecer className="boton__icono" />
              Quitar todo
            </button>
          </div>

          <CampoNumero
            etiqueta="Página que estás viendo"
            valor={paginaActiva}
            minimo={1}
            maximo={cargado.numeroPaginas}
            paso={1}
            deshabilitado={bloqueado}
            alCambiar={cambiarPaginaActiva}
            ayuda={`El documento tiene ${cargado.numeroPaginas} ${
              cargado.numeroPaginas === 1 ? 'página' : 'páginas'
            }. Los elementos nuevos se añaden a esta página.`}
          />

          <div className="editor-visual">
            <LienzoEdicion
              documento={cargado.abierto.documento}
              numeroPagina={paginaActiva}
              elementos={elementosPagina}
              idSeleccionado={capa.idSeleccionado}
              deshabilitado={bloqueado}
              alSeleccionar={capa.seleccionar}
              alMover={(id, posicion) => capa.cambiar(id, posicion)}
            />

            <div className="editor-visual__panel">
              {capa.seleccionado === null ? (
                <p className="campos-formulario__vacio">
                  {capa.elementos.length === 0
                    ? 'Añade un elemento con los botones de arriba.'
                    : 'Selecciona un elemento del lienzo o de la lista para ajustarlo.'}
                </p>
              ) : (
                <PanelElemento
                  elemento={capa.seleccionado}
                  numeroPaginas={cargado.numeroPaginas}
                  deshabilitado={bloqueado}
                  alCambiar={(cambios) =>
                    capa.cambiar(capa.seleccionado?.id ?? '', cambios)
                  }
                  alQuitar={() => capa.quitar(capa.seleccionado?.id ?? '')}
                  alDuplicar={() => capa.duplicar(capa.seleccionado?.id ?? '')}
                  alSubir={() => capa.subir(capa.seleccionado?.id ?? '')}
                  alBajar={() => capa.bajar(capa.seleccionado?.id ?? '')}
                />
              )}
            </div>
          </div>

          {capa.elementos.length > 0 && (
            <div className="lista-elementos">
              <h3 className="lista-elementos__titulo">
                Capa: {capa.elementos.length}{' '}
                {capa.elementos.length === 1 ? 'elemento' : 'elementos'}
              </h3>

              <ol className="lista-elementos__lista">
                {capa.elementos.map((elemento) => (
                  <li className="lista-elementos__elemento" key={elemento.id}>
                    <button
                      className={`lista-elementos__boton${
                        elemento.id === capa.idSeleccionado
                          ? ' lista-elementos__boton--activo'
                          : ''
                      }`}
                      type="button"
                      disabled={bloqueado}
                      aria-pressed={elemento.id === capa.idSeleccionado}
                      onClick={() => {
                        capa.seleccionar(elemento.id)
                        cambiarPaginaActiva(elemento.pagina)
                      }}
                    >
                      <span className="lista-elementos__nombre">
                        {describirElemento(elemento)}
                      </span>
                      <span className="lista-elementos__pagina">
                        Página {elemento.pagina}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>

              {capa.cuantosPintan < capa.elementos.length && (
                <p className="panel-ajustes__advertencia">
                  {capa.elementos.length - capa.cuantosPintan} de los elementos no
                  dibujan nada todavía —un texto vacío o una forma sin relleno ni
                  contorno— y se descartarán al aplicar.
                </p>
              )}
            </div>
          )}

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeAplicar}
              onClick={aplicar}
            >
              <IconoEditar className="boton__icono" />
              {proceso.procesando ? 'Aplicando…' : 'Aplicar los cambios'}
            </button>

            {proceso.procesando && (
              <button
                className="boton boton--secundario"
                type="button"
                onClick={proceso.cancelar}
              >
                <IconoDetener className="boton__icono" />
                Cancelar
              </button>
            )}

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

          {!puedeAplicar && !bloqueado && capa.cuantosPintan === 0 && (
            <p className="herramienta__requisito">
              Añade al menos un elemento que dibuje algo para poder aplicar los
              cambios.
            </p>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Dibujando la capa sobre el documento.',
        )}
        textoExito={
          proceso.resultado === null
            ? null
            : `${proceso.resultado.elementosDibujados} ${
                proceso.resultado.elementosDibujados === 1
                  ? 'elemento dibujado'
                  : 'elementos dibujados'
              } en ${proceso.resultado.paginasAfectadas} ${
                proceso.resultado.paginasAfectadas === 1 ? 'página' : 'páginas'
              }. ${formatearTamanoArchivo(
                proceso.resultado.tamano,
              )}. La descarga se ha iniciado automáticamente.`
        }
        textoAviso={
          proceso.cancelado
            ? 'La edición se canceló. No se descargó ningún archivo.'
            : documento.mensajeAviso
        }
        textoError={mensajeError}
      />
    </div>
  )
}

import { useId, useState } from 'react'
import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { CampoNumero } from '../../componentes/CampoNumero'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoDescargar,
  IconoDeshacer,
  IconoDetener,
  IconoElipse,
  IconoFlechaForma,
  IconoImagenAPdf,
  IconoLinea,
  IconoRectangulo,
  IconoRehacer,
  IconoResaltar,
  IconoRestablecer,
  IconoSeleccionArea,
  IconoTexto,
} from '../../componentes/Iconos'
import { LienzoEdicion } from '../../componentes/LienzoEdicion'
import { PanelElemento } from '../../componentes/PanelElemento'
import { describirElemento } from '../../edicion/colocarElementos'
import { useAtajosHistorial } from '../../ganchos/useAtajosHistorial'
import { ATRIBUTO_ACCEPT_IMAGENES } from '../../imagenes/validarImagen'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useEditarPdf } from './useEditarPdf'

/** Interfaz de la herramienta «Editar y anotar». */
export function HerramientaEditarPdf() {
  const [modoBorrado, establecerModoBorrado] = useState<
    'area' | 'texto' | null
  >('texto')
  const {
    documento,
    proceso,
    capa,
    paginaActiva,
    estado,
    bloqueado,
    mensajeError,
    puedeDescargar,
    cambiosSinGuardar,
    cambiarPaginaActiva,
    anadirTexto,
    anadirForma,
    anadirResaltado,
    anadirImagen,
    preparandoImagen,
    anadirCobertura,
    editarTextoExistente,
    guardarCambio,
    restablecer,
    descargarPdfFinal,
  } = useEditarPdf()

  const idImagen = useId()
  const cargado = documento.documento
  const elementosPagina = capa.elementosDePagina(paginaActiva)

  useAtajosHistorial({
    deshacer: capa.deshacer,
    rehacer: capa.rehacer,
    activo: cargado !== null && !bloqueado,
  })

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Qué hace y qué no hace esta herramienta">
        <p className="aviso-informativo__texto">
          Añade una <strong>capa encima</strong> de las páginas: texto, imágenes,
          formas y resaltados. El documento original se conserva por debajo, así que su
          texto sigue siendo texto, los enlaces siguen funcionando y la estructura de
          accesibilidad no se pierde.
        </p>
        <p className="aviso-informativo__texto">
          <strong>Editar texto</strong> permite pulsar una palabra y corregir sus
          letras en el mismo lugar. La aplicación reconstruye visualmente esa palabra
          y conserva el resto de la página. No hace reflujo de párrafos como Word; para
          datos confidenciales usa «Censurar permanentemente».
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
            <span className="barra-herramientas-edicion__titulo">Editar</span>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              aria-pressed={modoBorrado === 'area'}
              onClick={(evento) => {
                // Con teclado se crea una cobertura predeterminada que se puede
                // ajustar con los campos; con puntero se selecciona directamente.
                if (evento.detail === 0) {
                  anadirCobertura()
                  establecerModoBorrado(null)
                } else {
                  establecerModoBorrado((actual) =>
                    actual === 'area' ? null : 'area',
                  )
                }
              }}
              title="Cubre visualmente una zona; no elimina datos confidenciales"
            >
              <IconoSeleccionArea className="boton__icono" />
              Cubrir área
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              aria-pressed={modoBorrado === 'texto'}
              onClick={() =>
                establecerModoBorrado((actual) =>
                  actual === 'texto' ? null : 'texto',
                )
              }
              title="Pulsa una palabra existente para corregir sus letras"
            >
              <IconoTexto className="boton__icono" />
              Editar texto
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => {
                establecerModoBorrado(null)
                anadirTexto()
              }}
            >
              <IconoTexto className="boton__icono" />
              Texto
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => {
                establecerModoBorrado(null)
                anadirResaltado()
              }}
            >
              <IconoResaltar className="boton__icono" />
              Resaltado
            </button>

            {/*
              El «input» real queda oculto pero sigue siendo enfocable, y la etiqueta
              asociada hace de botón visible. Es el mismo patrón que el cargador de
              documentos, y es lo que mantiene el control usable con teclado.
            */}
            <div className="selector-archivo">
              <input
                className="selector-archivo__campo"
                id={idImagen}
                type="file"
                accept={ATRIBUTO_ACCEPT_IMAGENES}
                disabled={bloqueado}
                aria-label="Insertar una imagen en la página"
                onChange={(evento) => {
                  const elegida = evento.target.files?.[0]

                  if (elegida !== undefined) {
                    establecerModoBorrado(null)
                    void anadirImagen(elegida)
                  }

                  // Se limpia para poder volver a elegir el mismo archivo.
                  evento.target.value = ''
                }}
              />
              <label className="boton boton--secundario" htmlFor={idImagen}>
                <IconoImagenAPdf className="boton__icono" />
                {preparandoImagen ? 'Preparando imagen…' : 'Imagen'}
              </label>
            </div>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => {
                establecerModoBorrado(null)
                anadirForma('rectangulo')
              }}
            >
              <IconoRectangulo className="boton__icono" />
              Rectángulo
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => {
                establecerModoBorrado(null)
                anadirForma('elipse')
              }}
            >
              <IconoElipse className="boton__icono" />
              Elipse
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => {
                establecerModoBorrado(null)
                anadirForma('linea')
              }}
            >
              <IconoLinea className="boton__icono" />
              Línea
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={() => {
                establecerModoBorrado(null)
                anadirForma('flecha')
              }}
            >
              <IconoFlechaForma className="boton__icono" />
              Flecha
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado || !capa.puedeDeshacer}
              onClick={capa.deshacer}
              title="Deshacer el último cambio (Ctrl+Z)"
            >
              <IconoDeshacer className="boton__icono" />
              Deshacer
            </button>

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado || !capa.puedeRehacer}
              onClick={capa.rehacer}
              title="Rehacer el cambio deshecho (Ctrl+Mayús+Z)"
            >
              <IconoRehacer className="boton__icono" />
              Rehacer
            </button>

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado || capa.elementos.length === 0}
              onClick={capa.vaciar}
              title="Quita todos los cambios; se puede deshacer con Ctrl+Z"
            >
              <IconoRestablecer className="boton__icono" />
              Quitar todo
            </button>
          </div>

          <p className="barra-herramientas-edicion__ayuda">
            <strong>La edición de texto está activa al cargar el PDF.</strong> Haz clic
            en una palabra y modifica sus letras en «Contenido». Repite esto con todas
            las palabras necesarias: <strong>cada cambio se acumula automáticamente</strong>.
            Descarga el PDF terminado una sola vez al final. Si la página es una
            imagen, usa el botón de OCR que aparecerá sobre ella.
          </p>

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
              alRedimensionar={(id, tamano) => capa.cambiar(id, tamano)}
              alQuitar={capa.quitar}
              alEmpezarGesto={capa.separar}
              cubriendoArea={modoBorrado === 'area'}
              alCubrirArea={(caja) => {
                anadirCobertura(caja)
                establecerModoBorrado(null)
              }}
              borrandoTexto={modoBorrado === 'texto'}
              alBorrarTexto={editarTextoExistente}
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
                  alGuardar={() =>
                    guardarCambio(capa.seleccionado?.id ?? '')
                  }
                />
              )}
            </div>
          </div>

          {capa.elementos.length > 0 && (
            <div className="lista-elementos">
              <h3 className="lista-elementos__titulo">
                Cambios acumulados: {capa.elementos.length}{' '}
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
                        Página {elemento.pagina} ·{' '}
                        {elemento.guardado === true ? 'Guardado' : 'Sin guardar'}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>

              {capa.cuantosPintan < capa.elementos.length && (
                <p className="panel-ajustes__advertencia">
                  {capa.elementos.length - capa.cuantosPintan} de los elementos no
                  dibujan nada todavía —un texto vacío o una forma sin relleno ni
                  contorno— y se descartarán al preparar la descarga.
                </p>
              )}
            </div>
          )}

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeDescargar}
              onClick={descargarPdfFinal}
            >
              <IconoDescargar className="boton__icono" />
              {proceso.procesando
                ? 'Preparando descarga…'
                : 'Descargar PDF terminado'}
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
                Descargar de nuevo
              </button>
            )}
          </div>

          {cambiosSinGuardar > 0 && !bloqueado && (
            <p className="herramienta__requisito">
              {cambiosSinGuardar === 1
                ? 'Hay 1 cambio sin guardar. Selecciónalo y pulsa «Guardar cambio».'
                : `Hay ${cambiosSinGuardar} cambios sin guardar. Confirma cada uno antes de descargar.`}
            </p>
          )}

          {!puedeDescargar && !bloqueado && capa.cuantosPintan === 0 && (
            <p className="herramienta__requisito">
              Añade al menos un cambio para poder descargar el PDF terminado.
            </p>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Preparando el PDF final con todos los cambios acumulados.',
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
              )}. La descarga se ha iniciado. Puedes seguir editando; si haces otro
              cambio, se preparará una nueva versión al descargar.`
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

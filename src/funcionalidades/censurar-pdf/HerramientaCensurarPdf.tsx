import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { CampoNumero } from '../../componentes/CampoNumero'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { EditorCensura } from '../../componentes/EditorCensura'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../../componentes/GrupoOpciones'
import {
  IconoCensurar,
  IconoDescargar,
  IconoDetener,
  IconoRestablecer,
  IconoSeleccionArea,
} from '../../componentes/Iconos'
import { SelectorColor } from '../../componentes/SelectorColor'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import {
  describirDensidad,
  describirPerfil,
} from '../../seguridad/censura/coordenadasCensura'
import type { PerfilCalidad } from '../../seguridad/censura/tipos'
import { describirVerificacion } from '../../seguridad/censura/verificarCensura'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useCensurarPdf } from './useCensurarPdf'

/** Perfiles de calidad que se ofrecen. */
const PERFILES: readonly PerfilCalidad[] = ['ligera', 'equilibrada', 'alta']

/** Opciones del grupo de calidad. */
const OPCIONES_CALIDAD: readonly OpcionElegible<PerfilCalidad>[] = PERFILES.map(
  (perfil) => ({
    valor: perfil,
    etiqueta: describirPerfil(perfil),
    descripcion: describirDensidad(perfil),
  }),
)

/** Interfaz de la herramienta de censura permanente. */
export function HerramientaCensurarPdf() {
  const {
    documento,
    proceso,
    configuracion,
    zonas,
    paginaActiva,
    confirmado,
    estado,
    bloqueado,
    mensajeError,
    advertencia,
    puedeCensurar,
    cambiarCalidad,
    cambiarApariencia,
    cambiarPaginaActiva,
    anadirZona,
    cambiarZona,
    eliminarZona,
    limpiarZonas,
    cambiarConfirmado,
    restablecer,
    censurar,
  } = useCensurarPdf()

  const cargado = documento.documento
  const zonasPagina = zonas.filter((zona) => zona.pagina === paginaActiva)

  const textoProgreso =
    proceso.progreso === null
      ? null
      : `Reconstruyendo la página ${proceso.progreso.completados} de ${proceso.progreso.total}.`

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Cómo censura esta herramienta" tono="advertencia">
        <p className="aviso-informativo__texto">
          La censura segura <strong>reconstruye el documento como imágenes</strong>.
          Cada página se dibuja, las zonas se pintan sobre los píxeles y se crea un
          documento nuevo: no se copian los flujos de contenido originales, ni las
          anotaciones, ni los formularios, ni los archivos adjuntos, ni los
          metadatos.
        </p>
        <p className="aviso-informativo__texto">
          Como consecuencia, <strong>el texto, los enlaces y los formularios dejarán
          de ser interactivos</strong>, la estructura de accesibilidad se pierde y el
          archivo suele ocupar más que el original.
        </p>
        <p className="aviso-informativo__texto">
          Esto es distinto de «Recortar PDF», que solo cambia el área visible y
          conserva el contenido oculto dentro del archivo.
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
          <div className="grupo-botones">
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
              }.`}
            />

            <button
              className="boton boton--secundario"
              type="button"
              disabled={bloqueado}
              onClick={anadirZona}
            >
              <IconoSeleccionArea className="boton__icono" />
              Marcar una zona en esta página
            </button>

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado || zonas.length === 0}
              onClick={limpiarZonas}
            >
              <IconoRestablecer className="boton__icono" />
              Quitar todas las zonas
            </button>
          </div>

          <p className="herramienta__resumen">
            {zonas.length === 0
              ? 'Todavía no has marcado ninguna zona.'
              : `${zonas.length} ${
                  zonas.length === 1 ? 'zona marcada' : 'zonas marcadas'
                } en total. Todas las páginas se reconstruirán como imágenes, no solo las censuradas.`}
          </p>

          <EditorCensura
            documento={cargado.abierto.documento}
            numeroPagina={paginaActiva}
            zonas={zonasPagina}
            color={configuracion.apariencia.color}
            deshabilitado={bloqueado}
            alCambiar={cambiarZona}
            alEliminar={eliminarZona}
          />

          <div className="panel-ajustes">
            <div className="panel-ajustes__controles">
              <GrupoOpciones
                etiqueta="Calidad del rasterizado"
                opciones={OPCIONES_CALIDAD}
                valor={configuracion.calidad}
                deshabilitado={bloqueado}
                alCambiar={cambiarCalidad}
                enColumna
                ayuda="Más resolución da mejor lectura, pero consume más memoria y produce un archivo mayor."
              />

              <SelectorColor
                etiqueta="Color de las zonas"
                valor={configuracion.apariencia.color}
                deshabilitado={bloqueado}
                alCambiar={(color) => cambiarApariencia({ color })}
              />

              <div className="campo-texto-bloque">
                <label
                  className="campo-texto-bloque__etiqueta"
                  htmlFor="texto-censura"
                >
                  Texto sobre la zona
                </label>
                <input
                  className="campo-texto"
                  id="texto-censura"
                  type="text"
                  value={configuracion.apariencia.texto}
                  maxLength={40}
                  autoComplete="off"
                  disabled={bloqueado}
                  placeholder="CENSURADO"
                  onChange={(evento) =>
                    cambiarApariencia({ texto: evento.target.value })
                  }
                />
                <p className="campo-texto-bloque__ayuda">
                  Opcional. El texto pasa a formar parte de los píxeles, así que no se
                  puede quitar del documento resultante.
                </p>
              </div>
            </div>

            <div className="panel-ajustes__vista">
              <h3 className="panel-ajustes__titulo">Qué se comprobará</h3>
              <ul className="lista-datos">
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Páginas</span>
                  <span className="lista-datos__valor">
                    Que coincidan con el original
                  </span>
                </li>
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Texto extraíble</span>
                  <span className="lista-datos__valor">Que no quede ninguno</span>
                </li>
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Formularios</span>
                  <span className="lista-datos__valor">Que no queden campos</span>
                </li>
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Anotaciones</span>
                  <span className="lista-datos__valor">
                    Que no queden interactivas
                  </span>
                </li>
              </ul>
              <p className="panel-ajustes__ayuda">
                Si alguna comprobación falla, no se descarga nada.
              </p>
              {advertencia !== null && (
                <p className="panel-ajustes__advertencia">{advertencia}</p>
              )}
            </div>
          </div>

          <fieldset className="permisos-pdf__grupo">
            <legend className="permisos-pdf__titulo">Confirmación</legend>

            <label className="casilla">
              <input
                className="casilla__campo"
                type="checkbox"
                checked={confirmado}
                disabled={bloqueado}
                onChange={(evento) => cambiarConfirmado(evento.target.checked)}
              />
              <span className="casilla__texto">
                <span className="casilla__etiqueta">
                  Entiendo que el documento se reconstruirá como imágenes
                </span>
                <span className="casilla__ayuda">
                  El texto, los enlaces y los formularios dejarán de ser
                  interactivos. Es irreversible sobre el archivo que se descargue.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeCensurar}
              onClick={censurar}
            >
              <IconoCensurar className="boton__icono" />
              {proceso.procesando
                ? 'Censurando y comprobando…'
                : 'Censurar el documento'}
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

          {!puedeCensurar && !bloqueado && (
            <p className="herramienta__requisito">
              {zonas.length === 0
                ? 'Marca al menos una zona para poder censurar.'
                : !confirmado
                  ? 'Confirma que entiendes las consecuencias para poder censurar.'
                  : ''}
            </p>
          )}

          {proceso.progreso !== null && proceso.procesando && (
            <div className="progreso">
              <div
                className="progreso__barra"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={proceso.progreso.total}
                aria-valuenow={proceso.progreso.completados}
                aria-valuetext={`${proceso.progreso.completados} de ${proceso.progreso.total} páginas reconstruidas`}
              >
                <span
                  className="progreso__relleno"
                  style={{
                    width: `${
                      (proceso.progreso.completados / proceso.progreso.total) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={
          textoProgreso ??
          describirEstadoOcupado(
            estado,
            'Reconstruyendo el documento como imágenes.',
          )
        }
        textoExito={
          proceso.resultado === null
            ? null
            : `Documento censurado: ${formatearTamanoArchivo(
                proceso.resultado.tamano,
              )}. ${describirVerificacion(
                proceso.resultado.verificacion,
              )} La descarga se ha iniciado automáticamente.`
        }
        textoAviso={
          proceso.cancelado
            ? 'La censura se canceló. No se descargó ningún archivo.'
            : documento.mensajeAviso
        }
        textoError={mensajeError}
      />
    </div>
  )
}

import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { EditorCampoFormulario } from '../../componentes/EditorCampoFormulario'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../../componentes/GrupoOpciones'
import {
  IconoArchivoPdf,
  IconoDescargar,
  IconoFormulario,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { ListaCamposFormulario } from '../../componentes/ListaCamposFormulario'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import { esRellenable } from '../../formularios/inspeccionarFormulario'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useFormulariosPdf, type ModoFormulario } from './useFormulariosPdf'

/** Modos de trabajo que se ofrecen. */
const OPCIONES_MODO: readonly OpcionElegible<ModoFormulario>[] = [
  {
    valor: 'rellenar',
    etiqueta: 'Rellenar campos',
    descripcion: 'Escribe valores en los campos que ya existen.',
  },
  {
    valor: 'crear',
    etiqueta: 'Crear campos',
    descripcion: 'Añade campos nuevos al documento.',
  },
]

/** Interfaz de la herramienta de formularios PDF. */
export function HerramientaFormulariosPdf() {
  const {
    documento,
    proceso,
    inspeccion,
    inspeccionando,
    modo,
    valores,
    camposNuevos,
    aplanar,
    estado,
    bloqueado,
    mensajeError,
    problemas,
    avisos,
    puedeGenerar,
    seleccionarArchivos,
    cambiarModo,
    cambiarValor,
    limpiarValor,
    limpiarTodos,
    restaurarOriginales,
    anadirCampo,
    cambiarCampo,
    eliminarCampo,
    cambiarAplanar,
    restablecer,
    generar,
  } = useFormulariosPdf()

  /** Devuelve el mensaje de error que corresponde a un campo nuevo. */
  const errorDeCampo = (nombre: string): string | null =>
    problemas.find((problema) => problema.campo === nombre)?.mensaje ?? null

  const rellenables =
    inspeccion?.campos.filter((campo) => esRellenable(campo.clase)) ?? []

  return (
    <div className="herramienta__cuerpo">
      {documento === null ? (
        <ZonaArrastrePdf
          alSeleccionarArchivos={seleccionarArchivos}
          deshabilitado={bloqueado}
          permitirVarios={false}
          titulo="Arrastra el PDF con el formulario o pulsa para seleccionarlo"
          ayuda="Se leerán los campos que ya tenga. También puedes partir de un documento sin campos y crearlos."
          nombreAccesible="Seleccionar el PDF del formulario"
        />
      ) : (
        <>
          <div className="documento-cargado">
            <IconoArchivoPdf className="documento-cargado__icono" />
            <div className="documento-cargado__datos">
              <p className="documento-cargado__nombre">{documento.nombre}</p>
              <p className="documento-cargado__detalle">
                {formatearTamanoArchivo(documento.tamano)}
                {inspeccion !== null && (
                  <>
                    {' · '}
                    {inspeccion.numeroPaginas}{' '}
                    {inspeccion.numeroPaginas === 1 ? 'página' : 'páginas'}
                    {' · '}
                    {inspeccion.campos.length}{' '}
                    {inspeccion.campos.length === 1 ? 'campo' : 'campos'}
                  </>
                )}
              </p>
            </div>
            <div className="documento-cargado__acciones">
              <button
                className="boton boton--discreto"
                type="button"
                disabled={bloqueado}
                onClick={restablecer}
              >
                <IconoRestablecer className="boton__icono" />
                Empezar de nuevo
              </button>
            </div>
          </div>

          {inspeccion?.tieneXfa === true && (
            <AvisoSeguridad titulo="Formulario XFA no compatible" tono="advertencia">
              <p className="aviso-informativo__texto">
                Este documento declara un formulario <strong>XFA</strong>, una
                tecnología distinta y en desuso que esta herramienta no puede
                manipular. Los campos que se muestren serán los AcroForm, si los
                hay; el resto se conservará sin tocar.
              </p>
            </AvisoSeguridad>
          )}

          <GrupoOpciones
            etiqueta="Qué quieres hacer"
            opciones={OPCIONES_MODO}
            valor={modo}
            deshabilitado={bloqueado}
            alCambiar={cambiarModo}
          />

          {modo === 'rellenar' ? (
            <>
              {inspeccion !== null && rellenables.length > 0 && (
                <div className="grupo-botones">
                  <button
                    className="boton boton--secundario"
                    type="button"
                    disabled={bloqueado}
                    onClick={limpiarTodos}
                  >
                    Vaciar todos los campos
                  </button>

                  <button
                    className="boton boton--discreto"
                    type="button"
                    disabled={bloqueado || valores.size === 0}
                    onClick={restaurarOriginales}
                  >
                    <IconoRestablecer className="boton__icono" />
                    Restaurar los valores originales
                  </button>
                </div>
              )}

              {inspeccion !== null && (
                <ListaCamposFormulario
                  campos={inspeccion.campos}
                  valores={valores}
                  deshabilitado={bloqueado}
                  alCambiar={cambiarValor}
                  alLimpiar={limpiarValor}
                />
              )}
            </>
          ) : (
            <>
              <p className="herramienta__instrucciones">
                Los campos nuevos se colocan indicando su posición en puntos PDF,
                midiendo desde la esquina inferior izquierda de la página. No se
                crean campos de firma digital: esta herramienta no implementa firma
                criptográfica.
              </p>

              {camposNuevos.length === 0 ? (
                <p className="campos-formulario__vacio">
                  Todavía no has añadido ningún campo.
                </p>
              ) : (
                <div className="editor-campo__lista">
                  {camposNuevos.map((campo, indice) => (
                    <EditorCampoFormulario
                      key={campo.id}
                      campo={campo}
                      posicion={indice + 1}
                      numeroPaginas={inspeccion?.numeroPaginas ?? 1}
                      mensajeError={errorDeCampo(campo.nombre)}
                      deshabilitado={bloqueado}
                      alCambiar={(cambios) => cambiarCampo(campo.id, cambios)}
                      alEliminar={() => eliminarCampo(campo.id)}
                    />
                  ))}
                </div>
              )}

              <button
                className="boton boton--secundario"
                type="button"
                disabled={bloqueado}
                onClick={anadirCampo}
              >
                <IconoFormulario className="boton__icono" />
                Añadir un campo
              </button>
            </>
          )}

          <fieldset className="permisos-pdf__grupo">
            <legend className="permisos-pdf__titulo">Al guardar</legend>

            <label className="casilla">
              <input
                className="casilla__campo"
                type="checkbox"
                checked={aplanar}
                disabled={bloqueado}
                onChange={(evento) => cambiarAplanar(evento.target.checked)}
              />
              <span className="casilla__texto">
                <span className="casilla__etiqueta">Aplanar el formulario</span>
                <span className="casilla__ayuda">
                  Convierte la apariencia de los campos en contenido normal de la
                  página. El formulario deja de ser editable y su aspecto depende de
                  que las apariencias se hayan generado bien. Si no lo marcas, el
                  formulario se conserva editable.
                </span>
              </span>
            </label>
          </fieldset>

          {problemas.length > 0 && (
            <div className="aviso-informativo" role="alert">
              <p className="aviso-informativo__texto">
                Corrige esto antes de guardar:
              </p>
              <ul className="lista-problemas">
                {problemas.map((problema, indice) => (
                  <li key={`${problema.campo}-${indice}`}>
                    <strong>{problema.campo}</strong>: {problema.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {avisos.length > 0 && problemas.length === 0 && (
            <div className="aviso-informativo" role="note">
              <p className="aviso-informativo__texto">
                Puedes guardar así, pero ten en cuenta que:
              </p>
              <ul className="lista-problemas">
                {avisos.map((aviso, indice) => (
                  <li key={`${aviso.campo}-${indice}`}>
                    <strong>{aviso.campo}</strong>: {aviso.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeGenerar}
              onClick={generar}
            >
              <IconoFormulario className="boton__icono" />
              {proceso.procesando ? 'Guardando…' : 'Guardar formulario'}
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

          {!puedeGenerar && problemas.length === 0 && !bloqueado && (
            <p className="herramienta__requisito">
              Rellena algún campo, añade un campo nuevo o marca «Aplanar el
              formulario» para poder guardar.
            </p>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={
          inspeccionando
            ? 'Leyendo los campos del formulario.'
            : describirEstadoOcupado(estado, 'Guardando el formulario.')
        }
        textoExito={
          proceso.resultado === null
            ? null
            : `Formulario guardado con ${proceso.resultado.numeroPaginas} ${
                proceso.resultado.numeroPaginas === 1 ? 'página' : 'páginas'
              } y ${formatearTamanoArchivo(proceso.resultado.tamano)}${
                aplanar ? ', ya aplanado' : ', todavía editable'
              }. La descarga se ha iniciado automáticamente.`
        }
        textoAviso={null}
        textoError={mensajeError}
      />
    </div>
  )
}

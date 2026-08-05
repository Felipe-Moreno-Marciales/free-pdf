import { EditorPaginaEscaneada } from '../../componentes/EditorPaginaEscaneada'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoAlFinal,
  IconoAlInicio,
  IconoDescargar,
  IconoEscanear,
  IconoFlechaDerecha,
  IconoFlechaIzquierda,
  IconoObturador,
  IconoPapelera,
  IconoRestablecer,
  IconoRotarDerecha,
  IconoRotarIzquierda,
} from '../../componentes/Iconos'
import { MiniaturaImagen } from '../../componentes/MiniaturaImagen'
import { PanelConfiguracionImagen } from '../../componentes/PanelConfiguracionImagen'
import { VisorCamara } from '../../componentes/VisorCamara'
import { ZonaArrastreImagenes } from '../../componentes/ZonaArrastreImagenes'
import { describirFiltro } from '../../imagenes/aplicarFiltrosImagen'
import { describirDimensiones } from '../../imagenes/orientacionImagen'
import { describirRecorte } from '../../imagenes/recorteImagen'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { describirRotacion } from '../../pdf/rotaciones'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useEscanearAPdf } from './useEscanearAPdf'

/** Interfaz de la herramienta para escanear documentos con la cámara. */
export function HerramientaEscanearAPdf() {
  const {
    camara,
    proceso,
    capturas,
    configuracion,
    capturaEditada,
    estado,
    bloqueado,
    mensajeError,
    mensajeAviso,
    puedeGenerar,
    anadirCaptura,
    anadirArchivos,
    eliminarCaptura,
    moverCaptura,
    reordenarCapturas,
    girarCaptura,
    cambiarAjustes,
    cambiarRecorte,
    quitarRecorte,
    editarCaptura,
    cambiarConfiguracion,
    restablecer,
    generar,
  } = useEscanearAPdf()

  const capturar = (video: HTMLVideoElement): void => {
    camara
      .capturar(video)
      .then(anadirCaptura)
      .catch(() => {
        // El mensaje ya lo publica el propio control de la cámara.
      })
  }

  const tamanoTotal = capturas.reduce(
    (total, captura) => total + captura.tamano,
    0,
  )

  return (
    <div className="herramienta__cuerpo">
      <div className="aviso-informativo" role="note">
        <p className="aviso-informativo__texto">
          Esta herramienta crea páginas a partir de fotografías.{' '}
          <strong>No reconoce el texto</strong>: el resultado es un documento con
          imágenes, no un texto que se pueda buscar o copiar. Tampoco hay
          detección automática de bordes: el recorte se ajusta a mano. La cámara
          necesita tu permiso explícito y las fotografías no salen de este
          dispositivo.
        </p>
      </div>

      <VisorCamara
        estado={camara.estado}
        disponible={camara.disponible}
        flujo={camara.flujo}
        dispositivos={camara.dispositivos}
        idActual={camara.idActual}
        deshabilitado={bloqueado}
        alIniciar={camara.iniciar}
        alDetener={camara.detener}
        alCambiarCamara={camara.cambiarCamara}
        alCapturar={capturar}
      />

      <div className="escaner__carga">
        <h3 className="escaner__titulo">
          {camara.disponible
            ? 'O carga fotografías desde tu dispositivo'
            : 'Carga fotografías desde tu dispositivo'}
        </h3>
        <ZonaArrastreImagenes
          alSeleccionarArchivos={anadirArchivos}
          deshabilitado={bloqueado}
          titulo="Arrastra tus fotografías o pulsa para seleccionarlas"
          ayuda="Puedes mezclar fotografías tomadas con la cámara e imágenes ya guardadas. Se aceptan JPEG, JPG, PNG y WebP."
          nombreAccesible="Seleccionar fotografías para escanear"
        />
      </div>

      {capturas.length > 0 && (
        <>
          <p className="herramienta__resumen">
            {capturas.length} {capturas.length === 1 ? 'página' : 'páginas'} ·{' '}
            {formatearTamanoArchivo(tamanoTotal)} · una página por captura, en el
            orden de la lista.
          </p>

          <ol className="lista-capturas">
            {capturas.map((captura, posicion) => {
              const esPrimera = posicion === 0
              const esUltima = posicion === capturas.length - 1
              const estaEditando = capturaEditada?.id === captura.id

              return (
                <li className="lista-capturas__elemento" key={captura.id}>
                  <div
                    className="lista-capturas__tarjeta"
                    draggable={!bloqueado}
                    onDragStart={(evento) => {
                      evento.dataTransfer.effectAllowed = 'move'
                      evento.dataTransfer.setData('text/plain', String(posicion))
                    }}
                    onDragOver={(evento) => {
                      evento.preventDefault()
                      evento.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(evento) => {
                      evento.preventDefault()
                      const origen = Number.parseInt(
                        evento.dataTransfer.getData('text/plain'),
                        10,
                      )
                      if (Number.isInteger(origen)) {
                        reordenarCapturas(origen, posicion)
                      }
                    }}
                  >
                    <MiniaturaImagen
                      contenido={captura.contenido}
                      nombre={captura.nombre}
                      rotacion={captura.rotacion}
                      recorte={captura.recorte}
                      ajustes={captura.ajustes}
                      descripcion={`Página ${posicion + 1} de ${
                        capturas.length
                      }: ${captura.nombre}, ${describirDimensiones(
                        captura.dimensiones,
                      )}, ${describirRotacion(
                        captura.rotacion,
                      )}, ${describirRecorte(
                        captura.recorte,
                      )}, aspecto ${describirFiltro(captura.ajustes.filtro)}.`}
                    />

                    <div className="lista-capturas__datos">
                      <p className="lista-capturas__posicion">
                        Página {posicion + 1}
                      </p>
                      <p className="lista-capturas__nombre">{captura.nombre}</p>
                      <p className="lista-capturas__detalle">
                        {captura.origen === 'camara'
                          ? 'Tomada con la cámara'
                          : 'Cargada desde archivo'}{' '}
                        · {formatearTamanoArchivo(captura.tamano)}
                      </p>
                      <p className="lista-capturas__detalle">
                        {describirFiltro(captura.ajustes.filtro)}
                        {captura.recorte !== null && ' · recortada'}
                        {captura.rotacion !== 0 &&
                          ` · girada ${captura.rotacion}°`}
                      </p>
                    </div>

                    <div
                      className="lista-capturas__acciones"
                      role="group"
                      aria-label={`Acciones de la página ${posicion + 1}`}
                    >
                      <button
                        className="boton-icono"
                        type="button"
                        disabled={bloqueado || esPrimera}
                        onClick={() => moverCaptura(captura.id, 'inicio')}
                        aria-label={`Llevar la página ${
                          posicion + 1
                        } al principio`}
                      >
                        <IconoAlInicio className="boton-icono__icono" />
                      </button>

                      <button
                        className="boton-icono"
                        type="button"
                        disabled={bloqueado || esPrimera}
                        onClick={() => moverCaptura(captura.id, 'anterior')}
                        aria-label={`Mover la página ${
                          posicion + 1
                        } una posición hacia atrás`}
                      >
                        <IconoFlechaIzquierda className="boton-icono__icono" />
                      </button>

                      <button
                        className="boton-icono"
                        type="button"
                        disabled={bloqueado || esUltima}
                        onClick={() => moverCaptura(captura.id, 'siguiente')}
                        aria-label={`Mover la página ${
                          posicion + 1
                        } una posición hacia delante`}
                      >
                        <IconoFlechaDerecha className="boton-icono__icono" />
                      </button>

                      <button
                        className="boton-icono"
                        type="button"
                        disabled={bloqueado || esUltima}
                        onClick={() => moverCaptura(captura.id, 'final')}
                        aria-label={`Llevar la página ${posicion + 1} al final`}
                      >
                        <IconoAlFinal className="boton-icono__icono" />
                      </button>

                      <button
                        className="boton-icono"
                        type="button"
                        disabled={bloqueado}
                        onClick={() => girarCaptura(captura.id, 'izquierda')}
                        aria-label={`Girar la página ${
                          posicion + 1
                        } 90 grados a la izquierda`}
                      >
                        <IconoRotarIzquierda className="boton-icono__icono" />
                      </button>

                      <button
                        className="boton-icono"
                        type="button"
                        disabled={bloqueado}
                        onClick={() => girarCaptura(captura.id, 'derecha')}
                        aria-label={`Girar la página ${
                          posicion + 1
                        } 90 grados a la derecha`}
                      >
                        <IconoRotarDerecha className="boton-icono__icono" />
                      </button>

                      <button
                        className="boton-icono boton-icono--peligro"
                        type="button"
                        disabled={bloqueado}
                        onClick={() => eliminarCaptura(captura.id)}
                        aria-label={`Quitar la página ${posicion + 1}`}
                      >
                        <IconoPapelera className="boton-icono__icono" />
                      </button>
                    </div>

                    <div className="lista-capturas__pie">
                      <button
                        className="boton boton--secundario boton--pequeno"
                        type="button"
                        disabled={bloqueado}
                        aria-expanded={estaEditando}
                        onClick={() =>
                          editarCaptura(estaEditando ? null : captura.id)
                        }
                      >
                        {estaEditando
                          ? 'Ocultar ajustes'
                          : 'Ajustar esta página'}
                      </button>

                      {camara.estado === 'activa' && (
                        <span className="lista-capturas__nota">
                          Para repetir una captura, quítala y vuelve a
                          fotografiar.
                        </span>
                      )}
                    </div>
                  </div>

                  {estaEditando && capturaEditada !== null && (
                    <EditorPaginaEscaneada
                      captura={capturaEditada}
                      posicion={posicion + 1}
                      deshabilitado={bloqueado}
                      alCambiarAjustes={(cambios) =>
                        cambiarAjustes(capturaEditada.id, cambios)
                      }
                      alCambiarRecorte={(cambios) =>
                        cambiarRecorte(capturaEditada.id, cambios)
                      }
                      alQuitarRecorte={() => quitarRecorte(capturaEditada.id)}
                      alCerrar={() => editarCaptura(null)}
                    />
                  )}
                </li>
              )
            })}
          </ol>

          <PanelConfiguracionImagen
            configuracion={configuracion}
            deshabilitado={bloqueado}
            alCambiar={cambiarConfiguracion}
          />

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeGenerar}
              onClick={generar}
            >
              <IconoEscanear className="boton__icono" />
              {proceso.procesando
                ? 'Creando el PDF…'
                : 'Crear PDF escaneado'}
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
              onClick={restablecer}
            >
              <IconoRestablecer className="boton__icono" />
              Empezar de nuevo
            </button>
          </div>
        </>
      )}

      {capturas.length === 0 && camara.estado === 'activa' && (
        <p className="herramienta__requisito">
          <IconoObturador className="herramienta__icono-requisito" />
          Toma la primera fotografía para empezar a montar el documento.
        </p>
      )}

      <EstadoProcesamiento
        textoProceso={
          estado === 'cargando-documento'
            ? 'Leyendo las medidas de las capturas.'
            : describirEstadoOcupado(
                estado,
                'Aplicando los ajustes y creando el documento.',
              )
        }
        textoExito={
          proceso.resultado === null
            ? null
            : `Documento creado con ${proceso.resultado.numeroPaginas} ${
                proceso.resultado.numeroPaginas === 1 ? 'página' : 'páginas'
              } y ${formatearTamanoArchivo(
                proceso.resultado.tamano,
              )}. La descarga se ha iniciado automáticamente.`
        }
        textoAviso={mensajeAviso}
        textoError={mensajeError}
      />
    </div>
  )
}

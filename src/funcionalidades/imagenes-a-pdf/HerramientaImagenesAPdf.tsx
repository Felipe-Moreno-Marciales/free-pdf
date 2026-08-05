import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoDescargar,
  IconoImagenAPdf,
  IconoPapelera,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { ListaImagenes } from '../../componentes/ListaImagenes'
import { PanelConfiguracionImagen } from '../../componentes/PanelConfiguracionImagen'
import { VistaPreviaPagina } from '../../componentes/VistaPreviaPagina'
import { ZonaArrastreImagenes } from '../../componentes/ZonaArrastreImagenes'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useImagenesAPdf } from './useImagenesAPdf'

/** Interfaz de la herramienta para convertir imágenes en un PDF. */
export function HerramientaImagenesAPdf() {
  const {
    seleccion,
    proceso,
    configuracion,
    estado,
    bloqueado,
    mensajeError,
    advertencia,
    vistaPrevia,
    puedeGenerar,
    cambiarConfiguracion,
    restablecerConfiguracion,
    restablecer,
    generar,
  } = useImagenesAPdf()

  const numeroImagenes = seleccion.imagenes.length

  return (
    <div className="herramienta__cuerpo">
      <ZonaArrastreImagenes
        alSeleccionarArchivos={seleccion.anadir}
        deshabilitado={bloqueado}
      />

      {numeroImagenes > 0 && (
        <>
          <p className="herramienta__resumen">
            {numeroImagenes} {numeroImagenes === 1 ? 'imagen' : 'imágenes'} ·{' '}
            {formatearTamanoArchivo(seleccion.tamanoTotal)} · una página por
            imagen, en el orden de la lista.
          </p>

          <p className="herramienta__instrucciones">
            Ordena las imágenes con los botones de cada tarjeta o arrastrándolas,
            y gíralas si hace falta. Después elige el tamaño de página y genera el
            documento.
          </p>

          <ListaImagenes
            imagenes={seleccion.imagenes}
            deshabilitado={bloqueado}
            alMover={seleccion.mover}
            alReordenar={seleccion.reordenar}
            alGirar={seleccion.girar}
            alEliminar={seleccion.eliminar}
          />

          <div className="panel-ajustes">
            <div className="panel-ajustes__controles">
              <PanelConfiguracionImagen
                configuracion={configuracion}
                deshabilitado={bloqueado}
                alCambiar={cambiarConfiguracion}
                advertencia={advertencia}
              />
            </div>

            <div className="panel-ajustes__vista">
              <h3 className="panel-ajustes__titulo">Vista previa de la página</h3>
              {vistaPrevia === null ? (
                <p className="panel-ajustes__ayuda">
                  La vista previa aparecerá en cuanto se lean las medidas de la
                  primera imagen.
                </p>
              ) : (
                <>
                  <VistaPreviaPagina
                    colocacion={vistaPrevia}
                    colorFondo={configuracion.colorFondo}
                  />
                  <p className="panel-ajustes__ayuda">
                    Corresponde a la primera imagen de la lista. Cada página se
                    calcula con las medidas de su propia imagen.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeGenerar}
              onClick={generar}
            >
              <IconoImagenAPdf className="boton__icono" />
              {proceso.procesando ? 'Creando el PDF…' : 'Crear PDF'}
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

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado}
              onClick={restablecer}
            >
              <IconoPapelera className="boton__icono" />
              Quitar todas las imágenes
            </button>
          </div>
        </>
      )}

      <EstadoProcesamiento
        textoProceso={
          estado === 'cargando-documento'
            ? 'Leyendo las medidas de las imágenes.'
            : describirEstadoOcupado(
                estado,
                'Convirtiendo las imágenes y creando el documento.',
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
        textoAviso={seleccion.mensajeAviso}
        textoError={mensajeError}
      />
    </div>
  )
}

import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoDescargar,
  IconoPapelera,
  IconoUnir,
} from '../../componentes/Iconos'
import { ListaArchivosPdf } from '../../componentes/ListaArchivosPdf'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { MINIMO_ARCHIVOS_PARA_UNIR } from './unirPdf'
import { useUnirPdf } from './useUnirPdf'

/** Interfaz de la herramienta para combinar varios documentos en uno solo. */
export function HerramientaUnirPdf() {
  const {
    archivos,
    tamanoTotal,
    estado,
    estaUniendo,
    puedeUnir,
    mensajeError,
    mensajeAviso,
    resultado,
    anadirArchivos,
    moverArchivo,
    eliminarArchivo,
    limpiarSeleccion,
    unir,
    descargarResultado,
  } = useUnirPdf()

  const hayArchivos = archivos.length > 0
  const faltanArchivos = hayArchivos && archivos.length < MINIMO_ARCHIVOS_PARA_UNIR

  const etiquetaNumeroArchivos =
    archivos.length === 1
      ? '1 archivo seleccionado'
      : `${archivos.length} archivos seleccionados`

  return (
    <div className="herramienta__cuerpo">
      <p className="herramienta__instrucciones">
        El orden de la lista es el orden final de las páginas. Puedes añadir más
        archivos en cualquier momento.
      </p>

      <ZonaArrastrePdf
        alSeleccionarArchivos={anadirArchivos}
        deshabilitado={estaUniendo}
      />

      {hayArchivos && (
        <div className="seleccion">
          <div className="seleccion__resumen">
            <p className="seleccion__numero">{etiquetaNumeroArchivos}</p>
            <p className="seleccion__tamano">
              Tamaño total: {formatearTamanoArchivo(tamanoTotal)}
            </p>
            <button
              className="boton boton--discreto"
              type="button"
              disabled={estaUniendo}
              onClick={limpiarSeleccion}
            >
              <IconoPapelera className="boton__icono" />
              Limpiar selección
            </button>
          </div>

          <ListaArchivosPdf
            archivos={archivos}
            deshabilitado={estaUniendo}
            alMover={moverArchivo}
            alEliminar={eliminarArchivo}
          />
        </div>
      )}

      <div className="herramienta__acciones">
        <button
          className="boton boton--primario"
          type="button"
          disabled={!puedeUnir}
          onClick={unir}
        >
          <IconoUnir className="boton__icono" />
          {estaUniendo ? 'Uniendo PDF…' : 'Unir PDF'}
        </button>

        {resultado !== null && (
          <button
            className="boton boton--secundario"
            type="button"
            onClick={descargarResultado}
          >
            <IconoDescargar className="boton__icono" />
            Descargar {resultado.nombreArchivo}
          </button>
        )}
      </div>

      {faltanArchivos && (
        <p className="herramienta__requisito">
          Añade al menos {MINIMO_ARCHIVOS_PARA_UNIR} archivos PDF para poder
          unirlos.
        </p>
      )}

      <EstadoProcesamiento
        textoProceso={
          estaUniendo
            ? 'Uniendo los archivos seleccionados. Puede tardar unos segundos.'
            : null
        }
        textoExito={
          estado === 'completado' && resultado !== null
            ? `PDF unido correctamente: ${resultado.numeroPaginas} ${
                resultado.numeroPaginas === 1 ? 'página' : 'páginas'
              } y ${formatearTamanoArchivo(
                resultado.tamano,
              )}. La descarga se ha iniciado automáticamente.`
            : null
        }
        textoAviso={mensajeAviso}
        textoError={mensajeError}
      />
    </div>
  )
}

import {
  IconoAlerta,
  IconoCargando,
  IconoDescargar,
  IconoPapelera,
  IconoUnir,
  IconoVerificado,
} from '../../componentes/Iconos'
import { ListaArchivosPdf } from '../../componentes/ListaArchivosPdf'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { MINIMO_ARCHIVOS_PARA_UNIR } from './unirPdf'
import { useUnirPdf } from './useUnirPdf'

/** Herramienta para combinar varios documentos PDF en uno solo. */
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
    <section
      className="herramienta"
      id="herramientas"
      aria-labelledby="herramienta-titulo"
    >
      <div className="herramienta__introduccion">
        <h2 className="herramienta__titulo" id="herramienta-titulo">
          Unir PDF
        </h2>
        <p className="herramienta__descripcion">
          Combina varios documentos en un único PDF. El orden de la lista es el
          orden final de las páginas.
        </p>
      </div>

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
          {estaUniendo ? (
            <IconoCargando className="boton__icono boton__icono--girando" />
          ) : (
            <IconoUnir className="boton__icono" />
          )}
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

      <div className="herramienta__mensajes" role="status" aria-live="polite">
        {estaUniendo && (
          <p className="mensaje mensaje--proceso">
            <IconoCargando className="mensaje__icono mensaje__icono--girando" />
            Uniendo los archivos seleccionados. Puede tardar unos segundos.
          </p>
        )}

        {estado === 'completado' && resultado !== null && (
          <p className="mensaje mensaje--correcto">
            <IconoVerificado className="mensaje__icono" />
            PDF unido correctamente:{' '}
            {resultado.numeroPaginas === 1
              ? '1 página'
              : `${resultado.numeroPaginas} páginas`}{' '}
            y {formatearTamanoArchivo(resultado.tamano)}. La descarga se ha
            iniciado automáticamente.
          </p>
        )}

        {mensajeAviso !== null && (
          <p className="mensaje mensaje--informacion">{mensajeAviso}</p>
        )}
      </div>

      <div className="herramienta__mensajes" role="alert" aria-live="assertive">
        {mensajeError !== null && (
          <p className="mensaje mensaje--error">
            <IconoAlerta className="mensaje__icono" />
            {mensajeError}
          </p>
        )}
      </div>
    </section>
  )
}

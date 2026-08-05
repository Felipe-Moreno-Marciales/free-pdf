import { BarraAccionesPaginas } from '../../componentes/BarraAccionesPaginas'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { ControlDeslizante } from '../../componentes/ControlDeslizante'
import { CuadriculaPaginasPdf } from '../../componentes/CuadriculaPaginasPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import { GrupoOpciones, type OpcionElegible } from '../../componentes/GrupoOpciones'
import {
  IconoDescargar,
  IconoDetener,
  IconoPdfAImagenes,
  IconoRestablecer,
} from '../../componentes/Iconos'
import {
  CALIDAD_MAXIMA_PORCENTAJE,
  CALIDAD_MINIMA_PORCENTAJE,
  describirFormatoSalida,
} from '../../imagenes/convertirCanvas'
import type { FormatoImagenPdf } from '../../imagenes/tipos'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import type { PaginaCuadricula } from '../../pdf/tipos'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import {
  describirDensidad,
  describirResolucion,
} from './convertirPdfAImagenes'
import type { ClaveResolucion } from './tipos'
import { usePdfAImagenes } from './usePdfAImagenes'

/** Formatos de salida que se ofrecen. */
const OPCIONES_FORMATO: readonly OpcionElegible<FormatoImagenPdf>[] = [
  {
    valor: 'png',
    etiqueta: describirFormatoSalida('png'),
    descripcion: 'Sin pérdidas. Mejor para texto y líneas.',
  },
  {
    valor: 'jpeg',
    etiqueta: describirFormatoSalida('jpeg'),
    descripcion: 'Archivos más pequeños. Mejor para fotografías.',
  },
]

/** Resoluciones que se ofrecen. */
const RESOLUCIONES: readonly ClaveResolucion[] = [
  'estandar',
  'alta',
  'muy-alta',
]

/** Opciones de la resolución, con su densidad aproximada. */
const OPCIONES_RESOLUCION: readonly OpcionElegible<ClaveResolucion>[] =
  RESOLUCIONES.map((resolucion) => ({
    valor: resolucion,
    etiqueta: describirResolucion(resolucion),
    descripcion: describirDensidad(resolucion),
  }))

/** Interfaz de la herramienta para convertir un PDF en imágenes. */
export function HerramientaPdfAImagenes() {
  const {
    documento,
    seleccion,
    proceso,
    configuracion,
    estado,
    bloqueado,
    mensajeError,
    advertencia,
    puedeConvertir,
    cambiarConfiguracion,
    restablecerConfiguracion,
    restablecer,
    convertir,
  } = usePdfAImagenes()

  const cargado = documento.documento

  const paginas: readonly PaginaCuadricula[] =
    cargado === null
      ? []
      : Array.from({ length: cargado.numeroPaginas }, (_, indice) => ({
          indiceOriginal: indice,
          rotacion: 0,
          seleccionada: seleccion.seleccionadas.has(indice),
        }))

  const textoProgreso =
    proceso.progreso === null
      ? null
      : `Convirtiendo la página ${proceso.progreso.completados} de ${proceso.progreso.total}.`

  return (
    <div className="herramienta__cuerpo">
      <CargadorDocumentoPdf
        documento={cargado}
        deshabilitado={bloqueado}
        alSeleccionarArchivos={documento.seleccionarArchivos}
        alRestablecer={restablecer}
      />

      {cargado !== null && (
        <>
          <p className="herramienta__instrucciones">
            Marca las páginas que quieras convertir en imágenes. Se generará una
            imagen por página, conservando el orden del documento.
          </p>

          <BarraAccionesPaginas
            seleccion={seleccion}
            numeroPaginas={cargado.numeroPaginas}
            deshabilitada={bloqueado}
          />

          <CuadriculaPaginasPdf
            documento={cargado.abierto.documento}
            idDocumento={cargado.seleccionado.id}
            paginas={paginas}
            deshabilitada={bloqueado}
            alAlternarPagina={seleccion.alternarPagina}
            alReordenar={null}
            renderizarAcciones={null}
            textoSeleccion="marcada para convertir"
            mostrarPosicion={false}
          />

          <div className="panel-ajustes">
            <div className="panel-ajustes__controles">
              <GrupoOpciones
                etiqueta="Formato de salida"
                opciones={OPCIONES_FORMATO}
                valor={configuracion.formato}
                deshabilitado={bloqueado}
                alCambiar={(formato) => cambiarConfiguracion({ formato })}
              />

              {configuracion.formato === 'jpeg' && (
                <ControlDeslizante
                  etiqueta="Calidad del JPEG"
                  valor={configuracion.calidadPorcentaje}
                  minimo={CALIDAD_MINIMA_PORCENTAJE}
                  maximo={CALIDAD_MAXIMA_PORCENTAJE}
                  paso={5}
                  valorLegible={`${configuracion.calidadPorcentaje} %`}
                  deshabilitado={bloqueado}
                  alCambiar={(calidadPorcentaje) =>
                    cambiarConfiguracion({ calidadPorcentaje })
                  }
                  ayuda="Una calidad menor produce archivos más pequeños con más pérdida de detalle."
                />
              )}

              <GrupoOpciones
                etiqueta="Resolución"
                opciones={OPCIONES_RESOLUCION}
                valor={configuracion.resolucion}
                deshabilitado={bloqueado}
                alCambiar={(resolucion) => cambiarConfiguracion({ resolucion })}
                enColumna
                ayuda="Una resolución mayor da más detalle, pero consume más memoria y tarda más."
              />
            </div>

            <div className="panel-ajustes__vista">
              <h3 className="panel-ajustes__titulo">Resultado previsto</h3>
              <p className="panel-ajustes__ayuda">
                {seleccion.numeroSeleccionadas === 0
                  ? 'Marca al menos una página para convertirla.'
                  : seleccion.numeroSeleccionadas === 1
                    ? 'Se descargará una imagen suelta.'
                    : `Se descargarán ${seleccion.numeroSeleccionadas} imágenes dentro de un único archivo ZIP.`}
              </p>
              {seleccion.numeroSeleccionadas > 0 && (
                <p className="panel-ajustes__ayuda">
                  Páginas elegidas: {seleccion.resumen}.
                </p>
              )}
              {advertencia !== null && (
                <p className="panel-ajustes__advertencia">{advertencia}</p>
              )}
            </div>
          </div>

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeConvertir}
              onClick={convertir}
            >
              <IconoPdfAImagenes className="boton__icono" />
              {proceso.procesando ? 'Convirtiendo…' : 'Convertir en imágenes'}
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

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado}
              onClick={restablecerConfiguracion}
            >
              <IconoRestablecer className="boton__icono" />
              Restablecer opciones
            </button>
          </div>

          {proceso.progreso !== null && proceso.procesando && (
            <div className="progreso">
              <div
                className="progreso__barra"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={proceso.progreso.total}
                aria-valuenow={proceso.progreso.completados}
                aria-valuetext={`${proceso.progreso.completados} de ${proceso.progreso.total} páginas convertidas`}
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
          describirEstadoOcupado(estado, 'Convirtiendo las páginas en imágenes.')
        }
        textoExito={
          proceso.resultado === null
            ? null
            : `${
                proceso.resultado.esPaquete
                  ? `Se generaron ${proceso.resultado.imagenes.length} imágenes`
                  : 'Se generó 1 imagen'
              } con un total de ${formatearTamanoArchivo(
                proceso.resultado.tamano,
              )}. La descarga se ha iniciado automáticamente.`
        }
        textoAviso={
          proceso.cancelado
            ? 'La conversión se canceló. No se descargó ningún archivo.'
            : documento.mensajeAviso
        }
        textoError={mensajeError}
      />
    </div>
  )
}

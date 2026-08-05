import { BarraAccionesPaginas } from '../../componentes/BarraAccionesPaginas'
import { CampoNumero } from '../../componentes/CampoNumero'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { CuadriculaPaginasPdf } from '../../componentes/CuadriculaPaginasPdf'
import { EditorRecortePdf } from '../../componentes/EditorRecortePdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../../componentes/GrupoOpciones'
import {
  IconoDescargar,
  IconoRecortar,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import type { PaginaCuadricula } from '../../pdf/tipos'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { resumirIndicesComoTexto } from '../../utilidades/rangosPaginas'
import {
  abreviarUnidad,
  convertirMargenesAPuntos,
  describirUnidad,
} from './coordenadasRecorte'
import type { AlcanceRecorte, MargenesRecorte, UnidadRecorte } from './tipos'
import { useRecortarPdf } from './useRecortarPdf'

/** Unidades que se ofrecen. */
const OPCIONES_UNIDAD: readonly OpcionElegible<UnidadRecorte>[] = [
  { valor: 'milimetros', etiqueta: describirUnidad('milimetros') },
  { valor: 'puntos', etiqueta: describirUnidad('puntos') },
]

/** Alcances que se ofrecen. */
const OPCIONES_ALCANCE: readonly OpcionElegible<AlcanceRecorte>[] = [
  {
    valor: 'todas',
    etiqueta: 'Todas las páginas',
    descripcion: 'El mismo recorte en todo el documento.',
  },
  {
    valor: 'seleccionadas',
    etiqueta: 'Páginas marcadas',
    descripcion: 'Solo las que marques en la cuadrícula.',
  },
  {
    valor: 'referencia',
    etiqueta: 'Solo la página de referencia',
    descripcion: 'Únicamente la página que se está viendo.',
  },
]

/** Máximo admitido en los campos de margen, por unidad. */
const MAXIMOS: Readonly<Record<UnidadRecorte, number>> = {
  milimetros: 500,
  puntos: 1400,
}

/** Lados del recorte, con su etiqueta. */
const LADOS: readonly {
  readonly clave: keyof MargenesRecorte
  readonly etiqueta: string
}[] = [
  { clave: 'superior', etiqueta: 'Margen superior' },
  { clave: 'derecho', etiqueta: 'Margen derecho' },
  { clave: 'inferior', etiqueta: 'Margen inferior' },
  { clave: 'izquierdo', etiqueta: 'Margen izquierdo' },
]

/** Interfaz de la herramienta para recortar un PDF. */
export function HerramientaRecortarPdf() {
  const {
    documento,
    seleccion,
    proceso,
    configuracion,
    estado,
    bloqueado,
    mensajeError,
    referencia,
    leyendoMedidas,
    validacion,
    indicesAfectados,
    puedeRecortar,
    cambiarMargen,
    cambiarUnidad,
    cambiarAlcance,
    cambiarReferencia,
    restaurarRecorte,
    restablecer,
    recortar,
  } = useRecortarPdf()

  const cargado = documento.documento

  const paginas: readonly PaginaCuadricula[] =
    cargado === null
      ? []
      : Array.from({ length: cargado.numeroPaginas }, (_, indice) => ({
          indiceOriginal: indice,
          rotacion: 0,
          seleccionada:
            configuracion.alcance === 'seleccionadas'
              ? seleccion.seleccionadas.has(indice)
              : indice === referencia?.indice,
        }))

  const margenesPuntos = convertirMargenesAPuntos(
    configuracion.margenes,
    configuracion.unidad,
  )

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
            Indica cuánto quieres recortar por cada lado. Los márgenes se miden
            sobre la página tal y como se ve, así que «superior» es siempre el
            borde de arriba.
          </p>

          <div className="aviso-informativo" role="note">
            <p className="aviso-informativo__texto">
              El recorte cambia el área visible de la página mediante la caja de
              recorte del formato PDF. El contenido que queda fuera{' '}
              <strong>sigue estando dentro del archivo</strong>, aunque no se vea:
              esta herramienta sirve para ajustar encuadres y márgenes, no para
              ocultar información confidencial. Para eliminar contenido de verdad
              hará falta la herramienta de censura permanente, prevista para una
              fase posterior.
            </p>
          </div>

          <div className="panel-ajustes">
            <div className="panel-ajustes__controles">
              <GrupoOpciones
                etiqueta="Unidad"
                opciones={OPCIONES_UNIDAD}
                valor={configuracion.unidad}
                deshabilitado={bloqueado}
                alCambiar={cambiarUnidad}
                ayuda="Al cambiar de unidad se convierten los valores, así que el recorte no varía."
              />

              <div className="rejilla-campos">
                {LADOS.map(({ clave, etiqueta }) => (
                  <CampoNumero
                    key={clave}
                    etiqueta={etiqueta}
                    valor={configuracion.margenes[clave]}
                    minimo={0}
                    maximo={MAXIMOS[configuracion.unidad]}
                    paso={configuracion.unidad === 'milimetros' ? 1 : 5}
                    unidad={abreviarUnidad(configuracion.unidad)}
                    deshabilitado={bloqueado}
                    alCambiar={(valor) => cambiarMargen(clave, valor)}
                  />
                ))}
              </div>

              {validacion !== null && !validacion.valido && (
                <p className="panel-ajustes__advertencia" role="alert">
                  {validacion.mensaje}
                </p>
              )}

              <GrupoOpciones
                etiqueta="Páginas afectadas"
                opciones={OPCIONES_ALCANCE}
                valor={configuracion.alcance}
                deshabilitado={bloqueado}
                alCambiar={cambiarAlcance}
                enColumna
              />

              <p className="panel-ajustes__ayuda">
                {indicesAfectados.length === 0
                  ? 'Ninguna página quedará afectada con la selección actual.'
                  : `Se recortarán ${indicesAfectados.length} ${
                      indicesAfectados.length === 1 ? 'página' : 'páginas'
                    }: ${resumirIndicesComoTexto(indicesAfectados)}.`}
              </p>

              <button
                className="boton boton--discreto"
                type="button"
                disabled={bloqueado}
                onClick={restaurarRecorte}
              >
                <IconoRestablecer className="boton__icono" />
                Restaurar el recorte
              </button>
            </div>

            <div className="panel-ajustes__vista">
              <h3 className="panel-ajustes__titulo">
                Vista previa del recorte
              </h3>

              {referencia === null ? (
                <p className="panel-ajustes__ayuda">
                  {leyendoMedidas
                    ? 'Leyendo las medidas de la página…'
                    : 'No se pudieron leer las medidas de la página de referencia.'}
                </p>
              ) : (
                <EditorRecortePdf
                  documento={cargado.abierto.documento}
                  numeroPagina={referencia.indice + 1}
                  visibles={referencia.visibles}
                  margenesPuntos={margenesPuntos}
                  resultantes={
                    validacion?.resultantes ?? referencia.visibles
                  }
                  mensajeError={
                    validacion === null || validacion.valido
                      ? null
                      : validacion.mensaje
                  }
                />
              )}
            </div>
          </div>

          {configuracion.alcance === 'seleccionadas' && (
            <BarraAccionesPaginas
              seleccion={seleccion}
              numeroPaginas={cargado.numeroPaginas}
              deshabilitada={bloqueado}
            />
          )}

          <p className="herramienta__instrucciones">
            {configuracion.alcance === 'seleccionadas'
              ? 'Marca las páginas que quieres recortar. Pulsa «Usar como referencia» para medir el recorte sobre otra página.'
              : 'Pulsa «Usar como referencia» para medir el recorte sobre otra página.'}
          </p>

          <CuadriculaPaginasPdf
            documento={cargado.abierto.documento}
            idDocumento={cargado.seleccionado.id}
            paginas={paginas}
            deshabilitada={bloqueado}
            alAlternarPagina={
              configuracion.alcance === 'seleccionadas'
                ? seleccion.alternarPagina
                : null
            }
            alReordenar={null}
            renderizarAcciones={(pagina) => (
              <button
                className="boton boton--discreto boton--pequeno"
                type="button"
                disabled={bloqueado || pagina.indiceOriginal === referencia?.indice}
                onClick={() => cambiarReferencia(pagina.indiceOriginal)}
                aria-label={`Usar la página ${
                  pagina.indiceOriginal + 1
                } como referencia del recorte`}
              >
                {pagina.indiceOriginal === referencia?.indice
                  ? 'Referencia'
                  : 'Usar como referencia'}
              </button>
            )}
            textoSeleccion={
              configuracion.alcance === 'seleccionadas'
                ? 'marcada para recortar'
                : 'página de referencia'
            }
            mostrarPosicion={false}
          />

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeRecortar}
              onClick={recortar}
            >
              <IconoRecortar className="boton__icono" />
              {proceso.procesando ? 'Recortando…' : 'Guardar PDF recortado'}
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
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Ajustando el área visible de las páginas.',
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

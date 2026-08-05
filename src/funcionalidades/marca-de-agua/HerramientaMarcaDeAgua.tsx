import { useEffect, useId, useState } from 'react'
import { CampoNumero } from '../../componentes/CampoNumero'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { ControlDeslizante } from '../../componentes/ControlDeslizante'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../../componentes/GrupoOpciones'
import {
  IconoDescargar,
  IconoMarcaDeAgua,
  IconoPapelera,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { SelectorColor } from '../../componentes/SelectorColor'
import { SelectorPosicion } from '../../componentes/SelectorPosicion'
import { SelectorRangoPaginas } from '../../componentes/SelectorRangoPaginas'
import { VistaPreviaMarcaAgua } from '../../componentes/VistaPreviaMarcaAgua'
import { ZonaArrastreImagenes } from '../../componentes/ZonaArrastreImagenes'
import { liberarUrlTemporal } from '../../imagenes/liberarImagen'
import { describirFormato } from '../../imagenes/validarImagen'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { POSICIONES_COMPLETAS } from '../../pdf/posicionarEnPagina'
import { NOMBRE_TIPOGRAFIA } from '../../pdf/textoEstandar'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import {
  ESCALA_MAXIMA,
  ESCALA_MINIMA,
  LONGITUD_MAXIMA_TEXTO,
  MARGEN_MAXIMO_MM,
  OPACIDAD_MAXIMA,
  OPACIDAD_MINIMA,
  ROTACION_MAXIMA,
  ROTACION_MINIMA,
  SEPARACION_MAXIMA_MM,
  SEPARACION_MINIMA_MM,
  TAMANO_MAXIMO,
  TAMANO_MINIMO,
} from './aplicarMarcaDeAgua'
import type { ModoRepeticion, TipoMarca } from './tipos'
import { useMarcaDeAgua } from './useMarcaDeAgua'

/** Clases de marca que se ofrecen. */
const OPCIONES_TIPO: readonly OpcionElegible<TipoMarca>[] = [
  { valor: 'texto', etiqueta: 'Texto' },
  { valor: 'imagen', etiqueta: 'Imagen' },
]

/** Formas de repetición que se ofrecen. */
const OPCIONES_MODO: readonly OpcionElegible<ModoRepeticion>[] = [
  {
    valor: 'unica',
    etiqueta: 'Una sola vez',
    descripcion: 'En la posición elegida de cada página.',
  },
  {
    valor: 'mosaico',
    etiqueta: 'Repetida en mosaico',
    descripcion: 'Cubriendo toda la página.',
  },
]

/** Interfaz de la herramienta para añadir una marca de agua. */
export function HerramientaMarcaDeAgua() {
  const idTexto = useId()
  const idErrorTexto = useId()

  const {
    documento,
    proceso,
    configuracion,
    imagenMarca,
    estado,
    bloqueado,
    mensajeError,
    mensajeMarca,
    indicesAfectados,
    mensajeRangos,
    puedeAplicar,
    cambiarConfiguracion,
    cambiarTexto,
    cambiarImagen,
    cambiarTipo,
    cambiarModo,
    cambiarPosicion,
    cambiarAlcance,
    cambiarExpresion,
    elegirImagen,
    quitarImagen,
    restablecerConfiguracion,
    restablecer,
    aplicar,
  } = useMarcaDeAgua()

  const cargado = documento.documento

  // La vista previa de la imagen necesita una URL temporal, que se revoca en
  // cuanto cambia la imagen o se sale de la herramienta.
  const [urlPrevia, establecerUrlPrevia] = useState<string | null>(null)

  useEffect(() => {
    if (imagenMarca === null) {
      establecerUrlPrevia(null)
      return
    }

    const url = URL.createObjectURL(imagenMarca.contenido)
    establecerUrlPrevia(url)

    return () => {
      liberarUrlTemporal(url)
    }
  }, [imagenMarca])

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
            Elige una marca de texto o de imagen y ajusta su posición, su tamaño y
            su transparencia. Las páginas que no selecciones no se modificarán.
          </p>

          <div className="panel-ajustes">
            <div className="panel-ajustes__controles">
              <GrupoOpciones
                etiqueta="Clase de marca"
                opciones={OPCIONES_TIPO}
                valor={configuracion.tipo}
                deshabilitado={bloqueado}
                alCambiar={cambiarTipo}
              />

              {configuracion.tipo === 'texto' ? (
                <>
                  <div className="campo-texto-bloque">
                    <label
                      className="campo-texto-bloque__etiqueta"
                      htmlFor={idTexto}
                    >
                      Texto de la marca
                    </label>
                    <input
                      className="campo-texto"
                      id={idTexto}
                      type="text"
                      value={configuracion.texto.texto}
                      maxLength={LONGITUD_MAXIMA_TEXTO}
                      autoComplete="off"
                      disabled={bloqueado}
                      aria-invalid={mensajeMarca !== null}
                      aria-describedby={
                        mensajeMarca === null ? undefined : idErrorTexto
                      }
                      onChange={(evento) =>
                        cambiarTexto({ texto: evento.target.value })
                      }
                    />
                    {mensajeMarca !== null && (
                      <p
                        className="campo-texto-bloque__error"
                        id={idErrorTexto}
                      >
                        {mensajeMarca}
                      </p>
                    )}
                    <p className="campo-texto-bloque__ayuda">
                      Se escribe con la tipografía {NOMBRE_TIPOGRAFIA}, que el
                      formato PDF incluye de serie.
                    </p>
                  </div>

                  <CampoNumero
                    etiqueta="Tamaño de la tipografía"
                    valor={configuracion.texto.tamanoFuente}
                    minimo={TAMANO_MINIMO}
                    maximo={TAMANO_MAXIMO}
                    paso={2}
                    unidad="pt"
                    deshabilitado={bloqueado}
                    alCambiar={(tamanoFuente) =>
                      cambiarTexto({ tamanoFuente })
                    }
                  />

                  <SelectorColor
                    etiqueta="Color de la marca"
                    valor={configuracion.texto.color}
                    deshabilitado={bloqueado}
                    alCambiar={(color) => cambiarTexto({ color })}
                  />
                </>
              ) : (
                <>
                  {imagenMarca === null ? (
                    <ZonaArrastreImagenes
                      alSeleccionarArchivos={elegirImagen}
                      deshabilitado={bloqueado}
                      permitirVarias={false}
                      titulo="Arrastra la imagen de la marca o pulsa para seleccionarla"
                      nombreAccesible="Seleccionar la imagen de la marca de agua"
                    />
                  ) : (
                    <div className="marca-imagen">
                      <p className="marca-imagen__nombre">
                        {imagenMarca.nombre}
                      </p>
                      <p className="marca-imagen__detalle">
                        {describirFormato(imagenMarca.formato)} ·{' '}
                        {formatearTamanoArchivo(imagenMarca.tamano)}
                      </p>
                      <button
                        className="boton boton--discreto"
                        type="button"
                        disabled={bloqueado}
                        onClick={quitarImagen}
                      >
                        <IconoPapelera className="boton__icono" />
                        Cambiar la imagen
                      </button>
                    </div>
                  )}

                  {mensajeMarca !== null && imagenMarca === null && (
                    <p className="campo-texto-bloque__error">{mensajeMarca}</p>
                  )}

                  <ControlDeslizante
                    etiqueta="Tamaño de la marca"
                    valor={configuracion.imagen.escalaPorcentaje}
                    minimo={ESCALA_MINIMA}
                    maximo={ESCALA_MAXIMA}
                    paso={5}
                    valorLegible={`${configuracion.imagen.escalaPorcentaje} % del ancho de la página`}
                    deshabilitado={bloqueado}
                    alCambiar={(escalaPorcentaje) =>
                      cambiarImagen({ escalaPorcentaje })
                    }
                    ayuda="La proporción de la imagen se conserva siempre."
                  />
                </>
              )}

              <ControlDeslizante
                etiqueta="Opacidad"
                valor={configuracion.opacidadPorcentaje}
                minimo={OPACIDAD_MINIMA}
                maximo={OPACIDAD_MAXIMA}
                paso={5}
                valorLegible={`${configuracion.opacidadPorcentaje} %`}
                deshabilitado={bloqueado}
                alCambiar={(opacidadPorcentaje) =>
                  cambiarConfiguracion({ opacidadPorcentaje })
                }
              />

              <ControlDeslizante
                etiqueta="Giro"
                valor={configuracion.rotacionGrados}
                minimo={ROTACION_MINIMA}
                maximo={ROTACION_MAXIMA}
                paso={5}
                valorLegible={`${configuracion.rotacionGrados}°`}
                deshabilitado={bloqueado}
                alCambiar={(rotacionGrados) =>
                  cambiarConfiguracion({ rotacionGrados })
                }
              />

              <GrupoOpciones
                etiqueta="Repetición"
                opciones={OPCIONES_MODO}
                valor={configuracion.modo}
                deshabilitado={bloqueado}
                alCambiar={cambiarModo}
                enColumna
              />

              {configuracion.modo === 'mosaico' ? (
                <>
                  <CampoNumero
                    etiqueta="Separación horizontal"
                    valor={configuracion.separacionHorizontalMm}
                    minimo={SEPARACION_MINIMA_MM}
                    maximo={SEPARACION_MAXIMA_MM}
                    paso={5}
                    unidad="mm"
                    deshabilitado={bloqueado}
                    alCambiar={(separacionHorizontalMm) =>
                      cambiarConfiguracion({ separacionHorizontalMm })
                    }
                  />

                  <CampoNumero
                    etiqueta="Separación vertical"
                    valor={configuracion.separacionVerticalMm}
                    minimo={SEPARACION_MINIMA_MM}
                    maximo={SEPARACION_MAXIMA_MM}
                    paso={5}
                    unidad="mm"
                    deshabilitado={bloqueado}
                    alCambiar={(separacionVerticalMm) =>
                      cambiarConfiguracion({ separacionVerticalMm })
                    }
                  />
                </>
              ) : (
                <SelectorPosicion
                  etiqueta="Posición en la página"
                  posiciones={POSICIONES_COMPLETAS}
                  valor={configuracion.posicion}
                  deshabilitado={bloqueado}
                  alCambiar={cambiarPosicion}
                />
              )}

              <CampoNumero
                etiqueta="Margen respecto a los bordes"
                valor={configuracion.margenMm}
                minimo={0}
                maximo={MARGEN_MAXIMO_MM}
                paso={1}
                unidad="mm"
                deshabilitado={bloqueado}
                alCambiar={(margenMm) => cambiarConfiguracion({ margenMm })}
              />

              <SelectorRangoPaginas
                alcance={configuracion.alcance}
                expresion={configuracion.expresion}
                numeroPaginas={cargado.numeroPaginas}
                indicesAfectados={indicesAfectados}
                mensajeError={mensajeRangos}
                deshabilitado={bloqueado}
                alCambiarAlcance={cambiarAlcance}
                alCambiarExpresion={cambiarExpresion}
              />
            </div>

            <div className="panel-ajustes__vista">
              <h3 className="panel-ajustes__titulo">Vista previa</h3>

              <VistaPreviaMarcaAgua
                texto={
                  configuracion.tipo === 'texto'
                    ? configuracion.texto.texto
                    : null
                }
                urlImagen={configuracion.tipo === 'imagen' ? urlPrevia : null}
                tamanoFuente={configuracion.texto.tamanoFuente}
                color={configuracion.texto.color}
                opacidadPorcentaje={configuracion.opacidadPorcentaje}
                rotacionGrados={configuracion.rotacionGrados}
                posicion={configuracion.posicion}
                esMosaico={configuracion.modo === 'mosaico'}
                escalaPorcentaje={configuracion.imagen.escalaPorcentaje}
              />

              <p className="panel-ajustes__ayuda">
                Es una aproximación sobre una página A4 vertical: representa la
                posición, la escala, el giro, el color y la opacidad. El resultado
                exacto depende del tamaño de cada página del documento.
              </p>
            </div>
          </div>

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeAplicar}
              onClick={aplicar}
            >
              <IconoMarcaDeAgua className="boton__icono" />
              {proceso.procesando
                ? 'Aplicando la marca…'
                : 'Guardar PDF con marca de agua'}
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
          </div>
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Aplicando la marca de agua al documento.',
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

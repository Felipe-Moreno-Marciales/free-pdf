import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { CampoNumero } from '../../componentes/CampoNumero'
import { CargadorDocumentoPdf } from '../../componentes/CargadorDocumentoPdf'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../../componentes/GrupoOpciones'
import {
  IconoDescargar,
  IconoDeshacer,
  IconoDetener,
  IconoFirma,
  IconoRehacer,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { LienzoEdicion } from '../../componentes/LienzoEdicion'
import { LienzoFirma } from '../../componentes/LienzoFirma'
import { PanelElemento } from '../../componentes/PanelElemento'
import { SelectorColor } from '../../componentes/SelectorColor'
import { describirElemento } from '../../edicion/colocarElementos'
import { useAtajosHistorial } from '../../ganchos/useAtajosHistorial'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import {
  describirModo,
  LONGITUD_MAXIMA_FIRMA,
  useFirmaVisual,
  type ModoFirma,
} from './useFirmaVisual'

/** Formas de aportar la firma. */
const MODOS: readonly OpcionElegible<ModoFirma>[] = (
  ['dibujada', 'escrita'] as const
).map((modo) => ({
  valor: modo,
  etiqueta: describirModo(modo),
  descripcion:
    modo === 'dibujada'
      ? 'Con el ratón o el dedo, como en un papel.'
      : 'Escribe tu nombre y se coloca en cursiva.',
}))

/** Interfaz de la herramienta «Firma visual». */
export function HerramientaFirmaVisual() {
  const {
    documento,
    proceso,
    capa,
    modo,
    textoFirma,
    color,
    paginaActiva,
    estado,
    bloqueado,
    mensajeError,
    hayFirmaPreparada,
    puedeFirmar,
    cambiarModo,
    cambiarTrazos,
    cambiarTextoFirma,
    cambiarColor,
    cambiarPaginaActiva,
    colocarFirma,
    restablecer,
    firmar,
  } = useFirmaVisual()

  const cargado = documento.documento
  const elementosPagina = capa.elementosDePagina(paginaActiva)

  useAtajosHistorial({
    deshacer: capa.deshacer,
    rehacer: capa.rehacer,
    activo: cargado !== null && !bloqueado,
  })

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad
        titulo="Esto no es una firma digital"
        tono="advertencia"
      >
        <p className="aviso-informativo__texto">
          Esta herramienta coloca <strong>un dibujo o un texto</strong> sobre el
          documento. Vale lo que vale una firma en un papel escaneado, que en muchos
          trámites es suficiente.
        </p>
        <p className="aviso-informativo__texto">
          Lo que <strong>no</strong> hace: no usa ningún certificado, no prueba la
          identidad de quien firma, no detecta si el documento se modifica después y no
          tiene validez de firma electrónica cualificada. Cualquiera puede copiar la
          imagen de la firma y ponerla en otro documento.
        </p>
        <p className="aviso-informativo__texto">
          La firma no se guarda en ningún sitio: vive solo en esta página y desaparece
          al recargar.
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
          <div className="panel-ajustes">
            <div className="panel-ajustes__controles">
              <GrupoOpciones
                etiqueta="Cómo quieres firmar"
                opciones={MODOS}
                valor={modo}
                deshabilitado={bloqueado}
                alCambiar={cambiarModo}
                enColumna
              />

              <SelectorColor
                etiqueta="Color de la firma"
                valor={color}
                deshabilitado={bloqueado}
                alCambiar={cambiarColor}
              />

              <CampoNumero
                etiqueta="Página en la que firmar"
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
            </div>

            <div className="panel-ajustes__vista">
              {modo === 'dibujada' ? (
                <LienzoFirma
                  color={color}
                  deshabilitado={bloqueado}
                  alCambiar={cambiarTrazos}
                />
              ) : (
                <div className="campo-texto-bloque">
                  <label
                    className="campo-texto-bloque__etiqueta"
                    htmlFor="texto-firma"
                  >
                    Tu nombre
                  </label>
                  <input
                    className="campo-texto"
                    id="texto-firma"
                    type="text"
                    value={textoFirma}
                    maxLength={LONGITUD_MAXIMA_FIRMA}
                    autoComplete="off"
                    disabled={bloqueado}
                    onChange={(evento) => cambiarTextoFirma(evento.target.value)}
                  />
                  <p className="campo-texto-bloque__ayuda">
                    Se coloca en Times cursiva, que es lo más parecido a una firma
                    entre las tipografías que el PDF ya incluye. Solo caracteres
                    latinos.
                  </p>
                </div>
              )}

              <button
                className="boton boton--secundario"
                type="button"
                disabled={bloqueado || !hayFirmaPreparada}
                onClick={colocarFirma}
              >
                <IconoFirma className="boton__icono" />
                Colocar en la página {paginaActiva}
              </button>

              {!hayFirmaPreparada && (
                <p className="panel-ajustes__ayuda">
                  {modo === 'dibujada'
                    ? 'Dibuja algo en el área de arriba para poder colocarlo.'
                    : 'Escribe tu nombre para poder colocarlo.'}
                </p>
              )}
            </div>
          </div>

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
            />

            <div className="editor-visual__panel">
              {capa.seleccionado === null ? (
                <p className="campos-formulario__vacio">
                  {capa.elementos.length === 0
                    ? 'Prepara tu firma arriba y colócala en la página.'
                    : 'Selecciona la firma en el lienzo para moverla o cambiar su tamaño.'}
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
                />
              )}
            </div>
          </div>

          {capa.elementos.length > 0 && (
            <div className="lista-elementos">
              <h3 className="lista-elementos__titulo">
                {capa.elementos.length}{' '}
                {capa.elementos.length === 1
                  ? 'firma colocada'
                  : 'firmas colocadas'}
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
                        Página {elemento.pagina}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>

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
                disabled={bloqueado}
                onClick={capa.vaciar}
                title="Quita todas las firmas; se puede deshacer con Ctrl+Z"
              >
                <IconoRestablecer className="boton__icono" />
                Quitar todas
              </button>
            </div>
          )}

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeFirmar}
              onClick={firmar}
            >
              <IconoFirma className="boton__icono" />
              {proceso.procesando ? 'Firmando…' : 'Aplicar la firma'}
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

          {!puedeFirmar && !bloqueado && capa.cuantosPintan === 0 && (
            <p className="herramienta__requisito">
              Coloca la firma en alguna página para poder aplicarla.
            </p>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Colocando la firma sobre el documento.',
        )}
        textoExito={
          proceso.resultado === null
            ? null
            : `Documento firmado visualmente: ${
                proceso.resultado.elementosDibujados
              } ${
                proceso.resultado.elementosDibujados === 1
                  ? 'firma'
                  : 'firmas'
              }, ${formatearTamanoArchivo(
                proceso.resultado.tamano,
              )}. Recuerda que no es una firma digital. La descarga se ha iniciado automáticamente.`
        }
        textoAviso={
          proceso.cancelado
            ? 'La firma se canceló. No se descargó ningún archivo.'
            : documento.mensajeAviso
        }
        textoError={mensajeError}
      />
    </div>
  )
}

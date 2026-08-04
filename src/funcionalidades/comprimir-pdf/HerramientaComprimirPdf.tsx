import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { DetallesTecnicos } from '../../componentes/DetallesTecnicos'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../../componentes/GrupoOpciones'
import {
  IconoAlerta,
  IconoDescargar,
  IconoDetener,
  IconoPaquete,
  IconoRestablecer,
  IconoVerificado,
} from '../../componentes/Iconos'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import { describirEtapa } from '../../compresion/comprimirDocumento'
import {
  describirPerfil,
  explicarInventario,
  explicarPerfil,
  PERFILES,
  type PerfilCompresion,
} from '../../compresion/imagenesPdf'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { convieneOfrecerBorrado, useComprimirPdf } from './useComprimirPdf'

/** Perfiles que se ofrecen, con su explicación exacta. */
const OPCIONES_PERFIL: readonly OpcionElegible<PerfilCompresion>[] = PERFILES.map(
  (perfil) => ({
    valor: perfil,
    etiqueta: describirPerfil(perfil),
    descripcion: explicarPerfil(perfil),
  }),
)

/** Interfaz de la herramienta «Comprimir PDF». */
export function HerramientaComprimirPdf() {
  const {
    documento,
    perfil,
    borrarMetadatos,
    metadatos,
    filasMetadatos,
    procesando,
    progreso,
    resultado,
    cancelado,
    estado,
    bloqueado,
    mensajeError,
    mensajeAviso,
    puedeComprimir,
    hayDescarga,
    seleccionarArchivos,
    cambiarPerfil,
    cambiarBorrarMetadatos,
    comprimir,
    cancelar,
    descargar,
    restablecer,
  } = useComprimirPdf()

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Qué hace esta compresión, exactamente">
        <p className="aviso-informativo__texto">
          Hace <strong>dos cosas distintas</strong>. Primero recomprime las imágenes
          JPEG del documento: las reduce de tamaño y las vuelve a codificar. Después
          reorganiza la estructura del archivo con qpdf, que agrupa los objetos en
          flujos comprimidos.
        </p>
        <p className="aviso-informativo__texto">
          <strong>El texto no se toca.</strong> No se rasteriza nada: las letras siguen
          siendo letras seleccionables y buscables, los vectores siguen siendo
          vectores y las tipografías siguen incrustadas. Solo cambian los píxeles de
          las imágenes.
        </p>
        <p className="aviso-informativo__texto">
          La reducción de las imágenes <strong>sí pierde calidad</strong>, y es
          irreversible sobre el archivo que se descargue.{' '}
          <strong>Tu archivo original nunca se modifica</strong>, así que siempre puedes
          volver a él.
        </p>
      </AvisoSeguridad>

      <ZonaArrastrePdf
        alSeleccionarArchivos={seleccionarArchivos}
        deshabilitado={bloqueado}
        titulo="Elige el documento que quieres comprimir"
        ayuda="Se procesa en tu navegador. No se envía a ningún sitio."
      />

      {documento !== null && (
        <>
          <ul className="lista-datos">
            <li className="lista-datos__elemento">
              <span className="lista-datos__clave">Archivo</span>
              <span className="lista-datos__valor">{documento.nombre}</span>
            </li>
            <li className="lista-datos__elemento">
              <span className="lista-datos__clave">Tamaño original</span>
              <span className="lista-datos__valor">
                {formatearTamanoArchivo(documento.tamano)}
              </span>
            </li>
          </ul>

          <GrupoOpciones
            etiqueta="Cuánto comprimir"
            opciones={OPCIONES_PERFIL}
            valor={perfil}
            deshabilitado={bloqueado}
            alCambiar={cambiarPerfil}
            enColumna
          />

          {resultado !== null && (
            <p className="diagnostico__explicacion">
              {explicarInventario(resultado.inventario)}
            </p>
          )}

          {convieneOfrecerBorrado(metadatos) && (
            <fieldset className="permisos-pdf__grupo">
              <legend className="permisos-pdf__titulo">
                Metadatos del documento
              </legend>

              <p className="diagnostico__explicacion">
                Este documento lleva información sobre quién y con qué lo creó. No
                ocupa casi nada, así que borrarla{' '}
                <strong>no es una medida de compresión, sino de privacidad</strong>:
                viaja con el archivo cuando lo envías.
              </p>

              <ul className="lista-datos">
                {filasMetadatos.map((fila) => (
                  <li className="lista-datos__elemento" key={fila.clave}>
                    <span className="lista-datos__clave">{fila.clave}</span>
                    <span className="lista-datos__valor">{fila.valor}</span>
                  </li>
                ))}
              </ul>

              <label className="casilla">
                <input
                  className="casilla__campo"
                  type="checkbox"
                  checked={borrarMetadatos}
                  disabled={bloqueado}
                  onChange={(evento) =>
                    cambiarBorrarMetadatos(evento.target.checked)
                  }
                />
                <span className="casilla__texto">
                  <span className="casilla__etiqueta">
                    Borrar estos metadatos del documento comprimido
                  </span>
                  <span className="casilla__ayuda">
                    Las fechas quedan en un valor neutro, no en la de hoy: poner la
                    fecha actual delataría cuándo has procesado el documento.
                  </span>
                </span>
              </label>
            </fieldset>
          )}

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeComprimir}
              onClick={comprimir}
            >
              <IconoPaquete className="boton__icono" />
              {procesando ? 'Comprimiendo…' : 'Comprimir el documento'}
            </button>

            {procesando && (
              <button
                className="boton boton--secundario"
                type="button"
                onClick={cancelar}
              >
                <IconoDetener className="boton__icono" />
                Cancelar
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

            {hayDescarga && resultado !== null && (
              <button
                className="boton boton--secundario"
                type="button"
                onClick={descargar}
              >
                <IconoDescargar className="boton__icono" />
                Descargar {resultado.nombreArchivo}
              </button>
            )}
          </div>

          {progreso !== null && (
            <div className="progreso-etapas">
              <p className="progreso-etapas__texto" aria-live="polite">
                {describirEtapa(progreso.etapa)}
                {progreso.etapa === 'imagenes' && progreso.total > 0
                  ? `: imagen ${progreso.completadas} de ${progreso.total}`
                  : '…'}
              </p>

              {progreso.etapa === 'imagenes' && progreso.total > 0 && (
                <div className="progreso">
                  <div
                    className="progreso__barra"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={progreso.total}
                    aria-valuenow={progreso.completadas}
                    aria-valuetext={`${progreso.completadas} de ${progreso.total} imágenes recomprimidas`}
                  >
                    <span
                      className="progreso__relleno"
                      style={{
                        width: `${(progreso.completadas / progreso.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {resultado !== null && (
            <section className="comparacion-tamanos">
              <h3 className="comparacion-tamanos__titulo">Resultado</h3>

              <p
                className={`diagnostico__estado${
                  resultado.desenlace === 'reducido'
                    ? ' diagnostico__estado--correcto'
                    : ' diagnostico__estado--alerta'
                }`}
              >
                {resultado.desenlace === 'reducido' ? (
                  <IconoVerificado className="diagnostico__icono" />
                ) : (
                  <IconoAlerta className="diagnostico__icono" />
                )}
                {resultado.desenlace === 'reducido'
                  ? `Reducido un ${resultado.porcentaje.toFixed(1)} %`
                  : 'No se consiguió reducir'}
              </p>

              <ul className="lista-datos">
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Tamaño original</span>
                  <span className="lista-datos__valor">
                    {formatearTamanoArchivo(resultado.tamanoOriginal)}
                  </span>
                </li>
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Tamaño final</span>
                  <span className="lista-datos__valor">
                    {formatearTamanoArchivo(resultado.tamanoFinal)}
                  </span>
                </li>
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Reducción</span>
                  <span className="lista-datos__valor">
                    {resultado.reduccionAbsoluta >= 0 ? '−' : '+'}
                    {formatearTamanoArchivo(
                      Math.abs(resultado.reduccionAbsoluta),
                    )}{' '}
                    ({resultado.porcentaje >= 0 ? '−' : '+'}
                    {Math.abs(resultado.porcentaje).toFixed(1)} %)
                  </span>
                </li>
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Páginas</span>
                  <span className="lista-datos__valor">
                    {resultado.numeroPaginas}
                  </span>
                </li>
              </ul>

              {!hayDescarga && (
                <p className="diagnostico__explicacion">
                  No se ha descargado nada, y tu archivo original sigue intacto.
                  Entregarte una copia que no es más pequeña sería hacerte creer que
                  has ganado algo.
                </p>
              )}

              <DetallesTecnicos
                explicacion={
                  <p className="diagnostico__explicacion">
                    {resultado.explicacion}
                  </p>
                }
                titulo="Detalle de las imágenes y la estructura"
              >
                <ul className="lista-datos">
                  <li className="lista-datos__elemento">
                    <span className="lista-datos__clave">Imágenes del documento</span>
                    <span className="lista-datos__valor">
                      {resultado.inventario.total} (
                      {resultado.inventario.jpeg} en JPEG,{' '}
                      {resultado.inventario.flate} en Flate)
                    </span>
                  </li>
                  <li className="lista-datos__elemento">
                    <span className="lista-datos__clave">Recomprimidas</span>
                    <span className="lista-datos__valor">
                      {resultado.imagenes.sustituidas}
                    </span>
                  </li>
                  <li className="lista-datos__elemento">
                    <span className="lista-datos__clave">
                      Conservadas por no mejorar
                    </span>
                    <span className="lista-datos__valor">
                      {resultado.imagenes.conservadas}
                    </span>
                  </li>
                  <li className="lista-datos__elemento">
                    <span className="lista-datos__clave">
                      No descodificables
                    </span>
                    <span className="lista-datos__valor">
                      {resultado.imagenes.noDescodificadas}
                    </span>
                  </li>
                  <li className="lista-datos__elemento">
                    <span className="lista-datos__clave">Metadatos borrados</span>
                    <span className="lista-datos__valor">
                      {resultado.metadatosBorrados}
                    </span>
                  </li>
                </ul>
              </DetallesTecnicos>
            </section>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={
          procesando
            ? 'Comprimiendo el documento en tu navegador.'
            : estado === 'procesando'
              ? 'Procesando.'
              : null
        }
        textoExito={
          resultado !== null && hayDescarga
            ? `${resultado.explicacion} La descarga se ha iniciado automáticamente.`
            : null
        }
        textoAviso={
          cancelado
            ? 'La compresión se canceló. No se descargó ningún archivo y tu original sigue intacto.'
            : resultado !== null && !hayDescarga
              ? resultado.explicacion
              : mensajeAviso
        }
        textoError={mensajeError}
      />
    </div>
  )
}

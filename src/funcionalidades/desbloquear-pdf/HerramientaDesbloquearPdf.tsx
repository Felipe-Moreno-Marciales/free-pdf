import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { CampoContrasena } from '../../componentes/CampoContrasena'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoArchivoPdf,
  IconoDescargar,
  IconoDesbloquear,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { VERSION_QPDF } from '../../seguridad/qpdf/recursosQpdf'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useDesbloquearPdf } from './useDesbloquearPdf'

/** Interfaz de la herramienta para quitar la contraseña de un PDF. */
export function HerramientaDesbloquearPdf() {
  const {
    documento,
    proceso,
    contrasena,
    estadoCifrado,
    estado,
    bloqueado,
    mensajeError,
    puedeDesbloquear,
    seleccionarArchivos,
    cambiarContrasena,
    restablecer,
    desbloquear,
  } = useDesbloquearPdf()

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Hace falta la contraseña">
        <p className="aviso-informativo__texto">
          Esta herramienta <strong>descifra el documento con su contraseña</strong>
          , usando qpdf {VERSION_QPDF} compilado a WebAssembly. No existe ninguna
          forma de saltarse la protección y aquí no se intenta: sin la contraseña
          correcta el contenido no se puede recuperar. Ni el documento ni la
          contraseña salen de tu dispositivo, y la contraseña se borra en cuanto
          termina la operación.
        </p>
      </AvisoSeguridad>

      {documento === null ? (
        <ZonaArrastrePdf
          alSeleccionarArchivos={seleccionarArchivos}
          deshabilitado={bloqueado}
          permitirVarios={false}
          titulo="Arrastra el PDF protegido o pulsa para seleccionarlo"
          ayuda="Necesitarás la contraseña con la que se abre el documento."
          nombreAccesible="Seleccionar el PDF protegido"
        />
      ) : (
        <>
          <div className="documento-cargado">
            <IconoArchivoPdf className="documento-cargado__icono" />
            <div className="documento-cargado__datos">
              <p className="documento-cargado__nombre">{documento.nombre}</p>
              <p className="documento-cargado__detalle">
                {formatearTamanoArchivo(documento.tamano)} ·{' '}
                {describirEstadoCifrado(estadoCifrado)}
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

          {estadoCifrado === 'sin-cifrar' ? (
            <div className="aviso-informativo" role="note">
              <p className="aviso-informativo__texto">
                Este documento <strong>no está protegido con contraseña</strong>,
                así que no hay nada que desbloquear. Puedes usarlo tal cual en
                cualquier otra herramienta.
              </p>
            </div>
          ) : (
            <>
              <CampoContrasena
                etiqueta="Contraseña del documento"
                valor={contrasena}
                deshabilitado={bloqueado}
                alCambiar={cambiarContrasena}
                autocompletado="current-password"
                ayuda="Se usa solo para descifrar y se borra al terminar. Distingue mayúsculas y minúsculas."
              />

              <div className="herramienta__acciones">
                <button
                  className="boton boton--primario"
                  type="button"
                  disabled={!puedeDesbloquear}
                  onClick={desbloquear}
                >
                  <IconoDesbloquear className="boton__icono" />
                  {proceso.procesando
                    ? 'Descifrando y comprobando…'
                    : 'Quitar la contraseña'}
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
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Descifrando el documento y comprobando el resultado.',
        )}
        textoExito={
          proceso.resultado === null
            ? null
            : `Documento desbloqueado: ${proceso.resultado.numeroPaginas} ${
                proceso.resultado.numeroPaginas === 1 ? 'página' : 'páginas'
              } y ${formatearTamanoArchivo(
                proceso.resultado.tamano,
              )}. Se comprobó que ya no está cifrado y que se puede abrir. La descarga se ha iniciado automáticamente.`
        }
        textoAviso={
          proceso.resultado === null
            ? null
            : 'El documento descargado ya no tiene contraseña: cualquiera que lo reciba podrá abrirlo.'
        }
        textoError={mensajeError}
      />
    </div>
  )
}

/** Describe en español lo que se sabe del cifrado del documento. */
function describirEstadoCifrado(
  estado: ReturnType<typeof useDesbloquearPdf>['estadoCifrado'],
): string {
  switch (estado) {
    case 'sin-comprobar':
      return 'sin comprobar'
    case 'comprobando':
      return 'comprobando si está protegido…'
    case 'cifrado':
      return 'protegido con contraseña'
    case 'sin-cifrar':
      return 'sin protección'
    case 'indeterminado':
      return 'no se pudo comprobar la protección'
  }
}

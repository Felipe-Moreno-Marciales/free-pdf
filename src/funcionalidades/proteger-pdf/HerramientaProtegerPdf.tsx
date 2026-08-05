import { AvisoSeguridad } from '../../componentes/AvisoSeguridad'
import { CampoContrasena } from '../../componentes/CampoContrasena'
import { EstadoProcesamiento } from '../../componentes/EstadoProcesamiento'
import {
  IconoArchivoPdf,
  IconoDescargar,
  IconoProteger,
  IconoRestablecer,
} from '../../componentes/Iconos'
import { SelectorPermisosPdf } from '../../componentes/SelectorPermisosPdf'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import { BITS_CLAVE } from '../../seguridad/qpdf/permisosPdf'
import { VERSION_QPDF } from '../../seguridad/qpdf/recursosQpdf'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useProtegerPdf } from './useProtegerPdf'

/** Interfaz de la herramienta para proteger un PDF con contraseña. */
export function HerramientaProtegerPdf() {
  const {
    documento,
    proceso,
    configuracion,
    validacion,
    estado,
    bloqueado,
    mensajeError,
    puedeProteger,
    seleccionarArchivos,
    cambiarConfiguracion,
    cambiarPermisos,
    restablecer,
    proteger,
  } = useProtegerPdf()

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Cómo protege esta herramienta">
        <p className="aviso-informativo__texto">
          El documento se cifra con <strong>AES de {BITS_CLAVE} bits</strong>
          {' '}usando qpdf {VERSION_QPDF} compilado a WebAssembly, que se ejecuta en
          un hilo aparte dentro de tu navegador. Ni el documento ni la contraseña
          salen de tu dispositivo, y la contraseña no se guarda en ningún sitio: se
          borra en cuanto termina la operación.
        </p>
      </AvisoSeguridad>

      {documento === null ? (
        <ZonaArrastrePdf
          alSeleccionarArchivos={seleccionarArchivos}
          deshabilitado={bloqueado}
          permitirVarios={false}
          titulo="Arrastra el PDF que quieres proteger o pulsa para seleccionarlo"
          ayuda="Debe ser un documento sin contraseña. Si ya está protegido, usa antes «Desbloquear PDF»."
          nombreAccesible="Seleccionar el PDF que se va a proteger"
        />
      ) : (
        <>
          <div className="documento-cargado">
            <IconoArchivoPdf className="documento-cargado__icono" />
            <div className="documento-cargado__datos">
              <p className="documento-cargado__nombre">{documento.nombre}</p>
              <p className="documento-cargado__detalle">
                {formatearTamanoArchivo(documento.tamano)}
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

          <div className="panel-ajustes">
            <div className="panel-ajustes__controles">
              <CampoContrasena
                etiqueta="Contraseña de apertura"
                valor={configuracion.contrasenaUsuario}
                deshabilitado={bloqueado}
                alCambiar={(contrasenaUsuario) =>
                  cambiarConfiguracion({ contrasenaUsuario })
                }
                ayuda="Sin esta contraseña el documento no se puede abrir ni leer. Cuanto más larga, mejor."
                mensajeError={validacion.mensajeUsuario}
                mostrarFuerza
              />

              <CampoContrasena
                etiqueta="Repite la contraseña de apertura"
                valor={configuracion.confirmacionUsuario}
                deshabilitado={bloqueado}
                alCambiar={(confirmacionUsuario) =>
                  cambiarConfiguracion({ confirmacionUsuario })
                }
                mensajeError={validacion.mensajeConfirmacionUsuario}
              />

              <label className="casilla">
                <input
                  className="casilla__campo"
                  type="checkbox"
                  checked={configuracion.usarPropietarioPropio}
                  disabled={bloqueado}
                  onChange={(evento) =>
                    cambiarConfiguracion({
                      usarPropietarioPropio: evento.target.checked,
                    })
                  }
                />
                <span className="casilla__texto">
                  <span className="casilla__etiqueta">
                    Elegir yo la contraseña de propietario
                  </span>
                  <span className="casilla__ayuda">
                    La contraseña de propietario es la que permite cambiar los
                    permisos. Si no eliges ninguna se genera una aleatoria y no se
                    guarda: qpdf no admite dejarla vacía con AES de{' '}
                    {BITS_CLAVE} bits, porque el documento podría abrirse sin
                    contraseña.
                  </span>
                </span>
              </label>

              {configuracion.usarPropietarioPropio && (
                <>
                  <CampoContrasena
                    etiqueta="Contraseña de propietario"
                    valor={configuracion.contrasenaPropietario}
                    deshabilitado={bloqueado}
                    alCambiar={(contrasenaPropietario) =>
                      cambiarConfiguracion({ contrasenaPropietario })
                    }
                    ayuda="Debe ser distinta de la de apertura."
                    mensajeError={validacion.mensajePropietario}
                    mostrarFuerza
                  />

                  <CampoContrasena
                    etiqueta="Repite la contraseña de propietario"
                    valor={configuracion.confirmacionPropietario}
                    deshabilitado={bloqueado}
                    alCambiar={(confirmacionPropietario) =>
                      cambiarConfiguracion({ confirmacionPropietario })
                    }
                    mensajeError={validacion.mensajeConfirmacionPropietario}
                  />
                </>
              )}
            </div>

            <div className="panel-ajustes__vista">
              <h3 className="panel-ajustes__titulo">Cifrado que se aplicará</h3>
              <ul className="lista-datos">
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Algoritmo</span>
                  <span className="lista-datos__valor">
                    AES de {BITS_CLAVE} bits
                  </span>
                </li>
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Motor</span>
                  <span className="lista-datos__valor">
                    qpdf {VERSION_QPDF} (WebAssembly)
                  </span>
                </li>
                <li className="lista-datos__elemento">
                  <span className="lista-datos__clave">Dónde se ejecuta</span>
                  <span className="lista-datos__valor">
                    En tu navegador, en un hilo aparte
                  </span>
                </li>
              </ul>
              <p className="panel-ajustes__ayuda">
                Antes de entregarte el archivo se comprueba que quedó cifrado y que
                tu contraseña vuelve a abrirlo. Si la comprobación falla, no se
                descarga nada.
              </p>
            </div>
          </div>

          <SelectorPermisosPdf
            permisos={configuracion.permisos}
            deshabilitado={bloqueado}
            alCambiar={cambiarPermisos}
          />

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeProteger}
              onClick={proteger}
            >
              <IconoProteger className="boton__icono" />
              {proceso.procesando
                ? 'Cifrando y comprobando…'
                : 'Proteger el PDF'}
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
          'Cifrando el documento y comprobando el resultado.',
        )}
        textoExito={
          proceso.resultado === null
            ? null
            : `Documento protegido con AES de ${BITS_CLAVE} bits: ${
                proceso.resultado.numeroPaginas
              } ${
                proceso.resultado.numeroPaginas === 1 ? 'página' : 'páginas'
              } y ${formatearTamanoArchivo(
                proceso.resultado.tamano,
              )}. Se comprobó que queda cifrado y que la contraseña lo abre. La descarga se ha iniciado automáticamente.`
        }
        textoAviso={
          proceso.resultado === null
            ? null
            : 'Guarda la contraseña en un lugar seguro: sin ella el documento no se puede recuperar.'
        }
        textoError={mensajeError}
      />
    </div>
  )
}

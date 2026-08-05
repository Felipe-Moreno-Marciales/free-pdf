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
  IconoRestablecer,
  IconoVerificado,
} from '../../componentes/Iconos'
import { ZonaArrastrePdf } from '../../componentes/ZonaArrastrePdf'
import { describirEstadoOcupado } from '../../pdf/estadoHerramienta'
import {
  describirClaseHallazgo,
  describirEstado,
  describirNivel,
  explicarClaseHallazgo,
  explicarEstado,
  explicarNivel,
  type NivelReparacion,
} from '../../seguridad/qpdf/reparacionPdf'
import { formatearTamanoArchivo } from '../../utilidades/formatearTamano'
import { useRepararPdf } from './useRepararPdf'

/** Niveles de reparación que se ofrecen. */
const NIVELES: readonly OpcionElegible<NivelReparacion>[] = (
  ['conservador', 'completo'] as const
).map((nivel) => ({
  valor: nivel,
  etiqueta: describirNivel(nivel),
  descripcion: explicarNivel(nivel),
}))

/** Interfaz de la herramienta «Reparar PDF». */
export function HerramientaRepararPdf() {
  const {
    documento,
    proceso,
    diagnostico,
    estadoDiagnostico,
    nivel,
    estado,
    bloqueado,
    mensajeError,
    mensajeAviso,
    puedeReparar,
    seleccionarArchivos,
    cambiarNivel,
    restablecer,
    reparar,
  } = useRepararPdf()

  const revision = diagnostico?.diagnostico ?? null

  return (
    <div className="herramienta__cuerpo">
      <AvisoSeguridad titulo="Qué puede y qué no puede hacer la reparación">
        <p className="aviso-informativo__texto">
          Reparar consiste en <strong>leer el documento y volver a escribirlo</strong>{' '}
          entero, con una estructura nueva y limpia. Funciona cuando el archivo se
          puede leer pero está desordenado, y el resultado lo suelen aceptar lectores
          que rechazaban el original.
        </p>
        <p className="aviso-informativo__texto">
          <strong>No recupera lo que no está en el archivo.</strong> Si el documento
          llegó incompleto, las páginas que falten seguirán faltando: no se inventa
          nada. Y si el motor no consigue leerlo, se te dice que no hay nada que
          recuperar en lugar de entregarte un archivo vacío.
        </p>
        <p className="aviso-informativo__texto">
          Todo ocurre en tu navegador, con qpdf compilado a WebAssembly. El documento
          no se envía a ningún sitio.
        </p>
      </AvisoSeguridad>

      <ZonaArrastrePdf
        alSeleccionarArchivos={seleccionarArchivos}
        deshabilitado={bloqueado}
        titulo="Elige el documento que quieres reparar"
        ayuda="Acepta también archivos que otros programas no consiguen abrir."
      />

      {documento !== null && (
        <>
          <ul className="lista-datos">
            <li className="lista-datos__elemento">
              <span className="lista-datos__clave">Archivo</span>
              <span className="lista-datos__valor">{documento.nombre}</span>
            </li>
            <li className="lista-datos__elemento">
              <span className="lista-datos__clave">Tamaño</span>
              <span className="lista-datos__valor">
                {formatearTamanoArchivo(documento.tamano)}
              </span>
            </li>
          </ul>

          <section className="diagnostico" aria-live="polite">
            <h3 className="diagnostico__titulo">Diagnóstico</h3>

            {estadoDiagnostico === 'comprobando' && (
              <p className="diagnostico__estado">
                Comprobando el documento con qpdf…
              </p>
            )}

            {estadoDiagnostico === 'fallido' && (
              <p className="diagnostico__estado diagnostico__estado--alerta">
                <IconoAlerta className="diagnostico__icono" />
                No se pudo comprobar el documento. Puedes intentar repararlo de todos
                modos: es lo único que puede ayudar con un archivo así.
              </p>
            )}

            {estadoDiagnostico === 'listo' && revision !== null && (
              <>
                <p
                  className={`diagnostico__estado${
                    revision.estado === 'intacto'
                      ? ' diagnostico__estado--correcto'
                      : ' diagnostico__estado--alerta'
                  }`}
                >
                  {revision.estado === 'intacto' ? (
                    <IconoVerificado className="diagnostico__icono" />
                  ) : (
                    <IconoAlerta className="diagnostico__icono" />
                  )}
                  {describirEstado(revision.estado)}
                </p>

                <p className="diagnostico__explicacion">
                  {explicarEstado(revision.estado)}
                </p>

                <ul className="lista-datos">
                  <li className="lista-datos__elemento">
                    <span className="lista-datos__clave">Páginas detectadas</span>
                    <span className="lista-datos__valor">
                      {diagnostico?.numeroPaginas === null ||
                      diagnostico?.numeroPaginas === undefined
                        ? 'No se pudieron contar'
                        : diagnostico.numeroPaginas}
                    </span>
                  </li>
                  <li className="lista-datos__elemento">
                    <span className="lista-datos__clave">
                      Protegido con contraseña
                    </span>
                    <span className="lista-datos__valor">
                      {revision.necesitaContrasena ? 'Sí' : 'No'}
                    </span>
                  </li>
                </ul>

                {revision.necesitaContrasena && (
                  <p className="diagnostico__explicacion">
                    Este documento está cifrado. Desbloquéalo primero con
                    «Desbloquear PDF» y vuelve a intentarlo: no se puede reparar lo
                    que no se puede leer.
                  </p>
                )}

                {revision.estado === 'intacto' && (
                  <p className="diagnostico__explicacion">
                    Un diagnóstico limpio significa que <strong>qpdf</strong> no
                    encuentra errores, no que todos los lectores vayan a aceptar el
                    archivo. Si algún programa te lo rechaza, repararlo puede
                    arreglarlo igualmente.
                  </p>
                )}

                {revision.hallazgos.length > 0 && (
                  <>
                    <h4 className="diagnostico__subtitulo">
                      Qué le pasa al documento
                    </h4>

                    <ol className="diagnostico__hallazgos">
                      {revision.hallazgos.map((hallazgo, indice) => (
                        <li
                          className="diagnostico__hallazgo"
                          // Los hallazgos no cambian de orden ni se editan.
                          key={indice}
                        >
                          <span className="etiqueta-dato">
                            {describirClaseHallazgo(hallazgo.clase)}
                          </span>
                          <span className="diagnostico__afectado">
                            {explicarClaseHallazgo(hallazgo.clase)}
                          </span>
                        </li>
                      ))}
                    </ol>

                    <DetallesTecnicos
                      explicacion={
                        <p className="diagnostico__explicacion">
                          Arriba tienes, en español, qué parte del documento está
                          afectada. Si quieres el detalle exacto, qpdf escribe sus
                          propios mensajes y son la información más precisa que hay
                          sobre el daño.
                        </p>
                      }
                      titulo="Mensajes originales de qpdf"
                    >
                      <ul className="diagnostico__mensajes">
                        {revision.hallazgos.map((hallazgo, indice) => (
                          <li key={indice}>
                            <code className="diagnostico__mensaje">
                              {hallazgo.mensaje}
                            </code>
                          </li>
                        ))}
                      </ul>
                    </DetallesTecnicos>
                  </>
                )}
              </>
            )}
          </section>

          <GrupoOpciones
            etiqueta="Cuánto reescribir"
            opciones={NIVELES}
            valor={nivel}
            deshabilitado={bloqueado}
            alCambiar={cambiarNivel}
            enColumna
            ayuda="Con un archivo dañado conviene tocar lo mínimo: cada transformación adicional es una oportunidad más de perder algo."
          />

          <div className="herramienta__acciones">
            <button
              className="boton boton--primario"
              type="button"
              disabled={!puedeReparar}
              onClick={reparar}
            >
              <IconoVerificado className="boton__icono" />
              {proceso.procesando ? 'Reparando…' : 'Reparar el documento'}
            </button>

            <button
              className="boton boton--discreto"
              type="button"
              disabled={bloqueado}
              onClick={restablecer}
            >
              <IconoRestablecer className="boton__icono" />
              Empezar de nuevo
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

          {proceso.resultado !== null && (
            <ul className="lista-datos">
              <li className="lista-datos__elemento">
                <span className="lista-datos__clave">Tamaño del original</span>
                <span className="lista-datos__valor">
                  {formatearTamanoArchivo(proceso.resultado.tamanoOriginal)}
                </span>
              </li>
              <li className="lista-datos__elemento">
                <span className="lista-datos__clave">Tamaño del reparado</span>
                <span className="lista-datos__valor">
                  {formatearTamanoArchivo(proceso.resultado.tamano)}
                </span>
              </li>
              <li className="lista-datos__elemento">
                <span className="lista-datos__clave">Páginas recuperadas</span>
                <span className="lista-datos__valor">
                  {proceso.resultado.numeroPaginas}
                </span>
              </li>
            </ul>
          )}
        </>
      )}

      <EstadoProcesamiento
        textoProceso={describirEstadoOcupado(
          estado,
          'Leyendo el documento y reescribiéndolo con qpdf.',
        )}
        textoExito={
          proceso.resultado === null
            ? null
            : `${proceso.resultado.explicacion} La descarga se ha iniciado automáticamente.`
        }
        textoAviso={mensajeAviso}
        textoError={mensajeError}
      />
    </div>
  )
}

import { IconoAlerta, IconoCargando, IconoVerificado } from './Iconos'

interface PropiedadesEstadoProcesamiento {
  /** Texto que se muestra mientras hay un proceso en curso, o `null`. */
  readonly textoProceso: string | null
  /** Mensaje de una operación terminada correctamente, o `null`. */
  readonly textoExito: string | null
  /** Aviso informativo, o `null`. */
  readonly textoAviso: string | null
  /** Mensaje de error, o `null`. */
  readonly textoError: string | null
}

/**
 * Mensajes de estado compartidos por todas las herramientas.
 *
 * Se usan dos regiones activas: una amable para los avisos y el progreso, y
 * otra inmediata para los errores. Los contenedores existen siempre en el
 * documento, porque `aria-live` solo anuncia los cambios de un elemento que ya
 * estaba presente. Ningún estado se comunica solo con el color: siempre hay
 * texto y, cuando aporta, un icono.
 */
export function EstadoProcesamiento({
  textoProceso,
  textoExito,
  textoAviso,
  textoError,
}: PropiedadesEstadoProcesamiento) {
  return (
    <>
      <div className="herramienta__mensajes" role="status" aria-live="polite">
        {textoProceso !== null && (
          <p className="mensaje mensaje--proceso">
            <IconoCargando className="mensaje__icono mensaje__icono--girando" />
            {textoProceso}
          </p>
        )}

        {textoExito !== null && (
          <p className="mensaje mensaje--correcto">
            <IconoVerificado className="mensaje__icono" />
            {textoExito}
          </p>
        )}

        {textoAviso !== null && (
          <p className="mensaje mensaje--informacion">{textoAviso}</p>
        )}
      </div>

      <div className="herramienta__mensajes" role="alert" aria-live="assertive">
        {textoError !== null && (
          <p className="mensaje mensaje--error">
            <IconoAlerta className="mensaje__icono" />
            {textoError}
          </p>
        )}
      </div>
    </>
  )
}

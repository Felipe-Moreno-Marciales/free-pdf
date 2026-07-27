import {
  NOMBRE_APLICACION,
  NOMBRE_LICENCIA,
  URL_LICENCIA,
  URL_REPOSITORIO,
} from '../constantes'

/** Pie de página con la licencia y el enlace al código fuente. */
export function PiePagina() {
  return (
    <footer className="pie-pagina">
      <div className="pie-pagina__interior">
        <p className="pie-pagina__texto">
          <strong>{NOMBRE_APLICACION}</strong> es software libre. Se distribuye
          bajo la licencia{' '}
          <a
            className="pie-pagina__enlace"
            href={URL_LICENCIA}
            target="_blank"
            rel="noreferrer"
          >
            {NOMBRE_LICENCIA}
          </a>
          , que garantiza que cualquiera pueda usarlo, estudiarlo, modificarlo y
          compartirlo.
        </p>

        <p className="pie-pagina__texto">
          <a
            className="pie-pagina__enlace"
            href={URL_REPOSITORIO}
            target="_blank"
            rel="noreferrer"
          >
            Consulta el código fuente en GitHub
          </a>
        </p>
      </div>
    </footer>
  )
}

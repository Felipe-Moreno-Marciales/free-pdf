import { NOMBRE_APLICACION, URL_REPOSITORIO } from '../constantes'
import { IconoGitHub, IconoLogotipo } from './Iconos'

/** Cabecera con la marca del proyecto y los enlaces principales. */
export function Encabezado() {
  return (
    <header className="encabezado">
      <div className="encabezado__interior">
        <a className="encabezado__marca" href="#inicio">
          <IconoLogotipo className="encabezado__logotipo" />
          <span className="encabezado__nombre">{NOMBRE_APLICACION}</span>
        </a>

        <nav className="encabezado__navegacion" aria-label="Navegación principal">
          <a className="encabezado__enlace" href="#herramientas">
            Herramientas
          </a>
          <a
            className="encabezado__enlace"
            href={URL_REPOSITORIO}
            target="_blank"
            rel="noreferrer"
          >
            <IconoGitHub className="encabezado__icono" />
            <span>GitHub</span>
            <span className="solo-lector-pantalla">
              {' '}
              (se abre en una pestaña nueva)
            </span>
          </a>
        </nav>
      </div>
    </header>
  )
}

import { AvisoPrivacidad } from './componentes/AvisoPrivacidad'
import { Encabezado } from './componentes/Encabezado'
import { PanelHerramienta } from './componentes/PanelHerramienta'
import { PiePagina } from './componentes/PiePagina'
import { Presentacion } from './componentes/Presentacion'
import { SelectorHerramientas } from './componentes/SelectorHerramientas'
import { useHerramientaActiva } from './ganchos/useHerramientaActiva'
import { buscarHerramienta } from './herramientas/catalogo'
import './aplicacion.css'

/** Estructura general de la aplicación. */
export function Aplicacion() {
  const { idActiva, abrir, cerrar } = useHerramientaActiva()
  const herramienta = buscarHerramienta(idActiva)

  return (
    <div className="aplicacion">
      <a className="enlace-salto" href="#contenido">
        Saltar al contenido principal
      </a>

      <Encabezado />

      <main className="aplicacion__principal" id="contenido">
        {herramienta === null ? (
          <>
            <Presentacion />
            <SelectorHerramientas idActiva={idActiva} alAbrir={abrir} />
          </>
        ) : (
          <PanelHerramienta herramienta={herramienta} alVolver={cerrar} />
        )}

        <AvisoPrivacidad />
      </main>

      <PiePagina />
    </div>
  )
}

import { AvisoPrivacidad } from './componentes/AvisoPrivacidad'
import { Encabezado } from './componentes/Encabezado'
import { PiePagina } from './componentes/PiePagina'
import { Presentacion } from './componentes/Presentacion'
import { HerramientaUnirPdf } from './funcionalidades/unir-pdf/HerramientaUnirPdf'
import './aplicacion.css'

/** Estructura general de la aplicación. */
export function Aplicacion() {
  return (
    <div className="aplicacion">
      <a className="enlace-salto" href="#contenido">
        Saltar al contenido principal
      </a>

      <Encabezado />

      <main className="aplicacion__principal" id="contenido">
        <Presentacion />
        <HerramientaUnirPdf />
        <AvisoPrivacidad />
      </main>

      <PiePagina />
    </div>
  )
}

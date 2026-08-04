import type { DefinicionHerramienta } from '../herramientas/tipos'
import { IconoFlechaDerecha } from './Iconos'

interface PropiedadesTarjetaHerramienta {
  /** Herramienta que describe la tarjeta. */
  readonly herramienta: DefinicionHerramienta
  /** Abre la herramienta. */
  readonly alAbrir: () => void
}

/**
 * Tarjeta que presenta una herramienta dentro del listado.
 *
 * El botón lleva un nombre accesible completo, de modo que quien navegue con
 * lector de pantalla sepa qué herramienta abre sin depender del contexto
 * visual. Su estado deshabilitado refleja si la herramienta todavía no puede
 * abrirse.
 */
export function TarjetaHerramienta({
  herramienta,
  alAbrir,
}: PropiedadesTarjetaHerramienta) {
  const { Icono } = herramienta

  return (
    <article className="tarjeta-herramienta">
      <Icono className="tarjeta-herramienta__icono" />

      <div className="tarjeta-herramienta__texto">
        <h3 className="tarjeta-herramienta__nombre">{herramienta.nombre}</h3>
        <p className="tarjeta-herramienta__descripcion">
          {herramienta.descripcion}
        </p>
      </div>

      <button
        className="boton boton--primario tarjeta-herramienta__boton"
        type="button"
        disabled={!herramienta.disponible}
        onClick={alAbrir}
        aria-label={`Abrir la herramienta ${herramienta.nombre}`}
      >
        Abrir
        <IconoFlechaDerecha className="boton__icono" />
      </button>
    </article>
  )
}

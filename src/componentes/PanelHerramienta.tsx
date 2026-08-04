import { Suspense } from 'react'
import { buscarCategoria } from '../herramientas/catalogo'
import type { DefinicionHerramienta } from '../herramientas/tipos'
import { IconoCargando, IconoVolver } from './Iconos'

interface PropiedadesPanelHerramienta {
  /** Herramienta que se está mostrando. */
  readonly herramienta: DefinicionHerramienta
  /** Vuelve al listado de herramientas. */
  readonly alVolver: () => void
}

/**
 * Envoltorio común de todas las herramientas.
 *
 * Aporta el título, la descripción y el botón para regresar al listado, y
 * espera a que la interfaz de la herramienta se descargue. Cada herramienta se
 * carga de forma diferida, así que este componente muestra un aviso mientras
 * llega su código.
 */
export function PanelHerramienta({
  herramienta,
  alVolver,
}: PropiedadesPanelHerramienta) {
  const { Icono, Panel } = herramienta
  const categoria = buscarCategoria(herramienta)

  return (
    <section
      className="herramienta"
      id="herramientas"
      data-categoria={herramienta.categoria}
      aria-labelledby="herramienta-titulo"
    >
      <div className="herramienta__encabezado">
        <button className="boton boton--discreto" type="button" onClick={alVolver}>
          <IconoVolver className="boton__icono" />
          Todas las herramientas
        </button>

        <div className="herramienta__introduccion">
          {categoria !== null && (
            <p className="herramienta__categoria">{categoria.nombre}</p>
          )}
          <h2 className="herramienta__titulo" id="herramienta-titulo">
            <Icono className="herramienta__icono" />
            {herramienta.nombre}
          </h2>
          <p className="herramienta__descripcion">{herramienta.descripcion}</p>
        </div>
      </div>

      <Suspense
        fallback={
          <p className="mensaje mensaje--proceso" role="status">
            <IconoCargando className="mensaje__icono mensaje__icono--girando" />
            Cargando la herramienta…
          </p>
        }
      >
        <Panel />
      </Suspense>
    </section>
  )
}

import { agruparPorCategoria } from '../herramientas/catalogo'
import type { IdHerramienta } from '../herramientas/tipos'
import { TarjetaHerramienta } from './TarjetaHerramienta'

interface PropiedadesSelectorHerramientas {
  /** Herramienta abierta, o `null` si se está viendo el listado completo. */
  readonly idActiva: IdHerramienta | null
  /** Abre una herramienta. */
  readonly alAbrir: (id: IdHerramienta) => void
}

/**
 * Listado accesible de las herramientas disponibles, agrupadas por categoría.
 *
 * Se usan listas de tarjetas con un botón cada una en lugar del patrón de
 * pestañas: cada herramienta es una vista completa, no una pestaña dentro de un
 * mismo contenido. Cada categoría es una sección con su propio encabezado, así que
 * la estructura se puede recorrer con los atajos de encabezado de un lector de
 * pantalla y no depende del color con el que se distinguen los grupos.
 *
 * La herramienta abierta se marca con `aria-current`, así que quien vuelva al
 * listado sabe en qué estaba.
 */
export function SelectorHerramientas({
  idActiva,
  alAbrir,
}: PropiedadesSelectorHerramientas) {
  const grupos = agruparPorCategoria()

  return (
    <section
      className="selector-herramientas"
      id="herramientas"
      aria-labelledby="selector-titulo"
    >
      <div className="selector-herramientas__introduccion">
        <h2 className="selector-herramientas__titulo" id="selector-titulo">
          Herramientas disponibles
        </h2>
        <p className="selector-herramientas__descripcion">
          Todas funcionan por completo en tu navegador: tus archivos no se suben a
          ningún servidor.
        </p>
      </div>

      {grupos.map(({ categoria, herramientas }) => (
        <section
          className="categoria"
          key={categoria.id}
          data-categoria={categoria.id}
          aria-labelledby={`categoria-${categoria.id}`}
        >
          <div className="categoria__encabezado">
            <h3 className="categoria__titulo" id={`categoria-${categoria.id}`}>
              {categoria.nombre}
            </h3>
            <p className="categoria__descripcion">{categoria.descripcion}</p>
          </div>

          <ul className="selector-herramientas__lista">
            {herramientas.map((herramienta) => (
              <li
                className="selector-herramientas__elemento"
                key={herramienta.id}
                aria-current={idActiva === herramienta.id ? 'true' : undefined}
              >
                <TarjetaHerramienta
                  herramienta={herramienta}
                  alAbrir={() => alAbrir(herramienta.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}

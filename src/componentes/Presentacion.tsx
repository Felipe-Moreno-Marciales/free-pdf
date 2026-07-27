import { IconoCodigo, IconoEscudo, IconoOjoTachado } from './Iconos'

/** Distintivos que resumen las garantías del proyecto. */
const DISTINTIVOS = [
  { etiqueta: '100 % local', Icono: IconoEscudo },
  { etiqueta: 'Código abierto', Icono: IconoCodigo },
  { etiqueta: 'Sin registros', Icono: IconoOjoTachado },
] as const

/** Presentación principal de la aplicación. */
export function Presentacion() {
  return (
    <section
      className="presentacion"
      id="inicio"
      aria-labelledby="presentacion-titulo"
    >
      <h1 className="presentacion__titulo" id="presentacion-titulo">
        Herramientas PDF privadas y gratuitas
      </h1>

      <p className="presentacion__texto">
        Procesa tus documentos directamente en el navegador. Tus archivos nunca
        salen de tu dispositivo.
      </p>

      <ul className="presentacion__distintivos">
        {DISTINTIVOS.map(({ etiqueta, Icono }) => (
          <li className="distintivo" key={etiqueta}>
            <Icono className="distintivo__icono" />
            {etiqueta}
          </li>
        ))}
      </ul>
    </section>
  )
}

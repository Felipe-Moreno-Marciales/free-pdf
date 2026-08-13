import { useId, useState, type ReactNode } from 'react'
import { IconoCodigo } from './Iconos'

interface PropiedadesDetallesTecnicos {
  /**
   * Explicación en español de lo que contienen los detalles.
   *
   * No es opcional: es el texto principal. Los detalles técnicos amplían, nunca
   * sustituyen, y quien no quiera abrirlos debe entender igual qué ha pasado.
   */
  readonly explicacion: ReactNode
  /** Rótulo del control que despliega los detalles. */
  readonly titulo?: string
  /** Aclaración breve sobre la naturaleza del contenido desplegable. */
  readonly aclaracion?: string
  /** Contenido técnico, que puede venir en inglés del motor. */
  readonly children: ReactNode
}

/**
 * Sección plegable para la salida literal de un motor externo.
 *
 * Existe por una razón concreta: qpdf, PDF.js y los demás motores escriben sus
 * mensajes en inglés, y esos mensajes son la información más precisa que hay sobre lo
 * que ha ocurrido. Traducirlos perdería exactitud y haría imposible buscarlos en la
 * documentación del motor o en un foro.
 *
 * La solución no es esconderlos ni traducirlos a medias, sino **subordinarlos**: la
 * explicación en español es lo que se lee siempre, y el texto original queda dentro de
 * unos detalles que hay que abrir a propósito. Así la interfaz está en español sin
 * renunciar a la precisión.
 *
 * Se usa `<details>` nativo: funciona con teclado y con lector de pantalla sin que
 * haya que programar nada, y anuncia por sí solo si está abierto o cerrado.
 */
export function DetallesTecnicos({
  explicacion,
  titulo = 'Detalles técnicos',
  aclaracion = 'Texto original del motor, en inglés',
  children,
}: PropiedadesDetallesTecnicos) {
  const [abierto, establecerAbierto] = useState(false)
  const identificador = useId()

  return (
    <div className="detalles-tecnicos">
      <div className="detalles-tecnicos__explicacion" id={identificador}>
        {explicacion}
      </div>

      <details
        className="detalles-tecnicos__bloque"
        open={abierto}
        onToggle={(evento) =>
          establecerAbierto(evento.currentTarget.open)
        }
      >
        <summary className="detalles-tecnicos__resumen">
          <IconoCodigo className="detalles-tecnicos__icono" />
          {titulo}
          <span className="detalles-tecnicos__aclaracion">
            {aclaracion}
          </span>
        </summary>

        <div className="detalles-tecnicos__contenido">{children}</div>
      </details>
    </div>
  )
}

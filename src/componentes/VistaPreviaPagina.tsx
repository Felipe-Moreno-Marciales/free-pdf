import type { ColocacionImagen } from '../imagenes/tipos'
import { formatearMilimetros, puntosAMilimetros } from '../utilidades/unidades'

/** Ancho máximo de la vista previa, en píxeles CSS. */
const ANCHO_MAXIMO = 200

/** Alto máximo de la vista previa, en píxeles CSS. */
const ALTO_MAXIMO = 260

interface PropiedadesVistaPreviaPagina {
  /** Colocación calculada de la imagen dentro de su página. */
  readonly colocacion: ColocacionImagen
  /** Color de fondo de la página. */
  readonly colorFondo: string
}

/**
 * Vista previa esquemática de la página que se va a generar.
 *
 * No dibuja la imagen: representa la página, el área que ocupará la imagen y los
 * márgenes que quedan, que es lo que necesita comprobarse al cambiar el tamaño,
 * la orientación o el ajuste. Se dibuja con elementos normales y no con un
 * `canvas`, de modo que se puede leer con un lector de pantalla; las medidas
 * exactas se facilitan además como texto debajo.
 */
export function VistaPreviaPagina({
  colocacion,
  colorFondo,
}: PropiedadesVistaPreviaPagina) {
  const escala = Math.min(
    ANCHO_MAXIMO / colocacion.pagina.ancho,
    ALTO_MAXIMO / colocacion.pagina.alto,
  )

  const anchoPagina = colocacion.pagina.ancho * escala
  const altoPagina = colocacion.pagina.alto * escala

  const anchoMm = puntosAMilimetros(colocacion.pagina.ancho)
  const altoMm = puntosAMilimetros(colocacion.pagina.alto)
  const anchoImagenMm = puntosAMilimetros(colocacion.ancho)
  const altoImagenMm = puntosAMilimetros(colocacion.alto)

  return (
    <figure className="vista-previa-pagina">
      <div
        className="vista-previa-pagina__hoja"
        style={{
          width: `${anchoPagina}px`,
          height: `${altoPagina}px`,
          backgroundColor: colorFondo,
        }}
        aria-hidden="true"
      >
        <div
          className="vista-previa-pagina__imagen"
          style={{
            left: `${colocacion.x * escala}px`,
            bottom: `${colocacion.y * escala}px`,
            width: `${colocacion.ancho * escala}px`,
            height: `${colocacion.alto * escala}px`,
          }}
        />
      </div>

      <figcaption className="vista-previa-pagina__texto">
        <span>
          Página de {formatearMilimetros(anchoMm)} × {formatearMilimetros(altoMm)}
          .
        </span>
        <span>
          La imagen ocupará {formatearMilimetros(anchoImagenMm)} ×{' '}
          {formatearMilimetros(altoImagenMm)}.
        </span>
        {colocacion.recorta && (
          <span className="vista-previa-pagina__aviso">
            Con el ajuste «cubrir» se recortarán los bordes que sobren para
            rellenar la página sin deformar la imagen.
          </span>
        )}
      </figcaption>
    </figure>
  )
}

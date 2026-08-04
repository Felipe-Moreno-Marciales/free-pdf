import { useMemo } from 'react'
import type { PosicionEnPagina } from '../pdf/posicionarEnPagina'

/** Ancho de la hoja de la vista previa, en píxeles CSS. */
const ANCHO_HOJA = 190

/** Proporción de una página A4 vertical, que es la que se representa. */
const PROPORCION_A4 = 297 / 210

interface PropiedadesVistaPreviaMarcaAgua {
  /** Texto de la marca, o `null` si la marca es una imagen. */
  readonly texto: string | null
  /** Dirección de la imagen de la marca, o `null` si la marca es de texto. */
  readonly urlImagen: string | null
  /** Tamaño de la tipografía en puntos, para las marcas de texto. */
  readonly tamanoFuente: number
  /** Color del texto. */
  readonly color: string
  /** Opacidad, en porcentaje. */
  readonly opacidadPorcentaje: number
  /** Giro, en grados y en sentido contrario a las agujas del reloj. */
  readonly rotacionGrados: number
  /** Posición dentro de la página. */
  readonly posicion: PosicionEnPagina
  /** `true` cuando la marca se repite en mosaico. */
  readonly esMosaico: boolean
  /** Ancho de la marca de imagen, como porcentaje del ancho de la página. */
  readonly escalaPorcentaje: number
}

/**
 * Previsualización de la marca de agua sobre una página de ejemplo.
 *
 * No es una reproducción exacta del documento: representa una página A4 vertical
 * con unas líneas que sugieren el texto, y sobre ella la marca con su posición,
 * su escala, su giro, su color y su opacidad, que es lo que hay que poder juzgar
 * antes de generar el archivo. El resultado real depende del tamaño de cada
 * página del documento.
 *
 * La hoja se marca como decorativa y toda la información se facilita también en
 * texto, de modo que la vista previa no es la única forma de saber qué se ha
 * configurado.
 */
export function VistaPreviaMarcaAgua({
  texto,
  urlImagen,
  tamanoFuente,
  color,
  opacidadPorcentaje,
  rotacionGrados,
  posicion,
  esMosaico,
  escalaPorcentaje,
}: PropiedadesVistaPreviaMarcaAgua) {
  const altoHoja = ANCHO_HOJA * PROPORCION_A4

  // El tamaño en puntos se traslada a la escala de la hoja: una A4 mide 595
  // puntos de ancho, así que la proporción entre ambos da el tamaño en pantalla.
  const tamanoEnPantalla = (tamanoFuente / 595) * ANCHO_HOJA

  const copias = useMemo(
    () => (esMosaico ? crearPosicionesMosaico() : [null]),
    [esMosaico],
  )

  const estiloMarca = {
    color,
    opacity: opacidadPorcentaje / 100,
    transform: `rotate(${-rotacionGrados}deg)`,
  }

  return (
    <div className="vista-previa-marca">
      <div
        className="vista-previa-marca__hoja"
        style={{ width: `${ANCHO_HOJA}px`, height: `${altoHoja}px` }}
        aria-hidden="true"
      >
        <div className="vista-previa-marca__lineas">
          {Array.from({ length: 14 }, (_, indice) => (
            <span className="vista-previa-marca__linea" key={indice} />
          ))}
        </div>

        <div
          className="vista-previa-marca__capa"
          data-mosaico={esMosaico}
          data-posicion={esMosaico ? undefined : posicion}
        >
          {copias.map((clave, indice) => (
            <span
              className="vista-previa-marca__copia"
              key={clave ?? indice}
              style={estiloMarca}
            >
              {urlImagen === null ? (
                <span
                  className="vista-previa-marca__texto"
                  style={{ fontSize: `${Math.max(6, tamanoEnPantalla)}px` }}
                >
                  {texto ?? ''}
                </span>
              ) : (
                <img
                  className="vista-previa-marca__imagen"
                  src={urlImagen}
                  alt=""
                  style={{
                    width: `${(escalaPorcentaje / 100) * ANCHO_HOJA}px`,
                  }}
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Claves de las nueve copias que representan el mosaico. */
function crearPosicionesMosaico(): readonly string[] {
  return ['1', '2', '3', '4', '5', '6', '7', '8', '9']
}

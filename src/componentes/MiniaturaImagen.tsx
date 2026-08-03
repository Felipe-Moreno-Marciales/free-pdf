import { useEffect, useMemo, useRef, useState } from 'react'
import { descodificarImagen } from '../imagenes/cargarImagen'
import { dibujarMiniatura } from '../imagenes/dibujarImagen'
import {
  liberarImagenDescodificada,
  liberarLienzo,
} from '../imagenes/liberarImagen'
import type {
  AjustesImagen,
  RecorteRelativo,
  TransformacionImagen,
} from '../imagenes/tipos'
import type { GradosRotacion } from '../pdf/tipos'

/** Ancho en píxeles con el que se dibujan las miniaturas de imágenes. */
const ANCHO_MINIATURA = 200

/** Margen alrededor de la ventana en el que ya se empieza a dibujar. */
const MARGEN_ANTICIPACION = '400px'

/** Estado del dibujado de una miniatura. */
type EstadoMiniatura = 'pendiente' | 'dibujando' | 'lista' | 'error'

interface PropiedadesMiniaturaImagen {
  /** Contenido de la imagen. */
  readonly contenido: Blob
  /** Nombre visible, solo para los mensajes de error. */
  readonly nombre: string
  /** Giro que se aplica en la miniatura. */
  readonly rotacion: GradosRotacion
  /** Recorte que se aplica, o `null` si se muestra completa. */
  readonly recorte?: RecorteRelativo | null
  /** Ajustes de color que se aplican, o `null` si se muestra tal cual. */
  readonly ajustes?: AjustesImagen | null
  /** Descripción accesible de lo que representa la miniatura. */
  readonly descripcion: string
}

/**
 * Miniatura de una imagen, dibujada en un `canvas`.
 *
 * El dibujado es diferido: solo se lanza cuando la miniatura se acerca a la
 * ventana, de modo que una selección de cincuenta fotografías no descodifica
 * cincuenta imágenes de golpe. En cuanto la miniatura está dibujada se libera la
 * imagen descodificada, que es lo que de verdad ocupa memoria, y al desmontar se
 * vacía también el lienzo.
 *
 * Se usa un `canvas` y no un `<img>` porque así la miniatura refleja el giro, el
 * recorte y los filtros que la persona ha elegido, exactamente como aparecerán en
 * el documento.
 */
export function MiniaturaImagen({
  contenido,
  nombre,
  rotacion,
  recorte = null,
  ajustes = null,
  descripcion,
}: PropiedadesMiniaturaImagen) {
  const refLienzo = useRef<HTMLCanvasElement>(null)
  const refContenedor = useRef<HTMLDivElement>(null)
  const [visible, establecerVisible] = useState(false)
  const [estado, establecerEstado] = useState<EstadoMiniatura>('pendiente')

  // La transformación se compone aquí para que su identidad solo cambie cuando
  // cambia alguno de sus valores, y no en cada renderizado del componente padre.
  const transformacion = useMemo<TransformacionImagen>(
    () => ({ rotacion, recorte, ajustes }),
    [rotacion, recorte, ajustes],
  )

  // Vacía el lienzo al desmontar para devolver su memoria.
  useEffect(() => {
    const lienzo = refLienzo.current

    return () => {
      if (lienzo !== null) {
        liberarLienzo(lienzo)
      }
    }
  }, [])

  // Carga diferida: espera a que la miniatura se acerque a la ventana.
  useEffect(() => {
    if (visible) {
      return
    }

    const contenedor = refContenedor.current
    if (contenedor === null) {
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      establecerVisible(true)
      return
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          establecerVisible(true)
          observador.disconnect()
        }
      },
      { rootMargin: MARGEN_ANTICIPACION },
    )

    observador.observe(contenedor)

    return () => {
      observador.disconnect()
    }
  }, [visible])

  // Dibuja la miniatura y descarta el resultado si cambian los datos antes.
  useEffect(() => {
    if (!visible) {
      return
    }

    const lienzo = refLienzo.current
    if (lienzo === null) {
      return
    }

    let cancelado = false
    establecerEstado('dibujando')

    const dibujar = async (): Promise<void> => {
      const imagen = await descodificarImagen(contenido, nombre)

      try {
        if (cancelado) {
          return
        }

        dibujarMiniatura(lienzo, imagen, transformacion, ANCHO_MINIATURA)

        if (!cancelado) {
          establecerEstado('lista')
        }
      } finally {
        liberarImagenDescodificada(imagen)
      }
    }

    dibujar().catch(() => {
      if (!cancelado) {
        establecerEstado('error')
      }
    })

    return () => {
      cancelado = true
    }
  }, [contenido, nombre, transformacion, visible])

  return (
    <div className="miniatura" data-estado={estado} ref={refContenedor}>
      <canvas className="miniatura__lienzo" ref={refLienzo} aria-hidden="true" />

      {estado !== 'lista' && (
        <span className="miniatura__aviso">
          {estado === 'error' ? 'No se pudo mostrar' : 'Cargando…'}
        </span>
      )}

      <span className="solo-lector-pantalla">{descripcion}</span>
    </div>
  )
}

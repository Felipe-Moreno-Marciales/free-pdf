import { useCallback, useEffect, useRef, useState } from 'react'
import { leerDimensiones } from '../imagenes/cargarImagen'
import {
  anadirImagenesASeleccion,
  calcularPixelesTotales,
  calcularTamanoTotalImagenes,
  describirDescartesImagenes,
  eliminarImagenDeSeleccion,
  establecerDimensionesImagen,
  girarImagen,
  moverImagen,
  reordenarImagenes,
} from '../imagenes/seleccionImagenes'
import type {
  DesplazamientoImagen,
  ImagenSeleccionada,
} from '../imagenes/tipos'
import {
  PIXELES_AVISO_MEMORIA,
  TAMANO_AVISO_MEMORIA,
} from '../imagenes/validarImagen'
import type { SentidoGiro } from '../pdf/tipos'
import { obtenerMensajeError } from '../utilidades/errores'

/** Texto de reserva cuando la lectura de medidas falla sin mensaje. */
const ERROR_AL_LEER =
  'No se pudieron leer las medidas de alguna imagen. Comprueba que el archivo no esté dañado.'

/** Estado y acciones de una selección de imágenes. */
export interface ControladorSeleccionImagenes {
  /** Imágenes elegidas, en el orden en el que se usarán. */
  readonly imagenes: readonly ImagenSeleccionada[]
  /** `true` mientras se leen las medidas de alguna imagen. */
  readonly leyendoMedidas: boolean
  /** Aviso sobre la última selección, o `null`. */
  readonly mensajeAviso: string | null
  /** Mensaje de error de la lectura de medidas, o `null`. */
  readonly mensajeError: string | null
  /** Suma en bytes del tamaño de todas las imágenes. */
  readonly tamanoTotal: number
  /** `true` cuando la selección puede consumir bastante memoria. */
  readonly avisoMemoria: boolean
  /** Añade imágenes al final de la selección. */
  readonly anadir: (archivos: readonly File[]) => void
  /** Quita una imagen. */
  readonly eliminar: (id: string) => void
  /** Vacía la selección completa. */
  readonly limpiar: () => void
  /** Mueve una imagen dentro de la lista. */
  readonly mover: (id: string, desplazamiento: DesplazamientoImagen) => void
  /** Mueve una imagen de una posición a otra, para el reordenado por arrastre. */
  readonly reordenar: (posicionOrigen: number, posicionDestino: number) => void
  /** Gira una imagen un cuarto de vuelta. */
  readonly girar: (id: string, sentido: SentidoGiro) => void
}

/**
 * Concentra la selección de imágenes compartida por «Imágenes a PDF» y
 * «Escanear a PDF».
 *
 * Se guardan los objetos `File` y no sus bytes: el contenido se vuelve a leer
 * solo cuando hace falta, así que no se mantienen varios megabytes por imagen en
 * memoria. Las medidas de cada imagen se leen de una en una y en cuanto se
 * conocen se libera la memoria de la descodificación.
 *
 * Nada se guarda en `localStorage`, `sessionStorage`, `IndexedDB` ni cookies: la
 * selección vive únicamente mientras la página está abierta.
 */
export function useSeleccionImagenes(): ControladorSeleccionImagenes {
  const [imagenes, establecerImagenes] = useState<
    readonly ImagenSeleccionada[]
  >([])
  const [mensajeAviso, establecerMensajeAviso] = useState<string | null>(null)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const [leyendoMedidas, establecerLeyendoMedidas] = useState(false)

  // Evita seguir escribiendo en el estado después de desmontar.
  const refMontado = useRef(true)
  // Identificadores cuya lectura ya se ha intentado, para no repetirla.
  const refIntentados = useRef(new Set<string>())
  /**
   * Copia de la selección accesible de forma inmediata.
   *
   * Al añadir imágenes hay que descartar los duplicados —lo que exige conocer la
   * lista actual— y además redactar el aviso de los descartes. Ese aviso es un
   * efecto, así que no puede calcularse dentro de la función que actualiza el
   * estado: React puede llamarla más de una vez y, si la lista no cambia, ni
   * siquiera vuelve a renderizar, con lo que el aviso se perdería. La referencia
   * permite hacer las dos cosas fuera del actualizador.
   */
  const refImagenes = useRef<readonly ImagenSeleccionada[]>([])

  useEffect(() => {
    refMontado.current = true

    return () => {
      refMontado.current = false
    }
  }, [])

  // Mantiene la referencia al día con el estado.
  useEffect(() => {
    refImagenes.current = imagenes
  }, [imagenes])

  // Lee las medidas de las imágenes que aún no las tienen, de una en una para
  // no descodificar varias fotografías grandes al mismo tiempo.
  useEffect(() => {
    const pendientes = imagenes.filter(
      (imagen) =>
        imagen.dimensiones === null && !refIntentados.current.has(imagen.id),
    )

    if (pendientes.length === 0) {
      return
    }

    let cancelado = false
    establecerLeyendoMedidas(true)

    const leer = async (): Promise<void> => {
      for (const imagen of pendientes) {
        if (cancelado || !refMontado.current) {
          return
        }

        refIntentados.current.add(imagen.id)

        try {
          const dimensiones = await leerDimensiones(
            imagen.archivo,
            imagen.nombre,
          )

          if (cancelado || !refMontado.current) {
            return
          }

          establecerImagenes((actuales) =>
            establecerDimensionesImagen(actuales, imagen.id, dimensiones),
          )
        } catch (error) {
          if (cancelado || !refMontado.current) {
            return
          }

          establecerMensajeError(obtenerMensajeError(error, ERROR_AL_LEER))
        }
      }

      if (!cancelado && refMontado.current) {
        establecerLeyendoMedidas(false)
      }
    }

    void leer()

    return () => {
      cancelado = true
    }
  }, [imagenes])

  const anadir = useCallback((archivos: readonly File[]): void => {
    const actualizacion = anadirImagenesASeleccion(
      refImagenes.current,
      archivos,
    )

    // Se actualiza la referencia en el acto para que dos llamadas seguidas, antes
    // de que React vuelva a renderizar, sigan detectando los duplicados.
    refImagenes.current = actualizacion.imagenes

    establecerMensajeError(null)
    establecerMensajeAviso(describirDescartesImagenes(actualizacion.descartadas))
    establecerImagenes(actualizacion.imagenes)
  }, [])

  const eliminar = useCallback((id: string): void => {
    refIntentados.current.delete(id)
    establecerImagenes((actuales) => eliminarImagenDeSeleccion(actuales, id))
  }, [])

  const limpiar = useCallback((): void => {
    refIntentados.current.clear()
    refImagenes.current = []
    establecerImagenes([])
    establecerMensajeAviso(null)
    establecerMensajeError(null)
  }, [])

  const mover = useCallback(
    (id: string, desplazamiento: DesplazamientoImagen): void => {
      establecerImagenes((actuales) =>
        moverImagen(actuales, id, desplazamiento),
      )
    },
    [],
  )

  const reordenar = useCallback(
    (posicionOrigen: number, posicionDestino: number): void => {
      establecerImagenes((actuales) =>
        reordenarImagenes(actuales, posicionOrigen, posicionDestino),
      )
    },
    [],
  )

  const girar = useCallback((id: string, sentido: SentidoGiro): void => {
    establecerImagenes((actuales) => girarImagen(actuales, id, sentido))
  }, [])

  const tamanoTotal = calcularTamanoTotalImagenes(imagenes)
  const avisoMemoria =
    tamanoTotal > TAMANO_AVISO_MEMORIA ||
    calcularPixelesTotales(imagenes) > PIXELES_AVISO_MEMORIA

  return {
    imagenes,
    leyendoMedidas,
    mensajeAviso,
    mensajeError,
    tamanoTotal,
    avisoMemoria,
    anadir,
    eliminar,
    limpiar,
    mover,
    reordenar,
    girar,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { lienzoABlob } from '../../imagenes/convertirCanvas'
import { crearLienzo, obtenerContexto } from '../../imagenes/dibujarImagen'
import { ErrorImagen } from '../../imagenes/erroresImagen'
import { liberarLienzo } from '../../imagenes/liberarImagen'
import {
  admiteCamara,
  detenerFlujo,
  elegirCamaraTrasera,
  enumerarCamaras,
  reemplazarFlujo,
  solicitarFlujo,
  traducirErrorCamara,
  type DispositivoCamara,
  type EstadoCamara,
} from './controlarCamara'

/**
 * Calidad con la que se guardan las capturas.
 *
 * Se usa JPEG con una calidad alta: es lo que produce archivos manejables con
 * fotografías, que es lo que sale de una cámara. Un PNG del mismo encuadre
 * ocuparía varias veces más sin ganancia apreciable.
 */
const CALIDAD_CAPTURA = 0.92

/** Estado y acciones de la cámara. */
export interface ControladorCamara {
  /** Estado actual. */
  readonly estado: EstadoCamara
  /** `true` si el navegador ofrece acceso a la cámara. */
  readonly disponible: boolean
  /** Flujo activo, o `null` si la cámara está apagada. */
  readonly flujo: MediaStream | null
  /** Cámaras detectadas en el dispositivo. */
  readonly dispositivos: readonly DispositivoCamara[]
  /** Identificador de la cámara en uso, o `null`. */
  readonly idActual: string | null
  /** Mensaje de error de la cámara, o `null`. */
  readonly mensajeError: string | null
  /** Enciende la cámara. Solo debe llamarse desde una acción explícita. */
  readonly iniciar: () => void
  /** Cambia a otra cámara, deteniendo la anterior. */
  readonly cambiarCamara: (id: string) => void
  /** Apaga la cámara y detiene todas sus pistas. */
  readonly detener: () => void
  /** Toma una fotografía del fotograma actual del elemento de vídeo. */
  readonly capturar: (video: HTMLVideoElement) => Promise<Blob>
}

/**
 * Gestiona el ciclo de vida de la cámara.
 *
 * Reglas que se cumplen siempre:
 *
 * - El permiso solo se pide después de una acción explícita: nunca al cargar la
 *   página ni al abrir la herramienta.
 * - Al cambiar de cámara se detiene la anterior antes de pedir la nueva.
 * - Al apagar, al terminar y al desmontar el componente se detienen todas las
 *   pistas, que es lo que apaga de verdad la cámara.
 * - No se envía ninguna imagen fuera del dispositivo.
 */
export function useCamara(): ControladorCamara {
  const [estado, establecerEstado] = useState<EstadoCamara>('sin-solicitar')
  const [flujo, establecerFlujo] = useState<MediaStream | null>(null)
  const [dispositivos, establecerDispositivos] = useState<
    readonly DispositivoCamara[]
  >([])
  const [idActual, establecerIdActual] = useState<string | null>(null)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)

  const disponible = admiteCamara()

  // El flujo se guarda también en una referencia para poder detenerlo al
  // desmontar sin que la limpieza dependa del estado.
  const refFlujo = useRef<MediaStream | null>(null)
  const refMontado = useRef(true)
  // Identifica cada petición para descartar las que queden obsoletas.
  const refPeticion = useRef(0)

  useEffect(() => {
    refMontado.current = true

    return () => {
      refMontado.current = false
      refPeticion.current += 1
      detenerFlujo(refFlujo.current)
      refFlujo.current = null
    }
  }, [])

  const detener = useCallback((): void => {
    refPeticion.current += 1
    detenerFlujo(refFlujo.current)
    refFlujo.current = null

    establecerFlujo(null)
    establecerEstado('sin-solicitar')
    establecerMensajeError(null)
  }, [])

  const pedir = useCallback(
    (idDispositivo: string | null): void => {
      if (!admiteCamara()) {
        establecerEstado('no-disponible')
        establecerMensajeError(
          'Este navegador no permite usar la cámara. Recuerda que solo funciona en páginas servidas por HTTPS. Puedes cargar fotografías desde tus archivos.',
        )
        return
      }

      const numeroPeticion = refPeticion.current + 1
      refPeticion.current = numeroPeticion

      establecerEstado('solicitando')
      establecerMensajeError(null)

      const ejecutar = async (): Promise<void> => {
        try {
          const nuevo = await solicitarFlujo(idDispositivo)

          // Si mientras se esperaba el permiso se pidió otra cámara o se salió de
          // la herramienta, el flujo nuevo se detiene y se descarta.
          if (refPeticion.current !== numeroPeticion || !refMontado.current) {
            detenerFlujo(nuevo)
            return
          }

          refFlujo.current = reemplazarFlujo(refFlujo.current, nuevo)
          establecerFlujo(nuevo)
          establecerEstado('activa')

          // Las etiquetas de los dispositivos solo están disponibles después de
          // conceder el permiso, así que la lista se lee ahora.
          const detectados = await enumerarCamaras()

          if (refPeticion.current !== numeroPeticion || !refMontado.current) {
            return
          }

          establecerDispositivos(detectados)
          establecerIdActual(
            idDispositivo ?? leerIdEnUso(nuevo, detectados),
          )
        } catch (error) {
          if (refPeticion.current !== numeroPeticion || !refMontado.current) {
            return
          }

          const traducido = traducirErrorCamara(error)
          establecerEstado(traducido.estado)
          establecerMensajeError(traducido.mensaje)
          establecerFlujo(null)
          refFlujo.current = null
        }
      }

      void ejecutar()
    },
    [],
  )

  const iniciar = useCallback((): void => {
    pedir(null)
  }, [pedir])

  const cambiarCamara = useCallback(
    (id: string): void => {
      establecerIdActual(id)
      pedir(id)
    },
    [pedir],
  )

  const capturar = useCallback(
    async (video: HTMLVideoElement): Promise<Blob> => {
      const ancho = video.videoWidth
      const alto = video.videoHeight

      if (ancho === 0 || alto === 0) {
        throw new ErrorImagen(
          'La cámara todavía no está mostrando imagen. Espera un momento y vuelve a intentarlo.',
        )
      }

      const lienzo = crearLienzo(ancho, alto)

      try {
        const contexto = obtenerContexto(lienzo)
        contexto.drawImage(video, 0, 0, ancho, alto)

        return await lienzoABlob(lienzo, 'jpeg', CALIDAD_CAPTURA)
      } finally {
        // El lienzo de una fotografía puede ocupar varios megabytes.
        liberarLienzo(lienzo)
      }
    },
    [],
  )

  return {
    estado,
    disponible,
    flujo,
    dispositivos,
    idActual,
    mensajeError,
    iniciar,
    cambiarCamara,
    detener,
    capturar,
  }
}

/**
 * Deduce qué cámara está en uso a partir de las pistas del flujo.
 *
 * Cuando el navegador no informa del identificador se recurre a la que
 * probablemente sea la trasera, que es la que se ha pedido.
 */
function leerIdEnUso(
  flujo: MediaStream,
  dispositivos: readonly DispositivoCamara[],
): string | null {
  const pista = flujo.getVideoTracks()[0]
  const desdeAjustes = pista?.getSettings?.().deviceId

  if (typeof desdeAjustes === 'string' && desdeAjustes !== '') {
    return desdeAjustes
  }

  return elegirCamaraTrasera(dispositivos)?.id ?? null
}

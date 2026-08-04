import { useEffect, useId, useRef, useState } from 'react'
import {
  describirEstadoCamara,
  type DispositivoCamara,
  type EstadoCamara,
} from '../funcionalidades/escanear-a-pdf/controlarCamara'
import {
  IconoCamara,
  IconoCambiarCamara,
  IconoDetener,
  IconoObturador,
} from './Iconos'

interface PropiedadesVisorCamara {
  /** Estado actual de la cámara. */
  readonly estado: EstadoCamara
  /** `true` si el navegador ofrece acceso a la cámara. */
  readonly disponible: boolean
  /** Flujo activo, o `null` si la cámara está apagada. */
  readonly flujo: MediaStream | null
  /** Cámaras detectadas. */
  readonly dispositivos: readonly DispositivoCamara[]
  /** Identificador de la cámara en uso, o `null`. */
  readonly idActual: string | null
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Enciende la cámara. */
  readonly alIniciar: () => void
  /** Apaga la cámara. */
  readonly alDetener: () => void
  /** Cambia a otra cámara. */
  readonly alCambiarCamara: (id: string) => void
  /** Toma una fotografía del fotograma actual. */
  readonly alCapturar: (video: HTMLVideoElement) => void
}

/**
 * Visor de la cámara con sus controles.
 *
 * La cámara no se enciende al abrir la herramienta: hace falta pulsar el botón,
 * que es la acción explícita a partir de la cual se pide el permiso. Mientras está
 * apagada no se ocupa el dispositivo ni aparece el indicador del navegador.
 *
 * El elemento `<video>` no puede describir su contenido por sí mismo, así que se
 * le da un nombre accesible y se anuncia el estado en una región activa: quien no
 * vea la imagen sabe igualmente si la cámara está encendida, esperando permiso o
 * no disponible.
 */
export function VisorCamara({
  estado,
  disponible,
  flujo,
  dispositivos,
  idActual,
  deshabilitado,
  alIniciar,
  alDetener,
  alCambiarCamara,
  alCapturar,
}: PropiedadesVisorCamara) {
  const refVideo = useRef<HTMLVideoElement>(null)
  const idSelector = useId()
  const [listoParaCapturar, establecerListoParaCapturar] = useState(false)

  // Conecta el flujo al elemento de vídeo y lo desconecta al cambiar o al salir.
  useEffect(() => {
    const video = refVideo.current
    if (video === null) {
      return
    }

    establecerListoParaCapturar(false)
    video.srcObject = flujo

    if (flujo === null) {
      return
    }

    const alEmpezar = (): void => {
      establecerListoParaCapturar(true)
    }

    video.addEventListener('loadedmetadata', alEmpezar)

    return () => {
      video.removeEventListener('loadedmetadata', alEmpezar)
      // Se suelta la referencia al flujo; detenerlo es responsabilidad del
      // gancho que lo creó.
      video.srcObject = null
    }
  }, [flujo])

  const capturar = (): void => {
    const video = refVideo.current
    if (video !== null) {
      alCapturar(video)
    }
  }

  return (
    <section className="visor-camara" aria-labelledby={`${idSelector}-titulo`}>
      <h3 className="visor-camara__titulo" id={`${idSelector}-titulo`}>
        Cámara
      </h3>

      <div className="visor-camara__marco" data-activa={estado === 'activa'}>
        <video
          className="visor-camara__video"
          ref={refVideo}
          autoPlay
          playsInline
          muted
          aria-label="Imagen en directo de la cámara del dispositivo. La vista solo se usa para encuadrar la fotografía y no se envía a ningún servidor."
        />

        {estado !== 'activa' && (
          <p className="visor-camara__aviso">
            {disponible
              ? describirEstadoCamara(estado)
              : 'Este navegador no permite usar la cámara.'}
          </p>
        )}
      </div>

      <p className="visor-camara__estado" role="status" aria-live="polite">
        {describirEstadoCamara(estado)}
      </p>

      <div
        className="visor-camara__acciones"
        role="group"
        aria-label="Controles de la cámara"
      >
        {estado !== 'activa' ? (
          <button
            className="boton boton--secundario"
            type="button"
            disabled={deshabilitado || !disponible || estado === 'solicitando'}
            onClick={alIniciar}
          >
            <IconoCamara className="boton__icono" />
            {estado === 'solicitando'
              ? 'Esperando permiso…'
              : 'Encender la cámara'}
          </button>
        ) : (
          <>
            <button
              className="boton boton--primario"
              type="button"
              disabled={deshabilitado || !listoParaCapturar}
              onClick={capturar}
            >
              <IconoObturador className="boton__icono" />
              Tomar fotografía
            </button>

            <button
              className="boton boton--discreto"
              type="button"
              disabled={deshabilitado}
              onClick={alDetener}
            >
              <IconoDetener className="boton__icono" />
              Apagar la cámara
            </button>
          </>
        )}
      </div>

      {estado === 'activa' && dispositivos.length > 1 && (
        <div className="visor-camara__selector">
          <label className="visor-camara__etiqueta" htmlFor={idSelector}>
            <IconoCambiarCamara className="visor-camara__icono" />
            Cámara en uso
          </label>

          <select
            className="campo-seleccion"
            id={idSelector}
            value={idActual ?? ''}
            disabled={deshabilitado}
            onChange={(evento) => alCambiarCamara(evento.target.value)}
          >
            {dispositivos.map((dispositivo) => (
              <option key={dispositivo.id} value={dispositivo.id}>
                {dispositivo.etiqueta}
              </option>
            ))}
          </select>

          <p className="visor-camara__ayuda">
            Al cambiar de cámara se apaga la anterior.
          </p>
        </div>
      )}
    </section>
  )
}

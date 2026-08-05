import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import { AJUSTES_NEUTROS } from '../../imagenes/aplicarFiltrosImagen'
import {
  CONFIGURACION_PAGINA_PREDETERMINADA,
} from '../../imagenes/calcularAjusteImagen'
import { leerDimensiones } from '../../imagenes/cargarImagen'
import { normalizarRecorte } from '../../imagenes/recorteImagen'
import type {
  AjustesImagen,
  ConfiguracionPaginaImagen,
  RecorteRelativo,
} from '../../imagenes/tipos'
import { validarArchivoImagen } from '../../imagenes/validarImagen'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import { gradosDelGiro, sumarRotacion } from '../../pdf/rotaciones'
import type {
  EstadoHerramienta,
  ResultadoDocumento,
  SentidoGiro,
} from '../../pdf/tipos'
import { obtenerMensajeError } from '../../utilidades/errores'
import {
  actualizarPorId,
  buscarPorId,
  eliminarPorId,
  moverAPosicion,
  moverPorId,
  type Desplazamiento,
} from '../../utilidades/listas'
import { crearPdfEscaneado } from './crearPdfEscaneado'
import { useCamara, type ControladorCamara } from './useCamara'
import type { CapturaEscaneada } from './tipos'

/** Texto de reserva cuando la lectura de medidas falla sin mensaje. */
const ERROR_AL_LEER =
  'No se pudieron leer las medidas de alguna captura. Vuelve a tomarla o cárgala de nuevo.'

/** Estado y acciones de la herramienta «Escanear a PDF». */
export interface ControladorEscanearAPdf {
  /** Control de la cámara. */
  readonly camara: ControladorCamara
  /** Ejecución y descarga del resultado. */
  readonly proceso: ControladorProcesoPdf<ResultadoDocumento>
  /** Capturas en el orden en el que se convertirán en páginas. */
  readonly capturas: readonly CapturaEscaneada[]
  /** Configuración de las páginas. */
  readonly configuracion: ConfiguracionPaginaImagen
  /** Captura que se está editando, o `null`. */
  readonly capturaEditada: CapturaEscaneada | null
  /** Estado visible de la herramienta. */
  readonly estado: EstadoHerramienta
  /** `true` cuando no se debe permitir ninguna interacción. */
  readonly bloqueado: boolean
  /** Primer mensaje de error pendiente, o `null`. */
  readonly mensajeError: string | null
  /** Aviso sobre la última acción, o `null`. */
  readonly mensajeAviso: string | null
  /** `true` mientras se leen las medidas de alguna captura. */
  readonly leyendoMedidas: boolean
  /** `true` cuando se puede generar el documento. */
  readonly puedeGenerar: boolean
  /** Añade la fotografía tomada con la cámara. */
  readonly anadirCaptura: (contenido: Blob) => void
  /** Añade imágenes cargadas desde el dispositivo. */
  readonly anadirArchivos: (archivos: readonly File[]) => void
  /** Sustituye una captura por una fotografía nueva. */
  readonly repetirCaptura: (id: string, contenido: Blob) => void
  /** Quita una captura. */
  readonly eliminarCaptura: (id: string) => void
  /** Mueve una captura dentro de la lista. */
  readonly moverCaptura: (id: string, desplazamiento: Desplazamiento) => void
  /** Mueve una captura de una posición a otra, para el arrastre. */
  readonly reordenarCapturas: (
    posicionOrigen: number,
    posicionDestino: number,
  ) => void
  /** Gira una captura un cuarto de vuelta. */
  readonly girarCaptura: (id: string, sentido: SentidoGiro) => void
  /** Cambia los ajustes de color de una captura. */
  readonly cambiarAjustes: (
    id: string,
    cambios: Partial<AjustesImagen>,
  ) => void
  /** Cambia el recorte de una captura. */
  readonly cambiarRecorte: (
    id: string,
    cambios: Partial<RecorteRelativo>,
  ) => void
  /** Quita el recorte de una captura. */
  readonly quitarRecorte: (id: string) => void
  /** Abre o cierra el editor de una captura. */
  readonly editarCaptura: (id: string | null) => void
  /** Cambia parte de la configuración de las páginas. */
  readonly cambiarConfiguracion: (
    cambios: Partial<ConfiguracionPaginaImagen>,
  ) => void
  /** Apaga la cámara, descarta las capturas y vuelve al estado inicial. */
  readonly restablecer: () => void
  /** Genera el documento con las capturas. */
  readonly generar: () => void
}

/** Concentra el estado de la herramienta «Escanear a PDF». */
export function useEscanearAPdf(): ControladorEscanearAPdf {
  const camara = useCamara()
  const proceso = useProcesoPdf<ResultadoDocumento>()

  const [capturas, establecerCapturas] = useState<
    readonly CapturaEscaneada[]
  >([])
  const [configuracion, establecerConfiguracion] =
    useState<ConfiguracionPaginaImagen>(CONFIGURACION_PAGINA_PREDETERMINADA)
  const [idEditada, establecerIdEditada] = useState<string | null>(null)
  const [mensajeAviso, establecerMensajeAviso] = useState<string | null>(null)
  const [mensajeLectura, establecerMensajeLectura] = useState<string | null>(
    null,
  )
  const [leyendoMedidas, establecerLeyendoMedidas] = useState(false)

  // Contador con el que se nombran las capturas de la cámara.
  const refContador = useRef(0)
  const refMontado = useRef(true)
  const refIntentados = useRef(new Set<string>())

  useEffect(() => {
    refMontado.current = true

    return () => {
      refMontado.current = false
    }
  }, [])

  // Lee las medidas de las capturas que aún no las tienen, de una en una.
  useEffect(() => {
    const pendientes = capturas.filter(
      (captura) =>
        captura.dimensiones === null && !refIntentados.current.has(captura.id),
    )

    if (pendientes.length === 0) {
      return
    }

    let cancelado = false
    establecerLeyendoMedidas(true)

    const leer = async (): Promise<void> => {
      for (const captura of pendientes) {
        if (cancelado || !refMontado.current) {
          return
        }

        refIntentados.current.add(captura.id)

        try {
          const dimensiones = await leerDimensiones(
            captura.contenido,
            captura.nombre,
          )

          if (cancelado || !refMontado.current) {
            return
          }

          establecerCapturas((actuales) =>
            actualizarPorId(actuales, captura.id, { dimensiones }),
          )
        } catch (error) {
          if (cancelado || !refMontado.current) {
            return
          }

          establecerMensajeLectura(obtenerMensajeError(error, ERROR_AL_LEER))
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
  }, [capturas])

  const anadirCaptura = useCallback(
    (contenido: Blob): void => {
      refContador.current += 1
      const numero = refContador.current

      establecerCapturas((actuales) => [
        ...actuales,
        {
          id: `captura-${numero}`,
          nombre: `Captura ${numero}`,
          contenido,
          formato: 'jpeg',
          origen: 'camara',
          tamano: contenido.size,
          rotacion: 0,
          recorte: null,
          ajustes: AJUSTES_NEUTROS,
          dimensiones: null,
        },
      ])
      establecerMensajeAviso(null)
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const anadirArchivos = useCallback(
    (archivos: readonly File[]): void => {
      const validas: CapturaEscaneada[] = []
      const descartadas: string[] = []

      for (const archivo of archivos) {
        const validacion = validarArchivoImagen(archivo)

        if (!validacion.valido || validacion.formato === null) {
          descartadas.push(archivo.name)
          continue
        }

        refContador.current += 1
        validas.push({
          id: `archivo-${refContador.current}-${archivo.name}`,
          nombre: archivo.name,
          contenido: archivo,
          formato: validacion.formato,
          origen: 'archivo',
          tamano: archivo.size,
          rotacion: 0,
          recorte: null,
          ajustes: AJUSTES_NEUTROS,
          dimensiones: null,
        })
      }

      if (validas.length > 0) {
        establecerCapturas((actuales) => [...actuales, ...validas])
        proceso.limpiarResultado()
      }

      establecerMensajeAviso(
        descartadas.length === 0
          ? null
          : `No se añadieron ${descartadas.length} ${
              descartadas.length === 1 ? 'archivo' : 'archivos'
            }: solo se aceptan imágenes JPEG, PNG y WebP.`,
      )
    },
    [proceso],
  )

  const repetirCaptura = useCallback(
    (id: string, contenido: Blob): void => {
      refIntentados.current.delete(id)
      establecerCapturas((actuales) =>
        actualizarPorId(actuales, id, {
          contenido,
          tamano: contenido.size,
          dimensiones: null,
          rotacion: 0,
          recorte: null,
        }),
      )
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const eliminarCaptura = useCallback(
    (id: string): void => {
      refIntentados.current.delete(id)
      establecerCapturas((actuales) => eliminarPorId(actuales, id))
      establecerIdEditada((actual) => (actual === id ? null : actual))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const moverCaptura = useCallback(
    (id: string, desplazamiento: Desplazamiento): void => {
      establecerCapturas((actuales) =>
        moverPorId(actuales, id, desplazamiento),
      )
    },
    [],
  )

  const reordenarCapturas = useCallback(
    (posicionOrigen: number, posicionDestino: number): void => {
      establecerCapturas((actuales) =>
        moverAPosicion(actuales, posicionOrigen, posicionDestino),
      )
    },
    [],
  )

  const girarCaptura = useCallback(
    (id: string, sentido: SentidoGiro): void => {
      establecerCapturas((actuales) =>
        actuales.map((captura) =>
          captura.id === id
            ? {
                ...captura,
                rotacion: sumarRotacion(
                  captura.rotacion,
                  gradosDelGiro(sentido),
                ),
              }
            : captura,
        ),
      )
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarAjustes = useCallback(
    (id: string, cambios: Partial<AjustesImagen>): void => {
      establecerCapturas((actuales) =>
        actuales.map((captura) =>
          captura.id === id
            ? { ...captura, ajustes: { ...captura.ajustes, ...cambios } }
            : captura,
        ),
      )
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarRecorte = useCallback(
    (id: string, cambios: Partial<RecorteRelativo>): void => {
      establecerCapturas((actuales) =>
        actuales.map((captura) => {
          if (captura.id !== id) {
            return captura
          }

          const base = captura.recorte ?? {
            izquierda: 0,
            superior: 0,
            derecha: 0,
            inferior: 0,
          }

          return {
            ...captura,
            recorte: normalizarRecorte({ ...base, ...cambios }),
          }
        }),
      )
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const quitarRecorte = useCallback(
    (id: string): void => {
      establecerCapturas((actuales) =>
        actualizarPorId(actuales, id, { recorte: null }),
      )
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const editarCaptura = useCallback((id: string | null): void => {
    establecerIdEditada(id)
  }, [])

  const cambiarConfiguracion = useCallback(
    (cambios: Partial<ConfiguracionPaginaImagen>): void => {
      establecerConfiguracion((actual) => ({ ...actual, ...cambios }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const restablecer = useCallback((): void => {
    // Detener la cámara es lo primero: apaga el indicador del navegador aunque
    // algo fallase después.
    camara.detener()
    refIntentados.current.clear()
    refContador.current = 0
    establecerCapturas([])
    establecerIdEditada(null)
    establecerConfiguracion(CONFIGURACION_PAGINA_PREDETERMINADA)
    establecerMensajeAviso(null)
    establecerMensajeLectura(null)
    proceso.limpiarResultado()
  }, [camara, proceso])

  const mensajeError =
    mensajeLectura ?? camara.mensajeError ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: capturas.length > 0,
    cargando: leyendoMedidas,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = proceso.procesando

  const puedeGenerar =
    capturas.length > 0 && !bloqueado && !leyendoMedidas

  const generar = useCallback((): void => {
    if (capturas.length === 0) {
      return
    }

    proceso.ejecutar(() => crearPdfEscaneado({ capturas, configuracion }))
  }, [capturas, configuracion, proceso])

  return {
    camara,
    proceso,
    capturas,
    configuracion,
    capturaEditada: buscarPorId(capturas, idEditada),
    estado,
    bloqueado,
    mensajeError,
    mensajeAviso,
    leyendoMedidas,
    puedeGenerar,
    anadirCaptura,
    anadirArchivos,
    repetirCaptura,
    eliminarCaptura,
    moverCaptura,
    reordenarCapturas,
    girarCaptura,
    cambiarAjustes,
    cambiarRecorte,
    quitarRecorte,
    editarCaptura,
    cambiarConfiguracion,
    restablecer,
    generar,
  }
}

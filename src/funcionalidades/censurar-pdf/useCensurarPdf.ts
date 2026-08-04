import { useCallback, useMemo, useRef, useState } from 'react'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import {
  useProcesoCancelable,
  type ControladorProcesoCancelable,
} from '../../ganchos/useProcesoCancelable'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta } from '../../pdf/tipos'
import {
  censurarPdf,
  type ResultadoCensura,
} from '../../seguridad/censura/censurarPdf'
import {
  esZonaUtil,
  normalizarZona,
} from '../../seguridad/censura/coordenadasCensura'
import { crearAdaptadorNavegador } from '../../seguridad/censura/rasterizarPaginaCensurada'
import { comprobarCensura } from '../../seguridad/censura/verificarCensura'
import type {
  ConfiguracionCensura,
  PerfilCalidad,
  ZonaCensura,
} from '../../seguridad/censura/tipos'
import {
  actualizarPorId,
  eliminarPorId,
} from '../../utilidades/listas'

/** Configuración con la que arranca la herramienta. */
export const CONFIGURACION_PREDETERMINADA: ConfiguracionCensura = {
  calidad: 'equilibrada',
  apariencia: { color: '#000000', texto: '' },
  // Se usa JPEG porque una página rasterizada es una fotografía a efectos
  // prácticos: en PNG el documento resultante sería varias veces más grande.
  formato: 'jpeg',
}

/** Zona nueva colocada en el centro de la página. */
export function crearZona(id: string, pagina: number): ZonaCensura {
  return {
    id,
    pagina,
    izquierda: 0.1,
    superior: 0.1,
    ancho: 0.35,
    alto: 0.06,
    origen: 'manual',
  }
}

/** Estado y acciones de la herramienta «Censurar PDF». */
export interface ControladorCensurarPdf {
  readonly documento: ControladorDocumentoPdf
  readonly proceso: ControladorProcesoCancelable<ResultadoCensura>
  readonly configuracion: ConfiguracionCensura
  /** Zonas marcadas, de todas las páginas. */
  readonly zonas: readonly ZonaCensura[]
  /** Página que se está viendo en el editor, empezando en 1. */
  readonly paginaActiva: number
  /** `true` cuando la persona ya confirmó que entiende las consecuencias. */
  readonly confirmado: boolean
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  /** Advertencia de memoria, o `null`. */
  readonly advertencia: string | null
  readonly puedeCensurar: boolean
  readonly cambiarConfiguracion: (
    cambios: Partial<ConfiguracionCensura>,
  ) => void
  readonly cambiarCalidad: (calidad: PerfilCalidad) => void
  readonly cambiarApariencia: (
    cambios: Partial<ConfiguracionCensura['apariencia']>,
  ) => void
  readonly cambiarPaginaActiva: (pagina: number) => void
  readonly anadirZona: () => void
  readonly cambiarZona: (id: string, cambios: Partial<ZonaCensura>) => void
  readonly eliminarZona: (id: string) => void
  readonly limpiarZonas: () => void
  readonly cambiarConfirmado: (confirmado: boolean) => void
  readonly restablecer: () => void
  readonly censurar: () => void
}

/**
 * Concentra el estado de la herramienta «Censurar PDF».
 *
 * La confirmación explícita no es un adorno: censurar reconstruye el documento como
 * imágenes y eso tiene consecuencias irreversibles sobre el texto, los enlaces y los
 * formularios. Conviene que se acepten a conciencia antes de empezar.
 */
export function useCensurarPdf(): ControladorCensurarPdf {
  const documento = useDocumentoPdf()
  const proceso = useProcesoCancelable<ResultadoCensura>()

  const [configuracion, establecerConfiguracion] =
    useState<ConfiguracionCensura>(CONFIGURACION_PREDETERMINADA)
  const [zonas, establecerZonas] = useState<readonly ZonaCensura[]>([])
  const [paginaActiva, establecerPaginaActiva] = useState(1)
  const [confirmado, establecerConfirmado] = useState(false)

  const contador = useRef(0)
  const cargado = documento.documento

  const cambiarConfiguracion = useCallback(
    (cambios: Partial<ConfiguracionCensura>): void => {
      establecerConfiguracion((actual) => ({ ...actual, ...cambios }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarCalidad = useCallback(
    (calidad: PerfilCalidad): void => {
      cambiarConfiguracion({ calidad })
    },
    [cambiarConfiguracion],
  )

  const cambiarApariencia = useCallback(
    (cambios: Partial<ConfiguracionCensura['apariencia']>): void => {
      establecerConfiguracion((actual) => ({
        ...actual,
        apariencia: { ...actual.apariencia, ...cambios },
      }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarPaginaActiva = useCallback((pagina: number): void => {
    establecerPaginaActiva(Math.max(1, Math.trunc(pagina)))
  }, [])

  const anadirZona = useCallback((): void => {
    contador.current += 1
    establecerZonas((actuales) => [
      ...actuales,
      crearZona(`zona-${contador.current}`, paginaActiva),
    ])
    proceso.limpiarResultado()
  }, [paginaActiva, proceso])

  const cambiarZona = useCallback(
    (id: string, cambios: Partial<ZonaCensura>): void => {
      establecerZonas((actuales) => actualizarPorId(actuales, id, cambios))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const eliminarZona = useCallback(
    (id: string): void => {
      establecerZonas((actuales) => eliminarPorId(actuales, id))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const limpiarZonas = useCallback((): void => {
    establecerZonas([])
    proceso.limpiarResultado()
  }, [proceso])

  const cambiarConfirmado = useCallback((siguiente: boolean): void => {
    establecerConfirmado(siguiente)
  }, [])

  const restablecer = useCallback((): void => {
    proceso.cancelar()
    proceso.limpiarResultado()
    establecerZonas([])
    establecerPaginaActiva(1)
    establecerConfirmado(false)
    establecerConfiguracion(CONFIGURACION_PREDETERMINADA)
    contador.current = 0
    documento.restablecer()
  }, [proceso, documento])

  const zonasUtiles = useMemo(
    () => zonas.map(normalizarZona).filter(esZonaUtil),
    [zonas],
  )

  const mensajeError = documento.mensajeError ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: cargado !== null,
    cargando: documento.cargando,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = documento.cargando || proceso.procesando

  const advertencia = useMemo<string | null>(() => {
    if (cargado === null) {
      return null
    }

    if (configuracion.calidad === 'alta' && cargado.numeroPaginas > 20) {
      return `Vas a rasterizar ${cargado.numeroPaginas} páginas a 300 puntos por pulgada. Eso consume bastante memoria y tarda; si el navegador se queda sin memoria, baja la calidad.`
    }

    if (cargado.numeroPaginas > 50) {
      return `El documento tiene ${cargado.numeroPaginas} páginas. Todas se reconstruirán como imágenes, así que el proceso puede tardar y el archivo resultante será mayor que el original.`
    }

    return null
  }, [cargado, configuracion.calidad])

  const puedeCensurar =
    cargado !== null && !bloqueado && zonasUtiles.length > 0 && confirmado

  const censurar = useCallback((): void => {
    if (cargado === null || zonasUtiles.length === 0 || !confirmado) {
      return
    }

    const adaptador = crearAdaptadorNavegador(cargado.abierto.documento)

    proceso.ejecutar((senal, informarProgreso) =>
      censurarPdf(
        { zonas: zonasUtiles, configuracion },
        {
          adaptador,
          comprobador: comprobarCensura,
          senal,
          alProgreso: informarProgreso,
        },
      ),
    )
  }, [cargado, zonasUtiles, confirmado, configuracion, proceso])

  return {
    documento,
    proceso,
    configuracion,
    zonas,
    paginaActiva,
    confirmado,
    estado,
    bloqueado,
    mensajeError,
    advertencia,
    puedeCensurar,
    cambiarConfiguracion,
    cambiarCalidad,
    cambiarApariencia,
    cambiarPaginaActiva,
    anadirZona,
    cambiarZona,
    eliminarZona,
    limpiarZonas,
    cambiarConfirmado,
    restablecer,
    censurar,
  }
}

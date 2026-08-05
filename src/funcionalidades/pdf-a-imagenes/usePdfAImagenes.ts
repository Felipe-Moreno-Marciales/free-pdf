import { useCallback, useState } from 'react'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import {
  useProcesoCancelable,
  type ControladorProcesoCancelable,
} from '../../ganchos/useProcesoCancelable'
import {
  useSeleccionPaginas,
  type ControladorSeleccionPaginas,
} from '../../ganchos/useSeleccionPaginas'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta } from '../../pdf/tipos'
import {
  CONFIGURACION_PREDETERMINADA,
  convertirPdfAImagenes,
  ESCALAS_RESOLUCION,
} from './convertirPdfAImagenes'
import { crearRenderizadorNavegador } from './renderizadorPaginas'
import type {
  ConfiguracionPdfAImagenes,
  ResultadoImagenes,
} from './tipos'

/**
 * Número de páginas a partir del cual se advierte del consumo de memoria con
 * las resoluciones más altas.
 */
const PAGINAS_AVISO = 20

/** Estado y acciones de la herramienta «PDF a imágenes». */
export interface ControladorPdfAImagenes {
  /** Carga del documento. */
  readonly documento: ControladorDocumentoPdf
  /** Selección de páginas. */
  readonly seleccion: ControladorSeleccionPaginas
  /** Ejecución, progreso y descarga del resultado. */
  readonly proceso: ControladorProcesoCancelable<ResultadoImagenes>
  /** Configuración de la conversión. */
  readonly configuracion: ConfiguracionPdfAImagenes
  /** Estado visible de la herramienta. */
  readonly estado: EstadoHerramienta
  /** `true` cuando no se debe permitir ninguna interacción. */
  readonly bloqueado: boolean
  /** Primer mensaje de error pendiente, o `null`. */
  readonly mensajeError: string | null
  /** Advertencia sobre la memoria que consumirá la conversión, o `null`. */
  readonly advertencia: string | null
  /** `true` cuando se puede convertir. */
  readonly puedeConvertir: boolean
  /** Cambia parte de la configuración. */
  readonly cambiarConfiguracion: (
    cambios: Partial<ConfiguracionPdfAImagenes>,
  ) => void
  /** Devuelve la configuración a sus valores iniciales. */
  readonly restablecerConfiguracion: () => void
  /** Cierra el documento y vuelve al estado inicial. */
  readonly restablecer: () => void
  /** Convierte las páginas seleccionadas. */
  readonly convertir: () => void
}

/**
 * Concentra el estado de la herramienta «PDF a imágenes».
 *
 * El documento se abre una sola vez con PDF.js y el mismo documento se usa para
 * las miniaturas y para la conversión, así que no se lee el archivo dos veces.
 */
export function usePdfAImagenes(): ControladorPdfAImagenes {
  const documento = useDocumentoPdf()
  const proceso = useProcesoCancelable<ResultadoImagenes>()
  const [configuracion, establecerConfiguracion] =
    useState<ConfiguracionPdfAImagenes>(CONFIGURACION_PREDETERMINADA)

  const cargado = documento.documento
  const seleccion = useSeleccionPaginas(
    cargado?.numeroPaginas ?? 0,
    cargado?.seleccionado.id ?? null,
  )

  const cambiarConfiguracion = useCallback(
    (cambios: Partial<ConfiguracionPdfAImagenes>): void => {
      establecerConfiguracion((actual) => ({ ...actual, ...cambios }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const restablecerConfiguracion = useCallback((): void => {
    establecerConfiguracion(CONFIGURACION_PREDETERMINADA)
    proceso.limpiarResultado()
  }, [proceso])

  const restablecer = useCallback((): void => {
    proceso.cancelar()
    proceso.limpiarResultado()
    documento.restablecer()
  }, [proceso, documento])

  const mensajeError = documento.mensajeError ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: cargado !== null,
    cargando: documento.cargando,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = documento.cargando || proceso.procesando

  const puedeConvertir =
    cargado !== null && !bloqueado && seleccion.numeroSeleccionadas > 0

  const advertencia = calcularAdvertencia(
    seleccion.numeroSeleccionadas,
    configuracion,
  )

  const convertir = useCallback((): void => {
    if (cargado === null || seleccion.numeroSeleccionadas === 0) {
      return
    }

    // Los índices llegan ordenados, así que las imágenes conservan el orden
    // original de las páginas del documento.
    const numerosPagina = seleccion.indicesOrdenados.map(
      (indice) => indice + 1,
    )
    const renderizador = crearRenderizadorNavegador(cargado.abierto.documento)

    proceso.ejecutar((senal, informarProgreso) =>
      convertirPdfAImagenes(
        {
          numerosPagina,
          nombreDocumento: cargado.seleccionado.nombre,
          configuracion,
        },
        { renderizador, senal, alProgreso: informarProgreso },
      ),
    )
  }, [cargado, seleccion.indicesOrdenados, seleccion.numeroSeleccionadas, configuracion, proceso])

  return {
    documento,
    seleccion,
    proceso,
    configuracion,
    estado,
    bloqueado,
    mensajeError,
    advertencia,
    puedeConvertir,
    cambiarConfiguracion,
    restablecerConfiguracion,
    restablecer,
    convertir,
  }
}

/** Redacta la advertencia de memoria que corresponda, o `null`. */
function calcularAdvertencia(
  numeroSeleccionadas: number,
  configuracion: ConfiguracionPdfAImagenes,
): string | null {
  if (numeroSeleccionadas === 0) {
    return null
  }

  const escala = ESCALAS_RESOLUCION[configuracion.resolucion]

  if (configuracion.resolucion === 'estandar') {
    return null
  }

  if (numeroSeleccionadas >= PAGINAS_AVISO) {
    return `Vas a convertir ${numeroSeleccionadas} páginas a escala ${escala.toLocaleString(
      'es-ES',
    )}. Cuanto mayor es la resolución, más memoria consume y más tarda cada página. Si el navegador se queda sin memoria, convierte menos páginas de una vez o baja la resolución.`
  }

  return 'Una resolución mayor consume más memoria y tarda más en cada página.'
}

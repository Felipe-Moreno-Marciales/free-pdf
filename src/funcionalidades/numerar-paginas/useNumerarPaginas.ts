import { useCallback, useMemo, useState } from 'react'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import {
  interpretarAlcance,
  type AlcancePaginas,
} from '../../pdf/paginasAfectadas'
import type { PosicionEnPagina } from '../../pdf/posicionarEnPagina'
import type { EstadoHerramienta, ResultadoDocumento } from '../../pdf/tipos'
import {
  calcularNumeroDePagina,
  calcularTotalNumerado,
  numerarPaginas,
} from './numerarPaginas'
import {
  aplicarPlantilla,
  resolverPlantilla,
  validarPlantilla,
  type ClavePlantilla,
} from './plantillaNumeracion'
import type { AparienciaNumeracion, ConfiguracionNumeracion } from './tipos'

/** Apariencia con la que arranca la herramienta. */
export const APARIENCIA_PREDETERMINADA: AparienciaNumeracion = {
  tamanoFuente: 11,
  color: '#1b1f2a',
  opacidadPorcentaje: 100,
  margenHorizontalMm: 15,
  margenVerticalMm: 12,
}

/** Configuración con la que arranca la herramienta. */
export const CONFIGURACION_PREDETERMINADA: ConfiguracionNumeracion = {
  plantilla: 'numero',
  plantillaPropia: 'Página {pagina} de {total}',
  numeroInicial: 1,
  alcance: 'todas',
  expresion: '',
  posicion: 'inferior-centro',
  apariencia: APARIENCIA_PREDETERMINADA,
}

/** Vista previa del texto que se escribirá. */
export interface VistaPreviaNumeracion {
  /** Texto de la primera página afectada, o `null` si no hay ninguna. */
  readonly primerTexto: string | null
  /** Texto de la última página afectada, o `null` si no hay ninguna. */
  readonly ultimoTexto: string | null
  /** Valor que tomará el marcador `{total}`. */
  readonly total: number
  /** Mensaje de error de la plantilla, o `null`. */
  readonly mensajePlantilla: string | null
}

/** Estado y acciones de la herramienta «Numerar páginas». */
export interface ControladorNumerarPaginas {
  readonly documento: ControladorDocumentoPdf
  readonly proceso: ControladorProcesoPdf<ResultadoDocumento>
  readonly configuracion: ConfiguracionNumeracion
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  /** Índices de las páginas que recibirán número. */
  readonly indicesAfectados: readonly number[]
  /** Mensaje de error de la expresión de rangos, o `null`. */
  readonly mensajeRangos: string | null
  /** Vista previa del texto resultante. */
  readonly vistaPrevia: VistaPreviaNumeracion
  /** `true` cuando se puede generar el documento. */
  readonly puedeNumerar: boolean
  readonly cambiarConfiguracion: (
    cambios: Partial<ConfiguracionNumeracion>,
  ) => void
  readonly cambiarApariencia: (
    cambios: Partial<AparienciaNumeracion>,
  ) => void
  readonly cambiarPlantilla: (plantilla: ClavePlantilla) => void
  readonly cambiarPosicion: (posicion: PosicionEnPagina) => void
  readonly cambiarAlcance: (alcance: AlcancePaginas) => void
  readonly cambiarExpresion: (expresion: string) => void
  readonly restablecerConfiguracion: () => void
  readonly restablecer: () => void
  readonly numerar: () => void
}

/**
 * Concentra el estado de la herramienta «Numerar páginas».
 *
 * La vista previa usa las mismas funciones que el procesamiento, así que el texto
 * que se muestra es exactamente el que se escribirá en el documento.
 */
export function useNumerarPaginas(): ControladorNumerarPaginas {
  const documento = useDocumentoPdf()
  const proceso = useProcesoPdf<ResultadoDocumento>()
  const [configuracion, establecerConfiguracion] =
    useState<ConfiguracionNumeracion>(CONFIGURACION_PREDETERMINADA)

  const cargado = documento.documento
  const numeroPaginas = cargado?.numeroPaginas ?? 0

  const alcanceInterpretado = useMemo(
    () =>
      interpretarAlcance(
        configuracion.alcance,
        numeroPaginas,
        configuracion.expresion,
      ),
    [configuracion.alcance, configuracion.expresion, numeroPaginas],
  )

  const vistaPrevia = useMemo<VistaPreviaNumeracion>(() => {
    const plantilla = resolverPlantilla(
      configuracion.plantilla,
      configuracion.plantillaPropia,
    )
    const validacion = validarPlantilla(plantilla)
    const total = calcularTotalNumerado(
      numeroPaginas,
      configuracion.numeroInicial,
    )

    if (!validacion.valida) {
      return {
        primerTexto: null,
        ultimoTexto: null,
        total,
        mensajePlantilla: validacion.mensaje,
      }
    }

    const indices = alcanceInterpretado.indices
    const primero = indices[0]
    const ultimo = indices[indices.length - 1]

    return {
      primerTexto:
        primero === undefined
          ? null
          : aplicarPlantilla(
              plantilla,
              calcularNumeroDePagina(primero, configuracion.numeroInicial),
              total,
            ),
      ultimoTexto:
        ultimo === undefined || ultimo === primero
          ? null
          : aplicarPlantilla(
              plantilla,
              calcularNumeroDePagina(ultimo, configuracion.numeroInicial),
              total,
            ),
      total,
      mensajePlantilla: null,
    }
  }, [
    configuracion.plantilla,
    configuracion.plantillaPropia,
    configuracion.numeroInicial,
    numeroPaginas,
    alcanceInterpretado.indices,
  ])

  const cambiarConfiguracion = useCallback(
    (cambios: Partial<ConfiguracionNumeracion>): void => {
      establecerConfiguracion((actual) => ({ ...actual, ...cambios }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarApariencia = useCallback(
    (cambios: Partial<AparienciaNumeracion>): void => {
      establecerConfiguracion((actual) => ({
        ...actual,
        apariencia: { ...actual.apariencia, ...cambios },
      }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarPlantilla = useCallback(
    (plantilla: ClavePlantilla): void => {
      cambiarConfiguracion({ plantilla })
    },
    [cambiarConfiguracion],
  )

  const cambiarPosicion = useCallback(
    (posicion: PosicionEnPagina): void => {
      cambiarConfiguracion({ posicion })
    },
    [cambiarConfiguracion],
  )

  const cambiarAlcance = useCallback(
    (alcance: AlcancePaginas): void => {
      cambiarConfiguracion({ alcance })
    },
    [cambiarConfiguracion],
  )

  const cambiarExpresion = useCallback(
    (expresion: string): void => {
      cambiarConfiguracion({ expresion })
    },
    [cambiarConfiguracion],
  )

  const restablecerConfiguracion = useCallback((): void => {
    establecerConfiguracion(CONFIGURACION_PREDETERMINADA)
    proceso.limpiarResultado()
  }, [proceso])

  const restablecer = useCallback((): void => {
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

  const puedeNumerar =
    cargado !== null &&
    !bloqueado &&
    alcanceInterpretado.indices.length > 0 &&
    vistaPrevia.mensajePlantilla === null

  const numerar = useCallback((): void => {
    if (cargado === null) {
      return
    }

    proceso.ejecutar(() =>
      numerarPaginas({
        archivo: cargado.seleccionado.archivo,
        configuracion,
      }),
    )
  }, [cargado, configuracion, proceso])

  return {
    documento,
    proceso,
    configuracion,
    estado,
    bloqueado,
    mensajeError,
    indicesAfectados: alcanceInterpretado.indices,
    mensajeRangos: alcanceInterpretado.mensajeError,
    vistaPrevia,
    puedeNumerar,
    cambiarConfiguracion,
    cambiarApariencia,
    cambiarPlantilla,
    cambiarPosicion,
    cambiarAlcance,
    cambiarExpresion,
    restablecerConfiguracion,
    restablecer,
    numerar,
  }
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import {
  useSeleccionPaginas,
  type ControladorSeleccionPaginas,
} from '../../ganchos/useSeleccionPaginas'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import { calcularMedidasVisibles, type CajaPagina } from '../../pdf/posicionarEnPagina'
import { normalizarRotacion } from '../../pdf/rotaciones'
import type {
  EstadoHerramienta,
  GradosRotacion,
  ResultadoDocumento,
} from '../../pdf/tipos'
import {
  convertirMargenesAPuntos,
  convertirMargenesDesdePuntos,
  MARGENES_CERO,
  noRecortaNada,
  validarRecorte,
  type ResultadoValidacionRecorte,
} from './coordenadasRecorte'
import { calcularIndicesRecorte, recortarPdf } from './recortarPdf'
import type {
  AlcanceRecorte,
  ConfiguracionRecorte,
  MargenesRecorte,
  MedidasRecorte,
  UnidadRecorte,
} from './tipos'

/** Configuración con la que arranca la herramienta. */
export const CONFIGURACION_PREDETERMINADA: ConfiguracionRecorte = {
  margenes: MARGENES_CERO,
  unidad: 'milimetros',
  alcance: 'todas',
}

/** Medidas de la página de referencia, ya aplicada su rotación. */
export interface ReferenciaRecorte {
  /** Índice de la página, empezando en 0. */
  readonly indice: number
  /** Medidas visibles actuales, en puntos. */
  readonly visibles: MedidasRecorte
  /** Rotación que declara la página. */
  readonly rotacion: GradosRotacion
}

/** Estado y acciones de la herramienta «Recortar PDF». */
export interface ControladorRecortarPdf {
  readonly documento: ControladorDocumentoPdf
  readonly seleccion: ControladorSeleccionPaginas
  readonly proceso: ControladorProcesoPdf<ResultadoDocumento>
  readonly configuracion: ConfiguracionRecorte
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  /** Página de referencia, o `null` si todavía no se conoce. */
  readonly referencia: ReferenciaRecorte | null
  /** `true` mientras se leen las medidas de la página de referencia. */
  readonly leyendoMedidas: boolean
  /** Validación del recorte actual sobre la página de referencia. */
  readonly validacion: ResultadoValidacionRecorte | null
  /** Índices de las páginas que recibirán el recorte. */
  readonly indicesAfectados: readonly number[]
  /** `true` cuando se puede generar el documento. */
  readonly puedeRecortar: boolean
  readonly cambiarMargen: (
    lado: keyof MargenesRecorte,
    valor: number,
  ) => void
  readonly cambiarUnidad: (unidad: UnidadRecorte) => void
  readonly cambiarAlcance: (alcance: AlcanceRecorte) => void
  readonly cambiarReferencia: (indice: number) => void
  /** Devuelve los márgenes a cero. */
  readonly restaurarRecorte: () => void
  readonly restablecer: () => void
  readonly recortar: () => void
}

/**
 * Concentra el estado de la herramienta «Recortar PDF».
 *
 * Las medidas de la página de referencia se leen con PDF.js, que ya tiene el
 * documento abierto para las miniaturas, así que no hace falta cargar pdf-lib
 * hasta el momento de generar el resultado.
 */
export function useRecortarPdf(): ControladorRecortarPdf {
  const documento = useDocumentoPdf()
  const proceso = useProcesoPdf<ResultadoDocumento>()
  const [configuracion, establecerConfiguracion] =
    useState<ConfiguracionRecorte>(CONFIGURACION_PREDETERMINADA)
  const [indiceReferencia, establecerIndiceReferencia] = useState(0)
  const [referencia, establecerReferencia] = useState<ReferenciaRecorte | null>(
    null,
  )
  const [leyendoMedidas, establecerLeyendoMedidas] = useState(false)

  const cargado = documento.documento
  const numeroPaginas = cargado?.numeroPaginas ?? 0
  const idDocumento = cargado?.seleccionado.id ?? null

  const seleccion = useSeleccionPaginas(numeroPaginas, idDocumento)

  // Al cambiar de documento se vuelve a la primera página y se descarta el
  // recorte anterior, que se medía sobre otras páginas.
  useEffect(() => {
    establecerIndiceReferencia(0)
    establecerReferencia(null)
    establecerConfiguracion(CONFIGURACION_PREDETERMINADA)
  }, [idDocumento])

  // Lee las medidas de la página de referencia con PDF.js.
  useEffect(() => {
    if (cargado === null) {
      return
    }

    let cancelado = false
    establecerLeyendoMedidas(true)

    const leer = async (): Promise<void> => {
      try {
        const pagina = await cargado.abierto.documento.getPage(
          indiceReferencia + 1,
        )

        try {
          const rotacion = normalizarRotacion(pagina.rotate)
          // `view` es la caja de recorte actual de la página, que es justo el
          // área visible sobre la que se miden los márgenes nuevos.
          const [x0, y0, x1, y1] = pagina.view
          const caja: CajaPagina = {
            x: x0,
            y: y0,
            ancho: x1 - x0,
            alto: y1 - y0,
          }

          if (cancelado) {
            return
          }

          establecerReferencia({
            indice: indiceReferencia,
            visibles: calcularMedidasVisibles(caja, rotacion),
            rotacion,
          })
        } finally {
          await pagina.cleanup()
        }
      } catch {
        if (!cancelado) {
          establecerReferencia(null)
        }
      } finally {
        if (!cancelado) {
          establecerLeyendoMedidas(false)
        }
      }
    }

    void leer()

    return () => {
      cancelado = true
    }
  }, [cargado, indiceReferencia])

  const validacion = useMemo<ResultadoValidacionRecorte | null>(() => {
    if (referencia === null) {
      return null
    }

    return validarRecorte(
      referencia.visibles,
      convertirMargenesAPuntos(configuracion.margenes, configuracion.unidad),
    )
  }, [referencia, configuracion.margenes, configuracion.unidad])

  const indicesAfectados = useMemo(
    () =>
      calcularIndicesRecorte(
        configuracion.alcance,
        numeroPaginas,
        indiceReferencia,
        seleccion.indicesOrdenados,
      ),
    [
      configuracion.alcance,
      numeroPaginas,
      indiceReferencia,
      seleccion.indicesOrdenados,
    ],
  )

  const cambiarMargen = useCallback(
    (lado: keyof MargenesRecorte, valor: number): void => {
      establecerConfiguracion((actual) => ({
        ...actual,
        margenes: { ...actual.margenes, [lado]: valor },
      }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarUnidad = useCallback(
    (unidad: UnidadRecorte): void => {
      // Se convierten los valores para que el recorte no cambie al cambiar de
      // unidad: 10 mm siguen siendo los mismos 10 mm expresados en puntos.
      establecerConfiguracion((actual) => {
        if (actual.unidad === unidad) {
          return actual
        }

        const enPuntos = convertirMargenesAPuntos(
          actual.margenes,
          actual.unidad,
        )

        return {
          ...actual,
          unidad,
          margenes: redondearMargenes(
            convertirMargenesDesdePuntos(enPuntos, unidad),
          ),
        }
      })
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarAlcance = useCallback(
    (alcance: AlcanceRecorte): void => {
      establecerConfiguracion((actual) => ({ ...actual, alcance }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarReferencia = useCallback(
    (indice: number): void => {
      establecerIndiceReferencia(indice)
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const restaurarRecorte = useCallback((): void => {
    establecerConfiguracion((actual) => ({
      ...actual,
      margenes: MARGENES_CERO,
    }))
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

  const puedeRecortar =
    cargado !== null &&
    !bloqueado &&
    indicesAfectados.length > 0 &&
    !noRecortaNada(configuracion.margenes) &&
    validacion?.valido === true

  const recortar = useCallback((): void => {
    if (cargado === null) {
      return
    }

    proceso.ejecutar(() =>
      recortarPdf({
        archivo: cargado.seleccionado.archivo,
        configuracion,
        indiceReferencia,
        indicesSeleccionados: seleccion.indicesOrdenados,
      }),
    )
  }, [cargado, configuracion, indiceReferencia, seleccion.indicesOrdenados, proceso])

  return {
    documento,
    seleccion,
    proceso,
    configuracion,
    estado,
    bloqueado,
    mensajeError,
    referencia,
    leyendoMedidas,
    validacion,
    indicesAfectados,
    puedeRecortar,
    cambiarMargen,
    cambiarUnidad,
    cambiarAlcance,
    cambiarReferencia,
    restaurarRecorte,
    restablecer,
    recortar,
  }
}

/** Redondea los márgenes a un decimal, para que los campos queden legibles. */
function redondearMargenes(margenes: MargenesRecorte): MargenesRecorte {
  const redondear = (valor: number): number =>
    Math.round(valor * 10) / 10

  return {
    superior: redondear(margenes.superior),
    derecho: redondear(margenes.derecho),
    inferior: redondear(margenes.inferior),
    izquierdo: redondear(margenes.izquierdo),
  }
}

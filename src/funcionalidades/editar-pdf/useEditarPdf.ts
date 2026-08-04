import { useCallback, useState } from 'react'
import {
  aplicarEdicion,
  NOMBRE_EDITADO,
} from '../../edicion/aplicarEdicion'
import {
  crearForma,
  crearResaltado,
  crearTexto,
} from '../../edicion/crearElementos'
import type { ResultadoEdicion } from '../../edicion/tipos'
import type { ElementoSuperpuesto, FiguraGeometrica } from '../../edicion/tipos'
import {
  useCapaEdicion,
  type ControladorCapaEdicion,
} from '../../edicion/useCapaEdicion'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import {
  useProcesoCancelable,
  type ControladorProcesoCancelable,
} from '../../ganchos/useProcesoCancelable'
import { abrirDocumentoDesdeArchivo } from '../../pdf/cargarDocumentoPdf'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta } from '../../pdf/tipos'

/** Estado y acciones de la herramienta «Editar y anotar». */
export interface ControladorEditarPdf {
  readonly documento: ControladorDocumentoPdf
  readonly proceso: ControladorProcesoCancelable<ResultadoEdicion>
  readonly capa: ControladorCapaEdicion
  /** Página que se está viendo, empezando en 1. */
  readonly paginaActiva: number
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  readonly puedeAplicar: boolean
  readonly cambiarPaginaActiva: (pagina: number) => void
  readonly anadirTexto: () => void
  readonly anadirForma: (figura: FiguraGeometrica) => void
  readonly anadirResaltado: () => void
  readonly restablecer: () => void
  readonly aplicar: () => void
}

/**
 * Concentra el estado de la herramienta «Editar y anotar».
 *
 * El documento de pdf-lib se abre **en el momento de aplicar**, no al cargar el
 * archivo. Es a propósito: si se guardara en el estado, cada aplicación sucesiva iría
 * dibujando encima de la anterior y el resultado dependería de cuántas veces se ha
 * pulsado el botón. Abriendo de nuevo desde el archivo, aplicar dos veces con la misma
 * capa da exactamente el mismo documento.
 */
export function useEditarPdf(): ControladorEditarPdf {
  const documento = useDocumentoPdf()
  const proceso = useProcesoCancelable<ResultadoEdicion>()
  const capa = useCapaEdicion()

  const [paginaActiva, establecerPaginaActiva] = useState(1)

  const cargado = documento.documento

  const cambiarPaginaActiva = useCallback((pagina: number): void => {
    establecerPaginaActiva(Math.max(1, Math.trunc(pagina)))
  }, [])

  const anadirTexto = useCallback((): void => {
    capa.anadir((id) => crearTexto(id, paginaActiva))
    proceso.limpiarResultado()
  }, [capa, paginaActiva, proceso])

  const anadirForma = useCallback(
    (figura: FiguraGeometrica): void => {
      capa.anadir((id) => crearForma(id, paginaActiva, figura))
      proceso.limpiarResultado()
    },
    [capa, paginaActiva, proceso],
  )

  const anadirResaltado = useCallback((): void => {
    capa.anadir((id) => crearResaltado(id, paginaActiva))
    proceso.limpiarResultado()
  }, [capa, paginaActiva, proceso])

  const cambiarElemento = useCallback(
    (id: string, cambios: Partial<ElementoSuperpuesto>): void => {
      capa.cambiar(id, cambios)
      proceso.limpiarResultado()
    },
    [capa, proceso],
  )

  const restablecer = useCallback((): void => {
    proceso.cancelar()
    proceso.limpiarResultado()
    capa.vaciar()
    establecerPaginaActiva(1)
    documento.restablecer()
  }, [capa, documento, proceso])

  const mensajeError = documento.mensajeError ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: cargado !== null,
    cargando: documento.cargando,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = documento.cargando || proceso.procesando
  const puedeAplicar =
    cargado !== null && !bloqueado && capa.cuantosPintan > 0

  const aplicar = useCallback((): void => {
    if (cargado === null || capa.cuantosPintan === 0) {
      return
    }

    const archivo = cargado.seleccionado.archivo
    const elementos = capa.elementos

    proceso.ejecutar(async (senal, informarProgreso) => {
      const abierto = await abrirDocumentoDesdeArchivo(archivo)

      return await aplicarEdicion(
        {
          documento: abierto.documento,
          pdfLib: abierto.pdfLib,
          elementos,
          nombreArchivo: NOMBRE_EDITADO,
        },
        {
          senal,
          alProgreso: (progreso) =>
            informarProgreso(progreso.completados, progreso.total),
        },
      )
    })
  }, [cargado, capa.cuantosPintan, capa.elementos, proceso])

  return {
    documento,
    proceso,
    capa: { ...capa, cambiar: cambiarElemento },
    paginaActiva,
    estado,
    bloqueado,
    mensajeError,
    puedeAplicar,
    cambiarPaginaActiva,
    anadirTexto,
    anadirForma,
    anadirResaltado,
    restablecer,
    aplicar,
  }
}

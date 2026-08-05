import { calcularEstadoHerramienta } from '../pdf/estadoHerramienta'
import type { EstadoHerramienta } from '../pdf/tipos'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from './useDocumentoPdf'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
  type ResultadoDescargable,
} from './useProcesoPdf'
import {
  useSeleccionPaginas,
  type ControladorSeleccionPaginas,
} from './useSeleccionPaginas'

/** Estado común a las herramientas que trabajan con las páginas de un PDF. */
export interface ControladorHerramientaPaginas<
  Resultado extends ResultadoDescargable,
> {
  /** Carga del documento único con el que trabaja la herramienta. */
  readonly documento: ControladorDocumentoPdf
  /** Selección de páginas dentro de ese documento. */
  readonly seleccion: ControladorSeleccionPaginas
  /** Ejecución y descarga del resultado. */
  readonly proceso: ControladorProcesoPdf<Resultado>
  /** Estado visible de la herramienta. */
  readonly estado: EstadoHerramienta
  /** `true` cuando no se debe permitir ninguna interacción. */
  readonly bloqueado: boolean
  /** Primer mensaje de error pendiente, o `null`. */
  readonly mensajeError: string | null
}

/**
 * Reúne las tres piezas que comparten Extraer, Eliminar, Organizar y Rotar:
 * cargar un documento, seleccionar páginas y generar el resultado.
 *
 * Cada herramienta añade después su propia lógica sobre este cimiento, de modo
 * que la carga del documento, la selección y el control de estado se escriben
 * una sola vez.
 */
export function useHerramientaPaginas<
  Resultado extends ResultadoDescargable,
>(): ControladorHerramientaPaginas<Resultado> {
  const documento = useDocumentoPdf()
  const proceso = useProcesoPdf<Resultado>()

  const cargado = documento.documento
  const seleccion = useSeleccionPaginas(
    cargado?.numeroPaginas ?? 0,
    cargado?.seleccionado.id ?? null,
  )

  const mensajeError = documento.mensajeError ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: cargado !== null,
    cargando: documento.cargando,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  return {
    documento,
    seleccion,
    proceso,
    estado,
    bloqueado: documento.cargando || proceso.procesando,
    mensajeError,
  }
}

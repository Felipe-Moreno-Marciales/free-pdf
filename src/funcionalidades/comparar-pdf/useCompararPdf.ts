import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { abrirParaComparar } from '../../comparacion/adaptadorNavegador'
import {
  compararDocumentos,
  type ProgresoComparacion,
} from '../../comparacion/compararDocumentos'
import {
  generarInforme,
  NOMBRE_INFORME,
} from '../../comparacion/informeComparacion'
import {
  UMBRAL_PREDETERMINADO,
  type ResultadoComparacion,
} from '../../comparacion/tipos'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta, PdfSeleccionado } from '../../pdf/tipos'
import { validarArchivoPdf } from '../../pdf/validarDocumentoPdf'
import { descargarBlob } from '../../utilidades/descargarArchivo'
import { obtenerMensajeError } from '../../utilidades/errores'
import { construirIdArchivo } from '../../utilidades/validacionArchivos'

/** Cuál de los dos documentos se está eligiendo. */
export type Ranura = 'antes' | 'despues'

/** Modo con el que se muestran las páginas. */
export type ModoVista = 'lado-a-lado' | 'superpuesto'

/** Describe un modo de vista en español. */
export function describirModoVista(modo: ModoVista): string {
  return modo === 'lado-a-lado' ? 'Lado a lado' : 'Superpuestas'
}

/** Estado y acciones de la herramienta «Comparar PDF». */
export interface ControladorCompararPdf {
  readonly antes: PdfSeleccionado | null
  readonly despues: PdfSeleccionado | null
  readonly umbral: number
  readonly compararVisualmente: boolean
  readonly modoVista: ModoVista
  readonly opacidad: number
  /** Página que se está mirando, empezando en 1. */
  readonly paginaActiva: number
  readonly comparando: boolean
  readonly progreso: ProgresoComparacion | null
  readonly resultado: ResultadoComparacion | null
  readonly cancelado: boolean
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  readonly puedeComparar: boolean
  /** Números de página con diferencias, para poder navegar entre ellas. */
  readonly paginasConDiferencias: readonly number[]
  readonly seleccionarArchivos: (
    ranura: Ranura,
  ) => (archivos: readonly File[]) => void
  readonly cambiarUmbral: (umbral: number) => void
  readonly cambiarCompararVisualmente: (comparar: boolean) => void
  readonly cambiarModoVista: (modo: ModoVista) => void
  readonly cambiarOpacidad: (opacidad: number) => void
  readonly cambiarPaginaActiva: (pagina: number) => void
  readonly irADiferenciaAnterior: () => void
  readonly irADiferenciaSiguiente: () => void
  readonly comparar: () => void
  readonly cancelar: () => void
  readonly descargarInforme: () => void
  readonly restablecer: () => void
}

/**
 * Concentra el estado de la herramienta «Comparar PDF».
 *
 * Los documentos se abren, se comparan y **se cierran en el mismo ciclo**. No se
 * quedan abiertos esperando: dos documentos de PDF.js vivos consumen memoria y aquí no
 * hacen falta después de comparar, porque las miniaturas de la vista se dibujan aparte.
 */
export function useCompararPdf(): ControladorCompararPdf {
  const [antes, establecerAntes] = useState<PdfSeleccionado | null>(null)
  const [despues, establecerDespues] = useState<PdfSeleccionado | null>(null)
  const [umbral, establecerUmbral] = useState(UMBRAL_PREDETERMINADO)
  const [visual, establecerVisual] = useState(true)
  const [modoVista, establecerModoVista] = useState<ModoVista>('lado-a-lado')
  const [opacidad, establecerOpacidad] = useState(0.5)
  const [paginaActiva, establecerPaginaActiva] = useState(1)
  const [comparando, establecerComparando] = useState(false)
  const [progreso, establecerProgreso] = useState<ProgresoComparacion | null>(
    null,
  )
  const [resultado, establecerResultado] =
    useState<ResultadoComparacion | null>(null)
  const [cancelado, establecerCancelado] = useState(false)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)

  const refControlador = useRef<AbortController | null>(null)

  // Al salir de la herramienta se interrumpe cualquier comparación en curso.
  useEffect(
    () => () => {
      refControlador.current?.abort()
    },
    [],
  )

  const seleccionarArchivos = useCallback(
    (ranura: Ranura) =>
      (archivos: readonly File[]): void => {
        const primero = archivos[0]

        if (primero === undefined) {
          return
        }

        const validacion = validarArchivoPdf(primero)

        if (!validacion.valido) {
          establecerMensajeError(validacion.motivo)
          return
        }

        establecerMensajeError(null)
        establecerResultado(null)
        establecerCancelado(false)

        const seleccionado: PdfSeleccionado = {
          id: construirIdArchivo(primero),
          archivo: primero,
          nombre: primero.name,
          tamano: primero.size,
        }

        if (ranura === 'antes') {
          establecerAntes(seleccionado)
        } else {
          establecerDespues(seleccionado)
        }
      },
    [],
  )

  const cambiarUmbral = useCallback((siguiente: number): void => {
    establecerUmbral(siguiente)
    establecerResultado(null)
  }, [])

  const cambiarCompararVisualmente = useCallback(
    (siguiente: boolean): void => {
      establecerVisual(siguiente)
      establecerResultado(null)
    },
    [],
  )

  const cambiarPaginaActiva = useCallback((pagina: number): void => {
    establecerPaginaActiva(Math.max(1, Math.trunc(pagina)))
  }, [])

  const cancelar = useCallback((): void => {
    refControlador.current?.abort()
  }, [])

  const comparar = useCallback((): void => {
    if (antes === null || despues === null || comparando) {
      return
    }

    const controlador = new AbortController()
    refControlador.current = controlador

    establecerComparando(true)
    establecerResultado(null)
    establecerCancelado(false)
    establecerMensajeError(null)
    establecerProgreso(null)

    void (async () => {
      const abiertoAntes = await abrirParaComparar(antes.archivo).catch(
        () => null,
      )
      const abiertoDespues = await abrirParaComparar(despues.archivo).catch(
        () => null,
      )

      try {
        if (abiertoAntes === null || abiertoDespues === null) {
          throw new Error(
            'No se pudo abrir alguno de los dos documentos. Comprueba que los dos son PDF válidos.',
          )
        }

        const generado = await compararDocumentos(
          abiertoAntes.comparable,
          abiertoDespues.comparable,
          {
            umbral,
            compararVisualmente: visual,
            senal: controlador.signal,
            alProgreso: establecerProgreso,
          },
        )

        establecerResultado(generado)
        establecerPaginaActiva(1)
      } catch (error) {
        if (controlador.signal.aborted) {
          establecerCancelado(true)
        } else {
          establecerMensajeError(
            obtenerMensajeError(
              error,
              'No se pudo comparar los documentos. Vuelve a intentarlo.',
            ),
          )
        }
      } finally {
        // Los dos documentos se cierran siempre: si no, PDF.js dejaría sus
        // trabajadores vivos y su memoria ocupada.
        await abiertoAntes?.cerrar()
        await abiertoDespues?.cerrar()

        establecerComparando(false)
        establecerProgreso(null)
        refControlador.current = null
      }
    })()
  }, [antes, comparando, despues, umbral, visual])

  const descargarInforme = useCallback((): void => {
    if (resultado === null) {
      return
    }

    const html = generarInforme(resultado, new Date())

    descargarBlob(
      new Blob([html], { type: 'text/html;charset=utf-8' }),
      NOMBRE_INFORME,
    )
  }, [resultado])

  const restablecer = useCallback((): void => {
    refControlador.current?.abort()
    establecerAntes(null)
    establecerDespues(null)
    establecerResultado(null)
    establecerProgreso(null)
    establecerCancelado(false)
    establecerMensajeError(null)
    establecerPaginaActiva(1)
    establecerUmbral(UMBRAL_PREDETERMINADO)
    establecerVisual(true)
  }, [])

  // Se memoiza porque de ella dependen las dos funciones de navegación: sin esto se
  // recrearía en cada dibujado y con ella los `useCallback`, que dejarían de servir.
  const paginasConDiferencias = useMemo(
    () =>
      resultado === null
        ? []
        : resultado.paginas
            .filter((pagina) => pagina.estado !== 'identica')
            .map((pagina) => pagina.numero),
    [resultado],
  )

  const irADiferenciaSiguiente = useCallback((): void => {
    const siguiente = paginasConDiferencias.find(
      (numero) => numero > paginaActiva,
    )

    if (siguiente !== undefined) {
      establecerPaginaActiva(siguiente)
    }
  }, [paginaActiva, paginasConDiferencias])

  const irADiferenciaAnterior = useCallback((): void => {
    const anteriores = paginasConDiferencias.filter(
      (numero) => numero < paginaActiva,
    )
    const anterior = anteriores.at(-1)

    if (anterior !== undefined) {
      establecerPaginaActiva(anterior)
    }
  }, [paginaActiva, paginasConDiferencias])

  const estado = calcularEstadoHerramienta({
    hayDocumento: antes !== null && despues !== null,
    cargando: false,
    procesando: comparando,
    hayResultado: resultado !== null,
    hayError: mensajeError !== null,
  })

  return {
    antes,
    despues,
    umbral,
    compararVisualmente: visual,
    modoVista,
    opacidad,
    paginaActiva,
    comparando,
    progreso,
    resultado,
    cancelado,
    estado,
    bloqueado: comparando,
    mensajeError,
    puedeComparar: antes !== null && despues !== null && !comparando,
    paginasConDiferencias,
    seleccionarArchivos,
    cambiarUmbral,
    cambiarCompararVisualmente,
    cambiarModoVista: establecerModoVista,
    cambiarOpacidad: establecerOpacidad,
    cambiarPaginaActiva,
    irADiferenciaAnterior,
    irADiferenciaSiguiente,
    comparar,
    cancelar,
    descargarInforme,
    restablecer,
  }
}

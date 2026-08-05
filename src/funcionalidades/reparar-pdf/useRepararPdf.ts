import { useCallback, useEffect, useState } from 'react'
import { useProcesadorQpdf } from '../../ganchos/useProcesadorQpdf'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta, PdfSeleccionado } from '../../pdf/tipos'
import { validarArchivoPdf } from '../../pdf/validarDocumentoPdf'
import type { NivelReparacion } from '../../seguridad/qpdf/reparacionPdf'
import {
  diagnosticarPdf,
  repararPdf,
  type DiagnosticoDocumento,
  type ResultadoReparacion,
} from '../../seguridad/qpdf/repararPdf'
import { construirIdArchivo } from '../../utilidades/validacionArchivos'

/** Cómo va el diagnóstico del documento cargado. */
export type EstadoDiagnostico =
  | 'sin-comprobar'
  | 'comprobando'
  | 'listo'
  | 'fallido'

/** Estado y acciones de la herramienta «Reparar PDF». */
export interface ControladorRepararPdf {
  readonly documento: PdfSeleccionado | null
  readonly proceso: ControladorProcesoPdf<ResultadoReparacion>
  /** Diagnóstico del documento, o `null` si todavía no hay. */
  readonly diagnostico: DiagnosticoDocumento | null
  readonly estadoDiagnostico: EstadoDiagnostico
  readonly nivel: NivelReparacion
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  readonly mensajeAviso: string | null
  readonly puedeReparar: boolean
  readonly seleccionarArchivos: (archivos: readonly File[]) => void
  readonly cambiarNivel: (nivel: NivelReparacion) => void
  readonly restablecer: () => void
  readonly reparar: () => void
}

/**
 * Concentra el estado de la herramienta «Reparar PDF».
 *
 * El documento se diagnostica **en cuanto se carga**, sin que haya que pedirlo: quien
 * llega aquí con un archivo que no se abre quiere saber primero qué le pasa, y hacerle
 * pulsar un botón para averiguarlo no aporta nada.
 *
 * El diagnóstico que falla no bloquea la reparación. Es deliberado: si `--check` no
 * consigue ni leer el archivo, intentar repararlo sigue siendo lo único que puede
 * ayudar, y negárselo por no haber podido diagnosticarlo sería absurdo.
 */
export function useRepararPdf(): ControladorRepararPdf {
  const procesador = useProcesadorQpdf()
  const proceso = useProcesoPdf<ResultadoReparacion>()

  const [documento, establecerDocumento] = useState<PdfSeleccionado | null>(null)
  const [diagnostico, establecerDiagnostico] =
    useState<DiagnosticoDocumento | null>(null)
  const [estadoDiagnostico, establecerEstadoDiagnostico] =
    useState<EstadoDiagnostico>('sin-comprobar')
  const [nivel, establecerNivel] = useState<NivelReparacion>('conservador')
  const [mensajeAviso, establecerMensajeAviso] = useState<string | null>(null)
  const [mensajeErrorPropio, establecerMensajeErrorPropio] = useState<
    string | null
  >(null)

  // El trabajador se destruye al salir de la herramienta: mientras vive, el
  // WebAssembly y el documento que estuviera procesando siguen ocupando memoria.
  useEffect(() => procesador.destruir, [procesador])

  const seleccionarArchivos = useCallback(
    (archivos: readonly File[]): void => {
      const primero = archivos[0]

      if (primero === undefined) {
        return
      }

      const validacion = validarArchivoPdf(primero)

      if (!validacion.valido) {
        establecerMensajeErrorPropio(validacion.motivo)
        return
      }

      establecerMensajeErrorPropio(null)
      establecerMensajeAviso(
        archivos.length > 1
          ? 'Solo se repara un documento a la vez, así que se ha tomado el primero.'
          : null,
      )
      proceso.limpiarResultado()
      establecerDiagnostico(null)
      establecerEstadoDiagnostico('comprobando')

      const seleccionado: PdfSeleccionado = {
        id: construirIdArchivo(primero),
        archivo: primero,
        nombre: primero.name,
        tamano: primero.size,
      }

      establecerDocumento(seleccionado)

      // El diagnóstico se lanza sin esperarlo: la interfaz ya muestra que está en
      // curso y no tiene sentido bloquearla mientras qpdf recorre el archivo.
      void (async () => {
        try {
          const resultado = await diagnosticarPdf(
            procesador.obtener(),
            primero,
          )

          establecerDiagnostico(resultado)
          establecerEstadoDiagnostico('listo')
        } catch {
          // Que el diagnóstico falle no impide intentar la reparación, así que no se
          // trata como un error de la herramienta: solo se deja constancia.
          establecerEstadoDiagnostico('fallido')
        }
      })()
    },
    [procesador, proceso],
  )

  const cambiarNivel = useCallback(
    (siguiente: NivelReparacion): void => {
      establecerNivel(siguiente)
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const restablecer = useCallback((): void => {
    proceso.limpiarResultado()
    establecerDocumento(null)
    establecerDiagnostico(null)
    establecerEstadoDiagnostico('sin-comprobar')
    establecerNivel('conservador')
    establecerMensajeAviso(null)
    establecerMensajeErrorPropio(null)
  }, [proceso])

  const mensajeError = mensajeErrorPropio ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: documento !== null,
    cargando: estadoDiagnostico === 'comprobando',
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = proceso.procesando || estadoDiagnostico === 'comprobando'

  const puedeReparar = documento !== null && !bloqueado

  const reparar = useCallback((): void => {
    if (documento === null) {
      return
    }

    establecerMensajeErrorPropio(null)

    // `useProcesoPdf` ya traduce los `ErrorQpdf` a su mensaje para la interfaz, así
    // que aquí no hay nada que envolver.
    proceso.ejecutar(
      async () =>
        await repararPdf(procesador.obtener(), documento.archivo, nivel),
    )
  }, [documento, nivel, procesador, proceso])

  return {
    documento,
    proceso,
    diagnostico,
    estadoDiagnostico,
    nivel,
    estado,
    bloqueado,
    mensajeError,
    mensajeAviso,
    puedeReparar,
    seleccionarArchivos,
    cambiarNivel,
    restablecer,
    reparar,
  }
}

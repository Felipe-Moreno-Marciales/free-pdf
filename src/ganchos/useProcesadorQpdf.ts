import { useCallback, useEffect, useRef } from 'react'
import {
  crearProcesadorQpdf,
  type ProcesadorQpdf,
} from '../seguridad/qpdf/crearProcesadorQpdf'

/**
 * Gestiona el ciclo de vida del trabajador de qpdf.
 *
 * El trabajador se crea la primera vez que se pide y se **destruye al desmontar**
 * la herramienta. Eso importa: mientras vive, el WebAssembly ocupa memoria y
 * podría conservar restos de lo último que procesó. Al destruirlo, el hilo y toda
 * su memoria desaparecen.
 *
 * También se destruye al restablecer, para que no quede nada de la operación
 * anterior.
 */
export interface ControladorProcesadorQpdf {
  /** Devuelve el procesador, creándolo si hace falta. */
  readonly obtener: () => ProcesadorQpdf
  /** Destruye el trabajador actual, si existe. */
  readonly destruir: () => void
  /** `true` cuando hay un trabajador vivo. */
  readonly estaActivo: () => boolean
}

/** Crea y controla el procesador de qpdf de una herramienta. */
export function useProcesadorQpdf(): ControladorProcesadorQpdf {
  const referencia = useRef<ProcesadorQpdf | null>(null)

  const destruir = useCallback((): void => {
    const actual = referencia.current
    referencia.current = null
    actual?.destruir()
  }, [])

  const obtener = useCallback((): ProcesadorQpdf => {
    if (referencia.current === null) {
      referencia.current = crearProcesadorQpdf()
    }

    return referencia.current
  }, [])

  const estaActivo = useCallback(
    (): boolean => referencia.current?.estaActivo() === true,
    [],
  )

  // Al abandonar la herramienta se detiene el trabajador sin excepción.
  useEffect(() => {
    return () => {
      const actual = referencia.current
      referencia.current = null
      actual?.destruir()
    }
  }, [])

  return { obtener, destruir, estaActivo }
}

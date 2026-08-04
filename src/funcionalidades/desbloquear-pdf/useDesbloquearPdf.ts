import { useCallback, useEffect, useState } from 'react'
import { useProcesadorQpdf } from '../../ganchos/useProcesadorQpdf'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta, PdfSeleccionado } from '../../pdf/tipos'
import { validarArchivoPdf } from '../../pdf/validarDocumentoPdf'
import {
  comprobarSiEstaCifrado,
  desbloquearPdf,
} from '../../seguridad/qpdf/desbloquearPdf'
import { ErrorQpdf } from '../../seguridad/qpdf/erroresQpdf'
import type { ResultadoSeguridad } from '../../seguridad/qpdf/tipos'
import { construirIdArchivo } from '../../utilidades/validacionArchivos'

/** Lo que se sabe del cifrado del documento cargado. */
export type EstadoCifradoDocumento =
  | 'sin-comprobar'
  | 'comprobando'
  | 'cifrado'
  | 'sin-cifrar'
  | 'indeterminado'

/** Estado y acciones de la herramienta «Desbloquear PDF». */
export interface ControladorDesbloquearPdf {
  /** Documento elegido, o `null`. */
  readonly documento: PdfSeleccionado | null
  /** Ejecución y descarga del resultado. */
  readonly proceso: ControladorProcesoPdf<ResultadoSeguridad>
  /** Contraseña escrita. */
  readonly contrasena: string
  /** Lo que se sabe del cifrado del documento. */
  readonly estadoCifrado: EstadoCifradoDocumento
  /** Estado visible de la herramienta. */
  readonly estado: EstadoHerramienta
  /** `true` cuando no se debe permitir ninguna interacción. */
  readonly bloqueado: boolean
  /** Mensaje de error pendiente, o `null`. */
  readonly mensajeError: string | null
  /** `true` cuando se puede intentar desbloquear. */
  readonly puedeDesbloquear: boolean
  /** Elige el documento que se va a desbloquear. */
  readonly seleccionarArchivos: (archivos: readonly File[]) => void
  /** Cambia la contraseña escrita. */
  readonly cambiarContrasena: (contrasena: string) => void
  /** Vacía la herramienta y borra la contraseña del estado. */
  readonly restablecer: () => void
  /** Intenta desbloquear el documento. */
  readonly desbloquear: () => void
}

/**
 * Concentra el estado de la herramienta «Desbloquear PDF».
 *
 * La contraseña vive en el estado de React solo mientras se usa: **se borra en
 * cuanto la operación termina**, con éxito o con error, y también al restablecer o
 * al cambiar de documento. No se guarda en ningún almacenamiento del navegador ni
 * viaja a ningún servidor.
 *
 * Al cargar el archivo se comprueba si está cifrado, para poder avisar de que no
 * hace falta desbloquear nada antes de que la persona escriba una contraseña que
 * no se va a usar.
 */
export function useDesbloquearPdf(): ControladorDesbloquearPdf {
  const procesador = useProcesadorQpdf()
  const proceso = useProcesoPdf<ResultadoSeguridad>()

  const [documento, establecerDocumento] = useState<PdfSeleccionado | null>(null)
  const [contrasena, establecerContrasena] = useState('')
  const [mensajeArchivo, establecerMensajeArchivo] = useState<string | null>(
    null,
  )
  const [estadoCifrado, establecerEstadoCifrado] =
    useState<EstadoCifradoDocumento>('sin-comprobar')

  // Al desmontar se olvida la contraseña; el trabajador lo destruye su gancho.
  useEffect(() => {
    return () => {
      establecerContrasena('')
    }
  }, [])

  // Comprueba si el documento cargado está cifrado.
  useEffect(() => {
    if (documento === null) {
      establecerEstadoCifrado('sin-comprobar')
      return
    }

    let cancelado = false
    establecerEstadoCifrado('comprobando')

    const comprobar = async (): Promise<void> => {
      try {
        const cifrado = await comprobarSiEstaCifrado(
          procesador.obtener(),
          documento.archivo,
        )

        if (!cancelado) {
          establecerEstadoCifrado(cifrado ? 'cifrado' : 'sin-cifrar')
        }
      } catch {
        // Si la comprobación falla no se bloquea nada: se deja intentar.
        if (!cancelado) {
          establecerEstadoCifrado('indeterminado')
        }
      }
    }

    void comprobar()

    return () => {
      cancelado = true
    }
  }, [documento, procesador])

  const seleccionarArchivos = useCallback(
    (archivos: readonly File[]): void => {
      const primero = archivos[0]
      if (primero === undefined) {
        return
      }

      const validacion = validarArchivoPdf(primero)
      if (!validacion.valido) {
        establecerMensajeArchivo(validacion.mensaje)
        return
      }

      establecerMensajeArchivo(null)
      establecerContrasena('')
      establecerDocumento({
        id: construirIdArchivo(primero),
        archivo: primero,
        nombre: primero.name,
        tamano: primero.size,
      })
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarContrasena = useCallback(
    (siguiente: string): void => {
      establecerContrasena(siguiente)
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const restablecer = useCallback((): void => {
    procesador.destruir()
    establecerDocumento(null)
    establecerContrasena('')
    establecerMensajeArchivo(null)
    establecerEstadoCifrado('sin-comprobar')
    proceso.limpiarResultado()
  }, [procesador, proceso])

  const mensajeError = mensajeArchivo ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: documento !== null,
    cargando: estadoCifrado === 'comprobando',
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = proceso.procesando

  const puedeDesbloquear =
    documento !== null &&
    !bloqueado &&
    contrasena !== '' &&
    estadoCifrado !== 'sin-cifrar' &&
    estadoCifrado !== 'comprobando'

  const desbloquear = useCallback((): void => {
    if (documento === null || contrasena === '') {
      return
    }

    const clave = contrasena

    proceso.ejecutar(async () => {
      try {
        return await desbloquearPdf(procesador.obtener(), {
          archivo: documento.archivo,
          contrasena: clave,
        })
      } catch (error) {
        // Se vuelve a lanzar tal cual: `ErrorQpdf` ya trae un mensaje en español
        // que nunca incluye la contraseña.
        throw error instanceof ErrorQpdf
          ? error
          : new ErrorQpdf(
              'error-interno',
              'No se pudo desbloquear el documento. Vuelve a intentarlo.',
              { cause: error },
            )
      } finally {
        // La contraseña deja de estar en el estado en cuanto se ha usado.
        establecerContrasena('')
      }
    })
  }, [documento, contrasena, proceso, procesador])

  return {
    documento,
    proceso,
    contrasena,
    estadoCifrado,
    estado,
    bloqueado,
    mensajeError,
    puedeDesbloquear,
    seleccionarArchivos,
    cambiarContrasena,
    restablecer,
    desbloquear,
  }
}

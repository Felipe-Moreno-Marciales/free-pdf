import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProcesadorQpdf } from '../../ganchos/useProcesadorQpdf'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta, PdfSeleccionado } from '../../pdf/tipos'
import { validarArchivoPdf } from '../../pdf/validarDocumentoPdf'
import { PERMISOS_PREDETERMINADOS } from '../../seguridad/qpdf/permisosPdf'
import { protegerPdf } from '../../seguridad/qpdf/protegerPdf'
import type { PermisosPdf, ResultadoSeguridad } from '../../seguridad/qpdf/tipos'
import { construirIdArchivo } from '../../utilidades/validacionArchivos'
import type { ConfiguracionProteccion, ValidacionProteccion } from './tipos'
import { validarProteccion } from './validarProteccion'

/** Configuración con la que arranca la herramienta. */
export const CONFIGURACION_PREDETERMINADA: ConfiguracionProteccion = {
  contrasenaUsuario: '',
  confirmacionUsuario: '',
  usarPropietarioPropio: false,
  contrasenaPropietario: '',
  confirmacionPropietario: '',
  permisos: PERMISOS_PREDETERMINADOS,
}

/** Estado y acciones de la herramienta «Proteger PDF». */
export interface ControladorProtegerPdf {
  /** Documento elegido, o `null`. */
  readonly documento: PdfSeleccionado | null
  /** Ejecución y descarga del resultado. */
  readonly proceso: ControladorProcesoPdf<ResultadoSeguridad>
  /** Configuración actual. */
  readonly configuracion: ConfiguracionProteccion
  /** Validación de la configuración. */
  readonly validacion: ValidacionProteccion
  /** Estado visible de la herramienta. */
  readonly estado: EstadoHerramienta
  /** `true` cuando no se debe permitir ninguna interacción. */
  readonly bloqueado: boolean
  /** Mensaje de error pendiente, o `null`. */
  readonly mensajeError: string | null
  /** `true` cuando se puede proteger. */
  readonly puedeProteger: boolean
  /** Elige el documento que se va a proteger. */
  readonly seleccionarArchivos: (archivos: readonly File[]) => void
  /** Cambia parte de la configuración. */
  readonly cambiarConfiguracion: (
    cambios: Partial<ConfiguracionProteccion>,
  ) => void
  /** Cambia parte de los permisos. */
  readonly cambiarPermisos: (cambios: Partial<PermisosPdf>) => void
  /** Vacía la herramienta y borra las contraseñas del estado. */
  readonly restablecer: () => void
  /** Protege el documento. */
  readonly proteger: () => void
}

/**
 * Concentra el estado de la herramienta «Proteger PDF».
 *
 * Las contraseñas viven aquí, en el estado de React, únicamente mientras la
 * herramienta está abierta. **Se borran en cuanto la operación termina**, tanto si
 * sale bien como si falla, y también al restablecer o al cambiar de documento. No
 * se guardan en ningún almacenamiento del navegador.
 */
export function useProtegerPdf(): ControladorProtegerPdf {
  const procesador = useProcesadorQpdf()
  const proceso = useProcesoPdf<ResultadoSeguridad>()

  const [documento, establecerDocumento] = useState<PdfSeleccionado | null>(null)
  const [mensajeArchivo, establecerMensajeArchivo] = useState<string | null>(
    null,
  )
  const [configuracion, establecerConfiguracion] =
    useState<ConfiguracionProteccion>(CONFIGURACION_PREDETERMINADA)

  /** Borra del estado todas las contraseñas, conservando los permisos. */
  const olvidarContrasenas = useCallback((): void => {
    establecerConfiguracion((actual) => ({
      ...CONFIGURACION_PREDETERMINADA,
      permisos: actual.permisos,
      usarPropietarioPropio: actual.usarPropietarioPropio,
    }))
  }, [])

  // Al desmontar la herramienta se olvidan las contraseñas. El trabajador lo
  // destruye su propio gancho.
  useEffect(() => {
    return () => {
      establecerConfiguracion(CONFIGURACION_PREDETERMINADA)
    }
  }, [])

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
      establecerDocumento({
        id: construirIdArchivo(primero),
        archivo: primero,
        nombre: primero.name,
        tamano: primero.size,
      })
      // Cambiar de documento invalida lo escrito: se empieza de cero.
      olvidarContrasenas()
      proceso.limpiarResultado()
    },
    [olvidarContrasenas, proceso],
  )

  const cambiarConfiguracion = useCallback(
    (cambios: Partial<ConfiguracionProteccion>): void => {
      establecerConfiguracion((actual) => ({ ...actual, ...cambios }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarPermisos = useCallback(
    (cambios: Partial<PermisosPdf>): void => {
      establecerConfiguracion((actual) => ({
        ...actual,
        permisos: { ...actual.permisos, ...cambios },
      }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const restablecer = useCallback((): void => {
    // Destruir el trabajador libera el motor y cualquier resto de la operación.
    procesador.destruir()
    establecerDocumento(null)
    establecerMensajeArchivo(null)
    establecerConfiguracion(CONFIGURACION_PREDETERMINADA)
    proceso.limpiarResultado()
  }, [procesador, proceso])

  const validacion = useMemo(
    () => validarProteccion(configuracion),
    [configuracion],
  )

  const mensajeError = mensajeArchivo ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: documento !== null,
    cargando: false,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = proceso.procesando

  const puedeProteger =
    documento !== null && !bloqueado && validacion.valida

  const proteger = useCallback((): void => {
    if (documento === null || !validacion.valida) {
      return
    }

    // Se toman las contraseñas en variables locales para no depender del estado
    // dentro de la operación, y se olvidan del estado al terminar.
    const contrasenaUsuario = configuracion.contrasenaUsuario
    const contrasenaPropietario = configuracion.usarPropietarioPropio
      ? configuracion.contrasenaPropietario
      : ''

    proceso.ejecutar(async () => {
      try {
        return await protegerPdf(procesador.obtener(), {
          archivo: documento.archivo,
          contrasenaUsuario,
          contrasenaPropietario,
          permisos: configuracion.permisos,
        })
      } finally {
        // Pase lo que pase, las contraseñas dejan de estar en el estado.
        olvidarContrasenas()
      }
    })
  }, [
    documento,
    validacion.valida,
    configuracion,
    proceso,
    procesador,
    olvidarContrasenas,
  ])

  return {
    documento,
    proceso,
    configuracion,
    validacion,
    estado,
    bloqueado,
    mensajeError,
    puedeProteger,
    seleccionarArchivos,
    cambiarConfiguracion,
    cambiarPermisos,
    restablecer,
    proteger,
  }
}

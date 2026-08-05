import { useCallback, useMemo, useState } from 'react'
import {
  useSeleccionImagenes,
  type ControladorSeleccionImagenes,
} from '../../ganchos/useSeleccionImagenes'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import {
  CONFIGURACION_PAGINA_PREDETERMINADA,
  calcularColocacion,
  laImagenQuedaMuyPequena,
} from '../../imagenes/calcularAjusteImagen'
import { dimensionesTrasRotar } from '../../imagenes/orientacionImagen'
import type {
  ColocacionImagen,
  ConfiguracionPaginaImagen,
} from '../../imagenes/tipos'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta, ResultadoDocumento } from '../../pdf/tipos'
import { crearPdfDesdeImagenes } from './crearPdfDesdeImagenes'
import type { EntradaImagen } from './tipos'

/** Estado y acciones de la herramienta «Imágenes a PDF». */
export interface ControladorImagenesAPdf {
  /** Selección de imágenes. */
  readonly seleccion: ControladorSeleccionImagenes
  /** Ejecución y descarga del resultado. */
  readonly proceso: ControladorProcesoPdf<ResultadoDocumento>
  /** Configuración de las páginas. */
  readonly configuracion: ConfiguracionPaginaImagen
  /** Estado visible de la herramienta. */
  readonly estado: EstadoHerramienta
  /** `true` cuando no se debe permitir ninguna interacción. */
  readonly bloqueado: boolean
  /** Primer mensaje de error pendiente, o `null`. */
  readonly mensajeError: string | null
  /** Advertencia sobre la configuración o la memoria, o `null`. */
  readonly advertencia: string | null
  /** Colocación de la primera imagen, para la vista previa. */
  readonly vistaPrevia: ColocacionImagen | null
  /** `true` cuando se puede generar el documento. */
  readonly puedeGenerar: boolean
  /** Cambia parte de la configuración. */
  readonly cambiarConfiguracion: (
    cambios: Partial<ConfiguracionPaginaImagen>,
  ) => void
  /** Devuelve la configuración a sus valores iniciales. */
  readonly restablecerConfiguracion: () => void
  /** Vacía la selección y descarta el resultado. */
  readonly restablecer: () => void
  /** Genera el documento con las imágenes seleccionadas. */
  readonly generar: () => void
}

/**
 * Concentra el estado de la herramienta «Imágenes a PDF».
 *
 * La vista previa se calcula con la misma función pura que usa el procesamiento,
 * así que lo que se muestra coincide con lo que se genera.
 */
export function useImagenesAPdf(): ControladorImagenesAPdf {
  const seleccion = useSeleccionImagenes()
  const proceso = useProcesoPdf<ResultadoDocumento>()
  const [configuracion, establecerConfiguracion] =
    useState<ConfiguracionPaginaImagen>(CONFIGURACION_PAGINA_PREDETERMINADA)

  const primera = seleccion.imagenes[0] ?? null

  const vistaPrevia = useMemo<ColocacionImagen | null>(() => {
    if (primera === null || primera.dimensiones === null) {
      return null
    }

    return calcularColocacion(
      dimensionesTrasRotar(primera.dimensiones, primera.rotacion),
      configuracion,
    )
  }, [primera, configuracion])

  const cambiarConfiguracion = useCallback(
    (cambios: Partial<ConfiguracionPaginaImagen>): void => {
      establecerConfiguracion((actual) => ({ ...actual, ...cambios }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const restablecerConfiguracion = useCallback((): void => {
    establecerConfiguracion(CONFIGURACION_PAGINA_PREDETERMINADA)
    proceso.limpiarResultado()
  }, [proceso])

  const restablecer = useCallback((): void => {
    seleccion.limpiar()
    proceso.limpiarResultado()
  }, [seleccion, proceso])

  const mensajeError = seleccion.mensajeError ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: seleccion.imagenes.length > 0,
    cargando: seleccion.leyendoMedidas,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = proceso.procesando

  const advertencia = calcularAdvertencia(
    seleccion.avisoMemoria,
    primera === null || primera.dimensiones === null
      ? false
      : laImagenQuedaMuyPequena(
          dimensionesTrasRotar(primera.dimensiones, primera.rotacion),
          configuracion,
        ),
  )

  const puedeGenerar =
    seleccion.imagenes.length > 0 && !bloqueado && !seleccion.leyendoMedidas

  const generar = useCallback((): void => {
    if (seleccion.imagenes.length === 0) {
      return
    }

    const entradas: readonly EntradaImagen[] = seleccion.imagenes.map(
      (imagen) => ({
        id: imagen.id,
        nombre: imagen.nombre,
        contenido: imagen.archivo,
        formato: imagen.formato,
        rotacion: imagen.rotacion,
        dimensiones: imagen.dimensiones,
      }),
    )

    proceso.ejecutar(() =>
      crearPdfDesdeImagenes({ imagenes: entradas, configuracion }),
    )
  }, [seleccion.imagenes, configuracion, proceso])

  return {
    seleccion,
    proceso,
    configuracion,
    estado,
    bloqueado,
    mensajeError,
    advertencia,
    vistaPrevia,
    puedeGenerar,
    cambiarConfiguracion,
    restablecerConfiguracion,
    restablecer,
    generar,
  }
}

/** Redacta la advertencia que corresponda, o `null` si no hay ninguna. */
function calcularAdvertencia(
  avisoMemoria: boolean,
  quedaMuyPequena: boolean,
): string | null {
  const avisos: string[] = []

  if (quedaMuyPequena) {
    avisos.push(
      'Con estos márgenes la imagen aprovechará muy poco de la página. Reduce el margen si quieres que se vea más grande.',
    )
  }

  if (avisoMemoria) {
    avisos.push(
      'La selección es grande: convertirla puede tardar y consumir bastante memoria. Si el navegador se queda sin memoria, prueba con menos imágenes.',
    )
  }

  return avisos.length === 0 ? null : avisos.join(' ')
}

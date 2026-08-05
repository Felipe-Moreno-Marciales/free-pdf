import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import { inspeccionarFormulario } from '../../formularios/inspeccionarFormulario'
import { proponerNombreCampo } from '../../formularios/nombresCampos'
import { procesarFormulario } from '../../formularios/procesarFormulario'
import {
  comprobarObligatorios,
  validarCamposNuevos,
  validarValores,
} from '../../formularios/validarCamposFormulario'
import type {
  CampoNuevo,
  InspeccionFormulario,
  ProblemaFormulario,
  ValorCampo,
} from '../../formularios/tipos'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type {
  EstadoHerramienta,
  PdfSeleccionado,
  ResultadoDocumento,
} from '../../pdf/tipos'
import { validarArchivoPdf } from '../../pdf/validarDocumentoPdf'
import { obtenerMensajeError } from '../../utilidades/errores'
import { construirIdArchivo } from '../../utilidades/validacionArchivos'
import {
  actualizarPorId,
  eliminarPorId,
} from '../../utilidades/listas'

/** Modo de trabajo de la herramienta. */
export type ModoFormulario = 'rellenar' | 'crear'

/** Campo nuevo con los valores con los que arranca el editor. */
export function crearCampoNuevo(
  id: string,
  nombre: string,
  pagina: number,
): CampoNuevo {
  return {
    id,
    nombre,
    clase: 'texto',
    pagina,
    rectangulo: { x: 50, y: 500, ancho: 200, alto: 22 },
    valorPredeterminado: '',
    opciones: [],
    textoAyuda: '',
    soloLectura: false,
    obligatorio: false,
    tamanoFuente: 11,
    colorTexto: '#1b1f2a',
    colorBorde: '#565e72',
    colorFondo: '#ffffff',
    grosorBorde: 1,
  }
}

/** Estado y acciones de la herramienta «Formularios PDF». */
export interface ControladorFormulariosPdf {
  readonly documento: PdfSeleccionado | null
  readonly proceso: ControladorProcesoPdf<ResultadoDocumento>
  /** Formulario detectado en el documento, o `null`. */
  readonly inspeccion: InspeccionFormulario | null
  /** `true` mientras se inspecciona el documento. */
  readonly inspeccionando: boolean
  readonly modo: ModoFormulario
  /** Valores que se van a escribir, por nombre de campo. */
  readonly valores: ReadonlyMap<string, ValorCampo>
  /** Campos que se van a crear. */
  readonly camposNuevos: readonly CampoNuevo[]
  /** `true` para aplanar el formulario al guardar. */
  readonly aplanar: boolean
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  /** Problemas que impiden generar el documento. */
  readonly problemas: readonly ProblemaFormulario[]
  /** Avisos que no impiden generar el documento. */
  readonly avisos: readonly ProblemaFormulario[]
  readonly puedeGenerar: boolean
  readonly seleccionarArchivos: (archivos: readonly File[]) => void
  readonly cambiarModo: (modo: ModoFormulario) => void
  readonly cambiarValor: (nombre: string, valor: ValorCampo) => void
  readonly limpiarValor: (nombre: string) => void
  readonly limpiarTodos: () => void
  readonly restaurarOriginales: () => void
  readonly anadirCampo: () => void
  readonly cambiarCampo: (id: string, cambios: Partial<CampoNuevo>) => void
  readonly eliminarCampo: (id: string) => void
  readonly cambiarAplanar: (aplanar: boolean) => void
  readonly restablecer: () => void
  readonly generar: () => void
}

/**
 * Concentra el estado de la herramienta «Formularios PDF».
 *
 * Al cargar el documento se inspecciona su formulario para poder mostrar los campos
 * reales, con sus valores, sus opciones y sus restricciones. Los valores que se
 * escriben viven aparte de los originales, así que «restaurar» siempre puede volver
 * a lo que traía el archivo.
 */
export function useFormulariosPdf(): ControladorFormulariosPdf {
  const proceso = useProcesoPdf<ResultadoDocumento>()

  const [documento, establecerDocumento] = useState<PdfSeleccionado | null>(null)
  const [inspeccion, establecerInspeccion] =
    useState<InspeccionFormulario | null>(null)
  const [inspeccionando, establecerInspeccionando] = useState(false)
  const [mensajeArchivo, establecerMensajeArchivo] = useState<string | null>(
    null,
  )
  const [modo, establecerModo] = useState<ModoFormulario>('rellenar')
  const [valores, establecerValores] = useState<ReadonlyMap<string, ValorCampo>>(
    () => new Map(),
  )
  const [camposNuevos, establecerCamposNuevos] = useState<
    readonly CampoNuevo[]
  >([])
  const [aplanar, establecerAplanar] = useState(false)

  const contadorCampos = useRef(0)

  // Inspecciona el formulario del documento cargado.
  useEffect(() => {
    if (documento === null) {
      establecerInspeccion(null)
      return
    }

    let cancelado = false
    establecerInspeccionando(true)

    const inspeccionar = async (): Promise<void> => {
      try {
        const { inspeccion: leida } = await inspeccionarFormulario(
          documento.archivo,
        )

        if (!cancelado) {
          establecerInspeccion(leida)
        }
      } catch (error) {
        if (!cancelado) {
          establecerMensajeArchivo(
            obtenerMensajeError(
              error,
              'No se pudo leer el formulario del documento.',
            ),
          )
        }
      } finally {
        if (!cancelado) {
          establecerInspeccionando(false)
        }
      }
    }

    void inspeccionar()

    return () => {
      cancelado = true
    }
  }, [documento])

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
      establecerValores(new Map())
      establecerCamposNuevos([])
      establecerAplanar(false)
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

  const cambiarValor = useCallback(
    (nombre: string, valor: ValorCampo): void => {
      establecerValores((actuales) => {
        const siguientes = new Map(actuales)
        siguientes.set(nombre, valor)

        return siguientes
      })
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const limpiarValor = useCallback(
    (nombre: string): void => {
      const campo = inspeccion?.campos.find(
        (candidato) => candidato.nombre === nombre,
      )

      if (campo === undefined) {
        return
      }

      const vacio: ValorCampo =
        campo.clase === 'casilla'
          ? { clase: 'casilla', marcada: false }
          : campo.clase === 'opcion'
            ? { clase: 'opcion', elegida: null }
            : campo.clase === 'desplegable' || campo.clase === 'lista'
              ? { clase: 'seleccion', elegidas: [] }
              : { clase: 'texto', texto: '' }

      cambiarValor(nombre, vacio)
    },
    [inspeccion, cambiarValor],
  )

  const limpiarTodos = useCallback((): void => {
    if (inspeccion === null) {
      return
    }

    const siguientes = new Map<string, ValorCampo>()

    for (const campo of inspeccion.campos) {
      if (campo.soloLectura) {
        continue
      }

      siguientes.set(
        campo.nombre,
        campo.clase === 'casilla'
          ? { clase: 'casilla', marcada: false }
          : campo.clase === 'opcion'
            ? { clase: 'opcion', elegida: null }
            : campo.clase === 'desplegable' || campo.clase === 'lista'
              ? { clase: 'seleccion', elegidas: [] }
              : { clase: 'texto', texto: '' },
      )
    }

    establecerValores(siguientes)
    proceso.limpiarResultado()
  }, [inspeccion, proceso])

  const restaurarOriginales = useCallback((): void => {
    // Vaciar los valores propios equivale a volver a lo que traía el archivo:
    // lo que no se cambia, no se escribe.
    establecerValores(new Map())
    proceso.limpiarResultado()
  }, [proceso])

  const anadirCampo = useCallback((): void => {
    const ocupados = new Set([
      ...(inspeccion?.campos.map((campo) => campo.nombre) ?? []),
      ...camposNuevos.map((campo) => campo.nombre),
    ])

    contadorCampos.current += 1
    const nombre = proponerNombreCampo('campo', ocupados)

    establecerCamposNuevos((actuales) => [
      ...actuales,
      crearCampoNuevo(`nuevo-${contadorCampos.current}`, nombre, 1),
    ])
    proceso.limpiarResultado()
  }, [inspeccion, camposNuevos, proceso])

  const cambiarCampo = useCallback(
    (id: string, cambios: Partial<CampoNuevo>): void => {
      establecerCamposNuevos((actuales) =>
        actualizarPorId(actuales, id, cambios),
      )
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const eliminarCampo = useCallback(
    (id: string): void => {
      establecerCamposNuevos((actuales) => eliminarPorId(actuales, id))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarAplanar = useCallback(
    (siguiente: boolean): void => {
      establecerAplanar(siguiente)
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarModo = useCallback((siguiente: ModoFormulario): void => {
    establecerModo(siguiente)
  }, [])

  const restablecer = useCallback((): void => {
    establecerDocumento(null)
    establecerInspeccion(null)
    establecerValores(new Map())
    establecerCamposNuevos([])
    establecerAplanar(false)
    establecerMensajeArchivo(null)
    contadorCampos.current = 0
    proceso.limpiarResultado()
  }, [proceso])

  const problemas = useMemo<readonly ProblemaFormulario[]>(() => {
    if (inspeccion === null) {
      return []
    }

    return [
      ...validarValores(inspeccion.campos, valores).problemas,
      ...validarCamposNuevos(
        camposNuevos,
        inspeccion.campos.map((campo) => campo.nombre),
        inspeccion.numeroPaginas,
      ).problemas,
    ]
  }, [inspeccion, valores, camposNuevos])

  const avisos = useMemo<readonly ProblemaFormulario[]>(() => {
    if (inspeccion === null) {
      return []
    }

    return comprobarObligatorios(inspeccion.campos, valores)
  }, [inspeccion, valores])

  const mensajeError = mensajeArchivo ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: documento !== null,
    cargando: inspeccionando,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = proceso.procesando || inspeccionando

  const hayAlgoQueHacer =
    valores.size > 0 || camposNuevos.length > 0 || aplanar

  const puedeGenerar =
    documento !== null &&
    inspeccion !== null &&
    !bloqueado &&
    problemas.length === 0 &&
    hayAlgoQueHacer

  const generar = useCallback((): void => {
    if (documento === null) {
      return
    }

    proceso.ejecutar(() =>
      procesarFormulario({
        archivo: documento.archivo,
        valores,
        camposNuevos,
        aplanar,
      }),
    )
  }, [documento, valores, camposNuevos, aplanar, proceso])

  return {
    documento,
    proceso,
    inspeccion,
    inspeccionando,
    modo,
    valores,
    camposNuevos,
    aplanar,
    estado,
    bloqueado,
    mensajeError,
    problemas,
    avisos,
    puedeGenerar,
    seleccionarArchivos,
    cambiarModo,
    cambiarValor,
    limpiarValor,
    limpiarTodos,
    restaurarOriginales,
    anadirCampo,
    cambiarCampo,
    eliminarCampo,
    cambiarAplanar,
    restablecer,
    generar,
  }
}

import { useCallback, useMemo, useState } from 'react'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import {
  useProcesoPdf,
  type ControladorProcesoPdf,
} from '../../ganchos/useProcesoPdf'
import { validarArchivoImagen } from '../../imagenes/validarImagen'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import {
  interpretarAlcance,
  type AlcancePaginas,
} from '../../pdf/paginasAfectadas'
import type { PosicionEnPagina } from '../../pdf/posicionarEnPagina'
import { describirCaracterNoRepresentable } from '../../pdf/textoEstandar'
import type { EstadoHerramienta, ResultadoDocumento } from '../../pdf/tipos'
import {
  aplicarMarcaDeAgua,
  LONGITUD_MAXIMA_TEXTO,
} from './aplicarMarcaDeAgua'
import type {
  ConfiguracionMarcaDeAgua,
  ImagenMarca,
  MarcaImagen,
  MarcaTexto,
  ModoRepeticion,
  TipoMarca,
} from './tipos'

/** Configuración con la que arranca la herramienta. */
export const CONFIGURACION_PREDETERMINADA: ConfiguracionMarcaDeAgua = {
  tipo: 'texto',
  texto: {
    texto: 'BORRADOR',
    tamanoFuente: 48,
    color: '#b42318',
  },
  imagen: {
    escalaPorcentaje: 35,
  },
  opacidadPorcentaje: 25,
  rotacionGrados: 45,
  posicion: 'centro',
  modo: 'unica',
  separacionHorizontalMm: 20,
  separacionVerticalMm: 20,
  margenMm: 10,
  alcance: 'todas',
  expresion: '',
}

/** Estado y acciones de la herramienta «Marca de agua». */
export interface ControladorMarcaDeAgua {
  readonly documento: ControladorDocumentoPdf
  readonly proceso: ControladorProcesoPdf<ResultadoDocumento>
  readonly configuracion: ConfiguracionMarcaDeAgua
  /** Imagen elegida como marca, o `null`. */
  readonly imagenMarca: ImagenMarca | null
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  /** Mensaje de validación de la marca, o `null`. */
  readonly mensajeMarca: string | null
  /** Índices de las páginas afectadas. */
  readonly indicesAfectados: readonly number[]
  /** Mensaje de error de la expresión de rangos, o `null`. */
  readonly mensajeRangos: string | null
  /** `true` cuando se puede generar el documento. */
  readonly puedeAplicar: boolean
  readonly cambiarConfiguracion: (
    cambios: Partial<ConfiguracionMarcaDeAgua>,
  ) => void
  readonly cambiarTexto: (cambios: Partial<MarcaTexto>) => void
  readonly cambiarImagen: (cambios: Partial<MarcaImagen>) => void
  readonly cambiarTipo: (tipo: TipoMarca) => void
  readonly cambiarModo: (modo: ModoRepeticion) => void
  readonly cambiarPosicion: (posicion: PosicionEnPagina) => void
  readonly cambiarAlcance: (alcance: AlcancePaginas) => void
  readonly cambiarExpresion: (expresion: string) => void
  /** Elige la imagen de la marca a partir de los archivos seleccionados. */
  readonly elegirImagen: (archivos: readonly File[]) => void
  /** Quita la imagen elegida. */
  readonly quitarImagen: () => void
  readonly restablecerConfiguracion: () => void
  readonly restablecer: () => void
  readonly aplicar: () => void
}

/** Concentra el estado de la herramienta «Marca de agua». */
export function useMarcaDeAgua(): ControladorMarcaDeAgua {
  const documento = useDocumentoPdf()
  const proceso = useProcesoPdf<ResultadoDocumento>()
  const [configuracion, establecerConfiguracion] =
    useState<ConfiguracionMarcaDeAgua>(CONFIGURACION_PREDETERMINADA)
  const [imagenMarca, establecerImagenMarca] = useState<ImagenMarca | null>(
    null,
  )
  const [mensajeImagen, establecerMensajeImagen] = useState<string | null>(null)

  const cargado = documento.documento
  const numeroPaginas = cargado?.numeroPaginas ?? 0

  const alcanceInterpretado = useMemo(
    () =>
      interpretarAlcance(
        configuracion.alcance,
        numeroPaginas,
        configuracion.expresion,
      ),
    [configuracion.alcance, configuracion.expresion, numeroPaginas],
  )

  const mensajeMarca = useMemo<string | null>(() => {
    if (configuracion.tipo === 'imagen') {
      return imagenMarca === null
        ? (mensajeImagen ??
            'Elige la imagen que quieres usar como marca de agua.')
        : mensajeImagen
    }

    if (configuracion.texto.texto.trim() === '') {
      return 'Escribe el texto de la marca de agua.'
    }

    if (configuracion.texto.texto.length > LONGITUD_MAXIMA_TEXTO) {
      return `El texto no puede superar los ${LONGITUD_MAXIMA_TEXTO} caracteres.`
    }

    return describirCaracterNoRepresentable(configuracion.texto.texto)
  }, [
    configuracion.tipo,
    configuracion.texto.texto,
    imagenMarca,
    mensajeImagen,
  ])

  const cambiarConfiguracion = useCallback(
    (cambios: Partial<ConfiguracionMarcaDeAgua>): void => {
      establecerConfiguracion((actual) => ({ ...actual, ...cambios }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarTexto = useCallback(
    (cambios: Partial<MarcaTexto>): void => {
      establecerConfiguracion((actual) => ({
        ...actual,
        texto: { ...actual.texto, ...cambios },
      }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarImagen = useCallback(
    (cambios: Partial<MarcaImagen>): void => {
      establecerConfiguracion((actual) => ({
        ...actual,
        imagen: { ...actual.imagen, ...cambios },
      }))
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const cambiarTipo = useCallback(
    (tipo: TipoMarca): void => {
      cambiarConfiguracion({ tipo })
    },
    [cambiarConfiguracion],
  )

  const cambiarModo = useCallback(
    (modo: ModoRepeticion): void => {
      cambiarConfiguracion({ modo })
    },
    [cambiarConfiguracion],
  )

  const cambiarPosicion = useCallback(
    (posicion: PosicionEnPagina): void => {
      cambiarConfiguracion({ posicion })
    },
    [cambiarConfiguracion],
  )

  const cambiarAlcance = useCallback(
    (alcance: AlcancePaginas): void => {
      cambiarConfiguracion({ alcance })
    },
    [cambiarConfiguracion],
  )

  const cambiarExpresion = useCallback(
    (expresion: string): void => {
      cambiarConfiguracion({ expresion })
    },
    [cambiarConfiguracion],
  )

  const elegirImagen = useCallback(
    (archivos: readonly File[]): void => {
      const primero = archivos[0]
      if (primero === undefined) {
        return
      }

      const validacion = validarArchivoImagen(primero)
      if (!validacion.valido || validacion.formato === null) {
        establecerImagenMarca(null)
        establecerMensajeImagen(validacion.mensaje)
        return
      }

      establecerMensajeImagen(null)
      establecerImagenMarca({
        contenido: primero,
        nombre: primero.name,
        formato: validacion.formato,
        tamano: primero.size,
      })
      proceso.limpiarResultado()
    },
    [proceso],
  )

  const quitarImagen = useCallback((): void => {
    establecerImagenMarca(null)
    establecerMensajeImagen(null)
    proceso.limpiarResultado()
  }, [proceso])

  const restablecerConfiguracion = useCallback((): void => {
    establecerConfiguracion(CONFIGURACION_PREDETERMINADA)
    establecerImagenMarca(null)
    establecerMensajeImagen(null)
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

  const puedeAplicar =
    cargado !== null &&
    !bloqueado &&
    alcanceInterpretado.indices.length > 0 &&
    mensajeMarca === null

  const aplicar = useCallback((): void => {
    if (cargado === null) {
      return
    }

    proceso.ejecutar(() =>
      aplicarMarcaDeAgua({
        archivo: cargado.seleccionado.archivo,
        configuracion,
        imagenMarca,
      }),
    )
  }, [cargado, configuracion, imagenMarca, proceso])

  return {
    documento,
    proceso,
    configuracion,
    imagenMarca,
    estado,
    bloqueado,
    mensajeError,
    mensajeMarca,
    indicesAfectados: alcanceInterpretado.indices,
    mensajeRangos: alcanceInterpretado.mensajeError,
    puedeAplicar,
    cambiarConfiguracion,
    cambiarTexto,
    cambiarImagen,
    cambiarTipo,
    cambiarModo,
    cambiarPosicion,
    cambiarAlcance,
    cambiarExpresion,
    elegirImagen,
    quitarImagen,
    restablecerConfiguracion,
    restablecer,
    aplicar,
  }
}

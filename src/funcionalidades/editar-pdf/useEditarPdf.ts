import { useCallback, useEffect, useRef, useState } from 'react'
import {
  aplicarEdicion,
  NOMBRE_EDITADO,
} from '../../edicion/aplicarEdicion'
import {
  crearCobertura,
  crearForma,
  crearImagen,
  crearResaltado,
  crearTexto,
  crearTextoEditado,
} from '../../edicion/crearElementos'
import {
  LINEA_BASE_APROXIMADA,
  type SeleccionTextoPdf,
} from '../../edicion/seleccionTexto'
import type { ResultadoEdicion } from '../../edicion/tipos'
import type { ElementoSuperpuesto, FiguraGeometrica } from '../../edicion/tipos'
import {
  useCapaEdicion,
  type ControladorCapaEdicion,
} from '../../edicion/useCapaEdicion'
import {
  useDocumentoPdf,
  type DocumentoCargado,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import {
  useProcesoCancelable,
  type ControladorProcesoCancelable,
} from '../../ganchos/useProcesoCancelable'
import { abrirDocumentoDesdeArchivo } from '../../pdf/cargarDocumentoPdf'
import { TRANSFORMACION_NEUTRA } from '../../imagenes/dibujarImagen'
import { prepararImagenParaPdf } from '../../imagenes/normalizarImagen'
import { validarArchivoImagen } from '../../imagenes/validarImagen'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { EstadoHerramienta } from '../../pdf/tipos'
import { obtenerMensajeError } from '../../utilidades/errores'
import { limitar } from '../../utilidades/numeros'

/** Texto de reserva cuando preparar la imagen falla sin dar ningún mensaje. */
const ERROR_IMAGEN =
  'No se pudo preparar la imagen. Comprueba que el archivo no esté dañado.'

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
  /** Hay cambios pendientes y se puede generar una descarga actualizada. */
  readonly puedeDescargar: boolean
  readonly cambiosSinGuardar: number
  readonly cambiarPaginaActiva: (pagina: number) => void
  readonly anadirTexto: () => void
  readonly anadirForma: (figura: FiguraGeometrica) => void
  readonly anadirResaltado: () => void
  /**
   * Incrusta una imagen en la página que se está viendo.
   *
   * Es asíncrona porque un WebP, o cualquier formato que pdf-lib no sepa incrustar,
   * hay que convertirlo antes, y eso lo hace el `canvas` del navegador.
   */
  readonly anadirImagen: (archivo: File) => Promise<void>
  /** `true` mientras se descodifica y convierte una imagen. */
  readonly preparandoImagen: boolean
  readonly anadirCobertura: (caja?: {
    readonly izquierda: number
    readonly superior: number
    readonly ancho: number
    readonly alto: number
  }) => void
  readonly editarTextoExistente: (seleccion: SeleccionTextoPdf) => void
  readonly guardarCambio: (id: string) => void
  readonly restablecer: () => void
  readonly descargarPdfFinal: () => void
}

/**
 * Concentra el estado de la herramienta «Editar y anotar».
 *
 * El documento de pdf-lib se abre **en el momento de descargar**, no al cargar el
 * archivo. Es a propósito: si se guardara en el estado, cada aplicación sucesiva iría
 * dibujando encima de la anterior y el resultado dependería de cuántas veces se ha
 * pulsado el botón. Abriendo de nuevo desde el archivo, descargar dos veces con la
 * misma capa da exactamente el mismo documento.
 */
export function useEditarPdf(): ControladorEditarPdf {
  const documento = useDocumentoPdf()
  const proceso = useProcesoCancelable<ResultadoEdicion>()
  const capa = useCapaEdicion()

  const [paginaActiva, establecerPaginaActiva] = useState(1)
  const [errorImagen, establecerErrorImagen] = useState<string | null>(null)
  const [preparandoImagen, establecerPreparandoImagen] = useState(false)

  const cargado = documento.documento

  // Cambiar de documento descarta la capa y su historial.
  //
  // Se reacciona al documento en sí, no al botón de restablecer, porque no es el
  // único camino: «Cambiar documento» carga otro archivo sin pasar por él, y sin
  // esto las correcciones del anterior se dibujarían sobre las páginas del nuevo.
  const documentoAnterior = useRef<DocumentoCargado | null>(null)
  const reiniciarCapa = capa.reiniciar

  useEffect(() => {
    if (documentoAnterior.current === cargado) {
      return
    }

    documentoAnterior.current = cargado
    reiniciarCapa()
    establecerPaginaActiva(1)
    establecerErrorImagen(null)
  }, [cargado, reiniciarCapa])

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

  const anadirImagen = useCallback(
    async (archivo: File): Promise<void> => {
      establecerErrorImagen(null)

      const validacion = validarArchivoImagen(archivo)

      if (!validacion.valido || validacion.formato === null) {
        establecerErrorImagen(validacion.mensaje ?? ERROR_IMAGEN)
        return
      }

      const documentoAlEmpezar = cargado
      establecerPreparandoImagen(true)

      try {
        // Reutiliza los bytes tal cual si ya son PNG o JPEG; convierte el resto con
        // el «canvas» del navegador. En ningún caso sale nada de este equipo.
        const preparada = await prepararImagenParaPdf({
          contenido: archivo,
          nombre: archivo.name,
          formato: validacion.formato,
          transformacion: TRANSFORMACION_NEUTRA,
          dimensiones: null,
        })

        // Convertir una fotografía grande lleva su tiempo, y en ese rato se puede
        // haber cambiado de documento. Colocarla entonces la pondría en el sitio
        // equivocado de un archivo que no es el que la pidió.
        if (documentoAnterior.current !== documentoAlEmpezar) {
          return
        }

        capa.anadir((id) =>
          crearImagen(
            id,
            paginaActiva,
            preparada.bytes,
            preparada.formato,
            archivo.name,
            preparada.dimensiones.alto > 0
              ? preparada.dimensiones.ancho / preparada.dimensiones.alto
              : 1,
          ),
        )
        proceso.limpiarResultado()
      } catch (error) {
        establecerErrorImagen(obtenerMensajeError(error, ERROR_IMAGEN))
      } finally {
        establecerPreparandoImagen(false)
      }
    },
    [capa, cargado, paginaActiva, proceso],
  )

  const anadirCobertura = useCallback(
    (caja?: {
      readonly izquierda: number
      readonly superior: number
      readonly ancho: number
      readonly alto: number
    }): void => {
      capa.anadir((id) => crearCobertura(id, paginaActiva, caja))
      proceso.limpiarResultado()
    },
    [capa, paginaActiva, proceso],
  )

  const editarTextoExistente = useCallback(
    (seleccion: SeleccionTextoPdf): void => {
      const primera = seleccion.cajas[0]

      if (primera === undefined) {
        return
      }

      const izquierda = Math.min(...seleccion.cajas.map((caja) => caja.izquierda))
      const superior = Math.min(...seleccion.cajas.map((caja) => caja.superior))
      const derecha = Math.max(
        ...seleccion.cajas.map((caja) => caja.izquierda + caja.ancho),
      )
      const inferior = Math.max(
        ...seleccion.cajas.map((caja) => caja.superior + caja.alto),
      )
      const alto = inferior - superior

      capa.anadir((id) =>
        crearTextoEditado(id, paginaActiva, {
          izquierda,
          superior,
          ancho: derecha - izquierda,
          alto,
          texto: seleccion.texto,
          tamano: seleccion.tamano,
          tipografia: seleccion.tipografia,
          // La línea base llega en fracciones de la página; dentro del elemento se
          // guarda relativa a su caja para que sobreviva a moverlo o redimensionarlo.
          lineaBase:
            alto > 0
              ? limitar((seleccion.lineaBase - superior) / alto, 0, 1)
              : LINEA_BASE_APROXIMADA,
          color: seleccion.colorTexto,
          colorFondo: seleccion.colorFondo,
        }),
      )
      proceso.limpiarResultado()
    },
    [capa, paginaActiva, proceso],
  )

  const cambiarElemento = useCallback(
    (id: string, cambios: Partial<ElementoSuperpuesto>): void => {
      capa.cambiar(id, { ...cambios, guardado: false })
      proceso.limpiarResultado()
    },
    [capa, proceso],
  )

  const guardarCambio = useCallback(
    (id: string): void => {
      capa.cambiar(id, { guardado: true })
      proceso.limpiarResultado()
    },
    [capa, proceso],
  )

  const quitarElemento = useCallback(
    (id: string): void => {
      capa.quitar(id)
      proceso.limpiarResultado()
    },
    [capa, proceso],
  )

  const vaciarCapa = useCallback((): void => {
    capa.vaciar()
    proceso.limpiarResultado()
  }, [capa, proceso])

  const deshacer = useCallback((): void => {
    capa.deshacer()
    proceso.limpiarResultado()
  }, [capa, proceso])

  const rehacer = useCallback((): void => {
    capa.rehacer()
    proceso.limpiarResultado()
  }, [capa, proceso])

  const duplicarElemento = useCallback(
    (id: string): void => {
      capa.duplicar(id)
      proceso.limpiarResultado()
    },
    [capa, proceso],
  )

  const subirElemento = useCallback(
    (id: string): void => {
      capa.subir(id)
      proceso.limpiarResultado()
    },
    [capa, proceso],
  )

  const bajarElemento = useCallback(
    (id: string): void => {
      capa.bajar(id)
      proceso.limpiarResultado()
    },
    [capa, proceso],
  )

  const restablecer = useCallback((): void => {
    proceso.cancelar()
    proceso.limpiarResultado()
    // Reiniciar, no vaciar: vaciar dejaría el historial en pie y deshacer
    // devolvería los elementos del documento que se acaba de cerrar.
    capa.reiniciar()
    establecerPaginaActiva(1)
    documento.restablecer()
  }, [capa, documento, proceso])

  const mensajeError =
    documento.mensajeError ?? proceso.mensajeError ?? errorImagen

  const estado = calcularEstadoHerramienta({
    hayDocumento: cargado !== null,
    cargando: documento.cargando,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado =
    documento.cargando || proceso.procesando || preparandoImagen
  const cambiosSinGuardar = capa.elementos.filter(
    (elemento) => elemento.guardado !== true,
  ).length
  const puedeDescargar =
    cargado !== null &&
    !bloqueado &&
    capa.cuantosPintan > 0 &&
    cambiosSinGuardar === 0 &&
    proceso.resultado === null

  const descargarPdfFinal = useCallback((): void => {
    if (
      cargado === null ||
      capa.cuantosPintan === 0 ||
      capa.elementos.some((elemento) => elemento.guardado !== true)
    ) {
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
    capa: {
      ...capa,
      cambiar: cambiarElemento,
      quitar: quitarElemento,
      vaciar: vaciarCapa,
      duplicar: duplicarElemento,
      subir: subirElemento,
      bajar: bajarElemento,
      deshacer,
      rehacer,
    },
    paginaActiva,
    estado,
    bloqueado,
    mensajeError,
    puedeDescargar,
    cambiosSinGuardar,
    cambiarPaginaActiva,
    anadirTexto,
    anadirForma,
    anadirResaltado,
    anadirImagen,
    preparandoImagen,
    anadirCobertura,
    editarTextoExistente,
    guardarCambio,
    restablecer,
    descargarPdfFinal,
  }
}

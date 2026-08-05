import { useCallback, useState } from 'react'
import { aplicarEdicion, NOMBRE_FIRMADO } from '../../edicion/aplicarEdicion'
import { crearTexto, crearTrazo } from '../../edicion/crearElementos'
import type {
  ElementoSuperpuesto,
  ResultadoEdicion,
} from '../../edicion/tipos'
import {
  useCapaEdicion,
  type ControladorCapaEdicion,
} from '../../edicion/useCapaEdicion'
import {
  useDocumentoPdf,
  type ControladorDocumentoPdf,
} from '../../ganchos/useDocumentoPdf'
import {
  useProcesoCancelable,
  type ControladorProcesoCancelable,
} from '../../ganchos/useProcesoCancelable'
import { abrirDocumentoDesdeArchivo } from '../../pdf/cargarDocumentoPdf'
import { calcularEstadoHerramienta } from '../../pdf/estadoHerramienta'
import type { Punto } from '../../pdf/posicionarEnPagina'
import type { EstadoHerramienta } from '../../pdf/tipos'

/** Formas de aportar la firma. */
export type ModoFirma = 'dibujada' | 'escrita'

/** Describe cada modo, para la interfaz. */
export function describirModo(modo: ModoFirma): string {
  return modo === 'dibujada' ? 'Dibujarla' : 'Escribirla'
}

/** Estado y acciones de la herramienta «Firma visual». */
export interface ControladorFirmaVisual {
  readonly documento: ControladorDocumentoPdf
  readonly proceso: ControladorProcesoCancelable<ResultadoEdicion>
  readonly capa: ControladorCapaEdicion
  readonly modo: ModoFirma
  /** Trazos dibujados en el lienzo, todavía sin colocar en la página. */
  readonly trazosDibujados: readonly (readonly Punto[])[]
  /** Texto de la firma escrita. */
  readonly textoFirma: string
  readonly color: string
  /** Página en la que se colocará la firma, empezando en 1. */
  readonly paginaActiva: number
  readonly estado: EstadoHerramienta
  readonly bloqueado: boolean
  readonly mensajeError: string | null
  /** `true` cuando hay una firma preparada que se pueda colocar. */
  readonly hayFirmaPreparada: boolean
  readonly puedeFirmar: boolean
  readonly cambiarModo: (modo: ModoFirma) => void
  readonly cambiarTrazos: (trazos: readonly (readonly Punto[])[]) => void
  readonly cambiarTextoFirma: (texto: string) => void
  readonly cambiarColor: (color: string) => void
  readonly cambiarPaginaActiva: (pagina: number) => void
  /** Coloca la firma preparada en la página que se está viendo. */
  readonly colocarFirma: () => void
  readonly restablecer: () => void
  readonly firmar: () => void
}

/** Longitud máxima de la firma escrita. */
export const LONGITUD_MAXIMA_FIRMA = 60

/**
 * Concentra el estado de la herramienta «Firma visual».
 *
 * **Esto no es una firma digital ni electrónica cualificada.** Coloca un dibujo o un
 * texto sobre el documento y nada más: no hay certificado, no se prueba la identidad
 * de nadie y no se detecta si el documento se modifica después de firmarlo. Vale para
 * lo que vale una firma en un papel escaneado, que en muchos trámites es suficiente,
 * pero no es lo mismo y la interfaz lo dice.
 *
 * La firma no se guarda en ningún sitio: vive en el estado de la página y desaparece
 * al recargar o al restablecer.
 */
export function useFirmaVisual(): ControladorFirmaVisual {
  const documento = useDocumentoPdf()
  const proceso = useProcesoCancelable<ResultadoEdicion>()
  const capa = useCapaEdicion()

  const [modo, establecerModo] = useState<ModoFirma>('dibujada')
  const [trazosDibujados, establecerTrazos] = useState<
    readonly (readonly Punto[])[]
  >([])
  const [textoFirma, establecerTextoFirma] = useState('')
  const [color, establecerColor] = useState('#0b2545')
  const [paginaActiva, establecerPaginaActiva] = useState(1)

  const cargado = documento.documento

  const cambiarModo = useCallback((siguiente: ModoFirma): void => {
    establecerModo(siguiente)
  }, [])

  const cambiarTrazos = useCallback(
    (siguientes: readonly (readonly Punto[])[]): void => {
      establecerTrazos(siguientes)
    },
    [],
  )

  const cambiarTextoFirma = useCallback((texto: string): void => {
    establecerTextoFirma(texto.slice(0, LONGITUD_MAXIMA_FIRMA))
  }, [])

  const cambiarColor = useCallback((siguiente: string): void => {
    establecerColor(siguiente)
  }, [])

  const cambiarPaginaActiva = useCallback((pagina: number): void => {
    establecerPaginaActiva(Math.max(1, Math.trunc(pagina)))
  }, [])

  const trazosUtiles = trazosDibujados.filter((trazo) => trazo.length >= 2)

  const hayFirmaPreparada =
    modo === 'dibujada' ? trazosUtiles.length > 0 : textoFirma.trim() !== ''

  const colocarFirma = useCallback((): void => {
    if (modo === 'dibujada') {
      if (trazosUtiles.length === 0) {
        return
      }

      capa.anadir((id) =>
        crearTrazo(id, paginaActiva, trazosUtiles, { color }),
      )
    } else {
      if (textoFirma.trim() === '') {
        return
      }

      capa.anadir((id) =>
        crearTexto(id, paginaActiva, {
          texto: textoFirma.trim(),
          // La cursiva es lo más parecido a una firma que ofrecen las tipografías
          // estándar del PDF, y no hace falta descargar ninguna.
          tipografia: 'times-cursiva',
          tamano: 20,
          color,
          alineacion: 'centro',
          superior: 0.75,
          ancho: 0.35,
          alto: 0.06,
        }),
      )
    }

    proceso.limpiarResultado()
  }, [capa, color, modo, paginaActiva, proceso, textoFirma, trazosUtiles])

  const cambiarElemento = useCallback(
    (id: string, cambios: Partial<ElementoSuperpuesto>): void => {
      capa.cambiar(id, cambios)
      proceso.limpiarResultado()
    },
    [capa, proceso],
  )

  const restablecer = useCallback((): void => {
    proceso.cancelar()
    proceso.limpiarResultado()
    capa.vaciar()
    establecerTrazos([])
    establecerTextoFirma('')
    establecerPaginaActiva(1)
    documento.restablecer()
  }, [capa, documento, proceso])

  const mensajeError = documento.mensajeError ?? proceso.mensajeError

  const estado = calcularEstadoHerramienta({
    hayDocumento: cargado !== null,
    cargando: documento.cargando,
    procesando: proceso.procesando,
    hayResultado: proceso.resultado !== null,
    hayError: mensajeError !== null,
  })

  const bloqueado = documento.cargando || proceso.procesando
  const puedeFirmar = cargado !== null && !bloqueado && capa.cuantosPintan > 0

  const firmar = useCallback((): void => {
    if (cargado === null || capa.cuantosPintan === 0) {
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
          nombreArchivo: NOMBRE_FIRMADO,
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
    capa: { ...capa, cambiar: cambiarElemento },
    modo,
    trazosDibujados,
    textoFirma,
    color,
    paginaActiva,
    estado,
    bloqueado,
    mensajeError,
    hayFirmaPreparada,
    puedeFirmar,
    cambiarModo,
    cambiarTrazos,
    cambiarTextoFirma,
    cambiarColor,
    cambiarPaginaActiva,
    colocarFirma,
    restablecer,
    firmar,
  }
}

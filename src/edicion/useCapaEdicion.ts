import { useCallback, useMemo, useRef, useState } from 'react'
import { actualizarPorId, eliminarPorId } from '../utilidades/listas'
import { elementoPinta, normalizarElemento } from './colocarElementos'
import type { ClaseElemento, ElementoSuperpuesto } from './tipos'

/**
 * Estado compartido de una capa de elementos superpuestos.
 *
 * Lo usan «Editar y anotar» y «Firma visual», porque las dos hacen lo mismo con la
 * lista: añadir, mover, quitar y reordenar. La diferencia entre las dos herramientas
 * está en qué clases de elemento ofrecen, no en cómo las gestionan.
 */

/** Acciones y estado de la capa. */
export interface ControladorCapaEdicion {
  /** Elementos en orden de dibujado: el último queda encima. */
  readonly elementos: readonly ElementoSuperpuesto[]
  /** Elemento seleccionado, o `null`. */
  readonly seleccionado: ElementoSuperpuesto | null
  /** Identificador del seleccionado, para marcarlo en la interfaz. */
  readonly idSeleccionado: string | null
  /** Cuántos elementos van a dibujar algo de verdad. */
  readonly cuantosPintan: number
  /** Elementos de una página concreta, empezando en 1. */
  readonly elementosDePagina: (pagina: number) => readonly ElementoSuperpuesto[]
  /** Añade un elemento y lo selecciona. */
  readonly anadir: (
    crear: (id: string) => ElementoSuperpuesto,
  ) => ElementoSuperpuesto
  /** Cambia el elemento indicado. */
  readonly cambiar: (id: string, cambios: Partial<ElementoSuperpuesto>) => void
  /** Quita el elemento indicado. */
  readonly quitar: (id: string) => void
  /** Vacía la capa. */
  readonly vaciar: () => void
  /** Selecciona un elemento, o quita la selección con `null`. */
  readonly seleccionar: (id: string | null) => void
  /** Sube un elemento una posición en el orden de dibujado. */
  readonly subir: (id: string) => void
  /** Baja un elemento una posición. */
  readonly bajar: (id: string) => void
  /** Duplica un elemento, desplazándolo un poco para que se vea que hay dos. */
  readonly duplicar: (id: string) => void
  /** Cuántos elementos hay de cada clase. */
  readonly recuentoPorClase: Readonly<Record<ClaseElemento, number>>
}

/** Desplazamiento con el que se coloca una copia, en fracciones de la página. */
const DESPLAZAMIENTO_COPIA = 0.02

/** Gestiona la lista de elementos de una capa de edición. */
export function useCapaEdicion(): ControladorCapaEdicion {
  const [elementos, establecerElementos] = useState<
    readonly ElementoSuperpuesto[]
  >([])
  const [idSeleccionado, establecerIdSeleccionado] = useState<string | null>(
    null,
  )

  const contador = useRef(0)

  const anadir = useCallback(
    (crear: (id: string) => ElementoSuperpuesto): ElementoSuperpuesto => {
      contador.current += 1
      const elemento = normalizarElemento(crear(`elemento-${contador.current}`))

      establecerElementos((actuales) => [...actuales, elemento])
      establecerIdSeleccionado(elemento.id)

      return elemento
    },
    [],
  )

  const cambiar = useCallback(
    (id: string, cambios: Partial<ElementoSuperpuesto>): void => {
      establecerElementos((actuales) =>
        actualizarPorId(actuales, id, cambios).map((elemento) =>
          elemento.id === id ? normalizarElemento(elemento) : elemento,
        ),
      )
    },
    [],
  )

  const quitar = useCallback((id: string): void => {
    establecerElementos((actuales) => eliminarPorId(actuales, id))
    establecerIdSeleccionado((actual) => (actual === id ? null : actual))
  }, [])

  const vaciar = useCallback((): void => {
    establecerElementos([])
    establecerIdSeleccionado(null)
    contador.current = 0
  }, [])

  const seleccionar = useCallback((id: string | null): void => {
    establecerIdSeleccionado(id)
  }, [])

  const mover = useCallback((id: string, direccion: -1 | 1): void => {
    establecerElementos((actuales) => {
      const indice = actuales.findIndex((elemento) => elemento.id === id)
      const destino = indice + direccion

      if (indice === -1 || destino < 0 || destino >= actuales.length) {
        return actuales
      }

      const copia = [...actuales]
      const elemento = copia[indice]
      const otro = copia[destino]

      if (elemento === undefined || otro === undefined) {
        return actuales
      }

      copia[indice] = otro
      copia[destino] = elemento

      return copia
    })
  }, [])

  const subir = useCallback(
    (id: string): void => {
      mover(id, 1)
    },
    [mover],
  )

  const bajar = useCallback(
    (id: string): void => {
      mover(id, -1)
    },
    [mover],
  )

  const duplicar = useCallback((id: string): void => {
    contador.current += 1
    const nuevoId = `elemento-${contador.current}`

    establecerElementos((actuales) => {
      const original = actuales.find((elemento) => elemento.id === id)

      if (original === undefined) {
        return actuales
      }

      const copia = normalizarElemento({
        ...original,
        id: nuevoId,
        izquierda: original.izquierda + DESPLAZAMIENTO_COPIA,
        superior: original.superior + DESPLAZAMIENTO_COPIA,
      })

      return [...actuales, copia]
    })

    establecerIdSeleccionado(nuevoId)
  }, [])

  const elementosDePagina = useCallback(
    (pagina: number): readonly ElementoSuperpuesto[] =>
      elementos.filter((elemento) => elemento.pagina === pagina),
    [elementos],
  )

  const seleccionado = useMemo(
    () =>
      elementos.find((elemento) => elemento.id === idSeleccionado) ?? null,
    [elementos, idSeleccionado],
  )

  const cuantosPintan = useMemo(
    () => elementos.filter(elementoPinta).length,
    [elementos],
  )

  const recuentoPorClase = useMemo(() => {
    const recuento: Record<ClaseElemento, number> = {
      texto: 0,
      imagen: 0,
      trazo: 0,
      forma: 0,
      resaltado: 0,
    }

    for (const elemento of elementos) {
      recuento[elemento.clase] += 1
    }

    return recuento
  }, [elementos])

  return {
    elementos,
    seleccionado,
    idSeleccionado,
    cuantosPintan,
    elementosDePagina,
    anadir,
    cambiar,
    quitar,
    vaciar,
    seleccionar,
    subir,
    bajar,
    duplicar,
    recuentoPorClase,
  }
}

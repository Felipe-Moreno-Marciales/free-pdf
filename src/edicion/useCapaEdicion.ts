import { useCallback, useMemo, useRef, useState } from 'react'
import { actualizarPorId, eliminarPorId } from '../utilidades/listas'
import { elementoPinta, normalizarElemento } from './colocarElementos'
import {
  crearHistorial,
  deshacer as deshacerHistorial,
  puedeDeshacer as sePuedeDeshacer,
  puedeRehacer as sePuedeRehacer,
  reemplazar,
  registrar,
  rehacer as rehacerHistorial,
  separar as separarHistorial,
} from './historial'
import type { ClaseElemento, ElementoSuperpuesto } from './tipos'

/**
 * Estado compartido de una capa de elementos superpuestos.
 *
 * Lo usan «Editar y anotar» y «Firma visual», porque las dos hacen lo mismo con la
 * lista: añadir, mover, quitar y reordenar. La diferencia entre las dos herramientas
 * está en qué clases de elemento ofrecen, no en cómo las gestionan.
 *
 * La capa no se guarda en ningún sitio: vive en memoria y desaparece al recargar. Por
 * eso lleva historial. Sin él, «Quitar todo» o un arrastre a destiempo destruyen una
 * sesión entera de correcciones sin manera de recuperarla.
 */

/** Instantánea de la capa: es lo que se guarda en cada paso del historial. */
interface EstadoCapa {
  readonly elementos: readonly ElementoSuperpuesto[]
  readonly idSeleccionado: string | null
}

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
  /** Vacía la capa. Se puede deshacer. */
  readonly vaciar: () => void
  /**
   * Descarta la capa **y su historial**.
   *
   * Es lo que hay que llamar al cambiar de documento. Vaciar no sirve: dejaría el
   * historial en pie y deshacer devolvería los elementos del documento anterior,
   * que se dibujarían sobre las páginas del nuevo.
   */
  readonly reiniciar: () => void
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
  /** Vuelve al paso anterior. */
  readonly deshacer: () => void
  /** Recupera el último paso deshecho. */
  readonly rehacer: () => void
  readonly puedeDeshacer: boolean
  readonly puedeRehacer: boolean
  /**
   * Cierra el paso en curso.
   *
   * La interfaz lo llama al terminar un gesto —soltar un arrastre, acabar de
   * redimensionar—, para que el cambio siguiente no se funda con el anterior.
   */
  readonly separar: () => void
}

/** Desplazamiento con el que se coloca una copia, en fracciones de la página. */
const DESPLAZAMIENTO_COPIA = 0.02

/**
 * Compara dos elementos propiedad a propiedad, sin entrar en las anidadas.
 *
 * Basta con la comparación superficial: los elementos son inmutables, así que lo que
 * no se ha tocado conserva la misma referencia —los bytes de una imagen, los puntos
 * de un trazo— y comparar referencias es exacto y barato.
 */
function sonEquivalentes(primero: object, segundo: object): boolean {
  const propiedades = Object.entries(primero)
  const otro = new Map(Object.entries(segundo))

  if (propiedades.length !== otro.size) {
    return false
  }

  for (const [clave, valor] of propiedades) {
    if (!Object.is(valor, otro.get(clave))) {
      return false
    }
  }

  return true
}

/** Estado de partida: capa vacía y sin selección. */
const ESTADO_INICIAL: EstadoCapa = { elementos: [], idSeleccionado: null }

/** Gestiona la lista de elementos de una capa de edición. */
export function useCapaEdicion(): ControladorCapaEdicion {
  const [historial, establecerHistorial] = useState(() =>
    crearHistorial(ESTADO_INICIAL),
  )

  const { elementos, idSeleccionado } = historial.presente

  // El contador nunca retrocede, ni al vaciar ni al deshacer. Si lo hiciera, un
  // elemento restaurado podría acabar compartiendo identificador con otro nuevo, y
  // entonces editar uno editaría los dos.
  const contador = useRef(0)

  /**
   * Aplica un cambio al estado y lo registra como un paso.
   *
   * Si la transformación devuelve el mismo estado —subir el elemento que ya está
   * arriba, quitar uno que no existe— no se registra nada: un paso que no cambia
   * nada haría que deshacer pareciera no funcionar.
   */
  const aplicar = useCallback(
    (
      transformar: (estado: EstadoCapa) => EstadoCapa,
      clave: string | null = null,
    ): void => {
      establecerHistorial((actual) => {
        const siguiente = transformar(actual.presente)

        return siguiente === actual.presente
          ? actual
          : registrar(actual, siguiente, clave)
      })
    },
    [],
  )

  const anadir = useCallback(
    (crear: (id: string) => ElementoSuperpuesto): ElementoSuperpuesto => {
      contador.current += 1
      const elemento = normalizarElemento(crear(`elemento-${contador.current}`))

      aplicar((estado) => ({
        elementos: [...estado.elementos, elemento],
        idSeleccionado: elemento.id,
      }))

      return elemento
    },
    [aplicar],
  )

  const cambiar = useCallback(
    (id: string, cambios: Partial<ElementoSuperpuesto>): void => {
      // Los cambios seguidos sobre el mismo elemento y las mismas propiedades son un
      // solo paso: arrastrar es un gesto, no doscientos.
      const clave = `cambiar:${id}:${Object.keys(cambios).sort().join(',')}`

      aplicar((estado) => {
        const original = estado.elementos.find((elemento) => elemento.id === id)

        if (original === undefined) {
          return estado
        }

        const actualizados = actualizarPorId(estado.elementos, id, cambios).map(
          (elemento) =>
            elemento.id === id ? normalizarElemento(elemento) : elemento,
        )
        const actualizado = actualizados.find((elemento) => elemento.id === id)

        // Un cambio que no cambia nada —confirmar dos veces, arrastrar contra el
        // borde donde la posición ya estaba limitada— no debe ocupar un paso: si lo
        // hiciera, deshacer parecería no responder.
        if (actualizado === undefined || sonEquivalentes(original, actualizado)) {
          return estado
        }

        return { ...estado, elementos: actualizados }
      }, clave)
    },
    [aplicar],
  )

  const quitar = useCallback(
    (id: string): void => {
      aplicar((estado) => {
        const restantes = eliminarPorId(estado.elementos, id)

        if (restantes.length === estado.elementos.length) {
          return estado
        }

        return {
          elementos: restantes,
          idSeleccionado:
            estado.idSeleccionado === id ? null : estado.idSeleccionado,
        }
      })
    },
    [aplicar],
  )

  const vaciar = useCallback((): void => {
    aplicar((estado) =>
      estado.elementos.length === 0 ? estado : ESTADO_INICIAL,
    )
  }, [aplicar])

  const reiniciar = useCallback((): void => {
    // Aquí sí puede volver a cero: se descarta el historial entero, así que ningún
    // elemento restaurado puede acabar compartiendo identificador con uno nuevo.
    contador.current = 0

    establecerHistorial((actual) =>
      actual.presente === ESTADO_INICIAL &&
      actual.pasado.length === 0 &&
      actual.futuro.length === 0
        ? actual
        : crearHistorial(ESTADO_INICIAL),
    )
  }, [])

  const seleccionar = useCallback((id: string | null): void => {
    // Seleccionar no es una edición del documento, así que no abre un paso. Sí queda
    // guardado en el presente, para que deshacer devuelva la selección de entonces.
    establecerHistorial((actual) =>
      actual.presente.idSeleccionado === id
        ? actual
        : reemplazar(actual, { ...actual.presente, idSeleccionado: id }),
    )
  }, [])

  const mover = useCallback(
    (id: string, direccion: -1 | 1): void => {
      aplicar((estado) => {
        const indice = estado.elementos.findIndex(
          (elemento) => elemento.id === id,
        )
        const destino = indice + direccion

        if (indice === -1 || destino < 0 || destino >= estado.elementos.length) {
          return estado
        }

        const copia = [...estado.elementos]
        const elemento = copia[indice]
        const otro = copia[destino]

        if (elemento === undefined || otro === undefined) {
          return estado
        }

        copia[indice] = otro
        copia[destino] = elemento

        return { ...estado, elementos: copia }
      })
    },
    [aplicar],
  )

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

  const duplicar = useCallback(
    (id: string): void => {
      contador.current += 1
      const nuevoId = `elemento-${contador.current}`

      aplicar((estado) => {
        const original = estado.elementos.find(
          (elemento) => elemento.id === id,
        )

        if (original === undefined) {
          return estado
        }

        const copia = normalizarElemento({
          ...original,
          id: nuevoId,
          guardado: false,
          izquierda: original.izquierda + DESPLAZAMIENTO_COPIA,
          superior: original.superior + DESPLAZAMIENTO_COPIA,
        })

        return {
          elementos: [...estado.elementos, copia],
          idSeleccionado: nuevoId,
        }
      })
    },
    [aplicar],
  )

  const deshacer = useCallback((): void => {
    establecerHistorial(deshacerHistorial)
  }, [])

  const rehacer = useCallback((): void => {
    establecerHistorial(rehacerHistorial)
  }, [])

  const separar = useCallback((): void => {
    establecerHistorial(separarHistorial)
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
      'texto-editado': 0,
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
    reiniciar,
    seleccionar,
    subir,
    bajar,
    duplicar,
    recuentoPorClase,
    deshacer,
    rehacer,
    puedeDeshacer: sePuedeDeshacer(historial),
    puedeRehacer: sePuedeRehacer(historial),
    separar,
  }
}

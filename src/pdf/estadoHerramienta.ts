import type { EstadoHerramienta } from './tipos'

/** Señales de las que depende el estado visible de una herramienta. */
export interface SenalesEstado {
  /** `true` si hay un documento abierto. */
  readonly hayDocumento: boolean
  /** `true` mientras se abre un documento. */
  readonly cargando: boolean
  /** `true` mientras se dibujan las miniaturas iniciales. */
  readonly renderizando?: boolean
  /** `true` mientras se genera el resultado. */
  readonly procesando: boolean
  /** `true` si la última operación terminó correctamente. */
  readonly hayResultado: boolean
  /** `true` si hay algún error pendiente de resolver. */
  readonly hayError: boolean
}

/**
 * Traduce las señales de una herramienta a su estado visible.
 *
 * El orden de comprobación importa: lo que está ocurriendo ahora mismo tiene
 * prioridad sobre lo que ocurrió antes, de modo que un error anterior no oculta
 * un proceso en curso.
 */
export function calcularEstadoHerramienta(
  senales: SenalesEstado,
): EstadoHerramienta {
  if (senales.cargando) {
    return 'cargando-documento'
  }

  if (senales.procesando) {
    return 'procesando'
  }

  if (senales.renderizando === true) {
    return 'renderizando-miniaturas'
  }

  if (senales.hayError) {
    return 'error'
  }

  if (senales.hayResultado) {
    return 'completado'
  }

  return senales.hayDocumento ? 'preparado' : 'sin-archivo'
}

/** Texto que se anuncia mientras la herramienta está ocupada, o `null`. */
export function describirEstadoOcupado(
  estado: EstadoHerramienta,
  textoProcesando: string,
): string | null {
  switch (estado) {
    case 'cargando-documento':
      return 'Abriendo el documento y leyendo sus páginas.'
    case 'renderizando-miniaturas':
      return 'Dibujando las miniaturas de las páginas.'
    case 'procesando':
      return textoProcesando
    default:
      return null
  }
}

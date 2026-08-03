import type {
  ArchivoDescartado,
  MotivoDescarte,
  PdfSeleccionado,
} from '../../pdf/tipos'
import {
  construirIdArchivo,
  esArchivoPdf,
} from '../../utilidades/validacionArchivos'
import type { DireccionMovimiento } from './tipos'

/** Número máximo de archivos descartados que se detallan en el aviso. */
const MAXIMO_DESCARTES_DETALLADOS = 3

/** Texto que explica cada motivo de descarte. */
const ETIQUETAS_MOTIVO: Record<MotivoDescarte, string> = {
  'no-es-pdf': 'no es un archivo PDF',
  vacio: 'está vacío',
  duplicado: 'ya estaba en la lista',
}

/** Resultado de añadir archivos a la selección actual. */
export interface ActualizacionSeleccion {
  /** Selección resultante, con los archivos válidos añadidos al final. */
  readonly archivos: readonly PdfSeleccionado[]
  /** Número de archivos añadidos correctamente. */
  readonly numeroAnadidos: number
  /** Archivos descartados junto con su motivo. */
  readonly descartados: readonly ArchivoDescartado[]
}

/**
 * Añade archivos al final de la selección conservando el orden de llegada.
 *
 * Se descartan los que no son PDF, los que están vacíos y los duplicados
 * exactos. La función es pura: devuelve una selección nueva sin modificar la
 * que recibe.
 */
export function anadirArchivosASeleccion(
  actual: readonly PdfSeleccionado[],
  entrantes: readonly File[],
): ActualizacionSeleccion {
  const idsConocidos = new Set(actual.map((seleccionado) => seleccionado.id))
  const anadidos: PdfSeleccionado[] = []
  const descartados: ArchivoDescartado[] = []

  for (const archivo of entrantes) {
    if (!esArchivoPdf(archivo)) {
      descartados.push({ nombre: archivo.name, motivo: 'no-es-pdf' })
      continue
    }

    if (archivo.size === 0) {
      descartados.push({ nombre: archivo.name, motivo: 'vacio' })
      continue
    }

    const id = construirIdArchivo(archivo)
    if (idsConocidos.has(id)) {
      descartados.push({ nombre: archivo.name, motivo: 'duplicado' })
      continue
    }

    idsConocidos.add(id)
    anadidos.push({
      id,
      archivo,
      nombre: archivo.name,
      tamano: archivo.size,
    })
  }

  return {
    archivos: anadidos.length === 0 ? actual : [...actual, ...anadidos],
    numeroAnadidos: anadidos.length,
    descartados,
  }
}

/**
 * Intercambia un archivo con el inmediatamente anterior o posterior.
 * Si el movimiento sale de los límites, devuelve la selección sin cambios.
 */
export function moverArchivoEnSeleccion(
  archivos: readonly PdfSeleccionado[],
  id: string,
  direccion: DireccionMovimiento,
): readonly PdfSeleccionado[] {
  const indice = archivos.findIndex((seleccionado) => seleccionado.id === id)
  if (indice === -1) {
    return archivos
  }

  const indiceDestino = direccion === 'arriba' ? indice - 1 : indice + 1
  if (indiceDestino < 0 || indiceDestino >= archivos.length) {
    return archivos
  }

  const reordenados = [...archivos]
  const movido = reordenados[indice]
  reordenados[indice] = reordenados[indiceDestino]
  reordenados[indiceDestino] = movido

  return reordenados
}

/** Quita un archivo de la selección. */
export function eliminarArchivoDeSeleccion(
  archivos: readonly PdfSeleccionado[],
  id: string,
): readonly PdfSeleccionado[] {
  return archivos.filter((seleccionado) => seleccionado.id !== id)
}

/** Suma en bytes el tamaño de todos los archivos de la selección. */
export function calcularTamanoTotal(
  archivos: readonly PdfSeleccionado[],
): number {
  return archivos.reduce((total, seleccionado) => total + seleccionado.tamano, 0)
}

/**
 * Redacta un aviso con los archivos descartados.
 * Devuelve `null` cuando no se descartó ninguno.
 */
export function describirDescartes(
  descartados: readonly ArchivoDescartado[],
): string | null {
  if (descartados.length === 0) {
    return null
  }

  const detallados = descartados.slice(0, MAXIMO_DESCARTES_DETALLADOS)
  const detalle = detallados
    .map((elemento) => `«${elemento.nombre}» ${ETIQUETAS_MOTIVO[elemento.motivo]}`)
    .join('; ')

  const restantes = descartados.length - detallados.length
  const extra =
    restantes > 0
      ? ` Y ${restantes} ${restantes === 1 ? 'archivo' : 'archivos'} más.`
      : ''

  const introduccion =
    descartados.length === 1
      ? 'Se descartó 1 archivo'
      : `Se descartaron ${descartados.length} archivos`

  return `${introduccion}: ${detalle}.${extra}`
}

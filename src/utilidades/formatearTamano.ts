/** Unidades usadas para mostrar tamaños, de menor a mayor. */
const UNIDADES = ['B', 'kB', 'MB', 'GB', 'TB'] as const

/** Factor binario entre unidades consecutivas. */
const FACTOR = 1024

/**
 * Convierte un tamaño en bytes a un texto legible.
 * El número se formatea en español, con la coma como separador decimal.
 */
export function formatearTamanoArchivo(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  let valor = bytes
  let indiceUnidad = 0

  while (valor >= FACTOR && indiceUnidad < UNIDADES.length - 1) {
    valor /= FACTOR
    indiceUnidad += 1
  }

  // Los bytes se muestran enteros; el resto de unidades con un decimal.
  const decimales = indiceUnidad === 0 ? 0 : 1
  const formateado = valor.toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })

  return `${formateado} ${UNIDADES[indiceUnidad]}`
}

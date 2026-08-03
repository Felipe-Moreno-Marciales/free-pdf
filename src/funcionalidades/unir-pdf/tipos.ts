import type { ResultadoDocumento } from '../../pdf/tipos'

/** Estado del proceso de unión. */
export type EstadoUnion = 'inactivo' | 'uniendo' | 'completado' | 'error'

/** Dirección en la que se desplaza un archivo dentro de la lista. */
export type DireccionMovimiento = 'arriba' | 'abajo'

/**
 * Documento resultante de una unión correcta.
 *
 * Es el mismo tipo que devuelven las demás herramientas: se mantiene este
 * nombre porque describe mejor la intención dentro de esta funcionalidad.
 */
export type ResultadoUnion = ResultadoDocumento

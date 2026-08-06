import { gradosDelGiro, sumarRotacion } from '../pdf/rotaciones'
import type { GradosRotacion, SentidoGiro } from '../pdf/tipos'
import {
  eliminarPorId,
  moverAPosicion,
  moverPorId,
} from '../utilidades/listas'
import { construirIdArchivo } from '../utilidades/validacionArchivos'
import type {
  DesplazamientoImagen,
  DimensionesImagen,
  ImagenDescartada,
  ImagenSeleccionada,
  MotivoDescarteImagen,
  RecorteRelativo,
} from './tipos'
import { validarArchivoImagen } from './validarImagen'

/**
 * Operaciones sobre la lista de imágenes seleccionadas.
 *
 * Todas son puras: reciben la lista actual y devuelven una nueva sin modificar
 * la que reciben. Al no depender de React ni del navegador se pueden probar por
 * separado, y las usan por igual los botones y el reordenado por arrastre.
 */

/** Número máximo de imágenes descartadas que se detallan en el aviso. */
const MAXIMO_DESCARTES_DETALLADOS = 3

/** Texto que explica cada motivo de descarte. */
const ETIQUETAS_MOTIVO: Readonly<Record<MotivoDescarteImagen, string>> = {
  'formato-no-admitido': 'no tiene un formato de imagen admitido',
  vacia: 'está vacío',
  duplicada: 'ya estaba en la lista',
}

/** Resultado de añadir imágenes a la selección actual. */
export interface ActualizacionSeleccionImagenes {
  /** Selección resultante, con las imágenes válidas añadidas al final. */
  readonly imagenes: readonly ImagenSeleccionada[]
  /** Número de imágenes añadidas correctamente. */
  readonly numeroAnadidas: number
  /** Imágenes descartadas junto con su motivo. */
  readonly descartadas: readonly ImagenDescartada[]
}

/**
 * Añade imágenes al final de la selección conservando el orden de llegada.
 *
 * Se descartan las que no tienen un formato admitido, las vacías y las
 * duplicadas. Un duplicado se detecta comparando nombre, tamaño y fecha de
 * modificación, sin necesidad de leer el contenido.
 */
export function anadirImagenesASeleccion(
  actual: readonly ImagenSeleccionada[],
  entrantes: readonly File[],
): ActualizacionSeleccionImagenes {
  const idsConocidos = new Set(actual.map((imagen) => imagen.id))
  const anadidas: ImagenSeleccionada[] = []
  const descartadas: ImagenDescartada[] = []

  for (const archivo of entrantes) {
    const validacion = validarArchivoImagen(archivo)

    if (!validacion.valido || validacion.formato === null) {
      descartadas.push({
        nombre: archivo.name,
        motivo: validacion.motivo ?? 'formato-no-admitido',
      })
      continue
    }

    const id = construirIdArchivo(archivo)
    if (idsConocidos.has(id)) {
      descartadas.push({ nombre: archivo.name, motivo: 'duplicada' })
      continue
    }

    idsConocidos.add(id)
    anadidas.push({
      id,
      archivo,
      nombre: archivo.name,
      tamano: archivo.size,
      formato: validacion.formato,
      rotacion: 0,
      dimensiones: null,
    })
  }

  return {
    imagenes: anadidas.length === 0 ? actual : [...actual, ...anadidas],
    numeroAnadidas: anadidas.length,
    descartadas,
  }
}

/** Quita una imagen de la selección. */
export function eliminarImagenDeSeleccion(
  imagenes: readonly ImagenSeleccionada[],
  id: string,
): readonly ImagenSeleccionada[] {
  return eliminarPorId(imagenes, id)
}

/**
 * Mueve una imagen dentro de la lista.
 *
 * `anterior` y `siguiente` la intercambian con su vecina; `inicio` y `final` la
 * llevan a un extremo desplazando el resto. Si el movimiento no cambia nada se
 * devuelve la lista tal cual, lo que evita renderizados innecesarios.
 */
export function moverImagen(
  imagenes: readonly ImagenSeleccionada[],
  id: string,
  desplazamiento: DesplazamientoImagen,
): readonly ImagenSeleccionada[] {
  return moverPorId(imagenes, id, desplazamiento)
}

/** Mueve una imagen de una posición a otra, desplazando el resto. */
export function reordenarImagenes(
  imagenes: readonly ImagenSeleccionada[],
  posicionOrigen: number,
  posicionDestino: number,
): readonly ImagenSeleccionada[] {
  return moverAPosicion(imagenes, posicionOrigen, posicionDestino)
}

/** Gira una imagen un cuarto de vuelta en el sentido indicado. */
export function girarImagen(
  imagenes: readonly ImagenSeleccionada[],
  id: string,
  sentido: SentidoGiro,
): readonly ImagenSeleccionada[] {
  return imagenes.map((imagen) =>
    imagen.id === id
      ? { ...imagen, rotacion: sumarRotacion(imagen.rotacion, gradosDelGiro(sentido)) }
      : imagen,
  )
}

/** Establece la rotación de una imagen. */
export function establecerRotacionImagen(
  imagenes: readonly ImagenSeleccionada[],
  id: string,
  rotacion: GradosRotacion,
): readonly ImagenSeleccionada[] {
  return imagenes.map((imagen) =>
    imagen.id === id ? { ...imagen, rotacion } : imagen,
  )
}

/** Guarda las medidas leídas al descodificar una imagen. */
export function establecerDimensionesImagen(
  imagenes: readonly ImagenSeleccionada[],
  id: string,
  dimensiones: DimensionesImagen,
): readonly ImagenSeleccionada[] {
  return imagenes.map((imagen) =>
    imagen.id === id ? { ...imagen, dimensiones } : imagen,
  )
}

/** Suma en bytes el tamaño de todas las imágenes de la selección. */
export function calcularTamanoTotalImagenes(
  imagenes: readonly ImagenSeleccionada[],
): number {
  return imagenes.reduce((total, imagen) => total + imagen.tamano, 0)
}

/** Suma los píxeles de las imágenes cuyas medidas ya se conocen. */
export function calcularPixelesTotales(
  imagenes: readonly ImagenSeleccionada[],
): number {
  return imagenes.reduce(
    (total, imagen) =>
      total +
      (imagen.dimensiones === null
        ? 0
        : imagen.dimensiones.ancho * imagen.dimensiones.alto),
    0,
  )
}

/**
 * Redacta un aviso con las imágenes descartadas.
 * Devuelve `null` cuando no se descartó ninguna.
 */
export function describirDescartesImagenes(
  descartadas: readonly ImagenDescartada[],
): string | null {
  if (descartadas.length === 0) {
    return null
  }

  const detalladas = descartadas.slice(0, MAXIMO_DESCARTES_DETALLADOS)
  const detalle = detalladas
    .map((elemento) => `«${elemento.nombre}» ${ETIQUETAS_MOTIVO[elemento.motivo]}`)
    .join('; ')

  const restantes = descartadas.length - detalladas.length
  const extra =
    restantes > 0
      ? ` Y ${restantes} ${restantes === 1 ? 'archivo' : 'archivos'} más.`
      : ''

  const introduccion =
    descartadas.length === 1
      ? 'Se descartó 1 archivo'
      : `Se descartaron ${descartadas.length} archivos`

  return `${introduccion}: ${detalle}.${extra}`
}

/** Recortes por imagen, indexados por su identificador. */
export type RecortesPorImagen = ReadonlyMap<string, RecorteRelativo>

/** Devuelve el recorte guardado de una imagen, o `null` si no tiene ninguno. */
export function leerRecorte(
  recortes: RecortesPorImagen,
  id: string,
): RecorteRelativo | null {
  return recortes.get(id) ?? null
}

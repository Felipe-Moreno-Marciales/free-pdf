import type { PDFDocument } from 'pdf-lib'
import { comprobarCancelacion } from '../pdf/cancelacion'
import { cargarPdfLib, type ModuloPdfLib } from '../pdf/cargarDocumentoPdf'
import { crearBlobPdf } from '../pdf/guardarDocumentoPdf'
import type { ProcesadorQpdf } from '../seguridad/qpdf/crearProcesadorQpdf'
import {
  inventariar,
  localizarImagenes,
  type InventarioImagenes,
  type PerfilCompresion,
} from './imagenesPdf'
import {
  borrarMetadatos,
  contarMetadatos,
  leerMetadatos,
} from './metadatosPdf'
import {
  explicarImagenes,
  recomprimirImagenes,
  type AdaptadorImagen,
  type ResultadoImagenes,
} from './recomprimirImagenes'

/**
 * Canal completo de la compresión: imágenes y después estructura.
 *
 * El orden importa y es deliberado:
 *
 * 1. **Primero las imágenes**, con pdf-lib. Es donde está casi todo el ahorro posible
 *    en un documento con fotografías, y es lo que qpdf no puede hacer.
 * 2. **Después la estructura**, con qpdf. Reagrupa los objetos del documento ya
 *    modificado, incluidos los flujos de imagen nuevos.
 *
 * Al revés no funcionaría igual de bien: qpdf dejaría el documento con flujos de
 * objetos y pdf-lib tendría que rehacerlos al volver a guardar, deshaciendo parte del
 * trabajo.
 *
 * **El archivo original nunca se modifica.** Se leen sus bytes y todo lo demás ocurre
 * sobre copias en memoria.
 */

/** Mensaje exacto cuando no se consigue reducir. */
export const MENSAJE_SIN_REDUCCION =
  'No se pudo reducir el tamaño con este método local. El documento puede estar ya optimizado.'

/** Nombre del documento comprimido. */
export const NOMBRE_COMPRIMIDO = 'free-pdf-comprimido.pdf'

/** Etapa en la que está el proceso, para poder informar con precisión. */
export type EtapaCompresion =
  | 'leyendo'
  | 'imagenes'
  | 'estructura'
  | 'verificando'

/** Describe una etapa en español. */
export function describirEtapa(etapa: EtapaCompresion): string {
  switch (etapa) {
    case 'leyendo':
      return 'Analizando el documento'
    case 'imagenes':
      return 'Recomprimiendo las imágenes'
    case 'estructura':
      return 'Optimizando la estructura del archivo'
    case 'verificando':
      return 'Comprobando el resultado'
  }
}

/** Progreso del proceso completo. */
export interface ProgresoCompresion {
  readonly etapa: EtapaCompresion
  /** Imágenes ya tratadas, si la etapa es de imágenes. */
  readonly completadas: number
  readonly total: number
}

/** Qué se le pide a la compresión. */
export interface PeticionCompresion {
  readonly archivo: File
  readonly perfil: PerfilCompresion
  /** `true` para borrar los metadatos del documento. */
  readonly borrarMetadatos: boolean
}

/** Lo que necesita el canal para funcionar. */
export interface DependenciasCompresion {
  readonly procesador: ProcesadorQpdf
  readonly adaptador: AdaptadorImagen
  readonly senal?: AbortSignal
  readonly alProgreso?: (progreso: ProgresoCompresion) => void
}

/** Cómo terminó la compresión. */
export type DesenlaceCompresion = 'reducido' | 'sin-reduccion'

/** Resultado completo, con todo lo necesario para informar con honestidad. */
export interface ResultadoCompresion {
  /** El documento comprimido, o `null` si no se entrega por no ser menor. */
  readonly blob: Blob | null
  readonly nombreArchivo: string
  readonly desenlace: DesenlaceCompresion
  readonly tamanoOriginal: number
  readonly tamanoFinal: number
  /** Bytes ahorrados. Puede ser negativo. */
  readonly reduccionAbsoluta: number
  /** Porcentaje real de reducción. Puede ser negativo. */
  readonly porcentaje: number
  readonly perfil: PerfilCompresion
  readonly inventario: InventarioImagenes
  readonly imagenes: ResultadoImagenes
  /** Cuántos metadatos se borraron; 0 si no se pidió. */
  readonly metadatosBorrados: number
  readonly numeroPaginas: number
  /** Explicación en español del desenlace. */
  readonly explicacion: string
}

/**
 * Reducción mínima para entregar el archivo.
 *
 * Medio por ciento. Por debajo de eso, cambiar de archivo no aporta nada y el
 * documento nuevo pierde particularidades del original sin ninguna ganancia.
 */
export const REDUCCION_MINIMA = 0.005

/** Comprime un documento y devuelve el resultado, sin tocar el original. */
export async function comprimirDocumento(
  peticion: PeticionCompresion,
  dependencias: DependenciasCompresion,
): Promise<ResultadoCompresion> {
  const { senal, alProgreso } = dependencias
  const tamanoOriginal = peticion.archivo.size

  alProgreso?.({ etapa: 'leyendo', completadas: 0, total: 0 })

  const contenido = new Uint8Array(await peticion.archivo.arrayBuffer())
  const pdfLib = await cargarPdfLib()

  comprobarCancelacion(senal)

  // Se abre una copia propia: pdf-lib puede conservar referencias al búfer.
  const documento = await pdfLib.PDFDocument.load(copiar(contenido), {
    ignoreEncryption: false,
  })

  const inventario = inventariar(
    localizarImagenes(documento, pdfLib),
    peticion.perfil,
  )

  // --- 1. Metadatos ---
  const metadatosBorrados = peticion.borrarMetadatos
    ? aplicarBorradoMetadatos(documento)
    : 0

  // --- 2. Imágenes ---
  alProgreso?.({
    etapa: 'imagenes',
    completadas: 0,
    total: inventario.recomprimibles,
  })

  const imagenes = await recomprimirImagenes(
    documento,
    pdfLib,
    peticion.perfil,
    dependencias.adaptador,
    {
      ...(senal === undefined ? {} : { senal }),
      alProgreso: (progreso) =>
        alProgreso?.({
          etapa: 'imagenes',
          completadas: progreso.completadas,
          total: progreso.total,
        }),
    },
  )

  comprobarCancelacion(senal)

  const conImagenes = await documento.save({ useObjectStreams: false })
  const numeroPaginas = documento.getPageCount()

  // --- 3. Estructura, con qpdf ---
  alProgreso?.({ etapa: 'estructura', completadas: 0, total: 0 })

  const optimizado = await optimizarEstructura(
    dependencias.procesador,
    conImagenes,
    peticion.perfil,
  )

  comprobarCancelacion(senal)

  // --- 4. Verificación ---
  alProgreso?.({ etapa: 'verificando', completadas: 0, total: 0 })

  const candidato = optimizado ?? conImagenes

  await verificar(pdfLib, candidato, numeroPaginas)

  return construirResultado({
    candidato,
    tamanoOriginal,
    perfil: peticion.perfil,
    inventario,
    imagenes,
    metadatosBorrados,
    numeroPaginas,
  })
}

/** Copia unos bytes a un búfer propio. */
function copiar(origen: Uint8Array): Uint8Array {
  const copia = new Uint8Array(origen.byteLength)
  copia.set(origen)

  return copia
}

/** Borra los metadatos y devuelve cuántos había. */
function aplicarBorradoMetadatos(documento: PDFDocument): number {
  const cuantos = contarMetadatos(leerMetadatos(documento))
  borrarMetadatos(documento)

  return cuantos
}

/**
 * Optimiza la estructura con qpdf.
 *
 * Devuelve `null` si qpdf no consigue mejorarlo. No es un error: significa que se
 * queda la versión que salió de pdf-lib, que ya lleva las imágenes recomprimidas.
 */
async function optimizarEstructura(
  procesador: ProcesadorQpdf,
  contenido: Uint8Array,
  perfil: PerfilCompresion,
): Promise<Uint8Array | null> {
  try {
    // El perfil ligero no fuerza la recompresión de flujos; los otros dos sí, porque
    // ya han aceptado gastar tiempo a cambio de tamaño.
    const { contenido: comprimido } = await procesador.comprimir(
      copiar(contenido),
      perfil === 'ligera' ? 'estructural' : 'maxima',
    )

    return comprimido
  } catch {
    // Si qpdf falla, se conserva lo que pdf-lib produjo. Perder la optimización
    // estructural es mucho mejor que perder la recompresión de las imágenes.
    return null
  }
}

/**
 * Comprueba que el documento resultante sirve.
 *
 * Se abre con pdf-lib **sin `ignoreEncryption`** y se confirma que conserva las
 * páginas. Si algo falla, se lanza: es preferible un error claro a entregar un archivo
 * que quizá no se abra.
 */
async function verificar(
  pdfLib: ModuloPdfLib,
  contenido: Uint8Array,
  paginasEsperadas: number,
): Promise<void> {
  const reabierto = await pdfLib.PDFDocument.load(copiar(contenido), {
    ignoreEncryption: false,
  })

  if (reabierto.getPageCount() !== paginasEsperadas) {
    throw new Error(
      `El documento comprimido tiene ${reabierto.getPageCount()} páginas y el original ${paginasEsperadas}. No se entrega.`,
    )
  }
}

/** Datos con los que se construye el resultado. */
interface DatosResultado {
  readonly candidato: Uint8Array
  readonly tamanoOriginal: number
  readonly perfil: PerfilCompresion
  readonly inventario: InventarioImagenes
  readonly imagenes: ResultadoImagenes
  readonly metadatosBorrados: number
  readonly numeroPaginas: number
}

/**
 * Decide el desenlace y redacta la explicación.
 *
 * **La regla que no se negocia: si no es más pequeño, no se entrega.** El `blob` queda
 * en `null` y el mensaje es el exacto que la especificación pide.
 */
export function construirResultado(datos: DatosResultado): ResultadoCompresion {
  const tamanoFinal = datos.candidato.byteLength
  const reduccionAbsoluta = datos.tamanoOriginal - tamanoFinal
  const fraccion =
    datos.tamanoOriginal <= 0 ? 0 : reduccionAbsoluta / datos.tamanoOriginal
  const porcentaje = Math.round(fraccion * 1000) / 10

  const desenlace: DesenlaceCompresion =
    fraccion >= REDUCCION_MINIMA ? 'reducido' : 'sin-reduccion'

  return {
    blob: desenlace === 'reducido' ? crearBlobPdf(datos.candidato) : null,
    nombreArchivo: NOMBRE_COMPRIMIDO,
    desenlace,
    tamanoOriginal: datos.tamanoOriginal,
    tamanoFinal,
    reduccionAbsoluta,
    porcentaje,
    perfil: datos.perfil,
    inventario: datos.inventario,
    imagenes: datos.imagenes,
    metadatosBorrados: datos.metadatosBorrados,
    numeroPaginas: datos.numeroPaginas,
    explicacion: redactarExplicacion(
      desenlace,
      porcentaje,
      reduccionAbsoluta,
      datos,
    ),
  }
}

/** Redacta en español lo que ha ocurrido. */
function redactarExplicacion(
  desenlace: DesenlaceCompresion,
  porcentaje: number,
  reduccionAbsoluta: number,
  datos: DatosResultado,
): string {
  const partes: string[] = []

  if (desenlace === 'reducido') {
    partes.push(
      `El documento ha pasado a ocupar un ${porcentaje.toFixed(1)} % menos, ${Math.round(reduccionAbsoluta / 1024)} KB de ahorro.`,
    )
  } else {
    partes.push(MENSAJE_SIN_REDUCCION)
    partes.push('Se conserva el original, que no se ha modificado.')
  }

  const detalleImagenes = explicarImagenes(datos.imagenes)

  if (detalleImagenes !== 'No había imágenes que recomprimir.') {
    partes.push(detalleImagenes)
  }

  if (datos.metadatosBorrados > 0) {
    partes.push(
      `Se ${datos.metadatosBorrados === 1 ? 'borró' : 'borraron'} ${datos.metadatosBorrados} ${
        datos.metadatosBorrados === 1 ? 'metadato' : 'metadatos'
      } del documento.`,
    )
  }

  return partes.join(' ')
}

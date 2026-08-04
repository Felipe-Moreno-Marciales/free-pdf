import type { PDFDocument } from 'pdf-lib'
import { cederElControl, comprobarCancelacion } from '../pdf/cancelacion'
import type { ModuloPdfLib } from '../pdf/cargarDocumentoPdf'
import {
  AHORRO_MINIMO_IMAGEN,
  CALIDAD_JPEG,
  calcularMedidasDestino,
  localizarImagenes,
  seVaARecomprimir,
  type ImagenIncrustada,
  type MedidasDestino,
  type PerfilCompresion,
} from './imagenesPdf'

/**
 * Recompresión de las imágenes de un documento, conservando todo lo demás.
 *
 * El trabajo se reparte así:
 *
 * - **Este módulo** decide qué imágenes se tocan, sustituye los flujos y lleva la
 *   cuenta. No sabe descodificar ni codificar nada, así que se puede probar entero.
 * - **El adaptador** hace lo único que necesita el navegador: descodificar un JPEG,
 *   redibujarlo a otro tamaño y volver a codificarlo. En las pruebas se inyecta otro
 *   que devuelve JPEG reales más pequeños, así que el canal se ejerce de verdad.
 *
 * Las imágenes se procesan **una por una**. Una fotografía de 4000 × 3000 ocupa unos
 * 48 MB descodificada, y hacerlo en paralelo agotaría la memoria en documentos con
 * muchas. Además así el progreso puede ser real y la cancelación efectiva.
 */

/** Lo que el navegador tiene que saber hacer. */
export interface AdaptadorImagen {
  /**
   * Descodifica un JPEG, lo redibuja al tamaño indicado y lo vuelve a codificar.
   *
   * Debe devolver `null` si no consigue descodificarlo. Ocurre de verdad: un JPEG en
   * CMYK o con un perfil raro puede no ser descodificable por el navegador, y en ese
   * caso lo correcto es dejar la imagen como estaba.
   */
  readonly recomprimir: (
    bytes: Uint8Array,
    destino: MedidasDestino,
    calidad: number,
  ) => Promise<Uint8Array | null>
}

/** Progreso de la recompresión. */
export interface ProgresoImagenes {
  readonly completadas: number
  readonly total: number
}

/** Resultado de recomprimir las imágenes de un documento. */
export interface ResultadoImagenes {
  /** Cuántas imágenes se sustituyeron de verdad. */
  readonly sustituidas: number
  /** Cuántas se intentaron pero se dejaron como estaban. */
  readonly conservadas: number
  /** Bytes que ocupaban las imágenes sustituidas antes. */
  readonly bytesAntes: number
  /** Bytes que ocupan ahora. */
  readonly bytesDespues: number
  /** Cuántas no se pudieron descodificar. */
  readonly noDescodificadas: number
}

/** Opciones de la recompresión. */
export interface OpcionesImagenes {
  readonly senal?: AbortSignal
  readonly alProgreso?: (progreso: ProgresoImagenes) => void
}

/**
 * Recomprime las imágenes del documento, modificándolo en el sitio.
 *
 * El documento que se pasa se modifica: quien llame debe habérselo cargado a propósito
 * para esto y no reutilizarlo para otra cosa.
 */
export async function recomprimirImagenes(
  documento: PDFDocument,
  pdfLib: ModuloPdfLib,
  perfil: PerfilCompresion,
  adaptador: AdaptadorImagen,
  opciones: OpcionesImagenes = {},
): Promise<ResultadoImagenes> {
  const todas = localizarImagenes(documento, pdfLib)
  const candidatas = todas.filter((imagen) => seVaARecomprimir(imagen, perfil))

  let sustituidas = 0
  let conservadas = 0
  let noDescodificadas = 0
  let bytesAntes = 0
  let bytesDespues = 0

  for (const [indice, imagen] of candidatas.entries()) {
    comprobarCancelacion(opciones.senal)

    const resultado = await procesarUna(
      documento,
      pdfLib,
      imagen,
      perfil,
      adaptador,
    )

    switch (resultado.desenlace) {
      case 'sustituida':
        sustituidas += 1
        bytesAntes += imagen.bytes
        bytesDespues += resultado.bytesNuevos
        break
      case 'conservada':
        conservadas += 1
        break
      case 'no-descodificada':
        noDescodificadas += 1
        break
    }

    opciones.alProgreso?.({
      completadas: indice + 1,
      total: candidatas.length,
    })

    // Se cede el control entre imágenes para que la interfaz siga respondiendo y el
    // recolector de basura pueda liberar la imagen anterior.
    await cederElControl()
  }

  return {
    sustituidas,
    conservadas,
    bytesAntes,
    bytesDespues,
    noDescodificadas,
  }
}

/** Cómo terminó el tratamiento de una imagen. */
type DesenlaceImagen = 'sustituida' | 'conservada' | 'no-descodificada'

/** Resultado del tratamiento de una imagen. */
interface ResultadoUna {
  readonly desenlace: DesenlaceImagen
  readonly bytesNuevos: number
}

/**
 * Trata una sola imagen.
 *
 * La regla, igual que en el documento completo: **si la imagen nueva no es más
 * pequeña, se conserva la original**. Sustituirla por una que pesa lo mismo o más
 * empeoraría la calidad a cambio de nada, que es el peor resultado posible.
 */
async function procesarUna(
  documento: PDFDocument,
  pdfLib: ModuloPdfLib,
  imagen: ImagenIncrustada,
  perfil: PerfilCompresion,
  adaptador: AdaptadorImagen,
): Promise<ResultadoUna> {
  const destino = calcularMedidasDestino(imagen, perfil)

  let nuevos: Uint8Array | null

  try {
    nuevos = await adaptador.recomprimir(
      imagen.flujo.contents,
      destino,
      CALIDAD_JPEG[perfil],
    )
  } catch {
    // Un JPEG que el navegador no sabe leer no es un error de la herramienta: se deja
    // la imagen como estaba y se sigue con la siguiente.
    return { desenlace: 'no-descodificada', bytesNuevos: 0 }
  }

  if (nuevos === null) {
    return { desenlace: 'no-descodificada', bytesNuevos: 0 }
  }

  const ahorro = 1 - nuevos.byteLength / imagen.bytes

  if (ahorro < AHORRO_MINIMO_IMAGEN) {
    return { desenlace: 'conservada', bytesNuevos: imagen.bytes }
  }

  sustituirFlujo(documento, pdfLib, imagen, nuevos, destino)

  return { desenlace: 'sustituida', bytesNuevos: nuevos.byteLength }
}

/**
 * Sustituye el flujo de una imagen por otros bytes.
 *
 * Se clona el diccionario original en lugar de construir uno nuevo: así se conservan
 * todas las entradas que no se tocan —`/ColorSpace`, `/SMask`, `/Decode`, el espacio
 * de color indexado— y solo cambian las tres que dependen de los píxeles nuevos.
 * Construir el diccionario desde cero perdería esas entradas y el documento mostraría
 * la imagen mal o no la mostraría.
 */
export function sustituirFlujo(
  documento: PDFDocument,
  pdfLib: ModuloPdfLib,
  imagen: ImagenIncrustada,
  bytes: Uint8Array,
  destino: MedidasDestino,
): void {
  const contexto = documento.context
  const diccionario = imagen.flujo.dict.clone(contexto)

  diccionario.set(pdfLib.PDFName.of('Width'), pdfLib.PDFNumber.of(destino.ancho))
  diccionario.set(pdfLib.PDFName.of('Height'), pdfLib.PDFNumber.of(destino.alto))
  diccionario.set(
    pdfLib.PDFName.of('Length'),
    pdfLib.PDFNumber.of(bytes.byteLength),
  )

  // El resultado del adaptador es siempre un JPEG, así que el filtro es DCTDecode.
  // Se fija de forma explícita porque una imagen que antes fuera progresiva o llevara
  // varios filtros en cadena ya no los lleva.
  diccionario.set(pdfLib.PDFName.of('Filter'), pdfLib.PDFName.of('DCTDecode'))
  diccionario.delete(pdfLib.PDFName.of('DecodeParms'))

  contexto.assign(imagen.referencia, pdfLib.PDFRawStream.of(diccionario, bytes))
}

/** Explica en español lo que se hizo con las imágenes. */
export function explicarImagenes(resultado: ResultadoImagenes): string {
  if (resultado.sustituidas === 0 && resultado.conservadas === 0 && resultado.noDescodificadas === 0) {
    return 'No había imágenes que recomprimir.'
  }

  const partes: string[] = []

  if (resultado.sustituidas > 0) {
    const ahorro = resultado.bytesAntes - resultado.bytesDespues

    partes.push(
      `Se ${resultado.sustituidas === 1 ? 'recomprimió' : 'recomprimieron'} ${resultado.sustituidas} ${
        resultado.sustituidas === 1 ? 'imagen' : 'imágenes'
      }, ahorrando ${Math.round(ahorro / 1024)} KB entre todas.`,
    )
  }

  if (resultado.conservadas > 0) {
    partes.push(
      `${resultado.conservadas} se ${resultado.conservadas === 1 ? 'dejó' : 'dejaron'} como ${resultado.conservadas === 1 ? 'estaba' : 'estaban'}, porque recomprimirlas no las habría hecho más pequeñas.`,
    )
  }

  if (resultado.noDescodificadas > 0) {
    partes.push(
      `${resultado.noDescodificadas} no se ${resultado.noDescodificadas === 1 ? 'pudo' : 'pudieron'} descodificar y ${resultado.noDescodificadas === 1 ? 'quedó' : 'quedaron'} intacta${resultado.noDescodificadas === 1 ? '' : 's'}.`,
    )
  }

  return partes.join(' ')
}

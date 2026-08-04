import type { PDFDocument, PDFRawStream, PDFRef } from 'pdf-lib'
import type { ModuloPdfLib } from '../pdf/cargarDocumentoPdf'

/**
 * Localización y evaluación de las imágenes incrustadas en un PDF.
 *
 * Este módulo es la parte de la compresión que qpdf **no** puede hacer. qpdf
 * reorganiza la estructura del archivo pero no toca los datos de las imágenes; aquí se
 * las busca una por una para poder recomprimirlas en el navegador.
 *
 * ## Por qué se pueden sustituir sin destruir el documento
 *
 * Una imagen incrustada es un objeto indirecto con `/Subtype /Image`, y sus píxeles
 * son el contenido del flujo. Sustituir ese contenido —y ajustar `/Width`, `/Height` y
 * `/Length`— cambia la imagen y **deja intacto todo lo demás**: el texto sigue siendo
 * texto seleccionable, los vectores siguen siendo vectores y las tipografías siguen
 * incrustadas.
 *
 * Es la diferencia esencial con rasterizar el documento entero, que es lo que hacen
 * muchas herramientas y lo que hace la censura de Free PDF: eso reduce mucho, pero
 * convierte el documento en un álbum de fotos y le quita el texto.
 *
 * Medido con un documento de 162 KB con una imagen de 400 × 400: sustituyendo esa
 * imagen por una de 100 × 100 el archivo bajó a 12,7 KB —un 92,2 %— y el texto y la
 * tipografía Helvetica seguían presentes.
 *
 * ## Solo se tocan las imágenes JPEG
 *
 * Es deliberado. Un flujo `DCTDecode` es un JPEG completo: se puede descodificar,
 * redibujar y volver a codificar sin saber nada más del documento.
 *
 * Las imágenes `FlateDecode` guardan píxeles crudos cuya interpretación depende de
 * `/ColorSpace`, `/BitsPerComponent`, `/Decode` y a veces de una paleta indexada.
 * Recodificarlas exigiría reproducir esa interpretación correctamente, y equivocarse
 * significa cambiar los colores del documento. No merece la pena: `--recompress-flate`
 * de qpdf ya las vuelve a comprimir sin pérdida.
 */

/** Filtro de una imagen incrustada. */
export type FiltroImagen = 'jpeg' | 'flate' | 'otro'

/** Imagen encontrada dentro de un documento. */
export interface ImagenIncrustada {
  /** Referencia al objeto, para poder sustituirlo. */
  readonly referencia: PDFRef
  /** Flujo original. */
  readonly flujo: PDFRawStream
  readonly filtro: FiltroImagen
  /** Ancho en píxeles, tal y como lo declara el documento. */
  readonly ancho: number
  /** Alto en píxeles. */
  readonly alto: number
  /** Tamaño que ocupa en bytes. */
  readonly bytes: number
  /** `true` cuando la imagen lleva una máscara de transparencia asociada. */
  readonly tieneMascara: boolean
}

/**
 * Lado máximo, en píxeles, al que se reduce una imagen en cada perfil.
 *
 * Se limita el lado en píxeles y no la densidad porque **el documento no dice a qué
 * tamaño se dibuja cada imagen**: eso está en los flujos de contenido de cada página,
 * y averiguarlo exigiría interpretarlos. Limitar el lado es una regla comprensible,
 * predecible y que se puede explicar en una frase.
 *
 * 2200 píxeles de lado largo bastan para imprimir a 200 puntos por pulgada en A4, así
 * que el perfil ligero no degrada nada visible en la práctica.
 */
export const LADO_MAXIMO = {
  ligera: 2200,
  equilibrada: 1600,
  alta: 1100,
} as const

/** Calidad JPEG con la que se vuelve a codificar en cada perfil. */
export const CALIDAD_JPEG = {
  ligera: 0.9,
  equilibrada: 0.78,
  alta: 0.6,
} as const

/** Perfil de compresión. */
export type PerfilCompresion = keyof typeof LADO_MAXIMO

/** Todos los perfiles, en el orden en el que se ofrecen. */
export const PERFILES: readonly PerfilCompresion[] = [
  'ligera',
  'equilibrada',
  'alta',
]

/** Nombre visible de cada perfil. */
export function describirPerfil(perfil: PerfilCompresion): string {
  switch (perfil) {
    case 'ligera':
      return 'Ligera'
    case 'equilibrada':
      return 'Equilibrada'
    case 'alta':
      return 'Alta'
  }
}

/** Explica exactamente qué modifica cada perfil. */
export function explicarPerfil(perfil: PerfilCompresion): string {
  switch (perfil) {
    case 'ligera':
      return `Reorganiza la estructura del archivo y reduce las imágenes muy grandes, limitándolas a ${LADO_MAXIMO.ligera} píxeles de lado y calidad ${Math.round(CALIDAD_JPEG.ligera * 100)} %. A la vista no se nota, y sigue valiendo para imprimir.`
    case 'equilibrada':
      return `Además, limita las imágenes a ${LADO_MAXIMO.equilibrada} píxeles de lado con calidad ${Math.round(CALIDAD_JPEG.equilibrada * 100)} %. Es la opción recomendada para documentos que se van a leer en pantalla.`
    case 'alta':
      return `Limita las imágenes a ${LADO_MAXIMO.alta} píxeles de lado con calidad ${Math.round(CALIDAD_JPEG.alta * 100)} %. Reduce mucho más, y en las fotografías **se va a notar**.`
  }
}

/** Reducción mínima por imagen para que merezca la pena sustituirla. */
export const AHORRO_MINIMO_IMAGEN = 0.05

/** Traduce el filtro que declara el documento a un valor propio. */
export function interpretarFiltro(texto: string): FiltroImagen {
  if (texto.includes('DCTDecode')) {
    return 'jpeg'
  }

  if (texto.includes('FlateDecode')) {
    return 'flate'
  }

  return 'otro'
}

/**
 * Busca todas las imágenes incrustadas de un documento.
 *
 * Recorre los objetos indirectos, que es la única forma de encontrarlas sin
 * interpretar los flujos de contenido de cada página.
 */
export function localizarImagenes(
  documento: PDFDocument,
  pdfLib: ModuloPdfLib,
): readonly ImagenIncrustada[] {
  const encontradas: ImagenIncrustada[] = []

  for (const [referencia, objeto] of documento.context.enumerateIndirectObjects()) {
    if (!(objeto instanceof pdfLib.PDFRawStream)) {
      continue
    }

    const diccionario = objeto.dict
    const subtipo = diccionario.get(pdfLib.PDFName.of('Subtype'))

    if (subtipo?.toString() !== '/Image') {
      continue
    }

    const ancho = leerNumero(diccionario, pdfLib, 'Width')
    const alto = leerNumero(diccionario, pdfLib, 'Height')

    if (ancho === null || alto === null || ancho <= 0 || alto <= 0) {
      continue
    }

    encontradas.push({
      referencia,
      flujo: objeto,
      filtro: interpretarFiltro(
        diccionario.get(pdfLib.PDFName.of('Filter'))?.toString() ?? '',
      ),
      ancho,
      alto,
      bytes: objeto.contents.length,
      tieneMascara:
        diccionario.get(pdfLib.PDFName.of('SMask')) !== undefined ||
        diccionario.get(pdfLib.PDFName.of('Mask')) !== undefined,
    })
  }

  return encontradas
}

/** Lee una entrada numérica del diccionario de una imagen. */
function leerNumero(
  diccionario: PDFRawStream['dict'],
  pdfLib: ModuloPdfLib,
  clave: string,
): number | null {
  const valor = diccionario.get(pdfLib.PDFName.of(clave))

  if (valor === undefined) {
    return null
  }

  const numero = Number.parseFloat(valor.toString())

  return Number.isFinite(numero) ? numero : null
}

/** Medidas a las que hay que reducir una imagen. */
export interface MedidasDestino {
  readonly ancho: number
  readonly alto: number
  /** `true` cuando hay que cambiar el tamaño; `false` si solo se recomprime. */
  readonly cambiaTamano: boolean
}

/**
 * Calcula a qué tamaño hay que reducir una imagen.
 *
 * **La proporción se conserva siempre.** Se escala por el lado más largo y el otro se
 * deriva, redondeando a un píxel como mínimo para que una imagen muy alargada no
 * termine con un lado de cero.
 */
export function calcularMedidasDestino(
  imagen: ImagenIncrustada,
  perfil: PerfilCompresion,
): MedidasDestino {
  const limite = LADO_MAXIMO[perfil]
  const ladoMasLargo = Math.max(imagen.ancho, imagen.alto)

  if (ladoMasLargo <= limite) {
    return { ancho: imagen.ancho, alto: imagen.alto, cambiaTamano: false }
  }

  const factor = limite / ladoMasLargo

  return {
    ancho: Math.max(1, Math.round(imagen.ancho * factor)),
    alto: Math.max(1, Math.round(imagen.alto * factor)),
    cambiaTamano: true,
  }
}

/**
 * Decide si una imagen se va a intentar recomprimir.
 *
 * Se descartan las que no son JPEG, por lo explicado en la cabecera del módulo, y las
 * diminutas: un icono de 32 × 32 no va a ahorrar nada y sí puede quedar peor.
 */
export function seVaARecomprimir(
  imagen: ImagenIncrustada,
  perfil: PerfilCompresion,
): boolean {
  if (imagen.filtro !== 'jpeg') {
    return false
  }

  // Por debajo de este tamaño el ahorro posible no compensa el riesgo de empeorar.
  if (imagen.bytes < 4096) {
    return false
  }

  const destino = calcularMedidasDestino(imagen, perfil)

  // Si no hay que redimensionar, solo merece la pena si la calidad baja de verdad.
  return destino.cambiaTamano || CALIDAD_JPEG[perfil] < 0.85
}

/** Resumen de lo que se ha encontrado, para poder avisar antes de empezar. */
export interface InventarioImagenes {
  readonly total: number
  /** Imágenes JPEG, las únicas que se pueden recomprimir. */
  readonly jpeg: number
  /** Imágenes en Flate, que qpdf recomprime sin pérdida. */
  readonly flate: number
  /** Bytes que ocupan todas las imágenes juntas. */
  readonly bytesImagenes: number
  /** Cuántas se van a intentar recomprimir con el perfil elegido. */
  readonly recomprimibles: number
}

/** Resume las imágenes de un documento. */
export function inventariar(
  imagenes: readonly ImagenIncrustada[],
  perfil: PerfilCompresion,
): InventarioImagenes {
  return {
    total: imagenes.length,
    jpeg: imagenes.filter((imagen) => imagen.filtro === 'jpeg').length,
    flate: imagenes.filter((imagen) => imagen.filtro === 'flate').length,
    bytesImagenes: imagenes.reduce((suma, imagen) => suma + imagen.bytes, 0),
    recomprimibles: imagenes.filter((imagen) =>
      seVaARecomprimir(imagen, perfil),
    ).length,
  }
}

/**
 * Explica en español qué se va a hacer con las imágenes del documento.
 *
 * Se muestra **antes** de comprimir. Quien tiene un PDF de fotografías merece saber de
 * antemano qué va a pasar, y quien tiene uno sin imágenes merece saber que el perfil
 * que elija no va a cambiar nada.
 */
export function explicarInventario(inventario: InventarioImagenes): string {
  if (inventario.total === 0) {
    return 'Este documento no tiene imágenes incrustadas, así que solo se puede optimizar su estructura. El perfil que elijas no cambiará el resultado.'
  }

  const partes: string[] = []

  partes.push(
    `El documento tiene ${inventario.total} ${
      inventario.total === 1 ? 'imagen' : 'imágenes'
    }.`,
  )

  if (inventario.recomprimibles > 0) {
    partes.push(
      `Se van a recomprimir ${inventario.recomprimibles} de ellas.`,
    )
  }

  const sinTocar = inventario.total - inventario.recomprimibles

  if (sinTocar > 0) {
    partes.push(
      `${sinTocar} no ${sinTocar === 1 ? 'se va' : 'se van'} a tocar: solo se recomprimen las imágenes JPEG, porque las demás guardan sus píxeles de una forma que depende del documento y recodificarlas podría cambiar los colores.`,
    )
  }

  return partes.join(' ')
}

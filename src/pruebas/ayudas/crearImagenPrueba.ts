import { zlibSync } from 'fflate'
import type { PreparadorImagen } from '../../imagenes/normalizarImagen'
import type {
  DimensionesImagen,
  FormatoImagen,
  ImagenParaPdf,
} from '../../imagenes/tipos'
import type {
  AdaptadorImagenes,
  EntradaImagen,
} from '../../funcionalidades/imagenes-a-pdf/tipos'

/**
 * Ayudas para generar imágenes de prueba dentro de las propias pruebas.
 *
 * Las imágenes se construyen byte a byte en el momento, así que el repositorio no
 * necesita guardar ningún archivo binario.
 *
 * - Los **PNG** son completos y válidos: llevan su firma, su cabecera `IHDR`, los
 *   píxeles comprimidos con `zlib` y sus sumas de comprobación CRC-32. pdf-lib los
 *   descodifica de verdad.
 * - Los **JPEG** llevan una estructura de marcadores válida —`SOI`, `SOF0` y
 *   `EOI`— pero no contienen datos de imagen reales. Es exactamente lo que pdf-lib
 *   inspecciona para incrustarlos: lee las medidas y el número de canales de la
 *   cabecera `SOF0` y copia el resto tal cual. Sirven, por tanto, para comprobar la
 *   incrustación y la geometría del documento, pero **no** para comprobar que la
 *   imagen se vea: eso se verifica abriendo el resultado en un navegador.
 */

/** Tabla de la suma de comprobación CRC-32 que exige el formato PNG. */
const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256)

  for (let indice = 0; indice < 256; indice += 1) {
    let valor = indice

    for (let bit = 0; bit < 8; bit += 1) {
      valor = (valor & 1) !== 0 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1
    }

    tabla[indice] = valor >>> 0
  }

  return tabla
})()

/** Calcula la suma de comprobación CRC-32 de unos bytes. */
function calcularCrc32(bytes: Uint8Array): number {
  let valor = 0xffffffff

  for (const byte of bytes) {
    valor = TABLA_CRC[(valor ^ byte) & 0xff] ^ (valor >>> 8)
  }

  return (valor ^ 0xffffffff) >>> 0
}

/** Escribe un entero de 32 bits en orden de red. */
function escribirEntero32(valor: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, valor >>> 0, false)

  return bytes
}

/** Concatena varios bloques de bytes. */
function unirBytes(bloques: readonly Uint8Array[]): Uint8Array {
  const total = bloques.reduce((suma, bloque) => suma + bloque.byteLength, 0)
  const resultado = new Uint8Array(total)
  let posicion = 0

  for (const bloque of bloques) {
    resultado.set(bloque, posicion)
    posicion += bloque.byteLength
  }

  return resultado
}

/** Construye un fragmento PNG con su tipo, sus datos y su CRC. */
function crearFragmentoPng(tipo: string, datos: Uint8Array): Uint8Array {
  const bytesTipo = new Uint8Array(
    [...tipo].map((caracter) => caracter.charCodeAt(0)),
  )
  const cuerpo = unirBytes([bytesTipo, datos])

  return unirBytes([
    escribirEntero32(datos.byteLength),
    cuerpo,
    escribirEntero32(calcularCrc32(cuerpo)),
  ])
}

/** Color de relleno de una imagen de prueba. */
export interface ColorPrueba {
  readonly rojo: number
  readonly verde: number
  readonly azul: number
}

/** Color predeterminado de las imágenes de prueba. */
const COLOR_PREDETERMINADO: ColorPrueba = { rojo: 200, verde: 60, azul: 40 }

/**
 * Genera un PNG completo y válido, relleno de un color.
 *
 * Se usa color verdadero de 8 bits por componente —tipo 2— sin canal alfa y sin
 * entrelazado, que es la variante más simple que admite pdf-lib.
 */
export function crearBytesPng(
  ancho: number,
  alto: number,
  color: ColorPrueba = COLOR_PREDETERMINADO,
): Uint8Array {
  const firma = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  const cabecera = new Uint8Array(13)
  const vista = new DataView(cabecera.buffer)
  vista.setUint32(0, ancho, false)
  vista.setUint32(4, alto, false)
  cabecera[8] = 8 // Bits por componente.
  cabecera[9] = 2 // Color verdadero, sin canal alfa.
  cabecera[10] = 0 // Compresión zlib, la única que define el formato.
  cabecera[11] = 0 // Filtrado estándar.
  cabecera[12] = 0 // Sin entrelazado.

  // Cada fila lleva delante un byte que indica su filtro; 0 significa «ninguno».
  const bytesPorFila = 1 + ancho * 3
  const crudo = new Uint8Array(bytesPorFila * alto)

  for (let fila = 0; fila < alto; fila += 1) {
    const inicio = fila * bytesPorFila
    crudo[inicio] = 0

    for (let columna = 0; columna < ancho; columna += 1) {
      const posicion = inicio + 1 + columna * 3
      crudo[posicion] = color.rojo
      crudo[posicion + 1] = color.verde
      crudo[posicion + 2] = color.azul
    }
  }

  return unirBytes([
    firma,
    crearFragmentoPng('IHDR', cabecera),
    crearFragmentoPng('IDAT', zlibSync(crudo, { level: 6 })),
    crearFragmentoPng('IEND', new Uint8Array(0)),
  ])
}

/**
 * Genera un JPEG con marcadores válidos y las medidas indicadas.
 *
 * Contiene `SOI`, una cabecera `SOF0` con la precisión, el alto, el ancho y tres
 * canales, y `EOI`. No lleva datos de imagen: pdf-lib no los interpreta, solo los
 * copia al documento.
 */
export function crearBytesJpeg(ancho: number, alto: number): Uint8Array {
  const inicio = new Uint8Array([0xff, 0xd8])

  // Cabecera SOF0: marcador, longitud, precisión, alto, ancho, canales y, por
  // cada canal, su identificador, su submuestreo y su tabla de cuantización.
  const cuerpoSof = new Uint8Array(15)
  const vista = new DataView(cuerpoSof.buffer)
  vista.setUint16(0, 0xffc0, false)
  vista.setUint16(2, 8 + 3 * 3, false)
  cuerpoSof[4] = 8
  vista.setUint16(5, alto, false)
  vista.setUint16(7, ancho, false)
  cuerpoSof[9] = 3

  for (let canal = 0; canal < 3; canal += 1) {
    const posicion = 10 + canal * 3
    cuerpoSof[posicion] = canal + 1
    cuerpoSof[posicion + 1] = 0x11
    cuerpoSof[posicion + 2] = canal === 0 ? 0 : 1
  }

  const fin = new Uint8Array([0xff, 0xd9])

  return unirBytes([inicio, cuerpoSof, fin])
}

/** Tipo MIME de cada formato de prueba. */
const TIPOS_MIME: Readonly<Record<FormatoImagen, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/** Extensión de cada formato de prueba. */
const EXTENSIONES: Readonly<Record<FormatoImagen, string>> = {
  png: '.png',
  jpeg: '.jpg',
  webp: '.webp',
}

/** Envuelve unos bytes en un `File` con el tipo MIME correspondiente. */
export function comoArchivoImagen(
  bytes: Uint8Array,
  nombre: string,
  formato: FormatoImagen,
  fechaModificacion = 1_700_000_000_000,
): File {
  const contenido = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(contenido).set(bytes)

  return new File([contenido], nombre, {
    type: TIPOS_MIME[formato],
    lastModified: fechaModificacion,
  })
}

/** Genera un archivo de imagen de prueba con las medidas indicadas. */
export function crearArchivoImagen(
  nombreBase: string,
  ancho: number,
  alto: number,
  formato: FormatoImagen = 'png',
  fechaModificacion = 1_700_000_000_000,
): File {
  const bytes =
    formato === 'jpeg'
      ? crearBytesJpeg(ancho, alto)
      : crearBytesPng(ancho, alto)

  return comoArchivoImagen(
    bytes,
    `${nombreBase}${EXTENSIONES[formato]}`,
    formato,
    fechaModificacion,
  )
}

/** Entrada de imagen lista para el procesamiento, con sus medidas conocidas. */
export function comoEntradaImagen(
  archivo: File,
  formato: FormatoImagen,
  dimensiones: DimensionesImagen,
  extra: Partial<EntradaImagen> = {},
): EntradaImagen {
  return {
    id: archivo.name,
    nombre: archivo.name,
    contenido: archivo,
    formato,
    rotacion: 0,
    dimensiones,
    ...extra,
  }
}

/** Preparación que registra lo que se le pidió, para poder comprobarlo. */
export interface RegistroPreparacion {
  readonly nombre: string
  readonly rotacion: number
  readonly recorte: unknown
  readonly ajustes: unknown
}

/** Adaptador de imágenes que no necesita navegador. */
export interface AdaptadorDePrueba extends AdaptadorImagenes {
  /** Peticiones que ha recibido, en orden. */
  readonly registro: readonly RegistroPreparacion[]
}

/**
 * Crea un adaptador que sustituye al `canvas` en las pruebas.
 *
 * Devuelve los bytes de un PNG real con las medidas que resultarían de aplicar el
 * giro y el recorte, así que el documento generado es válido y la geometría se
 * puede comprobar de verdad. Además guarda cada petición, lo que permite
 * verificar qué recorte y qué ajustes se pidieron para cada imagen.
 */
export function crearAdaptadorDePrueba(
  medidasPorNombre: ReadonlyMap<string, DimensionesImagen>,
): AdaptadorDePrueba {
  const registro: RegistroPreparacion[] = []

  const preparar: PreparadorImagen = async (peticion) => {
    registro.push({
      nombre: peticion.nombre,
      rotacion: peticion.transformacion.rotacion,
      recorte: peticion.transformacion.recorte,
      ajustes: peticion.transformacion.ajustes,
    })

    const base =
      peticion.dimensiones ??
      medidasPorNombre.get(peticion.nombre) ?? { ancho: 100, alto: 100 }

    const dimensiones = calcularMedidasFinales(
      base,
      peticion.transformacion.rotacion,
      peticion.transformacion.recorte,
    )

    const resultado: ImagenParaPdf = {
      bytes: crearBytesPng(dimensiones.ancho, dimensiones.alto),
      formato: 'png',
      dimensiones,
    }

    return await Promise.resolve(resultado)
  }

  return {
    registro,
    medir: async (entrada) =>
      await Promise.resolve(
        medidasPorNombre.get(entrada.nombre) ?? { ancho: 100, alto: 100 },
      ),
    preparar,
  }
}

/** Recorte relativo tal y como lo recibe el adaptador. */
interface RecorteSimple {
  readonly izquierda: number
  readonly superior: number
  readonly derecha: number
  readonly inferior: number
}

/**
 * Reproduce el efecto del giro y del recorte sobre las medidas.
 *
 * El recorte llega expresado sobre la imagen ya girada, así que primero se giran
 * las medidas y después se aplica el recorte.
 */
function calcularMedidasFinales(
  base: DimensionesImagen,
  rotacion: number,
  recorte: unknown,
): DimensionesImagen {
  const giradas =
    rotacion === 90 || rotacion === 270
      ? { ancho: base.alto, alto: base.ancho }
      : base

  if (recorte === null || typeof recorte !== 'object') {
    return giradas
  }

  const { izquierda, superior, derecha, inferior } = recorte as RecorteSimple

  return {
    ancho: Math.max(
      1,
      Math.round(giradas.ancho * (1 - izquierda - derecha)),
    ),
    alto: Math.max(1, Math.round(giradas.alto * (1 - superior - inferior))),
  }
}

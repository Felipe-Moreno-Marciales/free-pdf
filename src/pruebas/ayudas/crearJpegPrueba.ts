/**
 * JPEG generados a mano para las pruebas.
 *
 * Hace falta un JPEG **de verdad** —con su marcador de inicio, sus tablas y su
 * `DCTDecode` cuando se incrusta— para poder comprobar que la recompresión de imágenes
 * funciona. No sirve un montón de bytes cualquiera: pdf-lib inspecciona la cabecera al
 * incrustarlo y rechaza lo que no es un JPEG.
 *
 * Los datos del escaneo son seudoaleatorios y deterministas, así que el JPEG es
 * incompresible —lo que hace las pruebas de tamaño significativas— y siempre idéntico
 * entre ejecuciones.
 */

/** Tabla de cuantización mínima, con todos los valores a uno. */
const TABLA_CUANTIZACION = Array.from({ length: 64 }, () => 0x01)

/** Tabla de Huffman mínima válida. */
const TABLA_HUFFMAN = [
  0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
  ...Array.from({ length: 12 }, (_, indice) => indice),
]

/**
 * Genera un JPEG en escala de grises del lado indicado.
 *
 * El byte 0xFF se evita en los datos del escaneo: dentro de un flujo JPEG ese byte
 * introduce un marcador, y colocarlo por accidente produciría un archivo inválido.
 */
export function crearJpeg(lado: number, semillaInicial = 987654321): Uint8Array {
  const cabecera = [
    0xff, 0xd8,
    0xff, 0xdb, 0x00, 0x43, 0x00, ...TABLA_CUANTIZACION,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (lado >> 8) & 0xff, lado & 0xff,
    (lado >> 8) & 0xff, lado & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xc4, 0x00, 0x1f, 0x00, ...TABLA_HUFFMAN,
    0xff, 0xc4, 0x00, 0x1f, 0x10, ...TABLA_HUFFMAN,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x00,
  ]

  // Se escribe directamente en un búfer del tamaño exacto. La primera versión
  // acumulaba los datos en un array y hacía `new Uint8Array([...cabecera, ...datos])`,
  // y con una imagen de 4000 píxeles de lado eso son dieciséis millones de elementos
  // que hay que esparcir: tardaba más de diez segundos y agotaba la paciencia de las
  // pruebas. Reservar y rellenar es inmediato.
  const pixeles = lado * lado
  const salida = new Uint8Array(cabecera.length + pixeles + 2)

  salida.set(cabecera, 0)

  let semilla = semillaInicial

  for (let indice = 0; indice < pixeles; indice += 1) {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
    const byte = semilla & 0xff
    salida[cabecera.length + indice] = byte === 0xff ? 0xfe : byte
  }

  salida[cabecera.length + pixeles] = 0xff
  salida[cabecera.length + pixeles + 1] = 0xd9

  return salida
}

/**
 * Adaptador de prueba que devuelve JPEG reales más pequeños.
 *
 * No es un doble que finja el resultado: genera un JPEG auténtico del tamaño de
 * destino, así que el canal de sustitución se ejerce de verdad —los bytes se
 * reemplazan, el diccionario se actualiza y el documento se vuelve a abrir—. Lo único
 * que no se ejercita es la descodificación del navegador, que es precisamente lo que
 * no existe en Node.
 */
export function crearAdaptadorPrueba(opciones: {
  /** Fuerza que no se pueda descodificar, para probar ese camino. */
  readonly falla?: boolean
  /** Devuelve algo más grande que el original, para probar el descarte. */
  readonly devuelveMasGrande?: boolean
  /** Registra cada llamada, para comprobar el orden y el número. */
  readonly registro?: { readonly llamadas: number[] }
} = {}) {
  return {
    recomprimir: async (
      bytes: Uint8Array,
      destino: { readonly ancho: number; readonly alto: number },
      calidad: number,
    ): Promise<Uint8Array | null> => {
      opciones.registro?.llamadas.push(destino.ancho)

      if (opciones.falla === true) {
        return null
      }

      if (opciones.devuelveMasGrande === true) {
        // El doble del original, para comprobar que no se sustituye.
        const grande = new Uint8Array(bytes.byteLength * 2)
        grande.set(crearJpeg(8), 0)

        return grande
      }

      // El lado se escala también por la calidad, porque es lo que hace un codificador
      // de verdad: recodificar a calidad 0,6 produce menos bytes aunque las medidas no
      // cambien. Sin esto, el doble no reflejaría el caso «misma medida, menos
      // calidad», que es justo el que aplica el perfil ligero a una imagen que ya cabe.
      const lado = Math.max(
        1,
        Math.round(Math.min(destino.ancho, destino.alto) * Math.sqrt(calidad)),
      )

      return crearJpeg(lado)
    },
  }
}

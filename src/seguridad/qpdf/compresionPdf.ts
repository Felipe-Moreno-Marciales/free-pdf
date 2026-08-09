/**
 * Compresión de documentos PDF con qpdf.
 *
 * Módulo puro: construye los argumentos y evalúa el resultado. Se prueba entero sin
 * WebAssembly, y las pruebas del motor real comprueban aparte que las cifras que aquí
 * se dan por buenas son las que qpdf produce.
 *
 * ## Lo que esta compresión es, y lo que no
 *
 * Es **optimización estructural**. qpdf reorganiza el documento: mete los objetos en
 * flujos comprimidos, elimina lo que no se referencia y recomprime los flujos que
 * usan Flate. Nada de eso toca el contenido: el texto sigue siendo el mismo texto y
 * las imágenes siguen siendo las mismas imágenes, con sus mismos píxeles.
 *
 * **No es reducción de imágenes.** qpdf no recodifica un JPEG, no baja su calidad y no
 * reduce su resolución. Está medido, no supuesto: en las pruebas del motor real, un
 * documento de 93 KB cuyos 90 KB eran un JPEG solo bajó un 1,5 %, y el `DCTDecode`
 * seguía intacto en el resultado.
 *
 * ## Cifras medidas con qpdf 12.2.0
 *
 * | Documento                              | Mejor reducción |
 * | -------------------------------------- | --------------- |
 * | Texto, sin flujos de objetos           | −49,5 %         |
 * | Imagen en Flate mal comprimida         | −37,2 %         |
 * | JPEG incrustado (`DCTDecode`)          | −1,5 %          |
 * | Ya optimizado (con flujos de objetos)  | −1,9 %          |
 *
 * De donde sale casi todo el ahorro es de `--object-streams=generate`. Por sí solo da
 * el −48,7 % en el documento de texto; `--compress-streams=y` sin él no cambia nada,
 * porque ya es el comportamiento de partida.
 *
 * ## Dos opciones que no se ofrecen, y por qué
 *
 * - `--linearize` **hace el archivo más grande**: +96,9 % en el documento ya
 *   optimizado. Sirve para abrir rápido por red, no para comprimir, y ofrecerla en una
 *   herramienta llamada «Comprimir» sería engañoso.
 * - `--normalize-content=y` lo infla un +472 %. Descomprime los flujos de contenido
 *   para poder leerlos, que es lo contrario de lo que se busca.
 */

/** Perfil de compresión. */
export type PerfilCompresion = 'estructural' | 'maxima'

/**
 * Nivel de compresión Flate que usa el perfil máximo.
 *
 * Es el máximo que admite zlib. Se llega a él a propósito: la diferencia entre el
 * nivel de partida y el 9 es lo único que aporta `--recompress-flate`, y en el
 * documento con imagen en Flate esa diferencia fue de un 11,7 % a un 37,2 %.
 */
export const NIVEL_FLATE_MAXIMO = 9

/** Describe un perfil para la interfaz. */
export function describirPerfil(perfil: PerfilCompresion): string {
  return perfil === 'estructural' ? 'Estructural' : 'Máxima'
}

/** Explica qué hace cada perfil, con las cifras medidas. */
export function explicarPerfil(perfil: PerfilCompresion): string {
  return perfil === 'estructural'
    ? 'Reagrupa los objetos del documento en flujos comprimidos. Es de donde sale casi todo el ahorro y no vuelve a comprimir nada que ya estuviera comprimido.'
    : 'Además de reagrupar los objetos, vuelve a comprimir los flujos con el nivel más alto. Tarda más y solo aporta algo si el documento tenía flujos mal comprimidos.'
}

/**
 * Argumentos para comprimir un documento.
 *
 * `--object-streams=generate` es el que de verdad comprime. El perfil máximo añade la
 * recompresión de flujos con el nivel más alto, que solo sirve si el documento traía
 * flujos comprimidos flojamente.
 */
export function construirArgumentosCompresion(
  rutaEntrada: string,
  rutaSalida: string,
  perfil: PerfilCompresion = 'estructural',
): readonly string[] {
  const argumentos = [
    rutaEntrada,
    rutaSalida,
    '--object-streams=generate',
    '--compress-streams=y',
  ]

  if (perfil === 'maxima') {
    argumentos.push(
      '--recompress-flate',
      `--compression-level=${NIVEL_FLATE_MAXIMO}`,
    )
  }

  return argumentos
}

/** Argumentos para averiguar qué filtros de imagen usa un documento. */
export function construirArgumentosFiltros(
  rutaEntrada: string,
): readonly string[] {
  return ['--show-object=trailer', rutaEntrada]
}

/** Cómo terminó una compresión. */
export type DesenlaceCompresion =
  /** El documento es más pequeño y se entrega. */
  | 'reducido'
  /** No se consiguió reducir nada apreciable: se conserva el original. */
  | 'ya-optimizado'
  /** El resultado sería mayor que el original: se conserva el original. */
  | 'contraproducente'

/**
 * Reducción por debajo de la cual no merece la pena cambiar de archivo.
 *
 * Medio por ciento. Por debajo de eso, entregar un archivo distinto solo sirve para
 * que la gente crea que ha ganado algo, y además el documento nuevo pierde cualquier
 * particularidad del original que no fuera estrictamente necesaria.
 */
export const REDUCCION_MINIMA_UTIL = 0.005

/** Medidas de una compresión, para poder decidir y para poder informar. */
export interface MedidasCompresion {
  readonly tamanoOriginal: number
  readonly tamanoResultante: number
}

/**
 * Fracción de reducción conseguida, entre 0 y 1.
 *
 * Puede ser negativa si el resultado es mayor, y eso es información útil: significa
 * que la compresión ha sido contraproducente y hay que conservar el original.
 */
export function calcularReduccion(medidas: MedidasCompresion): number {
  if (medidas.tamanoOriginal <= 0) {
    return 0
  }

  return 1 - medidas.tamanoResultante / medidas.tamanoOriginal
}

/** Porcentaje de reducción, redondeado a una cifra decimal. */
export function calcularPorcentaje(medidas: MedidasCompresion): number {
  return Math.round(calcularReduccion(medidas) * 1000) / 10
}

/**
 * Decide qué hacer con el resultado.
 *
 * La regla es sencilla y no admite matices: **si el archivo no es más pequeño, no se
 * entrega como comprimido**. Se dice lo que ha pasado y se conserva el original, que
 * sigue intacto porque nunca se toca.
 */
export function decidirDesenlace(
  medidas: MedidasCompresion,
): DesenlaceCompresion {
  const reduccion = calcularReduccion(medidas)

  if (reduccion < 0) {
    return 'contraproducente'
  }

  if (reduccion < REDUCCION_MINIMA_UTIL) {
    return 'ya-optimizado'
  }

  return 'reducido'
}

/** `true` cuando el archivo comprimido es el que se debe descargar. */
export function seEntregaElComprimido(
  desenlace: DesenlaceCompresion,
): boolean {
  return desenlace === 'reducido'
}

/** Nombre del documento comprimido. */
export const NOMBRE_COMPRIMIDO = 'free-pdf-comprimido.pdf'

/** Resultado completo de comprimir, con todo lo necesario para ser honestos. */
export interface ResumenCompresion {
  readonly desenlace: DesenlaceCompresion
  readonly tamanoOriginal: number
  readonly tamanoResultante: number
  /** Porcentaje de reducción; negativo si el resultado era mayor. */
  readonly porcentaje: number
  readonly perfil: PerfilCompresion
  /** Páginas del original, o `null` si no se pudieron contar. */
  readonly paginasAntes: number | null
  /** Páginas del resultado. */
  readonly paginasDespues: number
  /** `true` cuando el documento contiene imágenes que qpdf no puede tocar. */
  readonly tieneImagenesIntocables: boolean
}

/**
 * Explica el desenlace en español, sin adornarlo.
 *
 * Es el texto principal que se lee en la interfaz, así que dice el porcentaje real
 * —incluido el caso de que no haya habido reducción— y no promete nada.
 */
export function explicarCompresion(resumen: ResumenCompresion): string {
  const partes: string[] = []

  switch (resumen.desenlace) {
    case 'reducido':
      partes.push(
        `El documento se ha reducido un ${resumen.porcentaje.toFixed(1)} %.`,
      )
      break

    case 'ya-optimizado':
      partes.push(
        'Este documento ya estaba optimizado: la reorganización de su estructura no ha conseguido reducirlo de forma apreciable.',
        'Se conserva el original, que no se ha modificado.',
      )
      break

    case 'contraproducente':
      partes.push(
        `Comprimirlo habría dejado el archivo un ${Math.abs(resumen.porcentaje).toFixed(1)} % más grande, así que no se entrega.`,
        'Se conserva el original, que no se ha modificado.',
      )
      break
  }

  if (resumen.paginasAntes !== null && resumen.paginasAntes !== resumen.paginasDespues) {
    partes.push(
      `Atención: el original tenía ${resumen.paginasAntes} páginas y el resultado ${resumen.paginasDespues}.`,
    )
  }

  if (
    resumen.tieneImagenesIntocables &&
    resumen.desenlace !== 'reducido'
  ) {
    partes.push(
      'El documento contiene imágenes JPEG, y esta compresión no las toca: solo reorganiza la estructura. Si el peso viene de las imágenes, comprimir aquí no va a ayudar.',
    )
  }

  return partes.join(' ')
}

/**
 * Aviso sobre las imágenes, cuando el documento las tiene.
 *
 * Se muestra **antes** de comprimir, no después: quien tiene un PDF de veinte
 * megabytes lleno de fotografías merece saber de antemano que esta herramienta no es
 * la que va a resolverlo, en lugar de descubrirlo al ver un 1 % de reducción.
 */
export function avisarSobreImagenes(): string {
  return 'Este documento contiene imágenes JPEG. La compresión reorganiza la estructura del archivo, pero no recodifica las imágenes ni baja su calidad, así que si el peso viene de ellas la reducción será pequeña.'
}

/** Explica la diferencia entre los dos tipos de reducción, para la interfaz. */
export const EXPLICACION_TIPOS_COMPRESION = {
  estructural:
    'Reorganizar el archivo: agrupar los objetos en flujos comprimidos y recomprimir los que estuvieran flojos. No cambia ni un píxel ni una letra del contenido, y es lo único que hace esta herramienta.',
  imagenes:
    'Recodificar las imágenes con menos calidad o menos resolución. Reduce mucho más en documentos con fotografías, pero degrada el contenido de forma irreversible. Esta herramienta no lo hace.',
} as const

/**
 * Detecta si un documento declara imágenes con filtros que qpdf no recomprime.
 *
 * Se busca en los bytes del documento, sin descodificarlo: los nombres de filtro son
 * texto plano en el diccionario de cada imagen, y basta con encontrarlos para saber
 * que hay contenido que la compresión estructural no va a tocar.
 *
 * No es un análisis exhaustivo y no pretende serlo: sirve para poder avisar, y
 * equivocarse por exceso de aviso es preferible a no avisar.
 */
export function detectarImagenesIntocables(contenido: Uint8Array): boolean {
  // Solo se examina el principio del documento: los diccionarios de imagen aparecen
  // repartidos, y recorrer cien megabytes buscando una cadena no aporta nada frente a
  // recorrer el primer megabyte.
  const limite = Math.min(contenido.byteLength, 1_048_576)
  const texto = new TextDecoder('latin1').decode(
    contenido.subarray(0, limite),
  )

  return (
    texto.includes('DCTDecode') ||
    texto.includes('JPXDecode') ||
    texto.includes('JBIG2Decode')
  )
}

/**
 * Construcción y lectura de la inspección estructural de qpdf.
 *
 * Este módulo no interpreta el riesgo. Su única responsabilidad es pedir la
 * representación JSON documentada por qpdf y convertirla en un valor
 * desconocido que la capa de dominio validará después. Los datos de los flujos
 * se omiten de forma explícita: para detectar acciones, formularios y adjuntos
 * solo hacen falta sus diccionarios.
 */

/** Versión más reciente del formato JSON que soporta qpdf 12.2.0. */
export const VERSION_JSON_QPDF = 2

/**
 * Máximo admitido para el informe JSON antes de decodificarlo.
 *
 * El PDF puede ser mayor: este límite protege únicamente el objeto estructural
 * que qpdf devuelve y evita duplicar en memoria una cadena desproporcionada.
 */
export const TAMANO_MAXIMO_JSON_INSPECCION = 16 * 1024 * 1024

/** Operaciones mínimas de MEMFS necesarias para leer el informe. */
export interface SistemaArchivosJsonInspeccion {
  readonly stat: (ruta: string) => { readonly size: number }
  readonly readFile: (ruta: string) => Uint8Array
}

/** Resultado de localizar y medir el JSON antes de copiarlo desde MEMFS. */
export type ResultadoLecturaJsonInspeccion =
  | { readonly estado: 'leido'; readonly contenido: Uint8Array }
  | { readonly estado: 'ausente' }
  | { readonly estado: 'demasiado-grande' }

/** Claves de primer nivel imprescindibles para el inspector. */
export const CLAVES_JSON_INSPECCION = [
  'pages',
  'acroform',
  'attachments',
  'encrypt',
  'qpdf',
] as const

/**
 * Construye la orden de inspección compatible con qpdf 12.2.0.
 *
 * `--json-output=2` escribe en el sistema de archivos virtual. Esto evita que el
 * JSON pase por la consola interceptada y permite medirlo antes de crear una
 * cadena. `--json-stream-data=none` impide incluir contenidos de streams, como
 * JavaScript, imágenes o archivos adjuntos.
 */
export function construirArgumentosInspeccionSeguridad(
  rutaEntrada: string,
  rutaSalidaJson: string,
): readonly string[] {
  return [
    rutaEntrada,
    `--json-output=${VERSION_JSON_QPDF}`,
    '--json-stream-data=none',
    ...CLAVES_JSON_INSPECCION.map((clave) => `--json-key=${clave}`),
    rutaSalidaJson,
  ]
}

/** `true` cuando qpdf produjo una salida utilizable, con o sin advertencias. */
export function esEjecucionJsonUtilizable(codigo: number): boolean {
  return codigo === 0 || codigo === 3
}

/** `true` cuando qpdf informa de que hace falta una contraseña. */
export function necesitaContrasenaParaInspeccionar(
  mensajes: readonly string[],
): boolean {
  return mensajes.some((mensaje) => {
    const texto = mensaje.toLowerCase()
    return (
      texto.includes('invalid password') || texto.includes('password required')
    )
  })
}

/**
 * Lee el JSON solo después de comprobar su tamaño mediante `stat`.
 *
 * `FS.readFile` crea una copia completa. Separar este paso garantiza que una
 * salida que exceda el presupuesto se rechace sin reservar esa segunda copia.
 */
export function leerSalidaJsonInspeccion(
  sistemaArchivos: SistemaArchivosJsonInspeccion,
  ruta: string,
): ResultadoLecturaJsonInspeccion {
  let tamano: number

  try {
    tamano = sistemaArchivos.stat(ruta).size
  } catch {
    return { estado: 'ausente' }
  }

  if (!Number.isSafeInteger(tamano) || tamano < 0) {
    return { estado: 'ausente' }
  }

  if (tamano > TAMANO_MAXIMO_JSON_INSPECCION) {
    return { estado: 'demasiado-grande' }
  }

  try {
    return { estado: 'leido', contenido: sistemaArchivos.readFile(ruta) }
  } catch {
    return { estado: 'ausente' }
  }
}

/**
 * Decodifica y parsea el JSON producido por qpdf como `unknown`.
 *
 * El límite se comprueba antes de crear la cadena. El decodificador estricto
 * evita aceptar bytes UTF-8 rotos, y el resultado no se fuerza a ninguna
 * interfaz: la validación defensiva corresponde al analizador estructural.
 */
export function leerJsonInspeccion(contenido: Uint8Array): unknown {
  if (contenido.byteLength === 0) {
    throw new Error('qpdf no produjo un informe de inspección.')
  }

  if (contenido.byteLength > TAMANO_MAXIMO_JSON_INSPECCION) {
    throw new Error(
      'La estructura del PDF es demasiado grande para inspeccionarla de forma segura.',
    )
  }

  let texto: string

  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(contenido)
  } catch (error) {
    throw new Error('qpdf produjo un informe de inspección no válido.', {
      cause: error,
    })
  }

  try {
    return JSON.parse(texto) as unknown
  } catch (error) {
    throw new Error('qpdf produjo un informe de inspección no válido.', {
      cause: error,
    })
  }
}

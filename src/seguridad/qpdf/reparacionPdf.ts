/**
 * Reparación de documentos PDF dañados con qpdf.
 *
 * Todo lo de este módulo es puro: construye los argumentos que se le pasan a qpdf e
 * interpreta lo que qpdf escribe. Así se puede probar entero sin WebAssembly, y las
 * pruebas del motor real comprueban aparte que qpdf se comporta como aquí se supone.
 *
 * **Qué es reparar y qué no.** Reparar consiste en que qpdf lea el documento y lo
 * vuelva a escribir entero: tabla de referencias cruzadas nueva, objetos renumerados
 * y estructura normalizada. Sirve cuando el archivo se puede leer pero está
 * desordenado, y el resultado lo aceptan lectores que rechazaban el original.
 *
 * **Lo que qpdf no hace, comprobado con el motor real y no supuesto.** Si qpdf no
 * consigue leer el documento, no hay reparación posible: no adivina los datos que
 * faltan. En las pruebas de `motorQpdf.prueba.ts` se mide exactamente eso:
 *
 * - Bytes de basura antes de `%PDF`: qpdf los ignora y reescribe un archivo limpio.
 *   Es el caso en el que reparar sirve de verdad.
 * - `startxref` borrado, su desplazamiento falseado o las entradas de la tabla
 *   corrompidas: qpdf termina con código 2 y **no escribe nada**. No lo intenta.
 *
 * Por eso la herramienta nunca promete recuperar un archivo: lo intenta, mide el
 * resultado y dice qué ha salido, incluidas las páginas que se hayan perdido.
 *
 * **Y un matiz sobre el diagnóstico.** «Sin problemas» significa que *qpdf* no
 * encontró errores, no que todos los lectores vayan a aceptar el archivo: el caso de
 * la basura al principio se diagnostica como intacto y sin embargo repararlo mejora
 * su compatibilidad. Se dice así en la interfaz en lugar de dar a entender que un
 * diagnóstico limpio hace inútil la reparación.
 */

/** Cómo terminó el diagnóstico de un documento. */
export type EstadoDocumento =
  /** qpdf no encontró nada que objetar. */
  | 'intacto'
  /** Se puede leer, pero qpdf avisó de irregularidades. */
  | 'con-advertencias'
  /** Está dañado y qpdf tuvo que reconstruir la estructura. */
  | 'danado'
  /** No se pudo leer de ninguna manera. */
  | 'irrecuperable'

/** Clase de irregularidad encontrada. */
export type ClaseHallazgo =
  | 'referencias-cruzadas'
  | 'objeto-danado'
  | 'flujo-danado'
  | 'paginas'
  | 'cifrado'
  | 'estructura'
  | 'otra'

/** Una irregularidad concreta que qpdf comunicó. */
export interface HallazgoReparacion {
  readonly clase: ClaseHallazgo
  /** El mensaje de qpdf, ya depurado. */
  readonly mensaje: string
}

/** Diagnóstico completo de un documento. */
export interface DiagnosticoPdf {
  readonly estado: EstadoDocumento
  /** Irregularidades encontradas, sin repetidos. */
  readonly hallazgos: readonly HallazgoReparacion[]
  /**
   * `true` cuando qpdf tuvo que reconstruir la tabla de referencias cruzadas.
   * Es la señal más clara de que el archivo estaba dañado de verdad.
   */
  readonly reconstruyoReferencias: boolean
  /** `true` cuando el documento está cifrado y hace falta la contraseña. */
  readonly necesitaContrasena: boolean
}

/**
 * Nivel de reescritura que se aplica al reparar.
 *
 * `conservador` toca lo mínimo: reconstruye la estructura y deja los flujos como
 * están. Es lo que se quiere en un documento dañado, porque cada transformación
 * adicional es una oportunidad más de perder algo.
 *
 * `completo` regenera además los flujos de objetos, lo que suele reducir el tamaño
 * pero reescribe más del archivo.
 */
export type NivelReparacion = 'conservador' | 'completo'

/** Describe cada nivel para la interfaz. */
export function describirNivel(nivel: NivelReparacion): string {
  return nivel === 'conservador'
    ? 'Conservadora'
    : 'Completa'
}

/** Explica qué hace cada nivel. */
export function explicarNivel(nivel: NivelReparacion): string {
  return nivel === 'conservador'
    ? 'Reconstruye la estructura y deja los flujos intactos. Es la opción recomendada para un archivo dañado.'
    : 'Reconstruye la estructura y regenera los flujos de objetos. Suele dar un archivo menor, pero reescribe más.'
}

/**
 * Argumentos para comprobar un documento sin modificarlo.
 *
 * `--check` recorre el archivo entero y describe lo que encuentra. Es lo que se usa
 * para diagnosticar: `--is-encrypted` y `--requires-password` no sirven aquí, porque
 * solo responden a esa pregunta concreta y con códigos de salida que se confunden con
 * los de error.
 */
export function construirArgumentosComprobacion(
  rutaEntrada: string,
): readonly string[] {
  return ['--check', rutaEntrada]
}

/**
 * Argumentos para reparar un documento.
 *
 * Una invocación de qpdf con entrada y salida **ya reconstruye** el archivo: qpdf
 * siempre reescribe la tabla de referencias cruzadas y recorre los objetos
 * alcanzables. No hay una opción `--repair`; la reparación es el efecto de volver a
 * escribir el documento con un motor que sabe recuperarse de una estructura rota.
 *
 * No se usa `--replace-input`, que sobrescribiría la entrada: aquí se trabaja sobre
 * un sistema de archivos virtual y conviene conservar el original para poder comparar
 * el número de páginas antes y después.
 */
export function construirArgumentosReparacion(
  rutaEntrada: string,
  rutaSalida: string,
  nivel: NivelReparacion = 'conservador',
): readonly string[] {
  const argumentos = [rutaEntrada, rutaSalida]

  if (nivel === 'completo') {
    argumentos.push('--object-streams=generate')
  } else {
    // Se declara explícitamente aunque sea el comportamiento de partida: deja claro
    // en el propio comando que no se está recomprimiendo nada.
    argumentos.push('--stream-data=preserve')
  }

  return argumentos
}

/** Argumentos para contar las páginas de un documento. */
export function construirArgumentosRecuentoPaginas(
  rutaEntrada: string,
): readonly string[] {
  return ['--show-npages', rutaEntrada]
}

/** Frases de qpdf que delatan cada clase de irregularidad. */
const SENALES: readonly (readonly [ClaseHallazgo, readonly string[]])[] = [
  [
    'referencias-cruzadas',
    [
      'reconstruct',
      'cross-reference',
      'xref',
      'startxref',
      'file is damaged',
    ],
  ],
  [
    'objeto-danado',
    [
      'object stream',
      'expected dictionary',
      'invalid object',
      'object is not',
      'dangling reference',
      'unexpected object',
      // El mensaje que qpdf da de verdad cuando un desplazamiento no apunta a un
      // objeto. Está comprobado con el motor real, no deducido de la documentación.
      'expected n n obj',
    ],
  ],
  [
    'flujo-danado',
    [
      'stream length',
      'inflate',
      'stream data',
      'unexpected eof',
      'premature',
    ],
  ],
  ['paginas', ['page', '/pages', 'page tree']],
  ['cifrado', ['encrypt', 'password']],
  [
    'estructura',
    ['trailer', '/root', 'catalog', 'not a pdf file', 'header'],
  ],
]

/** Clasifica un mensaje de qpdf. */
export function clasificarMensaje(mensaje: string): ClaseHallazgo {
  const texto = mensaje.toLowerCase()

  for (const [clase, senales] of SENALES) {
    if (senales.some((senal) => texto.includes(senal))) {
      return clase
    }
  }

  return 'otra'
}

/**
 * Mensajes que qpdf escribe siempre y que no indican ningún problema.
 *
 * Filtrarlos importa: si se dejaran pasar, un documento perfectamente sano
 * aparecería con «irregularidades» y nadie volvería a fiarse del diagnóstico.
 */
const RUIDO: readonly string[] = [
  'no syntax or stream encoding errors found',
  // qpdf parte esa frase en dos líneas, y la continuación llega como un mensaje
  // aparte. Sin filtrarla también, un documento perfectamente sano aparecería con
  // una «irregularidad» que en realidad es la coletilla de «todo correcto».
  'the file may still contain',
  'errors that qpdf cannot detect',
  'checking',
  'pdf version',
  'file is linearized',
  'file is not linearized',
  // qpdf informa del cifrado incluso cuando no lo hay. Sin filtrar esta línea, un
  // documento sano aparecería con un hallazgo de la clase «cifrado».
  'file is not encrypted',
  'no errors found',
]

/** Decide si un mensaje aporta información. */
export function esMensajeUtil(mensaje: string): boolean {
  const limpio = mensaje.trim()

  if (limpio === '') {
    return false
  }

  const texto = limpio.toLowerCase()

  return !RUIDO.some((ruido) => texto.includes(ruido))
}

/**
 * Interpreta el resultado de comprobar un documento.
 *
 * Los códigos de salida de qpdf son: 0 correcto, 2 hubo errores, 3 solo
 * advertencias. Se combinan con lo que qpdf escribió, porque el código solo no
 * distingue un archivo reconstruido con éxito de uno intacto.
 */
export function interpretarComprobacion(
  codigoSalida: number,
  mensajes: readonly string[],
): DiagnosticoPdf {
  const utiles = mensajes.filter(esMensajeUtil)
  const texto = utiles.join('\n').toLowerCase()

  const reconstruyoReferencias =
    texto.includes('reconstruct') ||
    texto.includes('file is damaged') ||
    texto.includes('startxref')

  // Se busca la frase afirmativa completa a propósito. Con un `includes('encrypt')`
  // más suelto, el «File is not encrypted» que qpdf escribe en todos los documentos
  // sanos haría creer que hace falta una contraseña.
  const necesitaContrasena =
    texto.includes('invalid password') ||
    texto.includes('password required') ||
    texto.includes('file is encrypted')

  const hallazgos = reunirHallazgos(utiles)

  return {
    estado: deducirEstado(codigoSalida, hallazgos, reconstruyoReferencias),
    hallazgos,
    reconstruyoReferencias,
    necesitaContrasena,
  }
}

/** Agrupa los mensajes útiles en hallazgos sin repetidos. */
export function reunirHallazgos(
  mensajes: readonly string[],
): readonly HallazgoReparacion[] {
  const vistos = new Set<string>()
  const hallazgos: HallazgoReparacion[] = []

  for (const mensaje of mensajes) {
    const limpio = mensaje.trim()
    const clave = limpio.toLowerCase()

    if (vistos.has(clave)) {
      continue
    }

    vistos.add(clave)
    hallazgos.push({ clase: clasificarMensaje(limpio), mensaje: limpio })
  }

  return hallazgos
}

/** Decide el estado a partir del código de salida y de los hallazgos. */
function deducirEstado(
  codigoSalida: number,
  hallazgos: readonly HallazgoReparacion[],
  reconstruyoReferencias: boolean,
): EstadoDocumento {
  // Código 2 con nada legible: qpdf no pudo abrirlo.
  if (codigoSalida === 2 && hallazgos.length === 0) {
    return 'irrecuperable'
  }

  if (reconstruyoReferencias) {
    return 'danado'
  }

  if (codigoSalida === 2) {
    return 'danado'
  }

  if (codigoSalida === 3 || hallazgos.length > 0) {
    return 'con-advertencias'
  }

  return 'intacto'
}

/** Describe un estado para mostrarlo. */
export function describirEstado(estado: EstadoDocumento): string {
  switch (estado) {
    case 'intacto':
      return 'Sin problemas detectados'
    case 'con-advertencias':
      return 'Se puede leer, con irregularidades'
    case 'danado':
      return 'Dañado'
    case 'irrecuperable':
      return 'No se pudo leer'
  }
}

/** Explica un estado con algo más de detalle. */
export function explicarEstado(estado: EstadoDocumento): string {
  switch (estado) {
    case 'intacto':
      return 'qpdf ha recorrido el documento y no ha encontrado errores de sintaxis ni de codificación. Repararlo no va a mejorar nada, aunque puedes hacerlo si quieres normalizar su estructura.'
    case 'con-advertencias':
      return 'El documento se puede abrir, pero qpdf ha señalado irregularidades. Repararlo suele dejarlo en un estado más limpio y compatible con más lectores.'
    case 'danado':
      return 'La estructura del documento está dañada y qpdf ha tenido que reconstruirla para poder leerlo. Repararlo escribe esa versión reconstruida en un archivo nuevo.'
    case 'irrecuperable':
      return 'qpdf no ha conseguido leer el documento de ninguna manera. No hay nada que se pueda recuperar de este archivo.'
  }
}

/** Nombre del documento reparado. */
export const NOMBRE_REPARADO = 'free-pdf-reparado.pdf'

/**
 * Explica en español qué implica cada clase de hallazgo.
 *
 * Es el texto principal que se lee en la interfaz. El mensaje original de qpdf va
 * aparte, dentro de los detalles técnicos: es más preciso, pero está en inglés y no
 * puede ser lo único que se ofrezca.
 */
export function explicarClaseHallazgo(clase: ClaseHallazgo): string {
  switch (clase) {
    case 'referencias-cruzadas':
      return 'El índice que dice dónde está cada objeto del documento no cuadra. Es el daño más habitual y el que impide que muchos lectores abran el archivo.'
    case 'objeto-danado':
      return 'Uno de los objetos internos no está donde el documento dice que debería estar, o no tiene la forma esperada.'
    case 'flujo-danado':
      return 'Los datos comprimidos de alguna parte del documento no se pueden descomprimir del todo. Puede afectar a una imagen o a un bloque de texto.'
    case 'paginas':
      return 'La estructura que organiza las páginas tiene alguna irregularidad.'
    case 'cifrado':
      return 'El documento está protegido con contraseña, así que no se puede leer su contenido para repararlo.'
    case 'estructura':
      return 'Falta o está mal alguna de las piezas básicas del archivo, como la cabecera o la referencia al catálogo del documento.'
    case 'otra':
      return 'qpdf ha señalado algo que no encaja en ninguna de las categorías anteriores. El mensaje original tiene el detalle.'
  }
}

/** Describe una clase de hallazgo para mostrarla. */
export function describirClaseHallazgo(clase: ClaseHallazgo): string {
  switch (clase) {
    case 'referencias-cruzadas':
      return 'Tabla de referencias cruzadas'
    case 'objeto-danado':
      return 'Objeto dañado'
    case 'flujo-danado':
      return 'Flujo de datos dañado'
    case 'paginas':
      return 'Árbol de páginas'
    case 'cifrado':
      return 'Cifrado'
    case 'estructura':
      return 'Estructura del documento'
    case 'otra':
      return 'Otra irregularidad'
  }
}

/**
 * Resultado de reparar, con lo que hace falta para ser honestos sobre el desenlace.
 */
export interface ResumenReparacion {
  /** Diagnóstico del documento **antes** de repararlo. */
  readonly diagnosticoPrevio: DiagnosticoPdf
  /** Diagnóstico del documento resultante. */
  readonly diagnosticoFinal: DiagnosticoPdf
  /** Páginas que tenía el original, o `null` si no se pudo contar. */
  readonly paginasAntes: number | null
  /** Páginas que tiene el resultado. */
  readonly paginasDespues: number
}

/**
 * Decide si merece la pena entregar el resultado.
 *
 * Un documento «reparado» que se queda sin páginas no está reparado: está vacío. Se
 * rechaza en lugar de entregar un archivo que parece correcto y no contiene nada.
 */
export function laReparacionSirve(resumen: ResumenReparacion): boolean {
  if (resumen.paginasDespues <= 0) {
    return false
  }

  return resumen.diagnosticoFinal.estado !== 'irrecuperable'
}

/**
 * Explica el desenlace de una reparación, sin adornarlo.
 *
 * Si se perdieron páginas se dice, con el número exacto. Es la información que
 * de verdad importa y la que una herramienta honesta no puede ocultar.
 */
export function explicarResultado(resumen: ResumenReparacion): string {
  const partes: string[] = []

  const perdidas =
    resumen.paginasAntes === null
      ? 0
      : Math.max(0, resumen.paginasAntes - resumen.paginasDespues)

  partes.push(
    `El documento reparado tiene ${resumen.paginasDespues} ${
      resumen.paginasDespues === 1 ? 'página' : 'páginas'
    }.`,
  )

  if (resumen.paginasAntes === null) {
    partes.push(
      'No se pudo contar cuántas páginas tenía el original, porque estaba demasiado dañado para leerlo.',
    )
  } else if (perdidas > 0) {
    partes.push(
      `El original declaraba ${resumen.paginasAntes}, así que ${perdidas} ${
        perdidas === 1 ? 'no se pudo recuperar' : 'no se pudieron recuperar'
      }: esa información no estaba en el archivo.`,
    )
  } else {
    partes.push('Se conservan todas las páginas del original.')
  }

  if (resumen.diagnosticoPrevio.reconstruyoReferencias) {
    partes.push('Se reconstruyó la tabla de referencias cruzadas.')
  }

  if (resumen.diagnosticoFinal.estado === 'intacto') {
    partes.push('La comprobación posterior no encuentra ningún error.')
  } else if (resumen.diagnosticoFinal.hallazgos.length > 0) {
    partes.push(
      `Quedan ${resumen.diagnosticoFinal.hallazgos.length} ${
        resumen.diagnosticoFinal.hallazgos.length === 1
          ? 'irregularidad'
          : 'irregularidades'
      } que no se han podido corregir.`,
    )
  }

  return partes.join(' ')
}

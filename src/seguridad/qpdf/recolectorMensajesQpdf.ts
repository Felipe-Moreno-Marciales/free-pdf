/** Presupuesto máximo de la salida textual conservada por operación. */
export const LIMITES_MENSAJES_QPDF = {
  iniciales: 200,
  finales: 50,
  longitud: 2_048,
} as const

/** Captura acotada que conserva el inicio y el final de la salida de qpdf. */
export interface RecolectorMensajesQpdf {
  /** Descarta la operación anterior y registra los secretos de la siguiente. */
  readonly reiniciar: (secretos: readonly string[]) => void
  /** Añade una llamada de consola sin superar el presupuesto. */
  readonly recoger: (...partes: readonly unknown[]) => void
  /** Entrega la salida acotada y vuelve a dejar el recolector vacío. */
  readonly vaciar: () => readonly string[]
}

/** Cola FIFO que impide que dos invocaciones de qpdf compartan la consola. */
export interface ColaOperacionesQpdf {
  /** Ejecuta una operación cuando todas las anteriores han terminado. */
  readonly encolar: (operacion: () => Promise<void>) => Promise<void>
}

/**
 * Serializa operaciones aunque una de ellas falle.
 *
 * Cada instancia de qpdf tiene su propio MEMFS, pero la consola interceptada es
 * común a todo el Worker. La cola garantiza que `reiniciar`, `recoger` y `vaciar`
 * siempre pertenezcan a una sola operación.
 */
export function crearColaOperacionesQpdf(): ColaOperacionesQpdf {
  let ultima: Promise<void> = Promise.resolve()

  const encolar = (operacion: () => Promise<void>): Promise<void> => {
    const resultado = ultima.then(operacion, operacion)

    // La cola debe seguir disponible tras un fallo. El rechazo original se
    // conserva en `resultado` para que quien encoló la operación pueda observarlo.
    ultima = resultado.catch(() => undefined)
    return resultado
  }

  return { encolar }
}

/**
 * Sustituye secretos mientras copia como máximo `limite` caracteres.
 *
 * Se usa `indexOf` sobre la cadena original para no crear primero una copia
 * completa de una línea potencialmente enorme y truncarla solo después.
 */
function depurarYAcotar(
  texto: string,
  secretos: readonly string[],
  limite: number,
  marcador: string | null,
): string {
  if (
    marcador === null &&
    secretos.some((secreto) => secreto !== '' && texto.includes(secreto))
  ) {
    // No hay un marcador que pueda garantizar la redacción. Descartar la línea
    // completa es preferible a devolver aunque sea una parte del secreto.
    return ''
  }

  let salida = ''
  let posicion = 0

  while (salida.length < limite && posicion < texto.length) {
    let indiceSecreto = -1
    let secretoEncontrado = ''

    for (const secreto of secretos) {
      if (secreto === '') {
        continue
      }

      const indice = texto.indexOf(secreto, posicion)
      if (
        indice !== -1 &&
        (indiceSecreto === -1 ||
          indice < indiceSecreto ||
          (indice === indiceSecreto &&
            secreto.length > secretoEncontrado.length))
      ) {
        indiceSecreto = indice
        secretoEncontrado = secreto
      }
    }

    if (indiceSecreto === -1) {
      salida += texto.slice(posicion, posicion + limite - salida.length)
      break
    }

    salida += texto.slice(
      posicion,
      Math.min(indiceSecreto, posicion + limite - salida.length),
    )

    if (salida.length === limite) {
      break
    }

    salida += (marcador ?? '').slice(0, limite - salida.length)
    posicion = indiceSecreto + secretoEncontrado.length
  }

  return salida
}

/**
 * Elige un marcador que no pueda contener ninguno de los secretos.
 *
 * Un solo carácter ausente de todos ellos, repetido, también impide que un
 * secreto se reconstruya entre el texto conservado y el marcador. Se prefieren
 * símbolos visibles y se reserva el área de uso privado como respaldo. Si una
 * entrada excepcional contuviera todos los candidatos, se devuelve `null` y la
 * línea afectada se descarta.
 */
function crearMarcadorRedaccion(secretos: readonly string[]): string | null {
  const candidatosVisibles = ['█', '■', '◆', '●', '※', '¤', '§']

  for (const candidato of candidatosVisibles) {
    if (secretos.every((secreto) => !secreto.includes(candidato))) {
      return candidato.repeat(3)
    }
  }

  for (let codigo = 0xe000; codigo <= 0xf8ff; codigo += 1) {
    const candidato = String.fromCharCode(codigo)
    if (secretos.every((secreto) => !secreto.includes(candidato))) {
      return candidato.repeat(3)
    }
  }

  return null
}

/**
 * Crea un recolector resistente a documentos que hagan emitir miles de avisos.
 *
 * Los secretos se sustituyen antes de guardar o truncar cada mensaje. Se conservan
 * las primeras líneas para el diagnóstico y las últimas para no perder el código
 * final o un aviso de contraseña; todo lo intermedio se resume con un contador.
 */
export function crearRecolectorMensajesQpdf(): RecolectorMensajesQpdf {
  let iniciales: string[] = []
  let finales: string[] = []
  let omitidos = 0
  let secretosOperacion: readonly string[] = []
  let marcadorRedaccion: string | null = crearMarcadorRedaccion([])

  const reiniciar = (secretos: readonly string[]): void => {
    iniciales = []
    finales = []
    omitidos = 0
    secretosOperacion = secretos.filter((secreto) => secreto !== '')
    marcadorRedaccion = crearMarcadorRedaccion(secretosOperacion)
  }

  const recoger = (...partes: readonly unknown[]): void => {
    let mensaje = ''

    for (const parte of partes) {
      if (mensaje.length === LIMITES_MENSAJES_QPDF.longitud) {
        break
      }

      if (mensaje !== '') {
        mensaje += ' '
      }

      mensaje += depurarYAcotar(
        String(parte),
        secretosOperacion,
        LIMITES_MENSAJES_QPDF.longitud - mensaje.length,
        marcadorRedaccion,
      )
    }

    // Una llamada de consola puede repartir una contraseña entre argumentos. La
    // segunda pasada trabaja ya sobre un máximo de 2048 caracteres y cubre también
    // esa frontera sin volver a tocar las cadenas originales completas.
    mensaje = depurarYAcotar(
      mensaje,
      secretosOperacion,
      LIMITES_MENSAJES_QPDF.longitud,
      marcadorRedaccion,
    )

    if (iniciales.length < LIMITES_MENSAJES_QPDF.iniciales) {
      iniciales.push(mensaje)
      return
    }

    if (finales.length === LIMITES_MENSAJES_QPDF.finales) {
      finales.shift()
      omitidos += 1
    }

    finales.push(mensaje)
  }

  const vaciar = (): readonly string[] => {
    const resumen =
      omitidos > 0
        ? [
            depurarYAcotar(
              `Se omitieron ${omitidos} mensajes repetitivos de qpdf.`,
              secretosOperacion,
              LIMITES_MENSAJES_QPDF.longitud,
              marcadorRedaccion,
            ),
          ]
        : []
    const resultado = [...iniciales, ...resumen, ...finales]
    reiniciar([])
    return resultado
  }

  return { reiniciar, recoger, vaciar }
}

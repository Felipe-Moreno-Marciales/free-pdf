/**
 * Control de la cámara con las API nativas del navegador.
 *
 * Se usa exclusivamente `navigator.mediaDevices`, `MediaStream`, un elemento
 * `<video>` y un `canvas`. No interviene ningún servicio de cámara externo y
 * ninguna imagen sale del dispositivo.
 *
 * La lógica que no necesita una cámara real —traducir los errores, elegir la
 * cámara trasera y detener las pistas— vive aquí como funciones independientes,
 * de modo que se puede comprobar con objetos simulados sin acceder a una cámara
 * física.
 */

/** Estado del permiso de la cámara. */
export type EstadoCamara =
  | 'sin-solicitar'
  | 'solicitando'
  | 'activa'
  | 'denegada'
  | 'no-disponible'
  | 'error'

/** Cámara disponible en el dispositivo. */
export interface DispositivoCamara {
  /** Identificador que devuelve el navegador. */
  readonly id: string
  /** Nombre visible, o uno generado cuando el navegador no lo facilita. */
  readonly etiqueta: string
}

/** Pista de un flujo, reducida a lo que hace falta para detenerla. */
export interface PistaDetenible {
  stop: () => void
}

/** Flujo reducido a lo que hace falta para detenerlo. */
export interface FlujoDetenible {
  getTracks: () => readonly PistaDetenible[]
}

/** Resultado de traducir un error de la cámara. */
export interface ErrorCamaraTraducido {
  /** Estado al que pasa la herramienta. */
  readonly estado: EstadoCamara
  /** Mensaje en español listo para mostrar. */
  readonly mensaje: string
}

/** Palabras que delatan una cámara orientada hacia atrás. */
const PALABRAS_TRASERA = ['back', 'rear', 'trasera', 'environment', 'posterior']

/** Palabras que delatan una cámara frontal. */
const PALABRAS_FRONTAL = ['front', 'frontal', 'user', 'selfie']

/**
 * Comprueba si el navegador ofrece acceso a la cámara.
 *
 * `getUserMedia` solo existe en contextos seguros —HTTPS o `localhost`—, así que
 * esta comprobación también detecta que la página se esté sirviendo por HTTP.
 */
export function admiteCamara(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

/** Comprueba si se pueden enumerar los dispositivos disponibles. */
export function admiteEnumerarCamaras(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.enumerateDevices === 'function'
  )
}

/**
 * Detiene todas las pistas de un flujo.
 *
 * Detener las pistas es lo que apaga de verdad la cámara y hace desaparecer el
 * indicador del navegador. Se llama al cambiar de cámara, al terminar, al
 * restablecer y al salir de la herramienta.
 *
 * Los fallos se ignoran a propósito: si la pista ya estaba detenida no hay nada
 * que corregir y no debe interrumpirse la interfaz.
 */
export function detenerFlujo(flujo: FlujoDetenible | null): void {
  if (flujo === null) {
    return
  }

  try {
    for (const pista of flujo.getTracks()) {
      try {
        pista.stop()
      } catch {
        // La pista ya estaba detenida.
      }
    }
  } catch {
    // El flujo ya no está disponible.
  }
}

/**
 * Sustituye un flujo por otro deteniendo siempre el anterior.
 *
 * Devuelve el flujo nuevo, de modo que quien la llame no pueda olvidarse de
 * detener el que reemplaza.
 */
export function reemplazarFlujo<Flujo extends FlujoDetenible>(
  anterior: FlujoDetenible | null,
  siguiente: Flujo,
): Flujo {
  if (anterior !== siguiente) {
    detenerFlujo(anterior)
  }

  return siguiente
}

/**
 * Traduce un error de `getUserMedia` a un estado y un mensaje en español.
 *
 * Los nombres de los errores están fijados por la especificación, así que se
 * pueden distinguir con seguridad y explicar cada caso con precisión.
 */
export function traducirErrorCamara(error: unknown): ErrorCamaraTraducido {
  const nombre = leerNombreError(error)

  switch (nombre) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return {
        estado: 'denegada',
        mensaje:
          'No se concedió permiso para usar la cámara. Puedes concederlo desde los ajustes del navegador o, si lo prefieres, cargar fotografías desde tu dispositivo.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return {
        estado: 'no-disponible',
        mensaje:
          'No se encontró ninguna cámara en este dispositivo. Puedes cargar fotografías desde tus archivos.',
      }
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        estado: 'error',
        mensaje:
          'La cámara existe pero otra aplicación la está usando. Ciérrala y vuelve a intentarlo.',
      }
    case 'AbortError':
      return {
        estado: 'error',
        mensaje:
          'El navegador interrumpió el acceso a la cámara. Vuelve a intentarlo.',
      }
    default:
      return {
        estado: 'error',
        mensaje:
          'No se pudo acceder a la cámara. Comprueba que la página se esté viendo por HTTPS y vuelve a intentarlo.',
      }
  }
}

/** Lee el nombre de un error sin dar por hecho que sea una instancia de `Error`. */
function leerNombreError(error: unknown): string {
  if (error instanceof Error) {
    return error.name
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof (error as { name: unknown }).name === 'string'
  ) {
    return (error as { name: string }).name
  }

  return ''
}

/**
 * Elige la cámara que conviene usar de entrada.
 *
 * Se prefiere una cámara trasera, que es la que sirve para fotografiar un
 * documento, y se descartan explícitamente las frontales. Si no se puede
 * distinguir, se devuelve la primera de la lista.
 */
export function elegirCamaraTrasera(
  dispositivos: readonly DispositivoCamara[],
): DispositivoCamara | null {
  if (dispositivos.length === 0) {
    return null
  }

  const trasera = dispositivos.find((dispositivo) =>
    contienePalabra(dispositivo.etiqueta, PALABRAS_TRASERA),
  )
  if (trasera !== undefined) {
    return trasera
  }

  const noFrontal = dispositivos.find(
    (dispositivo) => !contienePalabra(dispositivo.etiqueta, PALABRAS_FRONTAL),
  )

  return noFrontal ?? dispositivos[0]
}

/** Comprueba si una etiqueta contiene alguna de las palabras indicadas. */
function contienePalabra(
  etiqueta: string,
  palabras: readonly string[],
): boolean {
  const normalizada = etiqueta.toLowerCase()

  return palabras.some((palabra) => normalizada.includes(palabra))
}

/** Construye la etiqueta visible de una cámara. */
export function etiquetarCamara(
  etiqueta: string,
  posicion: number,
): string {
  const limpia = etiqueta.trim()

  // Antes de conceder el permiso el navegador oculta las etiquetas, así que se
  // genera un nombre para que la lista siga siendo comprensible.
  return limpia === '' ? `Cámara ${posicion + 1}` : limpia
}

/**
 * Restricciones con las que se pide el flujo.
 *
 * Sin identificador se pide la cámara orientada hacia el entorno, que es la
 * trasera en los móviles. Con identificador se pide esa cámara concreta.
 * No se pide audio en ningún caso: grabar sonido no tendría sentido aquí y
 * obligaría a pedir un permiso adicional.
 */
export function construirRestricciones(
  idDispositivo: string | null,
): MediaStreamConstraints {
  if (idDispositivo !== null) {
    return {
      audio: false,
      video: { deviceId: { exact: idDispositivo } },
    }
  }

  return {
    audio: false,
    video: { facingMode: { ideal: 'environment' } },
  }
}

/** Pide acceso a la cámara indicada, o a la trasera si no se indica ninguna. */
export async function solicitarFlujo(
  idDispositivo: string | null = null,
): Promise<MediaStream> {
  if (!admiteCamara()) {
    throw new Error('NotSupportedError')
  }

  return await navigator.mediaDevices.getUserMedia(
    construirRestricciones(idDispositivo),
  )
}

/**
 * Enumera las cámaras disponibles.
 *
 * Devuelve una lista vacía si el navegador no permite enumerarlas, de modo que la
 * herramienta siga funcionando con la cámara predeterminada.
 */
export async function enumerarCamaras(): Promise<
  readonly DispositivoCamara[]
> {
  if (!admiteEnumerarCamaras()) {
    return []
  }

  try {
    const dispositivos = await navigator.mediaDevices.enumerateDevices()

    return dispositivos
      .filter((dispositivo) => dispositivo.kind === 'videoinput')
      .map((dispositivo, posicion) => ({
        id: dispositivo.deviceId,
        etiqueta: etiquetarCamara(dispositivo.label, posicion),
      }))
  } catch {
    return []
  }
}

/** Describe un estado de la cámara en español. */
export function describirEstadoCamara(estado: EstadoCamara): string {
  switch (estado) {
    case 'sin-solicitar':
      return 'La cámara está apagada. No se ha pedido ningún permiso todavía.'
    case 'solicitando':
      return 'Esperando el permiso de la cámara.'
    case 'activa':
      return 'La cámara está encendida.'
    case 'denegada':
      return 'No hay permiso para usar la cámara.'
    case 'no-disponible':
      return 'No hay ninguna cámara disponible.'
    case 'error':
      return 'La cámara no está disponible ahora mismo.'
  }
}

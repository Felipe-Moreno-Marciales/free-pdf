import type Tesseract from 'tesseract.js'
import {
  URL_IDIOMAS_OCR,
  URL_NUCLEOS_OCR,
  URL_TRABAJADOR_OCR,
} from './recursosOcr'

export type IdiomaOcr = 'espanol' | 'ingles' | 'espanol-ingles'

export interface MensajeProgresoMotor {
  readonly estado: string
  readonly fraccion: number
}

export interface MotorOcr {
  readonly reconocer: (imagen: Blob | Uint8Array) => Promise<string>
  /** Reconoce palabras conservando sus cajas en píxeles, cuando el motor lo admite. */
  readonly reconocerPalabras?: (
    imagen: Blob | Uint8Array,
  ) => Promise<ResultadoPalabrasOcr>
  readonly destruir: () => Promise<void>
}

export interface PalabraOcrMotor {
  readonly texto: string
  readonly confianza: number
  readonly izquierda: number
  readonly superior: number
  readonly derecha: number
  readonly inferior: number
}

export interface ResultadoPalabrasOcr {
  readonly texto: string
  readonly palabras: readonly PalabraOcrMotor[]
}

export interface RutasMotorOcr {
  readonly workerPath?: string
  readonly corePath?: string
  readonly langPath?: string
}

const CODIGOS_IDIOMA: Readonly<Record<IdiomaOcr, string>> = {
  espanol: 'spa',
  ingles: 'eng',
  'espanol-ingles': 'spa+eng',
}

/** Traduce los estados internos que Tesseract comunica durante la carga. */
export function traducirEstadoMotor(estado: string): string {
  const traducciones: Readonly<Record<string, string>> = {
    'loading tesseract core': 'Cargando el motor',
    'initializing tesseract': 'Inicializando el motor',
    'loading language traineddata': 'Cargando los datos de idioma',
    'initializing api': 'Preparando el reconocimiento',
    'recognizing text': 'Reconociendo el texto',
  }
  return traducciones[estado] ?? 'Procesando'
}

/** Construye las opciones auditables con las que se inicia Tesseract. */
export function construirOpcionesMotor(
  alProgreso: (mensaje: MensajeProgresoMotor) => void,
  rutas: RutasMotorOcr,
): Partial<Tesseract.WorkerOptions> {
  return {
    cacheMethod: 'none',
    gzip: true,
    legacyCore: false,
    legacyLang: false,
    workerBlobURL: false,
    logger: (mensaje) => {
      alProgreso({
        estado: traducirEstadoMotor(mensaje.status),
        fraccion: Math.min(1, Math.max(0, mensaje.progress)),
      })
    },
    ...(rutas.workerPath === undefined
      ? {}
      : { workerPath: rutas.workerPath }),
    ...(rutas.corePath === undefined ? {} : { corePath: rutas.corePath }),
    ...(rutas.langPath === undefined ? {} : { langPath: rutas.langPath }),
  }
}

/**
 * Crea una única instancia de Tesseract.js.
 *
 * Las tres rutas se fijan explícitamente para impedir los valores por omisión,
 * que apuntan a jsDelivr. `cacheMethod: 'none'` evita que Tesseract escriba los
 * modelos en IndexedDB: los recursos se leen del mismo origen en cada sesión.
 */
export async function crearMotorOcr(
  idioma: IdiomaOcr,
  alProgreso: (mensaje: MensajeProgresoMotor) => void,
  rutas: RutasMotorOcr = {
    workerPath: URL_TRABAJADOR_OCR,
    corePath: URL_NUCLEOS_OCR,
    langPath: URL_IDIOMAS_OCR,
  },
): Promise<MotorOcr> {
  const modulo = await import('tesseract.js')
  const opciones = construirOpcionesMotor(alProgreso, rutas)

  const trabajador = await modulo.createWorker(
    CODIGOS_IDIOMA[idioma],
    modulo.OEM.LSTM_ONLY,
    opciones,
  )
  let destruido = false
  let promesaDestruccion: Promise<void> | null = null

  return {
    reconocer: async (imagen): Promise<string> => {
      /*
       * Tesseract acepta Uint8Array en ejecución, aunque su declaración de
       * tipos solo enumera Buffer para Node. Este molde se limita a esa frontera.
       */
      const entrada =
        imagen as unknown as Parameters<typeof trabajador.recognize>[0]
      const resultado = await trabajador.recognize(entrada)
      return resultado.data.text
    },
    reconocerPalabras: async (imagen): Promise<ResultadoPalabrasOcr> => {
      const entrada =
        imagen as unknown as Parameters<typeof trabajador.recognize>[0]
      const resultado = await trabajador.recognize(
        entrada,
        {},
        { text: true, blocks: true },
      )
      const palabras: PalabraOcrMotor[] = []

      for (const bloque of resultado.data.blocks ?? []) {
        for (const parrafo of bloque.paragraphs) {
          for (const linea of parrafo.lines) {
            for (const palabra of linea.words) {
              palabras.push({
                texto: palabra.text,
                confianza: palabra.confidence,
                izquierda: palabra.bbox.x0,
                superior: palabra.bbox.y0,
                derecha: palabra.bbox.x1,
                inferior: palabra.bbox.y1,
              })
            }
          }
        }
      }

      return { texto: resultado.data.text, palabras }
    },
    destruir: async (): Promise<void> => {
      if (promesaDestruccion !== null) return await promesaDestruccion
      if (destruido) return
      destruido = true
      promesaDestruccion = trabajador.terminate().then(() => undefined)
      await promesaDestruccion
    },
  }
}

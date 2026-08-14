import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crearProcesadorQpdf,
  type ProcesadorQpdf,
} from '../seguridad/qpdf/crearProcesadorQpdf'
import { ErrorQpdf } from '../seguridad/qpdf/erroresQpdf'
import type { InformeSeguridadPdf } from '../seguridad/inspeccion/tipos'
import type {
  PeticionQpdf,
  RespuestaQpdf,
} from '../seguridad/qpdf/tipos'

const INFORME: InformeSeguridadPdf = {
  nivel: 'sin-indicios',
  hallazgos: [],
  archivosIncrustados: [],
  numeroPaginas: 1,
  estructuraValida: true,
  estadoEstructura: 'valida',
  cifrado: false,
  analisisCompleto: true,
  advertenciasTecnicas: [],
}

type Escenario =
  | 'correcto'
  | 'cifrado'
  | 'motor-no-disponible'
  | 'pendiente'

/** Worker mínimo para comprobar el protocolo del cliente sin cargar WebAssembly. */
class TrabajadorQpdfFalso {
  static instancias: TrabajadorQpdfFalso[] = []
  static escenario: Escenario = 'correcto'

  readonly mensajes: unknown[] = []
  readonly transferencias: Transferable[][] = []
  terminado = false

  private readonly oyentesMensaje: Array<
    (evento: MessageEvent<RespuestaQpdf>) => void
  > = []
  private readonly oyentesError: Array<(evento: Event) => void> = []

  constructor(_url: URL, _opciones: WorkerOptions) {
    TrabajadorQpdfFalso.instancias.push(this)
  }

  addEventListener(
    tipo: string,
    oyente: EventListenerOrEventListenerObject,
  ): void {
    if (tipo === 'message' && typeof oyente === 'function') {
      this.oyentesMensaje.push(
        oyente as (evento: MessageEvent<RespuestaQpdf>) => void,
      )
    }

    if (tipo === 'error' && typeof oyente === 'function') {
      this.oyentesError.push(oyente as (evento: Event) => void)
    }
  }

  postMessage(mensaje: unknown, transferencia: Transferable[] = []): void {
    this.mensajes.push(mensaje)
    this.transferencias.push(transferencia)

    if (
      typeof mensaje !== 'object' ||
      mensaje === null ||
      !('tipo' in mensaje) ||
      mensaje.tipo === 'preparar'
    ) {
      return
    }

    const peticion = mensaje as PeticionQpdf

    if (TrabajadorQpdfFalso.escenario === 'pendiente') {
      return
    }

    let respuesta: RespuestaQpdf

    if (TrabajadorQpdfFalso.escenario === 'cifrado') {
      respuesta = {
        tipo: 'fallo',
        identificador: peticion.identificador,
        codigo: 'ya-esta-cifrado',
        mensaje: 'Desbloquéalo primero con «Desbloquear PDF».',
      }
    } else if (TrabajadorQpdfFalso.escenario === 'motor-no-disponible') {
      respuesta = {
        tipo: 'fallo',
        identificador: peticion.identificador,
        codigo: 'motor-no-disponible',
        mensaje: 'No se pudo cargar el motor PDF local.',
      }
    } else {
      respuesta = {
        tipo: 'seguridad-analizada',
        identificador: peticion.identificador,
        informe: INFORME,
      }
    }

    queueMicrotask(() => {
      for (const oyente of this.oyentesMensaje) {
        oyente({ data: respuesta } as MessageEvent<RespuestaQpdf>)
      }
    })
  }

  terminate(): void {
    this.terminado = true
  }

  emitirError(): void {
    for (const oyente of this.oyentesError) {
      oyente(new Event('error'))
    }
  }
}

let procesador: ProcesadorQpdf | null = null

beforeEach(() => {
  TrabajadorQpdfFalso.instancias = []
  TrabajadorQpdfFalso.escenario = 'correcto'

  vi.stubGlobal('Worker', TrabajadorQpdfFalso)
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  })
})

afterEach(() => {
  procesador?.destruir()
  procesador = null
  vi.unstubAllGlobals()
})

describe('cliente qpdf: inspección de seguridad', () => {
  it('envía la petición transferible y devuelve el informe tipado', async () => {
    procesador = crearProcesadorQpdf()
    const contenido = new Uint8Array([37, 80, 68, 70])

    await expect(procesador.analizarSeguridad(contenido)).resolves.toBe(INFORME)

    const trabajador = TrabajadorQpdfFalso.instancias[0]
    const peticion = trabajador?.mensajes[1] as PeticionQpdf | undefined

    expect(trabajador?.mensajes[0]).toMatchObject({ tipo: 'preparar' })
    expect(peticion).toMatchObject({
      tipo: 'analizar-seguridad',
      identificador: 1,
    })
    expect(trabajador?.transferencias[1]).toEqual([contenido.buffer])
  })

  it('conserva el error explícito para un documento cifrado', async () => {
    TrabajadorQpdfFalso.escenario = 'cifrado'
    procesador = crearProcesadorQpdf()

    const promesa = procesador.analizarSeguridad(new Uint8Array([1]))

    await expect(promesa).rejects.toMatchObject({
      name: 'ErrorQpdf',
      codigo: 'ya-esta-cifrado',
    } satisfies Partial<ErrorQpdf>)
  })

  it('destruye el Worker y libera el cliente', async () => {
    procesador = crearProcesadorQpdf()
    await procesador.analizarSeguridad(new Uint8Array([1]))

    const trabajador = TrabajadorQpdfFalso.instancias[0]
    procesador.destruir()

    expect(trabajador?.terminado).toBe(true)
    expect(procesador.estaActivo()).toBe(false)
  })

  it('termina el Worker cuando vence el tiempo máximo', async () => {
    let vencer: (() => void) | undefined
    vi.stubGlobal('window', {
      setTimeout: (manejador: TimerHandler) => {
        vencer = manejador as () => void
        return 1
      },
      clearTimeout: vi.fn(),
    })
    TrabajadorQpdfFalso.escenario = 'pendiente'
    procesador = crearProcesadorQpdf()

    const promesa = procesador.analizarSeguridad(new Uint8Array([1]))
    const rechazo = expect(promesa).rejects.toMatchObject({
      codigo: 'error-interno',
      message: expect.stringContaining('se interrumpió'),
    })
    vencer?.()

    await rechazo
    expect(TrabajadorQpdfFalso.instancias[0]?.terminado).toBe(true)
    expect(procesador.estaActivo()).toBe(false)
  })

  it('descarta un Worker fallido y permite crear uno limpio al reintentar', async () => {
    TrabajadorQpdfFalso.escenario = 'pendiente'
    procesador = crearProcesadorQpdf()

    const primera = procesador.analizarSeguridad(new Uint8Array([1]))
    const rechazo = expect(primera).rejects.toMatchObject({
      codigo: 'motor-no-disponible',
    })
    TrabajadorQpdfFalso.instancias[0]?.emitirError()

    await rechazo
    expect(TrabajadorQpdfFalso.instancias[0]?.terminado).toBe(true)
    expect(procesador.estaActivo()).toBe(false)

    TrabajadorQpdfFalso.escenario = 'correcto'
    await expect(
      procesador.analizarSeguridad(new Uint8Array([2])),
    ).resolves.toBe(INFORME)
    expect(TrabajadorQpdfFalso.instancias).toHaveLength(2)
  })

  it('renueva el Worker si el motor local no pudo inicializarse', async () => {
    TrabajadorQpdfFalso.escenario = 'motor-no-disponible'
    procesador = crearProcesadorQpdf()

    await expect(
      procesador.analizarSeguridad(new Uint8Array([1])),
    ).rejects.toMatchObject({ codigo: 'motor-no-disponible' })
    expect(TrabajadorQpdfFalso.instancias[0]?.terminado).toBe(true)
    expect(procesador.estaActivo()).toBe(false)

    TrabajadorQpdfFalso.escenario = 'correcto'
    await expect(
      procesador.analizarSeguridad(new Uint8Array([2])),
    ).resolves.toBe(INFORME)
    expect(TrabajadorQpdfFalso.instancias).toHaveLength(2)
  })
})

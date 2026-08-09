import { crearErrorQpdf, ErrorQpdf } from './erroresQpdf'
import type { PerfilCompresion, ResumenCompresion } from './compresionPdf'
import { URL_WASM_QPDF } from './recursosQpdf'
import type {
  DiagnosticoPdf,
  NivelReparacion,
  ResumenReparacion,
} from './reparacionPdf'
import type {
  InformeCifrado,
  OpcionesProteccion,
  PeticionQpdf,
  RespuestaQpdf,
} from './tipos'

/**
 * Cliente del trabajador de qpdf, visto desde el hilo principal.
 *
 * Su responsabilidad es el ciclo de vida: crear el trabajador cuando se necesita,
 * emparejar cada petición con su respuesta y **destruirlo** al salir de la
 * herramienta. Mientras el trabajador vive, el WebAssembly y cualquier dato que
 * estuviera procesando siguen ocupando memoria, así que destruirlo no es una
 * cortesía: es parte de la limpieza.
 *
 * El procesador no guarda ninguna contraseña. Las recibe como argumento, las
 * reenvía al trabajador y las olvida.
 */

/** Tiempo máximo que se espera una respuesta antes de darla por perdida. */
const TIEMPO_MAXIMO_MS = 120_000

/** Resultado de una operación que devuelve un documento. */
export interface DocumentoProcesado {
  /** Contenido del documento resultante. */
  readonly contenido: Uint8Array
  /** Informe de cifrado con el que se verificó. */
  readonly informe: InformeCifrado
}

/** Resultado de diagnosticar un documento sin modificarlo. */
export interface DocumentoRevisado {
  readonly diagnostico: DiagnosticoPdf
  /** Páginas que se han podido contar, o `null` si el archivo no lo permite. */
  readonly numeroPaginas: number | null
}

/** Resultado de reparar un documento. */
export interface DocumentoReparado {
  readonly contenido: Uint8Array
  readonly resumen: ResumenReparacion
}

/**
 * Resultado de comprimir un documento.
 *
 * `contenido` es `null` cuando la compresión no consiguió reducirlo. No es un error:
 * es el desenlace legítimo de un documento que ya estaba optimizado, y el resumen
 * explica cuál fue.
 */
export interface DocumentoComprimido {
  readonly contenido: Uint8Array | null
  readonly resumen: ResumenCompresion
}

/** Operaciones que ofrece el procesador. */
export interface ProcesadorQpdf {
  /** Protege un documento con contraseña y verifica el resultado. */
  readonly proteger: (
    contenido: Uint8Array,
    opciones: OpcionesProteccion,
  ) => Promise<DocumentoProcesado>
  /** Descifra un documento y verifica el resultado. */
  readonly desbloquear: (
    contenido: Uint8Array,
    contrasena: string,
  ) => Promise<DocumentoProcesado>
  /** Informa de si un documento está cifrado, sin modificarlo. */
  readonly inspeccionar: (
    contenido: Uint8Array,
    contrasena?: string | null,
  ) => Promise<InformeCifrado>
  /** Comprueba el estado de un documento, sin modificarlo. */
  readonly diagnosticar: (contenido: Uint8Array) => Promise<DocumentoRevisado>
  /** Repara un documento dañado y comprueba que el resultado sirva. */
  readonly reparar: (
    contenido: Uint8Array,
    nivel: NivelReparacion,
  ) => Promise<DocumentoReparado>
  /** Comprime un documento; devuelve el contenido solo si de verdad es menor. */
  readonly comprimir: (
    contenido: Uint8Array,
    perfil: PerfilCompresion,
  ) => Promise<DocumentoComprimido>
  /** Detiene el trabajador y libera el motor. */
  readonly destruir: () => void
  /** `true` mientras el trabajador sigue vivo. */
  readonly estaActivo: () => boolean
}

/** Petición pendiente de respuesta. */
interface PeticionPendiente {
  readonly resolver: (respuesta: RespuestaQpdf) => void
  readonly rechazar: (error: unknown) => void
  readonly temporizador: number
}

/**
 * Crea el procesador y arranca el trabajador.
 *
 * El trabajador se crea con `new Worker(new URL(...), { type: 'module' })`, la
 * forma que Vite reconoce para empaquetarlo como un recurso del proyecto: así
 * respeta la ruta base `/free-pdf/` y no hace falta ninguna configuración
 * adicional para GitHub Pages.
 */
export function crearProcesadorQpdf(): ProcesadorQpdf {
  let trabajador: Worker | null = null
  let siguienteIdentificador = 1
  const pendientes = new Map<number, PeticionPendiente>()

  /** Rechaza todas las peticiones pendientes y limpia el registro. */
  const abortarPendientes = (error: unknown): void => {
    for (const pendiente of pendientes.values()) {
      window.clearTimeout(pendiente.temporizador)
      pendiente.rechazar(error)
    }
    pendientes.clear()
  }

  const destruir = (): void => {
    const actual = trabajador
    trabajador = null

    abortarPendientes(crearErrorQpdf('error-interno'))

    if (actual !== null) {
      // `terminate` detiene el hilo de inmediato: el WebAssembly, su memoria y su
      // sistema de archivos virtual desaparecen con él.
      actual.terminate()
    }
  }

  /** Devuelve el trabajador, creándolo la primera vez. */
  const obtenerTrabajador = (): Worker => {
    if (trabajador !== null) {
      return trabajador
    }

    let creado: Worker

    try {
      creado = new Worker(new URL('./trabajadorQpdf.ts', import.meta.url), {
        type: 'module',
        name: 'free-pdf-qpdf',
      })
    } catch (error) {
      throw crearErrorQpdf('motor-no-disponible', { cause: error })
    }

    creado.addEventListener('message', (evento: MessageEvent<RespuestaQpdf>) => {
      const respuesta = evento.data

      if (respuesta.tipo === 'preparado') {
        return
      }

      const pendiente = pendientes.get(respuesta.identificador)
      if (pendiente === undefined) {
        return
      }

      pendientes.delete(respuesta.identificador)
      window.clearTimeout(pendiente.temporizador)
      pendiente.resolver(respuesta)
    })

    creado.addEventListener('error', () => {
      abortarPendientes(crearErrorQpdf('motor-no-disponible'))
    })

    // El trabajador necesita la dirección del WebAssembly, que solo el hilo
    // principal puede resolver con la ruta base aplicada.
    creado.postMessage({ tipo: 'preparar', urlWasm: URL_WASM_QPDF })

    trabajador = creado

    return creado
  }

  /**
   * Envía una petición y espera su respuesta.
   *
   * El contenido del documento se transfiere en lugar de copiarse, así que un PDF
   * grande no se duplica en memoria al cruzar al trabajador.
   */
  const enviar = async (
    construir: (identificador: number) => PeticionQpdf,
  ): Promise<RespuestaQpdf> => {
    const activo = obtenerTrabajador()
    const identificador = siguienteIdentificador
    siguienteIdentificador += 1

    const peticion = construir(identificador)

    return await new Promise<RespuestaQpdf>((resolver, rechazar) => {
      const temporizador = window.setTimeout(() => {
        pendientes.delete(identificador)
        rechazar(
          new ErrorQpdf(
            'error-interno',
            'La operación tardó demasiado y se interrumpió. Prueba con un documento más pequeño.',
          ),
        )
      }, TIEMPO_MAXIMO_MS)

      pendientes.set(identificador, { resolver, rechazar, temporizador })

      const transferibles =
        'contenido' in peticion && peticion.contenido instanceof Uint8Array
          ? [peticion.contenido.buffer]
          : []

      activo.postMessage(peticion, transferibles)
    })
  }

  /** Traduce una respuesta de documento, o lanza el error que corresponda. */
  const interpretarDocumento = (
    respuesta: RespuestaQpdf,
  ): DocumentoProcesado => {
    if (respuesta.tipo === 'fallo') {
      throw new ErrorQpdf(respuesta.codigo, respuesta.mensaje)
    }

    if (
      respuesta.tipo !== 'listo' ||
      respuesta.contenido === null ||
      respuesta.informe === null
    ) {
      throw crearErrorQpdf('error-interno')
    }

    return { contenido: respuesta.contenido, informe: respuesta.informe }
  }

  return {
    proteger: async (contenido, opciones) =>
      interpretarDocumento(
        await enviar((identificador) => ({
          tipo: 'proteger',
          identificador,
          contenido,
          opciones,
        })),
      ),

    desbloquear: async (contenido, contrasena) =>
      interpretarDocumento(
        await enviar((identificador) => ({
          tipo: 'desbloquear',
          identificador,
          contenido,
          contrasena,
        })),
      ),

    inspeccionar: async (contenido, contrasena = null) => {
      const respuesta = await enviar((identificador) => ({
        tipo: 'inspeccionar',
        identificador,
        contenido,
        contrasena,
      }))

      if (respuesta.tipo === 'fallo') {
        throw new ErrorQpdf(respuesta.codigo, respuesta.mensaje)
      }

      if (respuesta.tipo !== 'listo' || respuesta.informe === null) {
        throw crearErrorQpdf('error-interno')
      }

      return respuesta.informe
    },

    diagnosticar: async (contenido) => {
      const respuesta = await enviar((identificador) => ({
        tipo: 'diagnosticar',
        identificador,
        contenido,
      }))

      if (respuesta.tipo === 'fallo') {
        throw new ErrorQpdf(respuesta.codigo, respuesta.mensaje)
      }

      if (respuesta.tipo !== 'diagnosticado') {
        throw crearErrorQpdf('error-interno')
      }

      return {
        diagnostico: respuesta.diagnostico,
        numeroPaginas: respuesta.numeroPaginas,
      }
    },

    reparar: async (contenido, nivel) => {
      const respuesta = await enviar((identificador) => ({
        tipo: 'reparar',
        identificador,
        contenido,
        nivel,
      }))

      if (respuesta.tipo === 'fallo') {
        throw new ErrorQpdf(respuesta.codigo, respuesta.mensaje)
      }

      if (respuesta.tipo !== 'reparado') {
        throw crearErrorQpdf('error-interno')
      }

      return { contenido: respuesta.contenido, resumen: respuesta.resumen }
    },

    comprimir: async (contenido, perfil) => {
      const respuesta = await enviar((identificador) => ({
        tipo: 'comprimir',
        identificador,
        contenido,
        perfil,
      }))

      if (respuesta.tipo === 'fallo') {
        throw new ErrorQpdf(respuesta.codigo, respuesta.mensaje)
      }

      if (respuesta.tipo !== 'comprimido') {
        throw crearErrorQpdf('error-interno')
      }

      return { contenido: respuesta.contenido, resumen: respuesta.resumen }
    },

    destruir,
    estaActivo: () => trabajador !== null,
  }
}

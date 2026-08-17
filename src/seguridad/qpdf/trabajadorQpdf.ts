/// <reference lib="webworker" />

import {
  construirArgumentosCifrado,
  construirArgumentosDescifrado,
  construirArgumentosInforme,
  interpretarInformeCifrado,
} from './permisosPdf'
import {
  calcularPorcentaje,
  construirArgumentosCompresion,
  decidirDesenlace,
  detectarImagenesIntocables,
  seEntregaElComprimido,
  type ResumenCompresion,
} from './compresionPdf'
import { deducirCodigo } from './erroresQpdf'
import {
  crearColaOperacionesQpdf,
  crearRecolectorMensajesQpdf,
} from './recolectorMensajesQpdf'
import {
  construirArgumentosComprobacion,
  construirArgumentosRecuentoPaginas,
  construirArgumentosReparacion,
  interpretarComprobacion,
  laReparacionSirve,
  type DiagnosticoPdf,
  type ResumenReparacion,
} from './reparacionPdf'
import {
  construirArgumentosInspeccionSeguridad,
  esEjecucionJsonUtilizable,
  leerJsonInspeccion,
  leerSalidaJsonInspeccion,
  necesitaContrasenaParaInspeccionar,
} from './inspeccionSeguridadPdf'
import {
  analizarEstructuraQpdf,
  ErrorInspeccionSeguridad,
} from '../inspeccion/analizarEstructura'
import type { InformeSeguridadPdf } from '../inspeccion/tipos'
import type {
  CodigoErrorQpdf,
  InformeCifrado,
  PeticionQpdf,
  RespuestaQpdf,
} from './tipos'

/**
 * Trabajador que ejecuta qpdf compilado a WebAssembly.
 *
 * Todo el trabajo con contraseñas ocurre aquí dentro, en un hilo aparte:
 *
 * - El documento y la contraseña llegan por `postMessage` y no salen de este
 *   contexto salvo como resultado ya procesado.
 * - **La consola se intercepta antes de evaluar el módulo de qpdf**, porque su
 *   pegamento fija la salida a `console.log` y `console.error` en el momento de
 *   evaluarse. Sin esta precaución, los mensajes de qpdf se escribirían en la
 *   consola del navegador.
 * - Los mensajes recogidos se depuran antes de enviarlos, por si alguna versión
 *   futura de qpdf llegara a incluir un argumento en un aviso.
 * - El sistema de archivos virtual se limpia siempre, incluso si la operación
 *   falla.
 * - Se crea una instancia nueva del motor por operación, de modo que no quede
 *   ningún residuo de la anterior.
 *
 * No se realiza ninguna petición de red salvo la del propio archivo WebAssembly,
 * que se sirve desde el mismo origen y no contiene ningún dato de la persona.
 */

/** Salida de qpdf acotada para que un PDF hostil no infle la memoria. */
const recolectorMensajes = crearRecolectorMensajesQpdf()

/** Una sola operación puede usar qpdf y la consola interceptada cada vez. */
const colaOperaciones = crearColaOperacionesQpdf()

/**
 * Instala la interceptación de la consola.
 *
 * Debe llamarse antes de importar el módulo de qpdf. Se deja instalada durante
 * toda la vida del trabajador: nada de lo que ocurra aquí debe llegar a la
 * consola del navegador.
 */
function interceptarConsola(): void {
  const recoger = (...partes: readonly unknown[]): void => {
    recolectorMensajes.recoger(...partes)
  }

  console.log = recoger
  console.info = recoger
  console.warn = recoger
  console.error = recoger
  console.debug = recoger
}

interceptarConsola()

/** Interfaz mínima del sistema de archivos virtual que se necesita. */
interface SistemaArchivosVirtual {
  readonly writeFile: (ruta: string, datos: Uint8Array) => void
  readonly readFile: (ruta: string) => Uint8Array
  readonly stat: (ruta: string) => { readonly size: number }
  readonly unlink: (ruta: string) => void
}

/** Interfaz mínima de una instancia de qpdf. */
interface InstanciaQpdf {
  readonly callMain: (argumentos: string[]) => number
  readonly FS: SistemaArchivosVirtual
}

/** Opciones con las que se crea una instancia. */
interface OpcionesModulo {
  readonly locateFile: () => string
  readonly noInitialRun: boolean
}

/** Fábrica que expone el paquete de qpdf. */
type FabricaQpdf = (opciones: OpcionesModulo) => Promise<InstanciaQpdf>

/** Señala que el módulo o su WebAssembly no pudieron inicializarse. */
class ErrorMotorQpdfNoDisponible extends Error {
  constructor() {
    super('El motor qpdf no pudo inicializarse.')
    this.name = 'ErrorMotorQpdfNoDisponible'
  }
}

/** Fábrica ya cargada, para no volver a descargar el módulo. */
let fabricaEnMemoria: FabricaQpdf | null = null

/** Dirección del archivo WebAssembly, que facilita el hilo principal. */
let urlWasm = ''

/**
 * Carga el módulo de qpdf.
 *
 * La importación es dinámica a propósito: así el WebAssembly no se descarga hasta
 * que de verdad se va a usar, y la interceptación de la consola ya está instalada
 * cuando el pegamento se evalúa.
 */
async function obtenerFabrica(): Promise<FabricaQpdf> {
  if (fabricaEnMemoria !== null) {
    return fabricaEnMemoria
  }

  const modulo: unknown = await import('@neslinesli93/qpdf-wasm')
  const candidata =
    typeof modulo === 'function'
      ? modulo
      : (modulo as { readonly default?: unknown }).default

  if (typeof candidata !== 'function') {
    throw new Error('El módulo de qpdf no expone una fábrica utilizable.')
  }

  fabricaEnMemoria = candidata as FabricaQpdf

  return fabricaEnMemoria
}

/** Crea una instancia nueva del motor, con su sistema de archivos vacío. */
async function crearInstancia(): Promise<InstanciaQpdf> {
  try {
    const fabrica = await obtenerFabrica()

    return await fabrica({ locateFile: () => urlWasm, noInitialRun: true })
  } catch {
    throw new ErrorMotorQpdfNoDisponible()
  }
}

/** Resultado de ejecutar qpdf una vez. */
interface Ejecucion {
  /** Código de salida: 0 correcto, 2 error, 3 avisos. */
  readonly codigo: number
  /** Mensajes que qpdf escribió, ya depurados. */
  readonly mensajes: readonly string[]
}

/**
 * Ejecuta qpdf y recoge su salida.
 *
 * Emscripten señala el final del programa lanzando una excepción con el código de
 * salida, así que se captura y se traduce a un número.
 *
 * `secretos` son las cadenas que deben desaparecer de los mensajes antes de que
 * salgan de esta función.
 */
function ejecutar(
  instancia: InstanciaQpdf,
  argumentos: readonly string[],
  secretos: readonly string[],
): Ejecucion {
  recolectorMensajes.reiniciar(secretos)

  let codigo: number

  try {
    codigo = instancia.callMain([...argumentos])
  } catch (error) {
    const estado = (error as { readonly status?: unknown } | null)?.status
    codigo = typeof estado === 'number' ? estado : -1
  }

  const mensajes = recolectorMensajes.vaciar()

  return { codigo, mensajes }
}

/** Rutas del sistema de archivos virtual. Son fijas y no llevan ningún dato. */
const RUTA_ENTRADA = '/entrada.pdf'
const RUTA_SALIDA = '/salida.pdf'
const RUTA_CONTRASENA = '/clave'
const RUTA_JSON_SEGURIDAD = '/inspeccion-seguridad.json'

/**
 * Borra del sistema virtual las rutas indicadas.
 *
 * Se llama siempre, también cuando la operación falla: el archivo de contraseña
 * no debe sobrevivir a la operación bajo ninguna circunstancia.
 */
function limpiarArchivos(
  instancia: InstanciaQpdf,
  rutas: readonly string[],
): void {
  for (const ruta of rutas) {
    try {
      instancia.FS.unlink(ruta)
    } catch {
      // El archivo no existía; no hay nada que limpiar.
    }
  }
}

/** Lee un archivo del sistema virtual, o devuelve `null` si no existe. */
function leerSiExiste(
  instancia: InstanciaQpdf,
  ruta: string,
): Uint8Array | null {
  try {
    return instancia.FS.readFile(ruta)
  } catch {
    return null
  }
}

/** Copia los bytes a un búfer propio, para poder transferirlos. */
function copiarBytes(origen: Uint8Array): Uint8Array {
  const copia = new Uint8Array(origen.byteLength)
  copia.set(origen)

  return copia
}

/** Pide a qpdf el informe de cifrado de un documento ya escrito. */
function obtenerInforme(
  instancia: InstanciaQpdf,
  contrasena: string | null,
  secretos: readonly string[],
): InformeCifrado {
  let rutaContrasena: string | null = null

  if (contrasena !== null && contrasena !== '') {
    rutaContrasena = RUTA_CONTRASENA
    instancia.FS.writeFile(
      rutaContrasena,
      new TextEncoder().encode(contrasena),
    )
  }

  try {
    const { mensajes } = ejecutar(
      instancia,
      construirArgumentosInforme(RUTA_ENTRADA, rutaContrasena),
      secretos,
    )

    return interpretarInformeCifrado(mensajes)
  } finally {
    if (rutaContrasena !== null) {
      limpiarArchivos(instancia, [rutaContrasena])
    }
  }
}

/** Publica una respuesta hacia el hilo principal. */
function responder(respuesta: RespuestaQpdf): void {
  self.postMessage(respuesta)
}

/** Publica un fallo, sin incluir jamás la contraseña. */
function responderFallo(
  identificador: number,
  codigo: CodigoErrorQpdf,
  mensaje: string,
): void {
  responder({ tipo: 'fallo', identificador, codigo, mensaje })
}

/**
 * Protege un documento y comprueba después el resultado.
 *
 * La verificación no es un adorno: si qpdf no confirma que el documento quedó
 * cifrado, o si la contraseña correcta no lo vuelve a abrir, no se entrega nada.
 */
async function atenderProteger(
  peticion: Extract<PeticionQpdf, { tipo: 'proteger' }>,
): Promise<void> {
  const { contrasenaUsuario, contrasenaPropietario, permisos } =
    peticion.opciones
  const secretos = [contrasenaUsuario, contrasenaPropietario]

  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, peticion.contenido)

    // Si el documento ya venía cifrado, qpdf no podría leerlo sin contraseña.
    const informePrevio = obtenerInforme(instancia, null, secretos)
    if (informePrevio.cifrado) {
      responderFallo(
        peticion.identificador,
        'ya-esta-cifrado',
        'Este documento ya está protegido con contraseña. Desbloquéalo antes de volver a protegerlo.',
      )
      return
    }

    const cifrado = ejecutar(
      instancia,
      construirArgumentosCifrado(
        RUTA_ENTRADA,
        RUTA_SALIDA,
        contrasenaUsuario,
        contrasenaPropietario,
        permisos,
      ),
      secretos,
    )

    const resultado = leerSiExiste(instancia, RUTA_SALIDA)

    if (cifrado.codigo !== 0 || resultado === null) {
      responderFallo(
        peticion.identificador,
        deducirCodigo(cifrado.mensajes),
        cifrado.mensajes.join(' ') || 'No se pudo cifrar el documento.',
      )
      return
    }

    const contenido = copiarBytes(resultado)

    // --- Verificación: ¿quedó de verdad cifrado y se puede volver a abrir? ---
    const verificacion = await verificarProteccion(
      contenido,
      contrasenaUsuario,
      secretos,
    )

    if (verificacion === null) {
      responderFallo(
        peticion.identificador,
        'verificacion-fallida',
        'El documento se cifró, pero la comprobación posterior falló, así que no se entrega.',
      )
      return
    }

    responder({
      tipo: 'listo',
      identificador: peticion.identificador,
      contenido,
      informe: verificacion.informe,
      numeroPaginas: null,
    })
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA, RUTA_SALIDA, RUTA_CONTRASENA])
  }
}

/** Resultado de comprobar un documento recién cifrado. */
interface Verificacion {
  readonly informe: InformeCifrado
}

/**
 * Comprueba un documento recién protegido.
 *
 * Se hacen tres cosas, en una instancia limpia:
 *  1. Se pide el informe con la contraseña, y debe declarar cifrado AES.
 *  2. Se descifra con la contraseña correcta, que debe funcionar.
 *  3. Se comprueba que el resultado descifrado ya no declara cifrado.
 */
async function verificarProteccion(
  contenido: Uint8Array,
  contrasena: string,
  secretos: readonly string[],
): Promise<Verificacion | null> {
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, contenido)

    const informe = obtenerInforme(instancia, contrasena, secretos)
    if (!informe.cifrado) {
      return null
    }

    instancia.FS.writeFile(
      RUTA_CONTRASENA,
      new TextEncoder().encode(contrasena),
    )

    const descifrado = ejecutar(
      instancia,
      construirArgumentosDescifrado(
        RUTA_ENTRADA,
        RUTA_SALIDA,
        RUTA_CONTRASENA,
      ),
      secretos,
    )

    if (descifrado.codigo !== 0) {
      return null
    }

    const claro = leerSiExiste(instancia, RUTA_SALIDA)
    if (claro === null || claro.byteLength === 0) {
      return null
    }

    return { informe }
  } catch {
    return null
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA, RUTA_SALIDA, RUTA_CONTRASENA])
  }
}

/** Desbloquea un documento cifrado y comprueba el resultado. */
async function atenderDesbloquear(
  peticion: Extract<PeticionQpdf, { tipo: 'desbloquear' }>,
): Promise<void> {
  const secretos = [peticion.contrasena]
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, peticion.contenido)

    // Sin contraseña: si el informe dice que no está cifrado, no hay nada que hacer.
    const informePrevio = obtenerInforme(instancia, null, secretos)

    instancia.FS.writeFile(
      RUTA_CONTRASENA,
      new TextEncoder().encode(peticion.contrasena),
    )

    const descifrado = ejecutar(
      instancia,
      construirArgumentosDescifrado(
        RUTA_ENTRADA,
        RUTA_SALIDA,
        RUTA_CONTRASENA,
      ),
      secretos,
    )

    // El archivo de contraseña se borra en cuanto qpdf ha terminado con él.
    limpiarArchivos(instancia, [RUTA_CONTRASENA])

    const resultado = leerSiExiste(instancia, RUTA_SALIDA)

    if (descifrado.codigo !== 0 || resultado === null) {
      const codigo = deducirCodigo(descifrado.mensajes)

      responderFallo(
        peticion.identificador,
        // Un documento sin cifrar produce un aviso distinto; se prioriza el caso
        // claro para no confundir a quien solo quería comprobarlo.
        codigo === 'error-interno' && !informePrevio.cifrado
          ? 'no-esta-cifrado'
          : codigo,
        descifrado.mensajes.join(' ') || 'No se pudo desbloquear el documento.',
      )
      return
    }

    const contenido = copiarBytes(resultado)

    // --- Verificación: el resultado no debe declarar cifrado. ---
    const informeFinal = await verificarDesbloqueo(contenido, secretos)

    if (informeFinal === null || informeFinal.cifrado) {
      responderFallo(
        peticion.identificador,
        'verificacion-fallida',
        'El documento se procesó, pero sigue apareciendo como cifrado, así que no se entrega.',
      )
      return
    }

    responder({
      tipo: 'listo',
      identificador: peticion.identificador,
      contenido,
      informe: informeFinal,
      numeroPaginas: null,
    })
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA, RUTA_SALIDA, RUTA_CONTRASENA])
  }
}

/** Comprueba que un documento ya no esté cifrado. */
async function verificarDesbloqueo(
  contenido: Uint8Array,
  secretos: readonly string[],
): Promise<InformeCifrado | null> {
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, contenido)

    return obtenerInforme(instancia, null, secretos)
  } catch {
    return null
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA])
  }
}

/** Informa de si un documento está cifrado, sin modificarlo. */
async function atenderInspeccionar(
  peticion: Extract<PeticionQpdf, { tipo: 'inspeccionar' }>,
): Promise<void> {
  const secretos = peticion.contrasena === null ? [] : [peticion.contrasena]
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, peticion.contenido)

    responder({
      tipo: 'listo',
      identificador: peticion.identificador,
      contenido: null,
      informe: obtenerInforme(instancia, peticion.contrasena, secretos),
      numeroPaginas: null,
    })
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA, RUTA_CONTRASENA])
  }
}

/**
 * Diagnostica un documento sin modificarlo.
 *
 * Se usa `--check`, que recorre el archivo entero y describe lo que encuentra. No se
 * escribe ninguna salida: esta operación solo informa.
 */
async function atenderDiagnosticar(
  peticion: Extract<PeticionQpdf, { tipo: 'diagnosticar' }>,
): Promise<void> {
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, peticion.contenido)

    const comprobacion = ejecutar(
      instancia,
      construirArgumentosComprobacion(RUTA_ENTRADA),
      [],
    )

    responder({
      tipo: 'diagnosticado',
      identificador: peticion.identificador,
      diagnostico: interpretarComprobacion(
        comprobacion.codigo,
        comprobacion.mensajes,
      ),
      numeroPaginas: contarPaginas(instancia),
    })
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA])
  }
}

/**
 * Inspecciona indicadores estructurales de riesgo sin abrir ningún contenido.
 *
 * qpdf serializa los diccionarios del documento en JSON, omitiendo expresamente
 * los datos de todos los streams. El JSON nunca abandona este trabajador: se
 * valida, se convierte en un informe acotado y se borra junto con el PDF en el
 * `finally`.
 */
async function atenderAnalizarSeguridad(
  peticion: Extract<PeticionQpdf, { tipo: 'analizar-seguridad' }>,
): Promise<void> {
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, peticion.contenido)

    const inspeccion = ejecutar(
      instancia,
      construirArgumentosInspeccionSeguridad(
        RUTA_ENTRADA,
        RUTA_JSON_SEGURIDAD,
      ),
      [],
    )

    if (necesitaContrasenaParaInspeccionar(inspeccion.mensajes)) {
      responderFallo(
        peticion.identificador,
        'ya-esta-cifrado',
        'El Inspector de seguridad no puede analizar un PDF protegido sin contraseña. Desbloquéalo primero con «Desbloquear PDF» y vuelve a intentarlo.',
      )
      return
    }

    if (!esEjecucionJsonUtilizable(inspeccion.codigo)) {
      const codigo = deducirCodigo(inspeccion.mensajes)

      responderFallo(
        peticion.identificador,
        codigo === 'contrasena-incorrecta' ? 'ya-esta-cifrado' : codigo,
        codigo === 'documento-danado'
          ? 'El documento está dañado o incompleto y no se pudo inspeccionar su estructura de forma fiable.'
          : 'No se pudo inspeccionar la estructura del PDF de forma fiable.',
      )
      return
    }

    const salidaJson = leerSalidaJsonInspeccion(
      instancia.FS,
      RUTA_JSON_SEGURIDAD,
    )

    if (salidaJson.estado === 'demasiado-grande') {
      responderFallo(
        peticion.identificador,
        'error-interno',
        'La estructura del PDF es demasiado grande para inspeccionarla de forma segura. Prueba con un documento más pequeño.',
      )
      return
    }

    if (salidaJson.estado === 'ausente') {
      responderFallo(
        peticion.identificador,
        'error-interno',
        'No se pudo leer la estructura generada por el motor PDF local.',
      )
      return
    }

    // `readFile` devuelve una copia independiente. Se elimina el original antes
    // de decodificar y parsear para no conservar simultáneamente ambas versiones.
    limpiarArchivos(instancia, [RUTA_JSON_SEGURIDAD])
    const json = salidaJson.contenido

    const diagnostico = interpretarComprobacion(
      inspeccion.codigo,
      inspeccion.mensajes,
    )

    let informe: InformeSeguridadPdf

    try {
      informe = analizarEstructuraQpdf(leerJsonInspeccion(json), {
        // El bloque `pages` del mismo JSON es la única fuente del recuento para
        // esta herramienta. Así no se vuelve a recorrer el PDF con qpdf.
        numeroPaginas: null,
        diagnostico,
      })
    } catch (error) {
      const codigoError: CodigoErrorQpdf =
        error instanceof ErrorInspeccionSeguridad &&
        error.motivo === 'documento-cifrado'
          ? 'ya-esta-cifrado'
          : error instanceof ErrorInspeccionSeguridad &&
              error.motivo === 'estructura-no-inspeccionable'
            ? 'documento-danado'
            : 'error-interno'

      responderFallo(
        peticion.identificador,
        codigoError,
        error instanceof ErrorInspeccionSeguridad
          ? error.message
          : 'No se pudo interpretar la estructura del PDF de forma segura. El archivo puede estar dañado, incompleto o usar una estructura no compatible.',
      )
      return
    }

    responder({
      tipo: 'seguridad-analizada',
      identificador: peticion.identificador,
      informe,
    })
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA, RUTA_JSON_SEGURIDAD])
  }
}

/**
 * Cuenta las páginas del documento que ya está escrito en la entrada.
 *
 * Devuelve `null` si no se puede contar, que es lo que ocurre con un archivo
 * demasiado dañado para leer su árbol de páginas. Eso no es un error: es un dato, y
 * la herramienta lo comunica en lugar de inventarse un número.
 */
function contarPaginas(instancia: InstanciaQpdf): number | null {
  const recuento = ejecutar(
    instancia,
    construirArgumentosRecuentoPaginas(RUTA_ENTRADA),
    [],
  )

  if (recuento.codigo === 2) {
    return null
  }

  for (const mensaje of recuento.mensajes) {
    const encontrado = /(\d+)/.exec(mensaje.trim())

    if (encontrado?.[1] !== undefined) {
      return Number.parseInt(encontrado[1], 10)
    }
  }

  return null
}

/**
 * Repara un documento y comprueba que el resultado sirve para algo.
 *
 * El orden importa y es deliberado:
 *
 * 1. Se diagnostica el original, para poder decir después qué estaba mal.
 * 2. Se cuentan sus páginas, si se puede.
 * 3. Se reescribe con qpdf, que es lo que reconstruye la estructura.
 * 4. Se diagnostica y se cuentan las páginas del **resultado**.
 * 5. Si el resultado no tiene páginas, **no se entrega**: un documento vacío no es
 *    una reparación, y entregarlo sería peor que fallar.
 */
async function atenderReparar(
  peticion: Extract<PeticionQpdf, { tipo: 'reparar' }>,
): Promise<void> {
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, peticion.contenido)

    const comprobacionPrevia = ejecutar(
      instancia,
      construirArgumentosComprobacion(RUTA_ENTRADA),
      [],
    )
    const diagnosticoPrevio = interpretarComprobacion(
      comprobacionPrevia.codigo,
      comprobacionPrevia.mensajes,
    )

    if (diagnosticoPrevio.necesitaContrasena) {
      responderFallo(
        peticion.identificador,
        'ya-esta-cifrado',
        'El documento está protegido con contraseña. Desbloquéalo antes de repararlo.',
      )
      return
    }

    const paginasAntes = contarPaginas(instancia)

    const reparacion = ejecutar(
      instancia,
      construirArgumentosReparacion(RUTA_ENTRADA, RUTA_SALIDA, peticion.nivel),
      [],
    )

    const resultado = leerSiExiste(instancia, RUTA_SALIDA)

    // El código 3 significa «solo advertencias», y al reparar un archivo dañado es
    // justo lo que se espera: qpdf avisa de lo que ha tenido que reconstruir.
    if (resultado === null || resultado.byteLength === 0) {
      responderFallo(
        peticion.identificador,
        'documento-danado',
        reparacion.mensajes.join(' ') ||
          'El documento está demasiado dañado y no se pudo recuperar nada de él.',
      )
      return
    }

    const contenido = copiarBytes(resultado)

    const verificacion = await verificarReparacion(contenido)

    if (verificacion === null) {
      responderFallo(
        peticion.identificador,
        'verificacion-fallida',
        'El documento se reescribió, pero la comprobación posterior falló, así que no se entrega.',
      )
      return
    }

    const resumen: ResumenReparacion = {
      diagnosticoPrevio,
      diagnosticoFinal: verificacion.diagnostico,
      paginasAntes,
      paginasDespues: verificacion.numeroPaginas ?? 0,
    }

    if (!laReparacionSirve(resumen)) {
      responderFallo(
        peticion.identificador,
        'reparacion-inutil',
        'El documento resultante no tiene ninguna página, así que no se entrega: no se pudo recuperar nada.',
      )
      return
    }

    responder({
      tipo: 'reparado',
      identificador: peticion.identificador,
      contenido,
      resumen,
    })
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA, RUTA_SALIDA])
  }
}

/** Comprueba el documento reparado en una instancia nueva. */
async function verificarReparacion(contenido: Uint8Array): Promise<{
  readonly diagnostico: DiagnosticoPdf
  readonly numeroPaginas: number | null
} | null> {
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, contenido)

    const comprobacion = ejecutar(
      instancia,
      construirArgumentosComprobacion(RUTA_ENTRADA),
      [],
    )

    return {
      diagnostico: interpretarComprobacion(
        comprobacion.codigo,
        comprobacion.mensajes,
      ),
      numeroPaginas: contarPaginas(instancia),
    }
  } catch {
    return null
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA])
  }
}

/**
 * Comprime un documento y decide si el resultado merece entregarse.
 *
 * La regla que gobierna esta función: **si el archivo no queda más pequeño, se
 * devuelve `null` en lugar del contenido**. Es el trabajador quien tiene las dos
 * medidas delante, así que es aquí donde se decide; devolver el archivo y confiar en
 * que el hilo principal no lo entregue sería dejar la puerta abierta a entregarlo.
 */
async function atenderComprimir(
  peticion: Extract<PeticionQpdf, { tipo: 'comprimir' }>,
): Promise<void> {
  const instancia = await crearInstancia()
  const tamanoOriginal = peticion.contenido.byteLength
  const tieneImagenesIntocables = detectarImagenesIntocables(peticion.contenido)

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, peticion.contenido)

    // Un documento cifrado no se puede recomprimir sin la contraseña, y qpdf falla
    // con un mensaje que no dice nada útil. Se detecta antes para poder explicarlo.
    const comprobacion = ejecutar(
      instancia,
      construirArgumentosComprobacion(RUTA_ENTRADA),
      [],
    )
    const diagnostico = interpretarComprobacion(
      comprobacion.codigo,
      comprobacion.mensajes,
    )

    if (diagnostico.necesitaContrasena) {
      responderFallo(
        peticion.identificador,
        'ya-esta-cifrado',
        'El documento está protegido con contraseña. Desbloquéalo antes de comprimirlo.',
      )
      return
    }

    const paginasAntes = contarPaginas(instancia)

    const compresion = ejecutar(
      instancia,
      construirArgumentosCompresion(RUTA_ENTRADA, RUTA_SALIDA, peticion.perfil),
      [],
    )

    const resultado = leerSiExiste(instancia, RUTA_SALIDA)

    if (resultado === null || resultado.byteLength === 0) {
      responderFallo(
        peticion.identificador,
        'documento-danado',
        compresion.mensajes.join(' ') ||
          'No se pudo comprimir el documento. Puede estar dañado: prueba antes con «Reparar PDF».',
      )
      return
    }

    const contenido = copiarBytes(resultado)

    // --- Verificación del resultado, antes de decidir nada ---
    const verificacion = await verificarCompresion(contenido)

    if (verificacion === null || verificacion.numeroPaginas === null) {
      responderFallo(
        peticion.identificador,
        'verificacion-fallida',
        'El documento se comprimió, pero la comprobación posterior falló, así que no se entrega.',
      )
      return
    }

    if (paginasAntes !== null && verificacion.numeroPaginas !== paginasAntes) {
      responderFallo(
        peticion.identificador,
        'verificacion-fallida',
        `El documento comprimido tiene ${verificacion.numeroPaginas} páginas y el original ${paginasAntes}. No se entrega.`,
      )
      return
    }

    const medidas = {
      tamanoOriginal,
      tamanoResultante: contenido.byteLength,
    }
    const desenlace = decidirDesenlace(medidas)

    const resumen: ResumenCompresion = {
      desenlace,
      tamanoOriginal,
      tamanoResultante: contenido.byteLength,
      porcentaje: calcularPorcentaje(medidas),
      perfil: peticion.perfil,
      paginasAntes,
      paginasDespues: verificacion.numeroPaginas,
      tieneImagenesIntocables,
    }

    responder({
      tipo: 'comprimido',
      identificador: peticion.identificador,
      // Aquí está la decisión: solo se manda el contenido si de verdad se entrega.
      contenido: seEntregaElComprimido(desenlace) ? contenido : null,
      resumen,
    })
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA, RUTA_SALIDA])
  }
}

/** Comprueba el documento comprimido en una instancia nueva del motor. */
async function verificarCompresion(contenido: Uint8Array): Promise<{
  readonly numeroPaginas: number | null
} | null> {
  const instancia = await crearInstancia()

  try {
    instancia.FS.writeFile(RUTA_ENTRADA, contenido)

    const comprobacion = ejecutar(
      instancia,
      construirArgumentosComprobacion(RUTA_ENTRADA),
      [],
    )

    // El código 2 significa que qpdf no puede leer lo que acaba de escribir: eso es
    // un fallo grave y no se entrega nada.
    if (comprobacion.codigo === 2) {
      return null
    }

    return { numeroPaginas: contarPaginas(instancia) }
  } catch {
    return null
  } finally {
    limpiarArchivos(instancia, [RUTA_ENTRADA])
  }
}

/** Atiende cada petición del hilo principal. */
self.addEventListener('message', (evento: MessageEvent<unknown>) => {
  const datos = evento.data

  if (typeof datos !== 'object' || datos === null) {
    return
  }

  // El hilo principal envía primero la dirección del WebAssembly.
  if ('tipo' in datos && datos.tipo === 'preparar') {
    urlWasm = String((datos as { readonly urlWasm?: unknown }).urlWasm ?? '')
    responder({ tipo: 'preparado' })
    return
  }

  const peticion = datos as PeticionQpdf

  const atender = async (): Promise<void> => {
    try {
      switch (peticion.tipo) {
        case 'proteger':
          await atenderProteger(peticion)
          return
        case 'desbloquear':
          await atenderDesbloquear(peticion)
          return
        case 'inspeccionar':
          await atenderInspeccionar(peticion)
          return
        case 'diagnosticar':
          await atenderDiagnosticar(peticion)
          return
        case 'analizar-seguridad':
          await atenderAnalizarSeguridad(peticion)
          return
        case 'reparar':
          await atenderReparar(peticion)
          return
        case 'comprimir':
          await atenderComprimir(peticion)
          return
        default:
          return
      }
    } catch (error) {
      const motorNoDisponible = error instanceof ErrorMotorQpdfNoDisponible

      // El mensaje original se descarta a propósito: podría venir de cualquier
      // capa y no se quiere arriesgar a publicar nada inesperado.
      responderFallo(
        peticion.identificador,
        motorNoDisponible ? 'motor-no-disponible' : 'error-interno',
        motorNoDisponible
          ? 'No se pudo cargar el motor PDF local. Comprueba tu conexión y recarga la página.'
          : 'No se pudo completar la operación por un error inesperado. Vuelve a intentarlo.',
      )
    }
  }

  // Las instancias tienen MEMFS independiente, pero comparten el recolector de la
  // consola. Serializar evita que una petición reinicie la salida de otra.
  void colaOperaciones.encolar(atender).catch(() => undefined)
})

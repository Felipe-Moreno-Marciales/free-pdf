import { createRequire } from 'node:module'
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  construirArgumentosCifrado,
  construirArgumentosDescifrado,
  construirArgumentosInforme,
  esAes256,
  interpretarInformeCifrado,
  PERMISOS_PREDETERMINADOS,
} from '../seguridad/qpdf/permisosPdf'
import {
  calcularReduccion,
  construirArgumentosCompresion,
  decidirDesenlace,
  detectarImagenesIntocables,
  REDUCCION_MINIMA_UTIL,
} from '../seguridad/qpdf/compresionPdf'
import { deducirCodigo } from '../seguridad/qpdf/erroresQpdf'
import {
  construirArgumentosComprobacion,
  construirArgumentosRecuentoPaginas,
  construirArgumentosReparacion,
  interpretarComprobacion,
} from '../seguridad/qpdf/reparacionPdf'
import type { PermisosPdf } from '../seguridad/qpdf/tipos'
import {
  CLAVES_JSON_INSPECCION,
  construirArgumentosInspeccionSeguridad,
  esEjecucionJsonUtilizable,
  leerJsonInspeccion,
  leerSalidaJsonInspeccion,
  necesitaContrasenaParaInspeccionar,
  TAMANO_MAXIMO_JSON_INSPECCION,
  VERSION_JSON_QPDF,
} from '../seguridad/qpdf/inspeccionSeguridadPdf'
import { crearRecolectorMensajesQpdf } from '../seguridad/qpdf/recolectorMensajesQpdf'
import { analizarEstructuraQpdf } from '../seguridad/inspeccion/analizarEstructura'

/**
 * Pruebas del **motor real** de qpdf, no de un simulacro.
 *
 * Una afirmación sobre criptografía no se puede sostener con dobles de prueba: si
 * aquí se dice que el documento queda cifrado con AES de 256 bits, tiene que
 * comprobarlo el propio qpdf. Por eso estas pruebas cargan el WebAssembly de
 * verdad y ejecutan las mismas órdenes que construye la aplicación.
 *
 * En Node el módulo se carga con `createRequire` y `locateFile` devuelve una ruta
 * del sistema de archivos; en el navegador es el trabajador quien lo carga y
 * `locateFile` devuelve una dirección del mismo origen. El motor y las órdenes son
 * idénticos en los dos casos.
 *
 * La consola se intercepta **antes** de cargar el pegamento de qpdf, igual que
 * hace el trabajador, porque el módulo fija su salida a `console.log` y
 * `console.error` en el momento de evaluarse.
 */

/** Mismo recolector acotado y con redacción que utiliza el Worker real. */
const recolectorMensajes = crearRecolectorMensajesQpdf()

/** Consola real, para poder informar sin quedar atrapado en la interceptación. */
const salidaReal = console.log.bind(console)

/** Interfaz mínima del sistema de archivos virtual. */
interface SistemaVirtual {
  writeFile: (ruta: string, datos: Uint8Array) => void
  readFile: (ruta: string) => Uint8Array
  stat: (ruta: string) => { readonly size: number }
  unlink: (ruta: string) => void
}

/** Interfaz mínima de una instancia de qpdf. */
interface InstanciaQpdf {
  callMain: (argumentos: string[]) => number
  FS: SistemaVirtual
}

/** Fábrica del módulo de qpdf. */
type FabricaQpdf = (opciones: {
  locateFile: () => string
  noInitialRun: boolean
}) => Promise<InstanciaQpdf>

let fabrica: FabricaQpdf
let rutaWasm: string

beforeAll(() => {
  // La interceptación se instala antes del `require`, que es cuando el pegamento
  // captura `console.log` y `console.error`.
  const recoger = (...partes: readonly unknown[]): void => {
    recolectorMensajes.recoger(...partes)
  }
  console.log = recoger
  console.error = recoger
  console.warn = recoger

  const requerir = createRequire(import.meta.url)
  rutaWasm = requerir.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm')
  fabrica = requerir('@neslinesli93/qpdf-wasm') as FabricaQpdf
})

/** Crea una instancia limpia del motor. */
async function crearInstancia(): Promise<InstanciaQpdf> {
  return await fabrica({ locateFile: () => rutaWasm, noInitialRun: true })
}

/** Resultado de una ejecución de qpdf. */
interface Ejecucion {
  readonly codigo: number
  readonly mensajes: readonly string[]
}

/** Ejecuta qpdf recogiendo su salida, como hace el trabajador. */
function ejecutar(
  instancia: InstanciaQpdf,
  argumentos: readonly string[],
  secretos: readonly string[] = [],
): Ejecucion {
  recolectorMensajes.reiniciar(secretos)

  let codigo: number
  try {
    codigo = instancia.callMain([...argumentos])
  } catch (error) {
    const estado = (error as { status?: unknown } | null)?.status
    codigo = typeof estado === 'number' ? estado : -1
  }

  const mensajes = recolectorMensajes.vaciar()

  return { codigo, mensajes }
}

/** Lee un archivo del sistema virtual, o `null` si no existe. */
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

/** Genera un PDF de prueba con el número de páginas indicado. */
async function crearPdf(numeroPaginas: number): Promise<Uint8Array> {
  const documento = await PDFDocument.create()

  for (let indice = 0; indice < numeroPaginas; indice += 1) {
    documento.addPage([200 + indice * 10, 300])
  }

  return await documento.save()
}

/** PDF válido cuyo único flujo declara Flate pero contiene bytes inválidos. */
async function crearPdfConFlujoFlateInvalido(): Promise<Uint8Array> {
  const documento = await PDFDocument.create()
  const pagina = documento.addPage()
  const flujo = documento.context.register(
    documento.context.stream(new Uint8Array([1, 2, 3, 4, 5]), {
      Filter: PDFName.of('FlateDecode'),
    }),
  )

  pagina.node.set(PDFName.of('Contents'), flujo)

  return await documento.save({ useObjectStreams: false })
}

/** Pide el informe de cifrado de un documento ya escrito en `/e.pdf`. */
function pedirInforme(
  instancia: InstanciaQpdf,
  contrasena: string | null,
): ReturnType<typeof interpretarInformeCifrado> {
  let rutaContrasena: string | null = null

  if (contrasena !== null) {
    rutaContrasena = '/clave'
    instancia.FS.writeFile(rutaContrasena, new TextEncoder().encode(contrasena))
  }

  const { mensajes } = ejecutar(
    instancia,
    construirArgumentosInforme('/e.pdf', rutaContrasena),
    contrasena === null ? [] : [contrasena],
  )

  if (rutaContrasena !== null) {
    instancia.FS.unlink(rutaContrasena)
  }

  return interpretarInformeCifrado(mensajes)
}

/** Cifra un documento con las órdenes reales de la aplicación. */
async function cifrar(
  contenido: Uint8Array,
  contrasenaUsuario: string,
  contrasenaPropietario: string,
  permisos: PermisosPdf = PERMISOS_PREDETERMINADOS,
): Promise<{ readonly bytes: Uint8Array | null; readonly ejecucion: Ejecucion }> {
  const instancia = await crearInstancia()
  instancia.FS.writeFile('/e.pdf', contenido)

  const ejecucion = ejecutar(
    instancia,
    construirArgumentosCifrado(
      '/e.pdf',
      '/s.pdf',
      contrasenaUsuario,
      contrasenaPropietario,
      permisos,
    ),
    [contrasenaUsuario, contrasenaPropietario],
  )

  return { bytes: leerSiExiste(instancia, '/s.pdf'), ejecucion }
}

/**
 * Genera un PDF benigno que declara todos los indicadores del inspector.
 *
 * Las acciones contienen datos inertes y destinos URN sin red: la prueba
 * comprueba estructura, no ejecuta ni distribuye código malicioso.
 */
async function crearPdfConIndicadoresSeguridad(): Promise<Uint8Array> {
  const documento = await PDFDocument.create()
  const pagina = documento.addPage()
  const contexto = documento.context

  await documento.attach(
    new TextEncoder().encode('adjunto benigno para una prueba automatizada'),
    'ejemplo.exe',
    { mimeType: 'application/octet-stream' },
  )

  const javascript = contexto.register(
    contexto.obj({
      S: PDFName.of('JavaScript'),
      JS: PDFString.of('void 0'),
    }),
  )
  const lanzamiento = contexto.register(
    contexto.obj({
      S: PDFName.of('Launch'),
      F: PDFString.of('manual.txt'),
    }),
  )
  const envio = contexto.register(
    contexto.obj({
      S: PDFName.of('SubmitForm'),
      F: PDFString.of('urn:free-pdf:destino-formulario-prueba'),
    }),
  )
  const enlace = contexto.register(
    contexto.obj({
      S: PDFName.of('URI'),
      URI: PDFString.of('urn:free-pdf:destino-enlace-prueba'),
    }),
  )
  const contenidoEnriquecido = contexto.register(
    contexto.obj({
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('RichMedia'),
      Rect: [0, 0, 10, 10],
    }),
  )
  const formularioXfa = contexto.register(
    contexto.obj({
      Fields: [],
      XFA: PDFString.of('estructura benigna'),
    }),
  )
  const anotacionEnvio = contexto.register(
    contexto.obj({
      A: envio,
      Rect: [0, 0, 10, 10],
      Subtype: PDFName.of('Link'),
      Type: PDFName.of('Annot'),
    }),
  )
  const anotacionEnlace = contexto.register(
    contexto.obj({
      A: enlace,
      Rect: [10, 0, 20, 10],
      Subtype: PDFName.of('Link'),
      Type: PDFName.of('Annot'),
    }),
  )

  documento.catalog.set(PDFName.of('OpenAction'), javascript)
  documento.catalog.set(
    PDFName.of('AA'),
    contexto.obj({ WC: lanzamiento }),
  )
  documento.catalog.set(PDFName.of('AcroForm'), formularioXfa)
  pagina.node.set(
    PDFName.of('Annots'),
    contexto.obj([contenidoEnriquecido, anotacionEnvio, anotacionEnlace]),
  )

  return await documento.save({ useObjectStreams: false })
}

/** OpenAction de navegación y JavaScript separado que solo se activa al pulsar. */
async function crearPdfConJavaScriptInteractivoSeparado(): Promise<Uint8Array> {
  const documento = await PDFDocument.create()
  const pagina = documento.addPage()
  const contexto = documento.context
  const javascript = contexto.register(
    contexto.obj({
      S: PDFName.of('JavaScript'),
      JS: PDFString.of('void 0'),
    }),
  )
  const anotacion = contexto.register(
    contexto.obj({
      Type: PDFName.of('Annot'),
      Subtype: PDFName.of('Link'),
      Rect: [0, 0, 10, 10],
      A: javascript,
    }),
  )
  const navegacion = contexto.register(
    contexto.obj({
      S: PDFName.of('GoTo'),
      D: contexto.obj([pagina.ref, PDFName.of('Fit')]),
    }),
  )

  pagina.node.set(PDFName.of('Annots'), contexto.obj([anotacion]))
  documento.catalog.set(PDFName.of('OpenAction'), navegacion)

  return await documento.save({ useObjectStreams: false })
}

/** Crea una tabla xref reparable para provocar el código 3 de qpdf. */
async function crearPdfConAdvertenciaReparable(): Promise<Uint8Array> {
  const documento = await PDFDocument.create()
  documento.addPage()

  const original = await documento.save({ useObjectStreams: false })
  const texto = Array.from(original, (byte) => String.fromCharCode(byte)).join(
    '',
  )
  const entradas = [...texto.matchAll(/\d{10} 00000 n/g)]
  const ultima = entradas.at(-1)?.[0]

  if (ultima === undefined) {
    throw new Error('El PDF de prueba no contiene una entrada xref utilizable.')
  }

  const alterado = texto.replace(ultima, '0000000000 00000 n')

  return Uint8Array.from(alterado, (caracter) => caracter.charCodeAt(0))
}

describe('motor qpdf: disponibilidad', () => {
  it('el WebAssembly está presente en el paquete instalado', () => {
    expect(rutaWasm).toContain('qpdf.wasm')
  })

  it('el motor se inicializa y responde a --version', async () => {
    const instancia = await crearInstancia()
    const { codigo, mensajes } = ejecutar(instancia, ['--version'])

    expect(codigo).toBe(0)
    expect(mensajes.join(' ')).toContain('version')
  })

  it('la interceptación de la consola captura la salida de qpdf', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', new TextEncoder().encode('no soy un pdf'))

    const { mensajes } = ejecutar(instancia, ['/e.pdf', '/s.pdf'])

    // Si no se capturase, esto llegaría a la consola del navegador.
    expect(mensajes.length).toBeGreaterThan(0)
  })
})

describe('motor qpdf: inspección estructural JSON', () => {
  it('construye la orden v2 con claves acotadas y sin datos de streams', () => {
    expect(
      construirArgumentosInspeccionSeguridad('/entrada.pdf', '/informe.json'),
    ).toEqual([
      '/entrada.pdf',
      '--json-output=2',
      '--json-stream-data=none',
      '--json-key=pages',
      '--json-key=acroform',
      '--json-key=attachments',
      '--json-key=encrypt',
      '--json-key=qpdf',
      '/informe.json',
    ])
    expect(VERSION_JSON_QPDF).toBe(2)
    expect(CLAVES_JSON_INSPECCION).toEqual([
      'pages',
      'acroform',
      'attachments',
      'encrypt',
      'qpdf',
    ])
  })

  it('acepta éxito limpio y éxito con advertencias', () => {
    expect(esEjecucionJsonUtilizable(0)).toBe(true)
    expect(esEjecucionJsonUtilizable(3)).toBe(true)
    expect(esEjecucionJsonUtilizable(2)).toBe(false)
    expect(esEjecucionJsonUtilizable(-1)).toBe(false)
  })

  it('reconoce las respuestas que exigen contraseña', () => {
    expect(necesitaContrasenaParaInspeccionar(['invalid password'])).toBe(true)
    expect(necesitaContrasenaParaInspeccionar(['password required'])).toBe(true)
    expect(necesitaContrasenaParaInspeccionar(['File is encrypted'])).toBe(false)
  })

  it('valida el límite antes de decodificar y rechaza JSON inválido', () => {
    expect(
      leerJsonInspeccion(new TextEncoder().encode('{"version":2}')),
    ).toEqual({ version: 2 })
    expect(() => leerJsonInspeccion(new TextEncoder().encode('{'))).toThrow(
      'no válido',
    )
    expect(() =>
      leerJsonInspeccion(
        new Uint8Array(TAMANO_MAXIMO_JSON_INSPECCION + 1),
      ),
    ).toThrow('demasiado grande')
  })

  it('rechaza por stat un JSON excesivo antes de llamar a readFile', () => {
    let intentoLectura = false

    const resultado = leerSalidaJsonInspeccion(
      {
        stat: () => ({ size: TAMANO_MAXIMO_JSON_INSPECCION + 1 }),
        readFile: () => {
          intentoLectura = true
          return new Uint8Array()
        },
      },
      '/informe.json',
    )

    expect(resultado).toEqual({ estado: 'demasiado-grande' })
    expect(intentoLectura).toBe(false)
  })

  it('escribe JSON parseable en el sistema virtual y omite los streams', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/inspeccion.pdf', await crearPdf(2))

    const { codigo } = ejecutar(
      instancia,
      construirArgumentosInspeccionSeguridad(
        '/inspeccion.pdf',
        '/inspeccion.json',
      ),
    )
    const tamanoSalida = instancia.FS.stat('/inspeccion.json').size
    const salida = leerSiExiste(instancia, '/inspeccion.json')

    expect(codigo).toBe(0)
    expect(salida).not.toBeNull()
    expect(tamanoSalida).toBe((salida as Uint8Array).byteLength)

    // `readFile` entrega una copia: el original se puede borrar antes de parsear.
    instancia.FS.unlink('/inspeccion.json')
    expect(leerSiExiste(instancia, '/inspeccion.json')).toBeNull()

    const json = leerJsonInspeccion(salida as Uint8Array) as {
      readonly pages?: readonly unknown[]
      readonly qpdf?: readonly unknown[]
    }

    expect(json.pages).toHaveLength(2)
    expect(json.qpdf).toHaveLength(2)
    expect(JSON.stringify(json)).not.toContain('"data"')
  })

  it('el JSON del Inspector no decodifica un stream Flate inválido', async () => {
    const contenido = await crearPdfConFlujoFlateInvalido()
    const instanciaJson = await crearInstancia()
    instanciaJson.FS.writeFile('/flujo-invalido.pdf', contenido)

    const inspeccion = ejecutar(
      instanciaJson,
      construirArgumentosInspeccionSeguridad(
        '/flujo-invalido.pdf',
        '/flujo-invalido.json',
      ),
    )

    expect(inspeccion.codigo).toBe(0)
    expect(inspeccion.mensajes.join(' ').toLowerCase()).not.toContain('inflate')
    expect(leerSiExiste(instanciaJson, '/flujo-invalido.json')).not.toBeNull()

    // Esta comparación protege la propiedad que importa: `--check` sí intenta
    // inflarlo, de modo que no debe volver a formar parte de la ruta del Inspector.
    const instanciaComprobacion = await crearInstancia()
    instanciaComprobacion.FS.writeFile('/flujo-invalido.pdf', contenido)
    const comprobacion = ejecutar(
      instanciaComprobacion,
      construirArgumentosComprobacion('/flujo-invalido.pdf'),
    )

    expect(comprobacion.codigo).toBe(2)
    expect(comprobacion.mensajes.join(' ').toLowerCase()).toContain('inflate')
  })

  it('conserva un JSON válido cuando qpdf termina con advertencias', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile(
      '/advertencia.pdf',
      await crearPdfConAdvertenciaReparable(),
    )

    const ejecucion = ejecutar(
      instancia,
      construirArgumentosInspeccionSeguridad(
        '/advertencia.pdf',
        '/advertencia.json',
      ),
    )
    const salida = leerSiExiste(instancia, '/advertencia.json')

    expect(ejecucion.codigo).toBe(3)
    expect(esEjecucionJsonUtilizable(ejecucion.codigo)).toBe(true)
    expect(salida).not.toBeNull()

    const informe = analizarEstructuraQpdf(
      leerJsonInspeccion(salida as Uint8Array),
      {
        numeroPaginas: null,
        diagnostico: interpretarComprobacion(
          ejecucion.codigo,
          ejecucion.mensajes,
        ),
      },
    )

    // La tabla dañada impide que el bloque `pages` sea fiable. La ruta de una sola
    // pasada informa `null` en vez de ejecutar un segundo comando o inventar el dato.
    expect(informe.numeroPaginas).toBeNull()
    expect(informe.estadoEstructura).toBe('con-advertencias')
  })

  it('preserva los indicadores solicitados y omite datos de streams', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile(
      '/indicadores.pdf',
      await crearPdfConIndicadoresSeguridad(),
    )

    const inspeccion = ejecutar(
      instancia,
      construirArgumentosInspeccionSeguridad(
        '/indicadores.pdf',
        '/indicadores.json',
      ),
    )
    const salida = leerSiExiste(instancia, '/indicadores.json')

    expect(inspeccion.codigo).toBe(0)
    expect(salida).not.toBeNull()

    const datos = leerJsonInspeccion(salida as Uint8Array)
    const texto = JSON.stringify(datos)

    for (const indicador of [
      '/JavaScript',
      '/JS',
      '/OpenAction',
      '/AA',
      '/Launch',
      '/EmbeddedFiles',
      '/EmbeddedFile',
      '/SubmitForm',
      '/URI',
      '/RichMedia',
      '/AcroForm',
      '/XFA',
    ]) {
      expect(texto).toContain(`"${indicador}"`)
    }

    expect(texto).not.toContain('adjunto benigno para una prueba automatizada')
    expect(texto).not.toContain('"data"')

    const informe = analizarEstructuraQpdf(datos, {
      numeroPaginas: null,
      diagnostico: interpretarComprobacion(
        inspeccion.codigo,
        inspeccion.mensajes,
      ),
    })

    expect(informe.numeroPaginas).toBe(1)
    expect(informe.nivel).toBe('elevado')
    expect(informe.hallazgos.map((hallazgo) => hallazgo.tipo)).toEqual(
      expect.arrayContaining([
        'javascript',
        'accion-apertura',
        'accion-adicional',
        'launch',
        'archivo-incrustado',
        'ejecutable-incrustado',
        'envio-formulario',
        'enlace-externo',
        'contenido-multimedia',
        'formulario',
        'xfa',
      ]),
    )
    expect(informe.archivosIncrustados[0]).toMatchObject({
      nombre: 'ejemplo.exe',
      extension: '.exe',
      tipoDeclarado: 'application/octet-stream',
      aparentaEjecutable: true,
    })
  })

  it('no atribuye JavaScript interactivo a una OpenAction de navegación real', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile(
      '/navegacion.pdf',
      await crearPdfConJavaScriptInteractivoSeparado(),
    )
    const inspeccion = ejecutar(
      instancia,
      construirArgumentosInspeccionSeguridad(
        '/navegacion.pdf',
        '/navegacion.json',
      ),
    )
    const salida = leerSiExiste(instancia, '/navegacion.json')

    expect(inspeccion.codigo).toBe(0)
    expect(salida).not.toBeNull()

    const informe = analizarEstructuraQpdf(
      leerJsonInspeccion(salida as Uint8Array),
      {
        numeroPaginas: null,
        diagnostico: interpretarComprobacion(
          inspeccion.codigo,
          inspeccion.mensajes,
        ),
      },
    )

    expect(
      informe.hallazgos.find(
        (hallazgo) => hallazgo.tipo === 'accion-apertura',
      )?.severidad,
    ).toBe('media')
    expect(informe.nivel).toBe('precaucion')
  })

  it('un PDF cifrado sin contraseña no produce un informe parcial', async () => {
    const { bytes } = await cifrar(
      await crearPdf(1),
      'clave-inspector',
      'dueno-inspector',
    )
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/cifrado.pdf', bytes as Uint8Array)

    const ejecucion = ejecutar(
      instancia,
      construirArgumentosInspeccionSeguridad(
        '/cifrado.pdf',
        '/cifrado.json',
      ),
    )

    expect(ejecucion.codigo).toBe(2)
    expect(necesitaContrasenaParaInspeccionar(ejecucion.mensajes)).toBe(true)
    expect(leerSiExiste(instancia, '/cifrado.json')).toBeNull()
  })

  it('informa el cifrado que se puede abrir sin contraseña', async () => {
    const { bytes, ejecucion: cifrado } = await cifrar(
      await crearPdf(1),
      '',
      'dueno-inspector-sin-clave',
    )

    expect(cifrado.codigo).toBe(0)

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/cifrado-legible.pdf', bytes as Uint8Array)

    const inspeccion = ejecutar(
      instancia,
      construirArgumentosInspeccionSeguridad(
        '/cifrado-legible.pdf',
        '/cifrado-legible.json',
      ),
    )
    const salida = leerSiExiste(instancia, '/cifrado-legible.json')

    expect(inspeccion.codigo).toBe(0)
    expect(salida).not.toBeNull()

    const informe = analizarEstructuraQpdf(
      leerJsonInspeccion(salida as Uint8Array),
      {
        numeroPaginas: null,
        diagnostico: interpretarComprobacion(
          inspeccion.codigo,
          inspeccion.mensajes,
        ),
      },
    )

    expect(informe.cifrado).toBe(true)
    expect(informe.numeroPaginas).toBe(1)
    expect(informe.analisisCompleto).toBe(true)
  })

  it('un archivo dañado falla sin fabricar un JSON de seguridad', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile(
      '/danado.pdf',
      new TextEncoder().encode('%PDF-1.4 estructura incompleta'),
    )

    const ejecucion = ejecutar(
      instancia,
      construirArgumentosInspeccionSeguridad(
        '/danado.pdf',
        '/danado.json',
      ),
    )

    expect(ejecucion.codigo).toBe(2)
    expect(deducirCodigo(ejecucion.mensajes)).toBe('documento-danado')
    expect(leerSiExiste(instancia, '/danado.json')).toBeNull()
  })
})

describe('motor qpdf: cifrado AES-256', () => {
  it('cifra un documento y declara AESv3 con revisión 6', async () => {
    const original = await crearPdf(3)
    const { bytes, ejecucion } = await cifrar(original, 'clave-de-apertura', 'clave-de-dueno')

    expect(ejecucion.codigo).toBe(0)
    expect(bytes).not.toBeNull()

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    const informe = pedirInforme(instancia, 'clave-de-dueno')

    expect(informe.cifrado).toBe(true)
    expect(informe.revision).toBe(6)
    expect(informe.metodo).toBe('AESv3')
    expect(esAes256(informe)).toBe(true)
  })

  it('el documento cifrado contiene el diccionario de cifrado', async () => {
    const { bytes } = await cifrar(await crearPdf(1), 'clave-larga-1', 'dueno-largo-1')
    const texto = new TextDecoder('latin1').decode(bytes as Uint8Array)

    expect(texto).toContain('/Encrypt')
    expect(texto).toContain('AESV3')
  })

  it('la contraseña no aparece en claro dentro del documento cifrado', async () => {
    const clave = 'contraseña-muy-reconocible-9f3a'
    const { bytes } = await cifrar(await crearPdf(1), clave, 'dueno-largo-2')
    const texto = new TextDecoder('latin1').decode(bytes as Uint8Array)

    expect(texto).not.toContain(clave)
  })

  it('pdf-lib no puede abrir el documento cifrado sin contraseña', async () => {
    const { bytes } = await cifrar(await crearPdf(2), 'clave-larga-3', 'dueno-largo-3')

    await expect(
      PDFDocument.load(bytes as Uint8Array, { ignoreEncryption: false }),
    ).rejects.toThrow()
  })

  it('graba los permisos que se le indican', async () => {
    const permisos: PermisosPdf = {
      impresion: 'baja',
      extraccion: false,
      accesibilidad: true,
      anotaciones: true,
      formularios: true,
      ensamblado: false,
      otrasModificaciones: false,
    }
    const { bytes } = await cifrar(
      await crearPdf(1),
      'clave-larga-4',
      'dueno-largo-4',
      permisos,
    )

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    const informe = pedirInforme(instancia, 'dueno-largo-4')

    expect(informe.permisos['print low resolution']).toBe(true)
    expect(informe.permisos['print high resolution']).toBe(false)
    expect(informe.permisos['extract for any purpose']).toBe(false)
    expect(informe.permisos['extract for accessibility']).toBe(true)
    expect(informe.permisos['modify annotations']).toBe(true)
    expect(informe.permisos['modify document assembly']).toBe(false)
  })

  it('deniega los permisos cuando se piden denegados', async () => {
    const { bytes } = await cifrar(
      await crearPdf(1),
      'clave-larga-5',
      'dueno-largo-5',
      {
        impresion: 'ninguna',
        extraccion: false,
        accesibilidad: true,
        anotaciones: false,
        formularios: false,
        ensamblado: false,
        otrasModificaciones: false,
      },
    )

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    const informe = pedirInforme(instancia, 'dueno-largo-5')

    expect(informe.permisos['print low resolution']).toBe(false)
    expect(informe.permisos['print high resolution']).toBe(false)
    expect(informe.permisos['extract for any purpose']).toBe(false)
    expect(informe.permisos['modify anything']).toBe(false)
  })

  it('con AES-256 la extracción para accesibilidad se permite siempre', async () => {
    // El bit de accesibilidad desapareció de la especificación en los formatos de
    // cifrado modernos, así que qpdf lo ignora y avisa de ello. Por eso la
    // herramienta no ofrece un control que no tendría ningún efecto.
    const { bytes } = await cifrar(
      await crearPdf(1),
      'clave-larga-acc',
      'dueno-largo-acc',
      {
        impresion: 'ninguna',
        extraccion: false,
        accesibilidad: false,
        anotaciones: false,
        formularios: false,
        ensamblado: false,
        otrasModificaciones: false,
      },
    )

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    const informe = pedirInforme(instancia, 'dueno-largo-acc')

    expect(informe.permisos['extract for accessibility']).toBe(true)
  })

  it('qpdf avisa de que ignora la denegación de accesibilidad', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', await crearPdf(1))

    const { mensajes } = ejecutar(
      instancia,
      construirArgumentosCifrado('/e.pdf', '/s.pdf', 'clave-larga-av', 'dueno-largo-av', {
        impresion: 'completa',
        extraccion: true,
        accesibilidad: false,
        anotaciones: true,
        formularios: true,
        ensamblado: true,
        otrasModificaciones: true,
      }),
      ['clave-larga-av', 'dueno-largo-av'],
    )

    expect(mensajes.join(' ')).toContain('accessibility')
    expect(mensajes.join(' ')).toContain('ignored')
  })
})

describe('motor qpdf: descifrado', () => {
  it('la contraseña correcta descifra el documento', async () => {
    const clave = 'clave-de-apertura-correcta'
    const { bytes } = await cifrar(await crearPdf(3), clave, 'dueno-largo-6')

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    instancia.FS.writeFile('/clave', new TextEncoder().encode(clave))

    const { codigo } = ejecutar(
      instancia,
      construirArgumentosDescifrado('/e.pdf', '/s.pdf', '/clave'),
      [clave],
    )

    expect(codigo).toBe(0)

    const claro = leerSiExiste(instancia, '/s.pdf')
    expect(claro).not.toBeNull()
    expect(
      new TextDecoder('latin1').decode(claro as Uint8Array),
    ).not.toContain('/Encrypt')
  })

  it('el documento descifrado conserva el número de páginas', async () => {
    const clave = 'clave-de-apertura-paginas'
    const { bytes } = await cifrar(await crearPdf(5), clave, 'dueno-largo-7')

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    instancia.FS.writeFile('/clave', new TextEncoder().encode(clave))
    ejecutar(
      instancia,
      construirArgumentosDescifrado('/e.pdf', '/s.pdf', '/clave'),
      [clave],
    )

    const claro = leerSiExiste(instancia, '/s.pdf')
    const documento = await PDFDocument.load(claro as Uint8Array)

    expect(documento.getPageCount()).toBe(5)
  })

  it('pdf-lib puede abrir el documento descifrado', async () => {
    const clave = 'clave-de-apertura-pdflib'
    const { bytes } = await cifrar(await crearPdf(2), clave, 'dueno-largo-8')

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    instancia.FS.writeFile('/clave', new TextEncoder().encode(clave))
    ejecutar(
      instancia,
      construirArgumentosDescifrado('/e.pdf', '/s.pdf', '/clave'),
      [clave],
    )

    await expect(
      PDFDocument.load(leerSiExiste(instancia, '/s.pdf') as Uint8Array, {
        ignoreEncryption: false,
      }),
    ).resolves.toBeDefined()
  })

  it('el informe del resultado ya no declara cifrado', async () => {
    const clave = 'clave-de-apertura-informe'
    const { bytes } = await cifrar(await crearPdf(1), clave, 'dueno-largo-9')

    const cifrador = await crearInstancia()
    cifrador.FS.writeFile('/e.pdf', bytes as Uint8Array)
    cifrador.FS.writeFile('/clave', new TextEncoder().encode(clave))
    ejecutar(
      cifrador,
      construirArgumentosDescifrado('/e.pdf', '/s.pdf', '/clave'),
      [clave],
    )
    const claro = leerSiExiste(cifrador, '/s.pdf')

    const verificador = await crearInstancia()
    verificador.FS.writeFile('/e.pdf', claro as Uint8Array)

    expect(pedirInforme(verificador, null).cifrado).toBe(false)
  })
})

describe('motor qpdf: errores y contraseñas', () => {
  it('la contraseña incorrecta falla y se reconoce como tal', async () => {
    const { bytes } = await cifrar(
      await crearPdf(1),
      'la-correcta-1234',
      'dueno-largo-10',
    )

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    instancia.FS.writeFile('/clave', new TextEncoder().encode('la-equivocada'))

    const { codigo, mensajes } = ejecutar(
      instancia,
      construirArgumentosDescifrado('/e.pdf', '/s.pdf', '/clave'),
      ['la-equivocada'],
    )

    expect(codigo).not.toBe(0)
    expect(deducirCodigo(mensajes)).toBe('contrasena-incorrecta')
  })

  it('los mensajes de error no contienen la contraseña', async () => {
    const clave = 'secreto-inconfundible-7b2c'
    const { bytes } = await cifrar(
      await crearPdf(1),
      'la-correcta-5678',
      'dueno-largo-11',
    )

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    instancia.FS.writeFile('/clave', new TextEncoder().encode(clave))

    const { mensajes } = ejecutar(
      instancia,
      construirArgumentosDescifrado('/e.pdf', '/s.pdf', '/clave'),
      [clave],
    )

    expect(mensajes.join(' ')).not.toContain(clave)
  })

  it('la contraseña no viaja en los argumentos al descifrar', () => {
    const argumentos = construirArgumentosDescifrado(
      '/e.pdf',
      '/s.pdf',
      '/clave',
    )

    expect(argumentos.join(' ')).not.toContain('secreto')
    expect(argumentos).toContain('--password-file=/clave')
  })

  it('un documento dañado se distingue de una contraseña incorrecta', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile(
      '/e.pdf',
      new TextEncoder().encode('%PDF-1.4 basura sin tabla'),
    )

    const { codigo, mensajes } = ejecutar(instancia, [
      '--show-encryption',
      '/e.pdf',
    ])

    expect(codigo).not.toBe(0)
    expect(deducirCodigo(mensajes)).toBe('documento-danado')
  })

  it('un documento sin cifrar se informa como no cifrado', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', await crearPdf(2))

    expect(pedirInforme(instancia, null).cifrado).toBe(false)
  })

  it('qpdf rechaza la contraseña de propietario vacía con AES-256', async () => {
    // Es el motivo por el que la aplicación genera una aleatoria: dejarla vacía
    // permitiría abrir el documento sin contraseña.
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', await crearPdf(1))

    const { codigo, mensajes } = ejecutar(instancia, [
      '--encrypt',
      '--user-password=solo-usuario',
      '--owner-password=',
      '--bits=256',
      '--',
      '/e.pdf',
      '/s.pdf',
    ])

    expect(codigo).not.toBe(0)
    expect(mensajes.join(' ')).toContain('insecure')
  })
})

describe('motor qpdf: limpieza del sistema virtual', () => {
  it('los archivos se pueden borrar después de usarlos', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', await crearPdf(1))
    instancia.FS.writeFile('/clave', new TextEncoder().encode('algo'))

    instancia.FS.unlink('/e.pdf')
    instancia.FS.unlink('/clave')

    expect(leerSiExiste(instancia, '/e.pdf')).toBeNull()
    expect(leerSiExiste(instancia, '/clave')).toBeNull()
  })

  it('cada instancia arranca con el sistema de archivos vacío', async () => {
    const primera = await crearInstancia()
    primera.FS.writeFile('/e.pdf', await crearPdf(1))

    const segunda = await crearInstancia()

    expect(leerSiExiste(segunda, '/e.pdf')).toBeNull()
  })

  it('el archivo de contraseña no sobrevive a la operación', async () => {
    const clave = 'clave-que-debe-desaparecer'
    const { bytes } = await cifrar(
      await crearPdf(1),
      clave,
      'dueno-largo-12',
    )

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    instancia.FS.writeFile('/clave', new TextEncoder().encode(clave))
    ejecutar(
      instancia,
      construirArgumentosDescifrado('/e.pdf', '/s.pdf', '/clave'),
      [clave],
    )
    instancia.FS.unlink('/clave')

    expect(leerSiExiste(instancia, '/clave')).toBeNull()
    void salidaReal
  })
})


/**
 * Reparación con el motor real.
 *
 * Estas pruebas son las que sostienen la herramienta «Reparar PDF», y están escritas
 * a partir de lo que qpdf hace **de verdad**, medido con este mismo motor. La primera
 * versión daba por hecho que qpdf reconstruye cualquier tabla de referencias rota;
 * ejecutarlo demostró que no es así, y las pruebas afirman ahora el comportamiento
 * real en lugar del esperado.
 *
 * Resumen de lo comprobado con qpdf 12.2.0:
 *
 * | Daño                                   | `--check` | ¿Escribe salida? |
 * | -------------------------------------- | --------- | ---------------- |
 * | Ninguno                                | 0         | Sí               |
 * | Basura antes de `%PDF`                 | 0         | Sí               |
 * | `startxref` borrado                    | 2         | **No**           |
 * | Desplazamiento de `startxref` falseado | 2         | **No**           |
 * | Entradas de la tabla falseadas         | 2         | **No**           |
 * | No es un PDF                           | 2         | **No**           |
 *
 * La conclusión que importa: cuando qpdf no puede leer el documento, no hay nada que
 * recuperar. La herramienta lo intenta y dice qué ha salido, sin prometer nada.
 */
describe('motor real de qpdf: reparación', () => {
  /** Busca la última aparición de un texto ASCII dentro de unos bytes. */
  function ultimoIndiceDe(bytes: Uint8Array, texto: string): number {
    const patron = [...texto].map((caracter) => caracter.charCodeAt(0))

    for (let inicio = bytes.length - patron.length; inicio >= 0; inicio -= 1) {
      let coincide = true

      for (let salto = 0; salto < patron.length; salto += 1) {
        if (bytes[inicio + salto] !== patron[salto]) {
          coincide = false
          break
        }
      }

      if (coincide) {
        return inicio
      }
    }

    return -1
  }

  /**
   * Sobrescribe la palabra `startxref`, dejando el archivo del mismo tamaño.
   *
   * La corrupción se hace **sobre los bytes**, nunca convirtiendo a texto y de vuelta:
   * pasar un PDF por `TextDecoder` y `TextEncoder` recodifica a UTF-8 todos los bytes
   * a partir del 0x80 y destruye el archivo mucho más allá de lo que se pretendía.
   */
  function borrarStartxref(bytes: Uint8Array): Uint8Array {
    const copia = new Uint8Array(bytes)
    const posicion = ultimoIndiceDe(copia, 'startxref')

    for (let salto = 0; salto < 'startxref'.length; salto += 1) {
      copia[posicion + salto] = 0x78
    }

    return copia
  }

  /** Falsea el desplazamiento que sigue a `startxref`. */
  function falsearDesplazamiento(bytes: Uint8Array): Uint8Array {
    const copia = new Uint8Array(bytes)
    let indice = ultimoIndiceDe(copia, 'startxref') + 'startxref'.length

    while (
      indice < copia.length &&
      (copia[indice] === 0x0a || copia[indice] === 0x0d || copia[indice] === 0x20)
    ) {
      indice += 1
    }

    while (
      indice < copia.length &&
      (copia[indice] ?? 0) >= 0x30 &&
      (copia[indice] ?? 0) <= 0x39
    ) {
      copia[indice] = 0x39
      indice += 1
    }

    return copia
  }

  /**
   * Añade bytes de basura antes de la cabecera.
   *
   * Es una corrupción muy real: ocurre cuando un servidor mal configurado antepone
   * una cabecera HTTP o un mensaje de error al archivo. Desplaza todos los
   * desplazamientos internos del documento.
   */
  function prefijarBasura(bytes: Uint8Array, cuantos: number): Uint8Array {
    const salida = new Uint8Array(cuantos + bytes.length)
    salida.fill(0x41, 0, cuantos)
    salida.set(bytes, cuantos)

    return salida
  }

  /** Diagnostica unos bytes con el motor real. */
  async function diagnosticar(bytes: Uint8Array) {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes)

    const revision = ejecutar(
      instancia,
      construirArgumentosComprobacion('/e.pdf'),
    )

    return {
      instancia,
      diagnostico: interpretarComprobacion(revision.codigo, revision.mensajes),
      codigo: revision.codigo,
    }
  }

  /** Cuenta las páginas del documento escrito en la ruta indicada. */
  function contarPaginas(
    instancia: InstanciaQpdf,
    ruta: string,
  ): number | null {
    const recuento = ejecutar(
      instancia,
      construirArgumentosRecuentoPaginas(ruta),
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

  /** Repara unos bytes y devuelve la salida, que puede ser `null`. */
  async function reparar(
    bytes: Uint8Array,
    nivel: 'conservador' | 'completo' = 'conservador',
  ): Promise<{ readonly salida: Uint8Array | null; readonly codigo: number }> {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes)

    const { codigo } = ejecutar(
      instancia,
      construirArgumentosReparacion('/e.pdf', '/s.pdf', nivel),
    )

    return { salida: leerSiExiste(instancia, '/s.pdf'), codigo }
  }

  it('un documento sano se diagnostica como intacto y sin hallazgos', async () => {
    const { diagnostico } = await diagnosticar(await crearPdf(3))

    expect(diagnostico.estado).toBe('intacto')
    expect(diagnostico.hallazgos).toHaveLength(0)
    expect(diagnostico.necesitaContrasena).toBe(false)
  })

  it('cuenta las páginas de un documento sano', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', await crearPdf(4))

    expect(contarPaginas(instancia, '/e.pdf')).toBe(4)
  })

  it('reescribe un documento sano y conserva sus páginas', async () => {
    const { salida } = await reparar(await crearPdf(3))

    expect(salida).not.toBeNull()

    const reabierto = await PDFDocument.load(salida as Uint8Array)
    expect(reabierto.getPageCount()).toBe(3)
  })

  it('recupera un documento con basura antes de la cabecera', async () => {
    const roto = prefijarBasura(await crearPdf(3), 40)
    const { salida, codigo } = await reparar(roto)

    expect(codigo).toBe(0)
    expect(salida).not.toBeNull()

    // Y el resultado es un PDF de verdad, con todas sus páginas.
    const reabierto = await PDFDocument.load(salida as Uint8Array)
    expect(reabierto.getPageCount()).toBe(3)
  })

  it('el resultado de esa recuperación ya no lleva la basura delante', async () => {
    const roto = prefijarBasura(await crearPdf(2), 40)
    const { salida } = await reparar(roto)
    const bytes = salida as Uint8Array

    // El archivo reparado empieza por la cabecera PDF, no por las «A» de la basura.
    expect(bytes[0]).toBe('%'.charCodeAt(0))
    expect(bytes[1]).toBe('P'.charCodeAt(0))
  })

  it('qpdf lee la basura del principio sin quejarse, así que el diagnóstico sale limpio', async () => {
    // Es una limitación honesta del diagnóstico y está documentada: «sin problemas»
    // significa que qpdf no encontró errores, no que todos los lectores lo acepten.
    const { diagnostico } = await diagnosticar(
      prefijarBasura(await crearPdf(2), 40),
    )

    expect(diagnostico.estado).toBe('intacto')
  })

  it('con startxref borrado, qpdf no escribe nada: no hay reparación posible', async () => {
    const { salida, codigo } = await reparar(borrarStartxref(await crearPdf(3)))

    expect(codigo).toBe(2)
    expect(salida === null || salida.byteLength === 0).toBe(true)
  })

  it('y ese caso se diagnostica como dañado, no como intacto', async () => {
    const { diagnostico } = await diagnosticar(
      borrarStartxref(await crearPdf(3)),
    )

    expect(diagnostico.estado).not.toBe('intacto')
    expect(diagnostico.hallazgos.length).toBeGreaterThan(0)
    expect(diagnostico.hallazgos[0]?.clase).toBe('referencias-cruzadas')
  })

  it('con el desplazamiento falseado tampoco escribe nada', async () => {
    const { salida, codigo } = await reparar(
      falsearDesplazamiento(await crearPdf(3)),
    )

    expect(codigo).toBe(2)
    expect(salida === null || salida.byteLength === 0).toBe(true)
  })

  it('ese daño se clasifica como problema de referencias cruzadas', async () => {
    // qpdf lo describe como «xref stream, offset N: expected n n obj», así que se
    // clasifica por la estructura afectada y no por el objeto al que no llegó.
    const { diagnostico } = await diagnosticar(
      falsearDesplazamiento(await crearPdf(3)),
    )

    expect(diagnostico.hallazgos[0]?.clase).toBe('referencias-cruzadas')
  })

  it('el mensaje de qpdf se conserva literal, para poder verlo tal cual', async () => {
    const { diagnostico } = await diagnosticar(
      falsearDesplazamiento(await crearPdf(3)),
    )

    expect(diagnostico.hallazgos[0]?.mensaje).toContain('expected n n obj')
  })

  it('un archivo que no es un PDF no produce ninguna salida', async () => {
    const basura = new TextEncoder().encode('esto no es un PDF en absoluto')
    const { salida } = await reparar(basura)

    expect(salida === null || salida.byteLength === 0).toBe(true)
  })

  it('no se puede contar las páginas de un archivo que no es un PDF', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile(
      '/e.pdf',
      new TextEncoder().encode('nada de esto es un PDF'),
    )

    expect(contarPaginas(instancia, '/e.pdf')).toBeNull()
  })

  it('un documento cifrado se detecta como que necesita contraseña', async () => {
    const { bytes } = await cifrar(await crearPdf(2), 'secreta12', 'dueno1234')
    const { diagnostico } = await diagnosticar(bytes as Uint8Array)

    expect(diagnostico.necesitaContrasena).toBe(true)
  })

  it('el nivel completo también produce un documento válido', async () => {
    const { salida } = await reparar(await crearPdf(3), 'completo')
    const reabierto = await PDFDocument.load(salida as Uint8Array)

    expect(reabierto.getPageCount()).toBe(3)
  })

  it('reparar es idempotente: el resultado de reparar dos veces sigue teniendo las páginas', async () => {
    const original = prefijarBasura(await crearPdf(3), 32)

    const primera = await reparar(original)
    const segunda = await reparar(primera.salida as Uint8Array)

    const reabierto = await PDFDocument.load(segunda.salida as Uint8Array)
    expect(reabierto.getPageCount()).toBe(3)
  })

  it('reparar no cifra el documento: sigue abriéndose sin contraseña', async () => {
    const { salida } = await reparar(await crearPdf(2))

    const revision = await crearInstancia()
    revision.FS.writeFile('/e.pdf', salida as Uint8Array)

    expect(pedirInforme(revision, null).cifrado).toBe(false)
  })

  it('el documento reparado se puede abrir con pdf-lib sin ignoreEncryption', async () => {
    const { salida } = await reparar(prefijarBasura(await crearPdf(2), 16))

    const reabierto = await PDFDocument.load(salida as Uint8Array, {
      ignoreEncryption: false,
    })

    expect(reabierto.getPageCount()).toBe(2)
  })

  it('el sistema de archivos virtual se puede dejar limpio tras reparar', async () => {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', await crearPdf(1))
    ejecutar(instancia, construirArgumentosReparacion('/e.pdf', '/s.pdf'))

    instancia.FS.unlink('/e.pdf')
    instancia.FS.unlink('/s.pdf')

    expect(leerSiExiste(instancia, '/e.pdf')).toBeNull()
    expect(leerSiExiste(instancia, '/s.pdf')).toBeNull()
  })
})

/**
 * Compresión con el motor real.
 *
 * Estas pruebas sostienen las cifras que la herramienta «Comprimir PDF» afirma. No
 * comprueban un número exacto —depende de la versión de qpdf y de zlib— sino las
 * **relaciones** que sí deben cumplirse siempre:
 *
 * - Los flujos de objetos reducen de verdad un documento que no los tenía.
 * - `--compress-streams=y` por sí solo no aporta nada, porque ya es el comportamiento
 *   de partida. Es el motivo de que el perfil estructural no se limite a esa opción.
 * - **Un JPEG incrustado sobrevive intacto y apenas se reduce.** Es la afirmación más
 *   importante de todas, porque es la que impide prometer que se comprimen imágenes.
 * - `--linearize` y `--normalize-content=y` agrandan el archivo, así que no se ofrecen.
 */
describe('motor real de qpdf: compresión', () => {
  /** Documento con mucho texto y sin flujos de objetos: el caso favorable. */
  async function pdfConTexto(paginas = 20): Promise<Uint8Array> {
    const documento = await PDFDocument.create()
    const tipografia = await documento.embedFont(StandardFonts.Helvetica)

    for (let pagina = 0; pagina < paginas; pagina += 1) {
      const hoja = documento.addPage([595, 842])

      for (let linea = 0; linea < 40; linea += 1) {
        hoja.drawText(
          `Linea ${linea} de la pagina ${pagina} con texto de relleno repetido`,
          { x: 40, y: 800 - linea * 19, size: 10, font: tipografia },
        )
      }
    }

    return await documento.save({ useObjectStreams: false })
  }

  /** El mismo documento pero ya guardado con flujos de objetos. */
  async function pdfYaOptimizado(paginas = 20): Promise<Uint8Array> {
    const documento = await PDFDocument.create()
    const tipografia = await documento.embedFont(StandardFonts.Helvetica)

    for (let pagina = 0; pagina < paginas; pagina += 1) {
      const hoja = documento.addPage([595, 842])

      for (let linea = 0; linea < 40; linea += 1) {
        hoja.drawText(
          `Linea ${linea} de la pagina ${pagina} con texto de relleno repetido`,
          { x: 40, y: 800 - linea * 19, size: 10, font: tipografia },
        )
      }
    }

    return await documento.save({ useObjectStreams: true })
  }

  /**
   * JPEG baseline mínimo pero válido, con datos incompresibles.
   *
   * Se construye a mano porque hace falta un JPEG de verdad —con su `DCTDecode`— para
   * poder comprobar que qpdf no lo toca. Los datos del escaneo son seudoaleatorios y
   * deterministas, y se evita el byte 0xFF para no introducir marcadores por accidente.
   */
  function jpegDePrueba(lado: number): Uint8Array {
    const tablaCuantizacion = Array.from({ length: 64 }, () => 0x01)
    const tablaHuffman = [
      0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
      ...Array.from({ length: 12 }, (_, indice) => indice),
    ]

    const cabecera = [
      0xff, 0xd8,
      0xff, 0xdb, 0x00, 0x43, 0x00, ...tablaCuantizacion,
      0xff, 0xc0, 0x00, 0x0b, 0x08,
      (lado >> 8) & 0xff, lado & 0xff,
      (lado >> 8) & 0xff, lado & 0xff,
      0x01, 0x01, 0x11, 0x00,
      0xff, 0xc4, 0x00, 0x1f, 0x00, ...tablaHuffman,
      0xff, 0xc4, 0x00, 0x1f, 0x10, ...tablaHuffman,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x00,
    ]

    const datos: number[] = []
    let semilla = 987654321

    for (let indice = 0; indice < lado * lado; indice += 1) {
      semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
      const byte = semilla & 0xff
      datos.push(byte === 0xff ? 0xfe : byte)
    }

    return new Uint8Array([...cabecera, ...datos, 0xff, 0xd9])
  }

  /** Documento cuyo peso es un JPEG: el caso donde la compresión no ayuda. */
  async function pdfConJpeg(): Promise<Uint8Array> {
    const documento = await PDFDocument.create()
    const imagen = await documento.embedJpg(jpegDePrueba(300))

    for (let pagina = 0; pagina < 6; pagina += 1) {
      documento
        .addPage([595, 842])
        .drawImage(imagen, { x: 50, y: 300, width: 450, height: 450 })
    }

    return await documento.save({ useObjectStreams: false })
  }

  /** Ejecuta qpdf con unos argumentos y devuelve la salida. */
  async function ejecutarQpdf(
    bytes: Uint8Array,
    argumentos: readonly string[],
  ): Promise<Uint8Array | null> {
    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes)
    ejecutar(instancia, argumentos)

    return leerSiExiste(instancia, '/s.pdf')
  }

  /** Comprime con las órdenes reales de la aplicación. */
  async function comprimir(
    bytes: Uint8Array,
    perfil: 'estructural' | 'maxima' = 'estructural',
  ): Promise<Uint8Array> {
    const salida = await ejecutarQpdf(
      bytes,
      construirArgumentosCompresion('/e.pdf', '/s.pdf', perfil),
    )

    expect(salida).not.toBeNull()

    return salida as Uint8Array
  }

  it('reduce de forma apreciable un documento de texto sin flujos de objetos', async () => {
    const original = await pdfConTexto()
    const comprimido = await comprimir(original)

    const medidas = {
      tamanoOriginal: original.byteLength,
      tamanoResultante: comprimido.byteLength,
    }

    // La cifra medida rondaba el 48,7 %. Se exige holgadamente menos para no atar la
    // prueba a una versión concreta de qpdf, pero la reducción tiene que ser real.
    expect(calcularReduccion(medidas)).toBeGreaterThan(0.3)
    expect(decidirDesenlace(medidas)).toBe('reducido')
  })

  it('el perfil máximo no empeora el resultado del estructural', async () => {
    const original = await pdfConTexto()
    const estructural = await comprimir(original, 'estructural')
    const maxima = await comprimir(original, 'maxima')

    expect(maxima.byteLength).toBeLessThanOrEqual(estructural.byteLength)
  })

  it('`--compress-streams=y` a solas no reduce nada: por eso no basta como perfil', async () => {
    const original = await pdfConTexto()
    const soloFlujos = await ejecutarQpdf(original, [
      '/e.pdf',
      '/s.pdf',
      '--compress-streams=y',
    ])

    // No reduce; de hecho crece ligeramente al reescribir.
    expect(
      calcularReduccion({
        tamanoOriginal: original.byteLength,
        tamanoResultante: (soloFlujos as Uint8Array).byteLength,
      }),
    ).toBeLessThan(REDUCCION_MINIMA_UTIL)
  })

  it('un documento que ya tiene flujos de objetos apenas se reduce', async () => {
    const original = await pdfYaOptimizado()
    const comprimido = await comprimir(original)

    const medidas = {
      tamanoOriginal: original.byteLength,
      tamanoResultante: comprimido.byteLength,
    }

    expect(calcularReduccion(medidas)).toBeLessThan(0.05)
    expect(decidirDesenlace(medidas)).toBe('ya-optimizado')
  })

  it('un documento cuyo peso es un JPEG apenas se reduce', async () => {
    const original = await pdfConJpeg()
    const comprimido = await comprimir(original, 'maxima')

    const reduccion = calcularReduccion({
      tamanoOriginal: original.byteLength,
      tamanoResultante: comprimido.byteLength,
    })

    // Medido: −1,5 %. Se exige que quede muy por debajo del 10 %, porque afirmar que
    // se comprimen imágenes sería falso.
    expect(reduccion).toBeLessThan(0.1)
  })

  it('el JPEG sigue intacto en el resultado: no se recodifica', async () => {
    const original = await pdfConJpeg()
    const comprimido = await comprimir(original, 'maxima')

    const texto = new TextDecoder('latin1').decode(comprimido)

    expect(texto).toContain('DCTDecode')
  })

  it('y ese documento se detecta como portador de imágenes intocables', async () => {
    expect(detectarImagenesIntocables(await pdfConJpeg())).toBe(true)
  })

  it('`--linearize` agranda el archivo, así que no se ofrece', async () => {
    const original = await pdfYaOptimizado()
    const linearizado = await ejecutarQpdf(original, [
      '/e.pdf',
      '/s.pdf',
      '--object-streams=generate',
      '--linearize',
    ])

    expect((linearizado as Uint8Array).byteLength).toBeGreaterThan(
      original.byteLength,
    )
  })

  it('`--normalize-content=y` agranda mucho el archivo, así que no se ofrece', async () => {
    const original = await pdfYaOptimizado()
    const normalizado = await ejecutarQpdf(original, [
      '/e.pdf',
      '/s.pdf',
      '--object-streams=generate',
      '--normalize-content=y',
    ])

    expect((normalizado as Uint8Array).byteLength).toBeGreaterThan(
      original.byteLength * 2,
    )
  })

  it('el documento comprimido conserva el número de páginas', async () => {
    const original = await pdfConTexto(7)
    const comprimido = await comprimir(original, 'maxima')

    const reabierto = await PDFDocument.load(comprimido)

    expect(reabierto.getPageCount()).toBe(7)
  })

  it('el documento comprimido se puede abrir con pdf-lib sin ignoreEncryption', async () => {
    const comprimido = await comprimir(await pdfConTexto(3), 'maxima')

    const reabierto = await PDFDocument.load(comprimido, {
      ignoreEncryption: false,
    })

    expect(reabierto.getPageCount()).toBe(3)
  })

  it('qpdf considera válido el documento que acaba de comprimir', async () => {
    const comprimido = await comprimir(await pdfConTexto(3), 'maxima')

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', comprimido)
    const revision = ejecutar(instancia, construirArgumentosComprobacion('/e.pdf'))

    expect(revision.codigo).toBe(0)
    expect(
      interpretarComprobacion(revision.codigo, revision.mensajes).estado,
    ).toBe('intacto')
  })

  it('comprimir no cifra el documento', async () => {
    const comprimido = await comprimir(await pdfConTexto(2))

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', comprimido)

    expect(pedirInforme(instancia, null).cifrado).toBe(false)
  })

  it('comprimir dos veces no vuelve a reducir: la segunda vez ya está optimizado', async () => {
    const original = await pdfConTexto()
    const unaVez = await comprimir(original, 'maxima')
    const dosVeces = await comprimir(unaVez, 'maxima')

    expect(
      decidirDesenlace({
        tamanoOriginal: unaVez.byteLength,
        tamanoResultante: dosVeces.byteLength,
      }),
    ).not.toBe('reducido')
  })

  it('un documento cifrado no se puede comprimir sin la contraseña', async () => {
    const { bytes } = await cifrar(await pdfConTexto(2), 'secreta12', 'dueno1234')

    const instancia = await crearInstancia()
    instancia.FS.writeFile('/e.pdf', bytes as Uint8Array)
    const revision = ejecutar(instancia, construirArgumentosComprobacion('/e.pdf'))

    expect(
      interpretarComprobacion(revision.codigo, revision.mensajes)
        .necesitaContrasena,
    ).toBe(true)
  })
})

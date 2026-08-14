import { clasificarRiesgo } from './clasificarRiesgo'
import {
  clasificarMensaje,
  type ClaseHallazgo,
} from '../qpdf/reparacionPdf'
import type {
  ArchivoIncrustadoSeguridad,
  ContextoInspeccionSeguridad,
  EstadoEstructuraSeguridad,
  HallazgoSeguridad,
  InformeSeguridadPdf,
  MotivoErrorInspeccionSeguridad,
  SeveridadHallazgoSeguridad,
  TipoHallazgoSeguridad,
} from './tipos'

/** Límites defensivos para tratar el JSON de qpdf como entrada no confiable. */
export const LIMITES_INSPECCION = {
  profundidad: 80,
  nodos: 100_000,
  longitudCadena: 32_768,
  longitudContexto: 1_024,
  contextosPorHallazgo: 12,
  archivosIncrustados: 1_000,
  advertenciasTecnicas: 20,
} as const

/** Error explícito cuando no se puede emitir un informe completo. */
export class ErrorInspeccionSeguridad extends Error {
  readonly motivo: MotivoErrorInspeccionSeguridad

  constructor(motivo: MotivoErrorInspeccionSeguridad, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorInspeccionSeguridad'
    this.motivo = motivo
  }
}

interface RegistroHallazgo {
  readonly contextos: string[]
  cantidad: number
  severidad?: SeveridadHallazgoSeguridad
}

interface NodoPendiente {
  readonly valor: unknown
  readonly ruta: string
  readonly profundidad: number
  readonly rol: RolSemantico
  readonly referenciaOrigen?: string
}

type RolSemantico =
  | 'generico'
  | 'catalogo'
  | 'arbol-paginas'
  | 'pagina'
  | 'formulario'
  | 'nombres-raiz'
  | 'anotaciones'
  | 'anotacion'
  | 'campos-formulario'
  | 'campo-formulario'
  | 'arbol-javascript'
  | 'arbol-adjuntos'
  | 'outline-raiz'
  | 'outline'

interface AnalisisObjetos {
  readonly registros: Map<TipoHallazgoSeguridad, RegistroHallazgo>
  readonly archivosIncrustados: readonly ArchivoIncrustadoSeguridad[]
}

interface ResultadoRelacionAccion {
  readonly referenciaJavascript: string | null
}

interface AdjuntoDetectado {
  readonly referencia: string | null
  readonly nombres: string[]
  nombrePreferido: string | null
  tipoDeclarado: string | null
}

interface PresupuestoInspeccion {
  restantes: number
}

/** Eventos de acciones adicionales admitidos por cada propietario PDF. */
const EVENTOS_AA_CATALOGO = new Set(['/WC', '/WS', '/DS', '/WP', '/DP'])
const EVENTOS_AA_PAGINA = new Set(['/O', '/C'])
const EVENTOS_AA_ANOTACION = new Set([
  '/E',
  '/X',
  '/D',
  '/U',
  '/Fo',
  '/Bl',
  '/PO',
  '/PC',
  '/PV',
  '/PI',
  '/F',
])
const EVENTOS_AA_CAMPO = new Set(['/K', '/F', '/V', '/C'])

/** Extensiones que merecen especial atención sin afirmar que sean maliciosas. */
const EXTENSIONES_SENSIBLES = new Set([
  '.exe',
  '.dll',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.ps1',
  '.vbs',
  '.js',
  '.jar',
  '.hta',
])

/** Orden estable de los hallazgos en el informe y en la interfaz. */
const ORDEN_HALLAZGOS: readonly TipoHallazgoSeguridad[] = [
  'launch',
  'ejecutable-incrustado',
  'accion-apertura',
  'javascript',
  'accion-adicional',
  'envio-formulario',
  'archivo-incrustado',
  'contenido-multimedia',
  'xfa',
  'enlace-externo',
  'formulario',
  'estructura-danada',
]

/** Textos de interfaz asociados a cada indicador. */
const DESCRIPCIONES: Readonly<
  Record<
    TipoHallazgoSeguridad,
    {
      readonly severidad: SeveridadHallazgoSeguridad
      readonly titulo: string
      readonly descripcion: string
    }
  >
> = {
  javascript: {
    severidad: 'media',
    titulo: 'JavaScript incrustado',
    descripcion:
      'El documento contiene una acción o un nombre de JavaScript. El inspector no ejecutó ese código.',
  },
  'accion-apertura': {
    severidad: 'media',
    titulo: 'Acción automática al abrir',
    descripcion:
      'El documento declara una acción de apertura. Su importancia depende de la acción a la que apunta.',
  },
  'accion-adicional': {
    severidad: 'media',
    titulo: 'Acciones adicionales',
    descripcion:
      'El documento declara acciones asociadas a eventos de páginas, formularios u otros objetos.',
  },
  launch: {
    severidad: 'alta',
    titulo: 'Apertura de programas o recursos',
    descripcion:
      'El documento puede pedir a determinados lectores que abran un programa, archivo u otro recurso.',
  },
  'archivo-incrustado': {
    severidad: 'media',
    titulo: 'Archivo adjunto',
    descripcion:
      'El PDF contiene uno o más archivos adjuntos. El informe solo incluye sus metadatos; el inspector no los extrajo ni abrió.',
  },
  'ejecutable-incrustado': {
    severidad: 'alta',
    titulo: 'Archivo potencialmente ejecutable',
    descripcion:
      'El nombre de un adjunto termina en una extensión asociada a ejecutables o scripts. La extensión no demuestra que sea malicioso.',
  },
  'envio-formulario': {
    severidad: 'media',
    titulo: 'Envío automático de formulario',
    descripcion:
      'El documento puede pedir a determinados lectores que envíen información de un formulario.',
  },
  'enlace-externo': {
    severidad: 'baja',
    titulo: 'Enlaces externos',
    descripcion:
      'El documento contiene enlaces a direcciones externas. El inspector no abrió ni siguió ninguna.',
  },
  'contenido-multimedia': {
    severidad: 'media',
    titulo: 'Contenido multimedia interactivo',
    descripcion:
      'El documento declara contenido multimedia enriquecido que algunos lectores pueden activar.',
  },
  formulario: {
    severidad: 'informativa',
    titulo: 'Formulario interactivo',
    descripcion:
      'El documento contiene campos interactivos. Es una característica común y no indica por sí sola peligro.',
  },
  xfa: {
    severidad: 'media',
    titulo: 'Formulario dinámico',
    descripcion:
      'El documento contiene una tecnología de formularios dinámicos con comportamiento más complejo.',
  },
  'estructura-danada': {
    severidad: 'media',
    titulo: 'Irregularidades estructurales',
    descripcion:
      'El análisis encontró advertencias o daños en la estructura. Esto limita la confianza en lo que otros lectores puedan interpretar.',
  },
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function crearError(
  motivo: MotivoErrorInspeccionSeguridad,
): ErrorInspeccionSeguridad {
  const mensajes: Readonly<Record<MotivoErrorInspeccionSeguridad, string>> = {
    'documento-cifrado':
      'El documento está cifrado y no se puede inspeccionar por completo sin contraseña. Desbloquéalo primero con «Desbloquear PDF».',
    'estructura-no-inspeccionable':
      'La estructura del documento está demasiado dañada para completar la inspección.',
    'json-invalido':
      'qpdf no devolvió una estructura JSON válida para inspeccionar el documento.',
    'limite-profundidad':
      'La estructura del documento supera el límite de profundidad del inspector.',
    'limite-nodos':
      'La estructura del documento supera el límite de elementos del inspector.',
    'cadena-demasiado-larga':
      'La estructura del documento contiene un texto que supera el límite del inspector.',
  }

  return new ErrorInspeccionSeguridad(motivo, mensajes[motivo])
}

/** Reconoce la notación de referencia indirecta que usa el JSON de qpdf. */
function esReferencia(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d+ \d+ R$/.test(valor)
}

function normalizarReferenciaObjeto(clave: string): string | null {
  const coincidencia = /^obj:(\d+ \d+ R)$/.exec(clave)
  return coincidencia?.[1] ?? null
}

/** Acota las rutas técnicas para que un nombre PDF no infle el informe. */
function acotarContexto(ruta: string): string {
  if (ruta.length <= LIMITES_INSPECCION.longitudContexto) {
    return ruta
  }

  const mitad = Math.floor((LIMITES_INSPECCION.longitudContexto - 1) / 2)
  return `${ruta.slice(0, mitad)}…${ruta.slice(-mitad)}`
}

function extenderRuta(ruta: string, segmento: string): string {
  return acotarContexto(`${ruta}${segmento}`)
}

function anadirContexto(registro: RegistroHallazgo, ruta: string): void {
  const acotada = acotarContexto(ruta)

  if (
    registro.contextos.length < LIMITES_INSPECCION.contextosPorHallazgo &&
    !registro.contextos.includes(acotada)
  ) {
    registro.contextos.push(acotada)
  }
}

function registrar(
  registros: Map<TipoHallazgoSeguridad, RegistroHallazgo>,
  tipo: TipoHallazgoSeguridad,
  ruta: string,
  severidad?: SeveridadHallazgoSeguridad,
): void {
  const existente = registros.get(tipo)

  if (existente === undefined) {
    registros.set(tipo, {
      cantidad: 1,
      contextos: [acotarContexto(ruta)],
      severidad,
    })
    return
  }

  existente.cantidad += 1
  anadirContexto(existente, ruta)

  if (severidad === 'alta') {
    existente.severidad = 'alta'
  }
}

function elevarSeveridad(
  registros: Map<TipoHallazgoSeguridad, RegistroHallazgo>,
  tipo: TipoHallazgoSeguridad,
  ruta: string,
): void {
  const registro = registros.get(tipo)
  if (registro === undefined) {
    return
  }

  registro.severidad = 'alta'
  anadirContexto(registro, ruta)
}

function consumirPresupuesto(presupuesto: PresupuestoInspeccion): void {
  presupuesto.restantes -= 1
  if (presupuesto.restantes < 0) {
    throw crearError('limite-nodos')
  }
}

/**
 * Cuenta solo propiedades estructurales inmediatas de cada objeto qpdf.
 *
 * No desciende por los valores ni toca datos de streams (que la orden JSON omite),
 * pero impide que un objeto huérfano esconda un diccionario extremadamente ancho.
 */
function consumirPropiedadesObjeto(
  objeto: unknown,
  presupuesto: PresupuestoInspeccion,
): void {
  const envoltorio = esRegistro(objeto) ? objeto : null
  const contenido = desenvolverValorObjetoQpdf(objeto)
  const contar = (diccionario: Record<string, unknown>): void => {
    for (const clave in diccionario) {
      if (!Object.hasOwn(diccionario, clave)) continue
      consumirPresupuesto(presupuesto)
      if (clave.length > LIMITES_INSPECCION.longitudCadena) {
        throw crearError('cadena-demasiado-larga')
      }
    }
  }

  if (envoltorio !== null) contar(envoltorio)
  if (esRegistro(contenido) && contenido !== envoltorio) contar(contenido)
  if (esRegistro(contenido) && esRegistro(contenido.stream)) {
    contar(contenido.stream)
    if (esRegistro(contenido.stream.dict)) contar(contenido.stream.dict)
  }
}

function crearIndiceObjetos(
  objetos: Record<string, unknown>,
): Map<string, unknown> {
  const indice = new Map<string, unknown>()

  for (const clave in objetos) {
    if (!Object.hasOwn(objetos, clave)) continue
    const objeto = objetos[clave]
    if (clave.length > LIMITES_INSPECCION.longitudCadena) {
      throw crearError('cadena-demasiado-larga')
    }

    if (clave === 'trailer') {
      continue
    }

    if (indice.size >= LIMITES_INSPECCION.nodos) {
      throw crearError('limite-nodos')
    }

    const referencia = normalizarReferenciaObjeto(clave)
    if (referencia === null) {
      throw crearError('json-invalido')
    }
    indice.set(referencia, objeto)
  }

  return indice
}

function validarPropiedadesObjetos(
  objetos: Record<string, unknown>,
): void {
  const presupuesto: PresupuestoInspeccion = {
    restantes: LIMITES_INSPECCION.nodos,
  }
  for (const clave in objetos) {
    if (!Object.hasOwn(objetos, clave) || clave === 'trailer') continue
    consumirPropiedadesObjeto(objetos[clave], presupuesto)
  }
}

function validarCantidadAdjuntos(valor: unknown): void {
  if (!esRegistro(valor)) throw crearError('json-invalido')
  let cantidad = 0
  for (const clave in valor) {
    if (!Object.hasOwn(valor, clave)) continue
    cantidad += 1
    if (cantidad > LIMITES_INSPECCION.archivosIncrustados) {
      throw crearError('limite-nodos')
    }
    if (clave.length > LIMITES_INSPECCION.longitudCadena) {
      throw crearError('cadena-demasiado-larga')
    }
  }
}

function resolverValor(
  valor: unknown,
  objetosPorReferencia: ReadonlyMap<string, unknown>,
  presupuesto?: PresupuestoInspeccion,
): unknown {
  let actual = desenvolverValorObjetoQpdf(valor)
  const referenciasVisitadas = new Set<string>()

  while (esReferencia(actual)) {
    if (referenciasVisitadas.has(actual)) return undefined
    referenciasVisitadas.add(actual)
    if (presupuesto !== undefined) consumirPresupuesto(presupuesto)
    actual = desenvolverValorObjetoQpdf(objetosPorReferencia.get(actual))
  }

  return actual
}

function eventosAdmitidosAA(
  rol: RolSemantico,
): ReadonlySet<string> | null {
  if (rol === 'catalogo') return EVENTOS_AA_CATALOGO
  if (rol === 'anotacion') return EVENTOS_AA_ANOTACION
  if (rol === 'campo-formulario') return EVENTOS_AA_CAMPO
  return EVENTOS_AA_PAGINA
}

function registrarTipoAccion(
  accion: Record<string, unknown>,
  ruta: string,
  registros: Map<TipoHallazgoSeguridad, RegistroHallazgo>,
): void {
  const tipo = accion['/S']
  if (tipo === '/JavaScript') registrar(registros, 'javascript', `${ruta}./S`)
  else if (tipo === '/Launch') registrar(registros, 'launch', `${ruta}./S`)
  else if (tipo === '/SubmitForm')
    registrar(registros, 'envio-formulario', `${ruta}./S`)
  else if (tipo === '/URI')
    registrar(registros, 'enlace-externo', `${ruta}./S`)
  else if (tipo === '/RichMedia')
    registrar(registros, 'contenido-multimedia', `${ruta}./S`)

}

function analizarCadenaAcciones(
  valorInicial: unknown,
  rutaInicial: string,
  objetosPorReferencia: ReadonlyMap<string, unknown>,
  registros: Map<TipoHallazgoSeguridad, RegistroHallazgo>,
  presupuesto: PresupuestoInspeccion,
): ResultadoRelacionAccion | null {
  const pendientes: Array<{
    readonly valor: unknown
    readonly permiteLista: boolean
    readonly ruta: string
    readonly ultimaReferencia: string | null
  }> = [
    {
      valor: valorInicial,
      permiteLista: false,
      ruta: rutaInicial,
      ultimaReferencia: null,
    },
  ]
  const referenciasVisitadas = new Set<string>()
  let resultado: ResultadoRelacionAccion | null = null

  const programar = (pendiente: (typeof pendientes)[number]): void => {
    consumirPresupuesto(presupuesto)
    pendientes.push(pendiente)
  }

  for (let indice = 0; indice < pendientes.length; indice += 1) {
    const actual = pendientes[indice]
    if (actual === undefined) continue

    if (esReferencia(actual.valor)) {
      if (referenciasVisitadas.has(actual.valor)) continue
      referenciasVisitadas.add(actual.valor)
      programar({
        ...actual,
        valor: objetosPorReferencia.get(actual.valor),
        ruta: extenderRuta(actual.ruta, ` -> ${actual.valor}`),
        ultimaReferencia: actual.valor,
      })
      continue
    }

    const valor = desenvolverValorObjetoQpdf(actual.valor)
    if (esReferencia(valor)) {
      programar({ ...actual, valor })
      continue
    }
    if (Array.isArray(valor)) {
      if (!actual.permiteLista) continue
      for (const elemento of valor) {
        programar({
          valor: elemento,
          permiteLista: false,
          ruta: actual.ruta,
          ultimaReferencia: actual.ultimaReferencia,
        })
      }
      continue
    }
    if (!esRegistro(valor)) continue

    registrarTipoAccion(valor, actual.ruta, registros)
    if (valor['/S'] === '/JavaScript' && resultado === null) {
      resultado = { referenciaJavascript: actual.ultimaReferencia }
    }
    if (Object.hasOwn(valor, '/Next')) {
      programar({
        valor: valor['/Next'],
        permiteLista: true,
        ruta: extenderRuta(actual.ruta, './Next'),
        ultimaReferencia: actual.ultimaReferencia,
      })
    }
  }

  return resultado
}

function analizarAccionesAdicionales(
  valorAA: unknown,
  ruta: string,
  rolPropietario: RolSemantico,
  objetosPorReferencia: ReadonlyMap<string, unknown>,
  registros: Map<TipoHallazgoSeguridad, RegistroHallazgo>,
  presupuesto: PresupuestoInspeccion,
): boolean {
  consumirPresupuesto(presupuesto)
  const diccionario = resolverValor(valorAA, objetosPorReferencia, presupuesto)
  if (!esRegistro(diccionario)) return false
  const eventos = eventosAdmitidosAA(rolPropietario)
  if (eventos === null) return false

  let conduceJavascript = false
  for (const evento in diccionario) {
    if (!Object.hasOwn(diccionario, evento)) continue
    consumirPresupuesto(presupuesto)
    if (!eventos.has(evento)) continue
    const accion = diccionario[evento]
    const resultado = analizarCadenaAcciones(
      accion,
      extenderRuta(ruta, `.${evento}`),
      objetosPorReferencia,
      registros,
      presupuesto,
    )
    conduceJavascript ||= resultado !== null
  }
  return conduceJavascript
}

function nombresDesdeFileSpec(fileSpec: Record<string, unknown>): string[] {
  const nombres: string[] = []
  for (const clave of ['/UF', '/F'] as const) {
    const valor = fileSpec[clave]
    if (typeof valor !== 'string') continue
    if (valor.length > LIMITES_INSPECCION.longitudCadena) {
      throw crearError('cadena-demasiado-larga')
    }
    nombres.push(decodificarNombreQpdf(valor))
  }
  return nombres
}

function decodificarNombrePdf(valor: string): string {
  const sinBarra = valor.startsWith('/') ? valor.slice(1) : valor
  return sinBarra.replace(/#([\dA-Fa-f]{2})/g, (_coincidencia, hexadecimal: string) =>
    String.fromCharCode(Number.parseInt(hexadecimal, 16)),
  )
}

function mimeDesdeFileSpec(
  fileSpec: Record<string, unknown>,
  objetosPorReferencia: ReadonlyMap<string, unknown>,
  presupuesto: PresupuestoInspeccion,
): string | null {
  const ef = resolverValor(fileSpec['/EF'], objetosPorReferencia, presupuesto)
  if (!esRegistro(ef)) return null
  for (const clave of ['/UF', '/F'] as const) {
    const stream = resolverValor(ef[clave], objetosPorReferencia, presupuesto)
    if (!esRegistro(stream)) continue
    const dict = esRegistro(stream.stream) ? stream.stream.dict : null
    if (!esRegistro(dict) || typeof dict['/Subtype'] !== 'string') continue
    const subtipo = dict['/Subtype']
    if (subtipo.length > LIMITES_INSPECCION.longitudCadena) {
      throw crearError('cadena-demasiado-larga')
    }
    return decodificarNombrePdf(subtipo)
  }
  return null
}

function referenciasFlujoDesdeFileSpec(
  fileSpec: Record<string, unknown>,
  objetosPorReferencia: ReadonlyMap<string, unknown>,
  presupuesto: PresupuestoInspeccion,
): string[] {
  const ef = resolverValor(fileSpec['/EF'], objetosPorReferencia, presupuesto)
  if (!esRegistro(ef)) return []
  return ['/UF', '/F']
    .map((clave) => ef[clave])
    .filter(esReferencia)
}

function datosFlujoIncrustado(
  valor: Record<string, unknown>,
): { readonly tipoDeclarado: string | null } | null {
  const dict = esRegistro(valor.stream) ? valor.stream.dict : null
  if (!esRegistro(dict) || dict['/Type'] !== '/EmbeddedFile') return null
  const subtipo = dict['/Subtype']
  if (typeof subtipo === 'string') {
    if (subtipo.length > LIMITES_INSPECCION.longitudCadena) {
      throw crearError('cadena-demasiado-larga')
    }
    return {
      tipoDeclarado: decodificarNombrePdf(subtipo),
    }
  }
  return { tipoDeclarado: null }
}

function analizarObjetos(objetos: Record<string, unknown>): AnalisisObjetos {
  const registros = new Map<TipoHallazgoSeguridad, RegistroHallazgo>()
  const objetosPorReferencia = crearIndiceObjetos(objetos)
  const trailer = desenvolverValorObjetoQpdf(objetos.trailer)
  if (!esRegistro(trailer) || !esReferencia(trailer['/Root'])) {
    throw crearError('json-invalido')
  }

  const pendientes: NodoPendiente[] = []
  const visitas = new Set<string>()
  const presupuesto: PresupuestoInspeccion = {
    restantes: LIMITES_INSPECCION.nodos,
  }
  const adjuntos = new Map<string, AdjuntoDetectado>()
  const flujosAsociados = new Set<string>()

  const programar = (nodo: NodoPendiente): void => {
    if (nodo.profundidad > LIMITES_INSPECCION.profundidad) {
      throw crearError('limite-profundidad')
    }
    consumirPresupuesto(presupuesto)
    pendientes.push(nodo)
  }

  programar({
    valor: trailer['/Root'],
    ruta: 'qpdf[1].trailer./Root',
    profundidad: 0,
    rol: 'catalogo',
  })

  while (pendientes.length > 0) {
    const actual = pendientes.pop()
    if (actual === undefined) break

    if (esReferencia(actual.valor)) {
      const claveVisita = `${actual.rol}:${actual.valor}`
      if (visitas.has(claveVisita)) continue
      visitas.add(claveVisita)
      programar({
        ...actual,
        valor: objetosPorReferencia.get(actual.valor),
        ruta: extenderRuta(actual.ruta, ` -> ${actual.valor}`),
        referenciaOrigen: actual.valor,
      })
      continue
    }

    const valor = desenvolverValorObjetoQpdf(actual.valor)
    if (typeof valor === 'string') {
      if (valor.length > LIMITES_INSPECCION.longitudCadena) {
        throw crearError('cadena-demasiado-larga')
      }
      continue
    }
    if (Array.isArray(valor)) {
      for (let indice = valor.length - 1; indice >= 0; indice -= 1) {
        programar({
          valor: valor[indice],
          ruta: extenderRuta(actual.ruta, `[${indice}]`),
          profundidad: actual.profundidad + 1,
          rol:
            actual.rol === 'anotaciones'
              ? 'anotacion'
              : actual.rol === 'campos-formulario'
                ? 'campo-formulario'
                : actual.rol === 'outline-raiz'
                  ? 'outline'
                  : actual.rol,
        })
      }
      continue
    }
    if (!esRegistro(valor)) continue

    const rolActual: RolSemantico =
      actual.rol === 'arbol-paginas' && valor['/Type'] === '/Page'
        ? 'pagina'
        : actual.rol
    const esCatalogo = rolActual === 'catalogo'
    const esPagina = rolActual === 'pagina'
    const esAnotacion = rolActual === 'anotacion'
    const esCampo = rolActual === 'campo-formulario'

    const flujoIncrustado = datosFlujoIncrustado(valor)
    if (
      flujoIncrustado !== null &&
      !(
        actual.referenciaOrigen !== undefined &&
        flujosAsociados.has(actual.referenciaOrigen)
      )
    ) {
      const referencia = actual.referenciaOrigen ?? null
      const claveAdjunto = referencia ?? actual.ruta
      if (!adjuntos.has(claveAdjunto)) {
        if (adjuntos.size >= LIMITES_INSPECCION.archivosIncrustados) {
          throw crearError('limite-nodos')
        }
        adjuntos.set(claveAdjunto, {
          referencia,
          nombres: [],
          nombrePreferido: null,
          tipoDeclarado: flujoIncrustado.tipoDeclarado,
        })
      }
    }

    if (esCatalogo && Object.hasOwn(valor, '/OpenAction')) {
      const ruta = extenderRuta(actual.ruta, './OpenAction')
      registrar(registros, 'accion-apertura', ruta)
      const resultado = analizarCadenaAcciones(
        valor['/OpenAction'],
        ruta,
        objetosPorReferencia,
        registros,
        presupuesto,
      )
      if (resultado !== null) {
        elevarSeveridad(
          registros,
          'accion-apertura',
          resultado.referenciaJavascript === null
            ? `${ruta} -> JavaScript`
            : `${ruta} -> ${resultado.referenciaJavascript}`,
        )
      }
    }

    const rolAA: RolSemantico | null = esCatalogo
      ? 'catalogo'
      : esPagina
        ? 'generico'
        : esAnotacion
          ? 'anotacion'
          : esCampo
            ? 'campo-formulario'
            : null
    if (rolAA !== null && Object.hasOwn(valor, '/AA')) {
      const ruta = extenderRuta(actual.ruta, './AA')
      registrar(registros, 'accion-adicional', ruta)
      if (
        analizarAccionesAdicionales(
          valor['/AA'],
          ruta,
          rolAA,
          objetosPorReferencia,
          registros,
          presupuesto,
        )
      ) {
        elevarSeveridad(registros, 'accion-adicional', `${ruta} -> JavaScript`)
      }
    }

    if ((esAnotacion || actual.rol === 'outline') && Object.hasOwn(valor, '/A')) {
      analizarCadenaAcciones(
        valor['/A'],
        extenderRuta(actual.ruta, './A'),
        objetosPorReferencia,
        registros,
        presupuesto,
      )
    }

    if (rolActual === 'arbol-javascript') {
      registrar(registros, 'javascript', actual.ruta)
    }
    if (rolActual === 'arbol-adjuntos') {
      registrar(registros, 'archivo-incrustado', actual.ruta)
    }
    if (esAnotacion && valor['/Subtype'] === '/RichMedia') {
      registrar(registros, 'contenido-multimedia', `${actual.ruta}./Subtype`)
    }
    if (rolActual === 'formulario' && Object.hasOwn(valor, '/XFA')) {
      registrar(registros, 'xfa', `${actual.ruta}./XFA`)
    }

    const posibleFileSpec =
      esAnotacion && valor['/Subtype'] === '/FileAttachment'
        ? valor['/FS']
        : valor['/Type'] === '/Filespec' && Object.hasOwn(valor, '/EF')
          ? actual.valor
          : null
    if (posibleFileSpec !== null) {
      const referencia = esReferencia(posibleFileSpec)
        ? posibleFileSpec
        : (actual.referenciaOrigen ?? null)
      const fileSpec = resolverValor(
        posibleFileSpec,
        objetosPorReferencia,
        presupuesto,
      )
      if (esRegistro(fileSpec)) {
        for (const referenciaFlujo of referenciasFlujoDesdeFileSpec(
          fileSpec,
          objetosPorReferencia,
          presupuesto,
        )) {
          flujosAsociados.add(referenciaFlujo)
          adjuntos.delete(referenciaFlujo)
        }
        const nombres = nombresDesdeFileSpec(fileSpec)
        const claveAdjunto = referencia ?? `${actual.ruta}./FS`
        if (!adjuntos.has(claveAdjunto)) {
          if (adjuntos.size >= LIMITES_INSPECCION.archivosIncrustados) {
            throw crearError('limite-nodos')
          }
          adjuntos.set(claveAdjunto, {
            referencia,
            nombres,
            nombrePreferido: nombres[0] ?? null,
            tipoDeclarado: mimeDesdeFileSpec(
              fileSpec,
              objetosPorReferencia,
              presupuesto,
            ),
          })
        }
      }
    }

    for (const clave in valor) {
      if (!Object.hasOwn(valor, clave)) continue
      consumirPresupuesto(presupuesto)
      const hijo = valor[clave]
      if (clave.length > LIMITES_INSPECCION.longitudCadena) {
        throw crearError('cadena-demasiado-larga')
      }
      if (
        clave === '/OpenAction' ||
        clave === '/AA' ||
        ((esAnotacion || actual.rol === 'outline') && clave === '/A') ||
        (esAnotacion && clave === '/FS') ||
        (rolActual === 'formulario' && clave === '/XFA')
      ) {
        continue
      }

      let rol: RolSemantico = 'generico'
      if (esCatalogo && clave === '/Pages') rol = 'arbol-paginas'
      else if (rolActual === 'arbol-paginas' && clave === '/Kids')
        rol = 'arbol-paginas'
      else if (esCatalogo && clave === '/Names') rol = 'nombres-raiz'
      else if (rolActual === 'nombres-raiz' && clave === '/JavaScript')
        rol = 'arbol-javascript'
      else if (rolActual === 'nombres-raiz' && clave === '/EmbeddedFiles')
        rol = 'arbol-adjuntos'
      else if (esCatalogo && clave === '/AcroForm') {
        rol = 'formulario'
        registrar(registros, 'formulario', extenderRuta(actual.ruta, './AcroForm'))
      } else if (rolActual === 'formulario' && clave === '/Fields')
        rol = 'campos-formulario'
      else if (rolActual === 'campo-formulario' && clave === '/Kids')
        rol = 'campos-formulario'
      else if ((esPagina || rolActual === 'anotacion') && clave === '/Annots')
        rol = 'anotaciones'
      else if (esCatalogo && clave === '/Outlines') rol = 'outline-raiz'
      else if (rolActual === 'outline-raiz' || rolActual === 'outline') {
        if (clave === '/First' || clave === '/Next') rol = 'outline'
      }

      programar({
        valor: hijo,
        ruta: extenderRuta(actual.ruta, `.${clave}`),
        profundidad: actual.profundidad + 1,
        rol,
      })
    }
  }

  const archivosIncrustados = [...adjuntos.values()].map(convertirAdjunto)
  return { registros, archivosIncrustados }
}

/** Quita únicamente el envoltorio `{ value: ... }` de un objeto indirecto qpdf. */
function desenvolverValorObjetoQpdf(valor: unknown): unknown {
  return esRegistro(valor) && Object.hasOwn(valor, 'value') ? valor.value : valor
}

function decodificarNombreQpdf(valor: string): string {
  return valor.startsWith('u:') ? valor.slice(2) : valor
}

function extraerExtension(nombre: string): string | null {
  const normalizado = nombre.trimEnd()
  const punto = normalizado.lastIndexOf('.')
  if (
    punto <= normalizado.lastIndexOf('/') ||
    punto <= normalizado.lastIndexOf('\\')
  ) {
    return null
  }

  const extension = normalizado.slice(punto).toLowerCase()
  return extension.length > 1 && extension.length <= 16 ? extension : null
}

function todosLosTextos(
  registro: Record<string, unknown>,
  claves: readonly string[],
): string[] {
  const resultado: string[] = []
  for (const clave of claves) {
    const valor = registro[clave]
    if (typeof valor !== 'string') {
      continue
    }

    if (valor.length > LIMITES_INSPECCION.longitudCadena) {
      throw crearError('cadena-demasiado-larga')
    }

    resultado.push(decodificarNombreQpdf(valor))
  }
  return resultado
}

function extraerTipoAdjunto(adjunto: Record<string, unknown>): string | null {
  const flujos = adjunto.streams
  if (!esRegistro(flujos)) {
    return null
  }

  let cantidad = 0
  for (const clave in flujos) {
    if (!Object.hasOwn(flujos, clave)) continue
    cantidad += 1
    if (cantidad > LIMITES_INSPECCION.nodos) {
      throw crearError('limite-nodos')
    }
    const flujo = flujos[clave]
    if (!esRegistro(flujo)) {
      continue
    }

    const tipo = flujo.mimetype
    if (typeof tipo !== 'string') {
      continue
    }

    if (tipo.length > LIMITES_INSPECCION.longitudCadena) {
      throw crearError('cadena-demasiado-larga')
    }

    return tipo
  }

  return null
}

function convertirAdjunto(adjunto: AdjuntoDetectado): ArchivoIncrustadoSeguridad {
  const nombres = adjunto.nombres.length > 0 ? adjunto.nombres : ['Adjunto sin nombre']
  const nombrePreferido = adjunto.nombrePreferido ?? nombres[0] ?? 'Adjunto sin nombre'
  const nombreSensible = nombres.find((nombre) => {
    const extension = extraerExtension(nombre)
    return extension !== null && EXTENSIONES_SENSIBLES.has(extension)
  })
  const nombre = nombreSensible ?? nombrePreferido
  const extension = extraerExtension(nombre)

  return {
    nombre,
    extension,
    tipoDeclarado: adjunto.tipoDeclarado,
    aparentaEjecutable:
      extension !== null && EXTENSIONES_SENSIBLES.has(extension),
    referencia: adjunto.referencia,
  }
}

function analizarAdjuntosResumen(
  valor: unknown,
): readonly ArchivoIncrustadoSeguridad[] {
  if (!esRegistro(valor)) {
    throw crearError('json-invalido')
  }

  const resultado: ArchivoIncrustadoSeguridad[] = []
  for (const clave in valor) {
    if (!Object.hasOwn(valor, clave)) continue
    if (resultado.length >= LIMITES_INSPECCION.archivosIncrustados) {
      throw crearError('limite-nodos')
    }
    const dato = valor[clave]
    if (clave.length > LIMITES_INSPECCION.longitudCadena || !esRegistro(dato)) {
      throw crearError(
        clave.length > LIMITES_INSPECCION.longitudCadena
          ? 'cadena-demasiado-larga'
          : 'json-invalido',
      )
    }

    const nombres = esRegistro(dato.names) ? dato.names : {}
    const preferidos = todosLosTextos(dato, ['preferredname'])
    const candidatos = [
      ...preferidos,
      ...todosLosTextos(nombres, ['/UF', '/F']),
      decodificarNombreQpdf(clave),
    ]
    if (candidatos.some((nombre) => nombre.length > LIMITES_INSPECCION.longitudCadena)) {
      throw crearError('cadena-demasiado-larga')
    }

    resultado.push(convertirAdjunto({
      referencia: esReferencia(dato.filespec) ? dato.filespec : null,
      nombres: candidatos,
      nombrePreferido: preferidos[0] ?? null,
      tipoDeclarado: extraerTipoAdjunto(dato),
    }))
  }
  return resultado
}

/** Aplica también los límites defensivos al bloque especializado de adjuntos. */
function validarEstructuraAcotada(valorInicial: unknown): void {
  const pendientes: Array<{
    readonly valor: unknown
    readonly profundidad: number
  }> = []
  let nodosProgramados = 0

  const programar = (valor: unknown, profundidad: number): void => {
    if (profundidad > LIMITES_INSPECCION.profundidad) {
      throw crearError('limite-profundidad')
    }

    nodosProgramados += 1
    if (nodosProgramados > LIMITES_INSPECCION.nodos) {
      throw crearError('limite-nodos')
    }

    pendientes.push({ valor, profundidad })
  }

  programar(valorInicial, 0)

  while (pendientes.length > 0) {
    const actual = pendientes.pop()
    if (actual === undefined) {
      break
    }

    if (typeof actual.valor === 'string') {
      if (actual.valor.length > LIMITES_INSPECCION.longitudCadena) {
        throw crearError('cadena-demasiado-larga')
      }
      continue
    }

    if (Array.isArray(actual.valor)) {
      for (const valor of actual.valor) {
        programar(valor, actual.profundidad + 1)
      }
      continue
    }

    if (!esRegistro(actual.valor)) {
      continue
    }

    for (const clave in actual.valor) {
      if (!Object.hasOwn(actual.valor, clave)) continue
      const valor = actual.valor[clave]
      if (clave.length > LIMITES_INSPECCION.longitudCadena) {
        throw crearError('cadena-demasiado-larga')
      }
      programar(valor, actual.profundidad + 1)
    }
  }
}

function leerRaizQpdf(datos: unknown): Record<string, unknown> {
  if (!esRegistro(datos) || !Array.isArray(datos.qpdf)) {
    throw crearError('json-invalido')
  }

  const metadatos = datos.qpdf[0]
  const objetos = datos.qpdf[1]
  if (
    !esRegistro(metadatos) ||
    metadatos.jsonversion !== 2 ||
    !esRegistro(objetos)
  ) {
    throw crearError('json-invalido')
  }

  let tieneTrailer = false
  let cantidadClaves = 0
  for (const clave in objetos) {
    if (!Object.hasOwn(objetos, clave)) continue
    cantidadClaves += 1
    if (cantidadClaves > LIMITES_INSPECCION.nodos + 1) {
      throw crearError('limite-nodos')
    }
    if (clave === 'trailer') tieneTrailer = true
    else if (normalizarReferenciaObjeto(clave) === null) {
      throw crearError('json-invalido')
    }
  }

  if (cantidadClaves === 0 || !tieneTrailer) {
    throw crearError('json-invalido')
  }

  return objetos
}

function leerCifrado(datos: unknown): boolean {
  if (!esRegistro(datos) || !esRegistro(datos.encrypt)) {
    throw crearError('json-invalido')
  }

  const cifrado = datos.encrypt.encrypted
  if (typeof cifrado !== 'boolean') {
    throw crearError('json-invalido')
  }

  return cifrado
}

/** Usa el recuento directo de qpdf y, si faltó, el bloque `pages` del JSON. */
function leerNumeroPaginas(
  datos: unknown,
  numeroPaginas: number | null,
): number | null {
  if (numeroPaginas !== null) {
    return numeroPaginas
  }

  if (!esRegistro(datos) || !Array.isArray(datos.pages)) {
    return null
  }

  if (datos.pages.length > LIMITES_INSPECCION.nodos) {
    throw crearError('limite-nodos')
  }

  return datos.pages.length > 0 ? datos.pages.length : null
}

function tieneAcroForm(datos: unknown): boolean {
  if (!esRegistro(datos) || !esRegistro(datos.acroform)) {
    throw crearError('json-invalido')
  }

  const valor = datos.acroform.hasacroform
  if (typeof valor !== 'boolean') {
    throw crearError('json-invalido')
  }

  return valor
}

function convertirHallazgos(
  registros: ReadonlyMap<TipoHallazgoSeguridad, RegistroHallazgo>,
): readonly HallazgoSeguridad[] {
  const resultado: HallazgoSeguridad[] = []

  for (const tipo of ORDEN_HALLAZGOS) {
    const registro = registros.get(tipo)
    if (registro === undefined) {
      continue
    }

    const descripcion = DESCRIPCIONES[tipo]
    resultado.push({
      tipo,
      severidad: registro.severidad ?? descripcion.severidad,
      titulo: descripcion.titulo,
      descripcion: descripcion.descripcion,
      cantidad: registro.cantidad,
      contextos: registro.contextos,
    })
  }

  return resultado
}

function obtenerEstadoEstructura(
  estado: ContextoInspeccionSeguridad['diagnostico']['estado'],
): EstadoEstructuraSeguridad {
  if (estado === 'intacto') {
    return 'valida'
  }

  return estado === 'con-advertencias' ? 'con-advertencias' : 'danada'
}

const ADVERTENCIAS_CONTROLADAS: Readonly<Record<ClaseHallazgo, string>> = {
  'referencias-cruzadas':
    'qpdf detectó una irregularidad en las referencias cruzadas.',
  'objeto-danado': 'qpdf detectó uno o más objetos PDF irregulares.',
  'flujo-danado': 'qpdf detectó una irregularidad en un flujo del documento.',
  paginas: 'qpdf detectó una irregularidad en el árbol de páginas.',
  cifrado: 'qpdf informó de una irregularidad relacionada con el cifrado.',
  estructura: 'qpdf detectó una irregularidad en la estructura general.',
  otra: 'qpdf detectó una irregularidad estructural no clasificada.',
}

function acotarAdvertencias(
  contexto: ContextoInspeccionSeguridad,
): readonly string[] {
  const vistas = new Set<ClaseHallazgo>()
  const resultado: string[] = []

  for (const hallazgo of contexto.diagnostico.hallazgos) {
    const clase = hallazgo.clase ?? clasificarMensaje(hallazgo.mensaje)
    if (vistas.has(clase)) {
      continue
    }

    vistas.add(clase)
    resultado.push(ADVERTENCIAS_CONTROLADAS[clase])
    if (resultado.length === LIMITES_INSPECCION.advertenciasTecnicas) {
      break
    }
  }

  return resultado
}

/**
 * Interpreta la salida JSON v2 de qpdf sin ejecutar acciones ni leer streams.
 *
 * La estructura se recorre iterativamente y solo se comparan nombres de claves y
 * valores PDF exactos. Nunca se devuelven scripts ni destinos URI: los detalles
 * técnicos contienen rutas y referencias, no el contenido activo encontrado.
 */
export function analizarEstructuraQpdf(
  datos: unknown,
  contexto: ContextoInspeccionSeguridad,
): InformeSeguridadPdf {
  if (contexto.diagnostico.necesitaContrasena) {
    throw crearError('documento-cifrado')
  }

  if (contexto.diagnostico.estado === 'irrecuperable') {
    throw crearError('estructura-no-inspeccionable')
  }

  const objetos = leerRaizQpdf(datos)
  validarPropiedadesObjetos(objetos)
  validarCantidadAdjuntos(esRegistro(datos) ? datos.attachments : undefined)

  // Se valida todo el JSON antes de interpretar sus secciones: `pages`,
  // `acroform` y `encrypt` también proceden de un documento no confiable. La
  // orden de qpdf omite los datos de streams, por lo que este recorrido solo ve
  // estructura y metadatos serializados.
  validarEstructuraAcotada(datos)

  const cifrado = leerCifrado(datos)
  const archivosResumen = analizarAdjuntosResumen(
    esRegistro(datos) ? datos.attachments : undefined,
  )
  const { registros, archivosIncrustados: archivosEstructurales } =
    analizarObjetos(objetos)
  const archivosPorClave = new Map<string, ArchivoIncrustadoSeguridad>()

  for (const archivo of [...archivosResumen, ...archivosEstructurales]) {
    const clave =
      archivo.referencia ??
      `${archivo.nombre}\u0000${archivo.tipoDeclarado ?? ''}`
    const existente = archivosPorClave.get(clave)
    if (existente === undefined || (!existente.aparentaEjecutable && archivo.aparentaEjecutable)) {
      archivosPorClave.set(clave, archivo)
    }
  }
  const archivosIncrustados = [...archivosPorClave.values()]

  if (archivosIncrustados.length > LIMITES_INSPECCION.archivosIncrustados) {
    throw crearError('limite-nodos')
  }

  // El bloque especializado de qpdf es más fiable para contar adjuntos que las
  // dos claves estructurales que suelen describir un solo árbol de nombres.
  if (archivosIncrustados.length > 0) {
    registros.set('archivo-incrustado', {
      cantidad: archivosIncrustados.length,
      contextos: ['attachments'],
    })
  }

  const sensibles = archivosIncrustados.filter(
    (archivo) => archivo.aparentaEjecutable,
  )
  if (sensibles.length > 0) {
    registros.set('ejecutable-incrustado', {
      cantidad: sensibles.length,
      contextos: sensibles
        .slice(0, LIMITES_INSPECCION.contextosPorHallazgo)
        .map((archivo) =>
          acotarContexto(
            archivo.referencia === null
              ? `attachments.${archivo.nombre}`
              : `attachments.${archivo.nombre} -> ${archivo.referencia}`,
          ),
        ),
    })
  }

  if (tieneAcroForm(datos) && !registros.has('formulario')) {
    registros.set('formulario', { cantidad: 1, contextos: ['acroform'] })
  }

  if (contexto.diagnostico.estado !== 'intacto') {
    registros.set('estructura-danada', {
      cantidad: Math.max(1, contexto.diagnostico.hallazgos.length),
      contextos: ['diagnostico-qpdf'],
    })
  }

  const hallazgos = convertirHallazgos(registros)
  const estadoEstructura = obtenerEstadoEstructura(
    contexto.diagnostico.estado,
  )

  return {
    nivel: clasificarRiesgo(hallazgos),
    hallazgos,
    archivosIncrustados,
    numeroPaginas: leerNumeroPaginas(datos, contexto.numeroPaginas),
    estructuraValida: estadoEstructura === 'valida',
    estadoEstructura,
    cifrado,
    analisisCompleto: true,
    advertenciasTecnicas: acotarAdvertencias(contexto),
  }
}

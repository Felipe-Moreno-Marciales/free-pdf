import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib'
import { cargarPdfLib, type ModuloPdfLib } from '../pdf/cargarDocumentoPdf'
import { comprobarCancelacion, cederElControl } from '../pdf/cancelacion'
import { interpretarColorConReserva, NEGRO, type ColorRgb } from '../pdf/colores'
import { ErrorPdf, envolverErrorPdf } from '../pdf/erroresPdf'
import { guardarComoResultado } from '../pdf/guardarDocumentoPdf'
import { calcularMedidasVisibles } from '../pdf/posicionarEnPagina'
import { normalizarRotacion } from '../pdf/rotaciones'
import type { GradosRotacion } from '../pdf/tipos'
import {
  agruparPorPagina,
  calcularCajaVisible,
  calcularColocacionElemento,
  elementoPinta,
  puntoDeTrazoAVisible,
  type ContextoPagina,
} from './colocarElementos'
import { MARGEN_COBERTURA_PUNTOS } from './seleccionTexto'
import { TIPOGRAFIAS_ESTANDAR } from './tipografias'
import type {
  ElementoForma,
  ElementoImagen,
  ElementoResaltado,
  ElementoSuperpuesto,
  ElementoTexto,
  ElementoTextoEditado,
  ElementoTrazo,
  ProgresoEdicion,
  ResultadoEdicion,
} from './tipos'

/**
 * Aplicación de la capa de edición a un documento.
 *
 * **Lo que hace:** dibuja los elementos encima de las páginas del documento original,
 * conservándolo intacto por debajo. El texto que ya había sigue siendo texto, los
 * enlaces siguen funcionando y la estructura de accesibilidad no se pierde. Es la
 * diferencia deliberada con la censura, que sí rasteriza.
 *
 * **Lo que no hace, y no se va a insinuar que haga:** no modifica el texto original.
 * No se puede corregir una palabra de un párrafo existente. Hacerlo exigiría
 * reconstruir tipografía, interletraje y reflujo del párrafo, y el resultado sería
 * peor que el original en casi todos los casos.
 */

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_EDITADO = 'free-pdf-editado.pdf'

/** Nombre predeterminado del documento firmado. */
export const NOMBRE_FIRMADO = 'free-pdf-firmado.pdf'

/** Lo que hace falta para aplicar la capa de edición. */
export interface PeticionEdicion {
  /** Documento original, ya abierto con pdf-lib. */
  readonly documento: PDFDocument
  /** Módulo de pdf-lib, inyectado para no volver a cargarlo. */
  readonly pdfLib: ModuloPdfLib
  /** Elementos que hay que dibujar, de todas las páginas. */
  readonly elementos: readonly ElementoSuperpuesto[]
  /** Nombre del archivo resultante. */
  readonly nombreArchivo?: string
}

/** Opciones de ejecución. */
export interface OpcionesEdicion {
  readonly senal?: AbortSignal
  readonly alProgreso?: (progreso: ProgresoEdicion) => void
}

/**
 * Dibuja los elementos sobre el documento y devuelve el resultado.
 *
 * Se recorren solo las páginas que tienen algo que dibujar: no tiene sentido tocar
 * las demás, y así un documento de 300 páginas con una firma en la primera se procesa
 * igual de rápido que uno de una sola página.
 */
export async function aplicarEdicion(
  peticion: PeticionEdicion,
  opciones: OpcionesEdicion = {},
): Promise<ResultadoEdicion> {
  const { documento, pdfLib } = peticion
  const numeroPaginas = documento.getPageCount()

  if (numeroPaginas === 0) {
    throw new ErrorPdf('El documento no tiene ninguna página que editar.')
  }

  const utiles = peticion.elementos.filter(elementoPinta)
  const descartados = peticion.elementos.length - utiles.length

  if (utiles.length === 0) {
    throw new ErrorPdf(
      descartados === 0
        ? 'No has añadido ningún elemento, así que no hay nada que aplicar.'
        : 'Ninguno de los elementos añadidos dibuja nada: revisa los textos vacíos y las formas sin relleno ni borde.',
    )
  }

  const porPagina = agruparPorPagina(utiles)
  const paginasInexistentes: number[] = []
  const tipografias = new CacheTipografias(documento, pdfLib)
  const imagenes = new CacheImagenes(documento)

  let dibujados = 0
  let afectadas = 0
  let completados = 0

  // Se recorren en orden para que el progreso sea creciente y comprensible.
  const numeros = [...porPagina.keys()].sort((primero, segundo) => primero - segundo)
  const total = utiles.length

  try {
    for (const numero of numeros) {
      comprobarCancelacion(opciones.senal)

      const grupo = porPagina.get(numero) ?? []

      if (numero > numeroPaginas) {
        paginasInexistentes.push(numero)
        completados += grupo.length
        opciones.alProgreso?.({ completados, total })
        continue
      }

      const pagina = documento.getPage(numero - 1)
      const contexto = describirPagina(pagina)

      for (const elemento of grupo) {
        comprobarCancelacion(opciones.senal)

        await dibujarElemento({
          pagina,
          pdfLib,
          contexto,
          elemento,
          tipografias,
          imagenes,
        })

        dibujados += 1
        completados += 1
        opciones.alProgreso?.({ completados, total })
      }

      afectadas += 1

      // Se cede el control entre páginas para que la interfaz siga respondiendo.
      await cederElControl()
    }
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudo aplicar la capa de edición al documento.',
    )
  }

  const guardado = await guardarComoResultado(
    documento,
    peticion.nombreArchivo ?? NOMBRE_EDITADO,
  )

  return {
    ...guardado,
    elementosDibujados: dibujados,
    elementosDescartados: descartados,
    paginasAfectadas: afectadas,
    paginasInexistentes,
  }
}

/** Lee de la página lo que hace falta para colocar contenido en ella. */
export function describirPagina(pagina: PDFPage): ContextoPagina {
  const caja = pagina.getMediaBox()

  return {
    caja: {
      x: caja.x,
      y: caja.y,
      ancho: caja.width,
      alto: caja.height,
    },
    rotacion: normalizarRotacion(
      pagina.getRotation().angle as GradosRotacion,
    ),
  }
}

/** Todo lo que necesita el dibujado de un elemento. */
interface PeticionDibujo {
  readonly pagina: PDFPage
  readonly pdfLib: ModuloPdfLib
  readonly contexto: ContextoPagina
  readonly elemento: ElementoSuperpuesto
  readonly tipografias: CacheTipografias
  readonly imagenes: CacheImagenes
}

/** Reparte el dibujado según la clase del elemento. */
async function dibujarElemento(peticion: PeticionDibujo): Promise<void> {
  const { elemento } = peticion

  switch (elemento.clase) {
    case 'texto':
      await dibujarTexto(peticion, elemento)
      return
    case 'texto-editado':
      await dibujarTextoEditado(peticion, elemento)
      return
    case 'imagen':
      await dibujarImagen(peticion, elemento)
      return
    case 'trazo':
      dibujarTrazo(peticion, elemento)
      return
    case 'forma':
      dibujarForma(peticion, elemento)
      return
    case 'resaltado':
      dibujarResaltado(peticion, elemento)
      return
  }
}

/** Cómo colocar el texto dentro de su caja. */
interface OpcionesTexto {
  /**
   * Distancia en puntos desde el borde superior de la caja hasta la primera línea
   * base.
   */
  readonly lineaBase: number
  /**
   * Reparte el texto en líneas para que quepa en el ancho de la caja.
   *
   * Se desactiva al corregir una palabra existente: su caja mide exactamente lo que
   * medía la palabra original, así que ajustar al ancho partiría cualquier
   * corrección más larga y solo se vería la primera línea.
   */
  readonly ajustar: boolean
}

/**
 * Dibuja un texto.
 *
 * El texto se ajusta en líneas al ancho de su caja y se recorta si no cabe en el
 * alto. Recortar no es lo ideal, pero es preferible a dejar que el texto se salga de
 * la caja y se pinte sobre el resto de la página.
 */
async function dibujarTexto(
  peticion: PeticionDibujo,
  elemento: ElementoTexto | ElementoTextoEditado,
  opciones?: OpcionesTexto,
): Promise<void> {
  const { pagina, pdfLib, contexto } = peticion
  const tipografia = await peticion.tipografias.obtener(elemento.tipografia)
  const color = interpretarColorConReserva(elemento.color, NEGRO)

  const colocacion = calcularColocacionElemento(elemento, contexto)
  const caja = colocacion.cajaEnPagina
  const ajustar = opciones?.ajustar ?? true
  const lineaBase = opciones?.lineaBase ?? elemento.tamano * 0.8

  const lineas = ajustar
    ? ajustarLineas(elemento.texto, tipografia, elemento.tamano, caja.ancho)
    : elemento.texto.split(/\r?\n/u)

  const interlineado = elemento.tamano * 1.2
  const cabenLineas = ajustar
    ? Math.max(1, Math.floor(caja.alto / interlineado))
    : lineas.length
  const visibles = lineas.slice(0, cabenLineas)

  for (const [indice, linea] of visibles.entries()) {
    const anchoLinea = medirTexto(tipografia, linea, elemento.tamano)
    const sangria = calcularSangria(
      elemento.alineacion,
      caja.ancho,
      anchoLinea,
    )

    // pdf-lib coloca el texto por su línea base, así que se cuenta desde el borde
    // superior de la caja hasta donde se apoyan las letras.
    const desplazamientoY = caja.alto - lineaBase - interlineado * indice

    const colocacionLinea = calcularColocacionElemento(elemento, contexto, {
      x: sangria,
      y: desplazamientoY,
    })

    pagina.drawText(linea, {
      x: colocacionLinea.x,
      y: colocacionLinea.y,
      size: elemento.tamano,
      font: tipografia,
      color: aColorPdf(pdfLib, color),
      opacity: elemento.opacidad,
      rotate: pdfLib.degrees(colocacionLinea.rotacionGrados),
    })
  }
}

/**
 * Cubre solo la caja de la palabra original y dibuja su versión corregida.
 *
 * La caja del elemento coincide con la palabra original al píxel, porque es lo que
 * hace que la corrección caiga en su sitio. El fondo sí se agranda un poco al
 * pintarlo, para que no asomen los bordes suavizados de los glifos de debajo.
 */
async function dibujarTextoEditado(
  peticion: PeticionDibujo,
  elemento: ElementoTextoEditado,
): Promise<void> {
  const medidas = calcularMedidasVisibles(
    peticion.contexto.caja,
    peticion.contexto.rotacion,
  )
  const margenAncho = MARGEN_COBERTURA_PUNTOS / Math.max(1, medidas.ancho)
  const margenAlto = MARGEN_COBERTURA_PUNTOS / Math.max(1, medidas.alto)

  dibujarForma(peticion, {
    ...elemento,
    clase: 'forma',
    figura: 'rectangulo',
    izquierda: elemento.izquierda - margenAncho,
    superior: elemento.superior - margenAlto,
    ancho: elemento.ancho + margenAncho * 2,
    alto: elemento.alto + margenAlto * 2,
    relleno: elemento.colorFondo,
    borde: null,
    grosorBorde: 0.25,
  })

  if (elemento.texto.trim() !== '') {
    const caja = calcularCajaVisible(elemento, medidas)

    await dibujarTexto(peticion, elemento, {
      lineaBase: elemento.lineaBase * caja.alto,
      ajustar: false,
    })
  }
}

/** Calcula cuánto hay que desplazar una línea según su alineación. */
export function calcularSangria(
  alineacion: ElementoTexto['alineacion'],
  anchoCaja: number,
  anchoLinea: number,
): number {
  switch (alineacion) {
    case 'izquierda':
      return 0
    case 'centro':
      return Math.max(0, (anchoCaja - anchoLinea) / 2)
    case 'derecha':
      return Math.max(0, anchoCaja - anchoLinea)
  }
}

/** Mide un texto, devolviendo 0 si la tipografía no puede representarlo. */
function medirTexto(
  tipografia: PDFFont,
  texto: string,
  tamano: number,
): number {
  try {
    return tipografia.widthOfTextAtSize(texto, tamano)
  } catch {
    return 0
  }
}

/**
 * Reparte un texto en líneas que caben en un ancho.
 *
 * Se respetan los saltos de línea que ya trae el texto y se parte por palabras. Una
 * palabra más larga que la caja se deja sola en su línea en lugar de partirla por la
 * mitad: partir palabras sin reglas de guionado da resultados peores.
 */
export function ajustarLineas(
  texto: string,
  tipografia: PDFFont,
  tamano: number,
  anchoDisponible: number,
): readonly string[] {
  const lineas: string[] = []

  for (const parrafo of texto.split('\n')) {
    const palabras = parrafo.split(/\s+/).filter((palabra) => palabra !== '')

    if (palabras.length === 0) {
      lineas.push('')
      continue
    }

    let actual = ''

    for (const palabra of palabras) {
      const propuesta = actual === '' ? palabra : `${actual} ${palabra}`

      if (
        actual !== '' &&
        medirTexto(tipografia, propuesta, tamano) > anchoDisponible
      ) {
        lineas.push(actual)
        actual = palabra
      } else {
        actual = propuesta
      }
    }

    lineas.push(actual)
  }

  return lineas
}

/** Dibuja una imagen incrustada. */
async function dibujarImagen(
  peticion: PeticionDibujo,
  elemento: ElementoImagen,
): Promise<void> {
  const { pagina, pdfLib, contexto } = peticion
  const incrustada = await peticion.imagenes.obtener(elemento)
  const colocacion = calcularColocacionElemento(elemento, contexto)
  const caja = colocacion.cajaEnPagina

  pagina.drawImage(incrustada, {
    x: colocacion.x,
    y: colocacion.y,
    width: caja.ancho,
    height: caja.alto,
    opacity: elemento.opacidad,
    rotate: pdfLib.degrees(colocacion.rotacionGrados),
  })
}

/**
 * Dibuja un trazo a mano alzada.
 *
 * Se dibuja como una sucesión de segmentos rectos. Con los puntos que produce un
 * gesto de ratón o de dedo la diferencia con una curva suavizada no se aprecia, y a
 * cambio no hace falta calcular ninguna curva de Bézier.
 *
 * El trazo no se gira: girar cada punto por separado daría un resultado distinto del
 * de girar la caja. Se documenta en lugar de hacerlo a medias.
 */
function dibujarTrazo(
  peticion: PeticionDibujo,
  elemento: ElementoTrazo,
): void {
  const { pagina, pdfLib, contexto } = peticion
  const color = interpretarColorConReserva(elemento.color, NEGRO)
  const caja = calcularCajaVisible(
    elemento,
    medidasDeContexto(contexto),
  )

  for (const trazo of elemento.trazos) {
    if (trazo.length < 2) {
      continue
    }

    for (let indice = 1; indice < trazo.length; indice += 1) {
      const anterior = trazo[indice - 1]
      const siguiente = trazo[indice]

      if (anterior === undefined || siguiente === undefined) {
        continue
      }

      const desde = aPdf(peticion, puntoDeTrazoAVisible(anterior, caja))
      const hasta = aPdf(peticion, puntoDeTrazoAVisible(siguiente, caja))

      pagina.drawLine({
        start: { x: desde.x, y: desde.y },
        end: { x: hasta.x, y: hasta.y },
        thickness: elemento.grosor,
        color: aColorPdf(pdfLib, color),
        opacity: elemento.opacidad,
        lineCap: pdfLib.LineCapStyle.Round,
      })
    }
  }
}

/** Dibuja una figura geométrica. */
function dibujarForma(
  peticion: PeticionDibujo,
  elemento: ElementoForma,
): void {
  const { pagina, pdfLib, contexto } = peticion
  const colocacion = calcularColocacionElemento(elemento, contexto)
  const caja = colocacion.cajaEnPagina

  const relleno =
    elemento.relleno === null
      ? undefined
      : aColorPdf(pdfLib, interpretarColorConReserva(elemento.relleno, NEGRO))

  const borde =
    elemento.borde === null
      ? undefined
      : aColorPdf(pdfLib, interpretarColorConReserva(elemento.borde, NEGRO))

  switch (elemento.figura) {
    case 'rectangulo':
      pagina.drawRectangle({
        x: colocacion.x,
        y: colocacion.y,
        width: caja.ancho,
        height: caja.alto,
        ...(relleno === undefined ? {} : { color: relleno }),
        ...(borde === undefined ? {} : { borderColor: borde }),
        borderWidth: borde === undefined ? 0 : elemento.grosorBorde,
        opacity: elemento.opacidad,
        borderOpacity: elemento.opacidad,
        rotate: pdfLib.degrees(colocacion.rotacionGrados),
      })
      return

    case 'elipse': {
      // pdf-lib coloca la elipse por su centro, no por su esquina.
      const centro = aPdf(peticion, {
        x: caja.x + caja.ancho / 2,
        y: caja.y + caja.alto / 2,
      })

      pagina.drawEllipse({
        x: centro.x,
        y: centro.y,
        xScale: caja.ancho / 2,
        yScale: caja.alto / 2,
        ...(relleno === undefined ? {} : { color: relleno }),
        ...(borde === undefined ? {} : { borderColor: borde }),
        borderWidth: borde === undefined ? 0 : elemento.grosorBorde,
        opacity: elemento.opacidad,
        borderOpacity: elemento.opacidad,
      })
      return
    }

    case 'linea':
    case 'flecha': {
      // La línea va de la esquina inferior izquierda a la superior derecha de la
      // caja, así que la caja define su dirección además de su longitud.
      const desde = aPdf(peticion, { x: caja.x, y: caja.y })
      const hasta = aPdf(peticion, {
        x: caja.x + caja.ancho,
        y: caja.y + caja.alto,
      })
      const trazo = aColorPdf(
        pdfLib,
        interpretarColorConReserva(
          elemento.borde ?? elemento.relleno ?? "#000000",
          NEGRO,
        ),
      )

      pagina.drawLine({
        start: { x: desde.x, y: desde.y },
        end: { x: hasta.x, y: hasta.y },
        thickness: elemento.grosorBorde,
        color: trazo,
        opacity: elemento.opacidad,
        lineCap: pdfLib.LineCapStyle.Round,
      })

      if (elemento.figura === 'flecha') {
        dibujarPuntaFlecha(peticion, desde, hasta, trazo, elemento)
      }

      return
    }
  }
}

/** Dibuja las dos líneas de la punta de una flecha. */
function dibujarPuntaFlecha(
  peticion: PeticionDibujo,
  desde: { readonly x: number; readonly y: number },
  hasta: { readonly x: number; readonly y: number },
  color: ReturnType<typeof aColorPdf>,
  elemento: ElementoForma,
): void {
  const { pagina, pdfLib } = peticion
  const largo = Math.hypot(hasta.x - desde.x, hasta.y - desde.y)

  if (largo === 0) {
    return
  }

  // La punta ocupa como mucho un quinto de la flecha, con un mínimo razonable para
  // que siga viéndose en flechas cortas.
  const puntaLargo = Math.min(largo / 5, Math.max(6, elemento.grosorBorde * 4))
  const angulo = Math.atan2(hasta.y - desde.y, hasta.x - desde.x)
  const apertura = Math.PI / 7

  for (const signo of [1, -1]) {
    const direccion = angulo + Math.PI + signo * apertura

    pagina.drawLine({
      start: { x: hasta.x, y: hasta.y },
      end: {
        x: hasta.x + Math.cos(direccion) * puntaLargo,
        y: hasta.y + Math.sin(direccion) * puntaLargo,
      },
      thickness: elemento.grosorBorde,
      color,
      opacity: elemento.opacidad,
      lineCap: pdfLib.LineCapStyle.Round,
    })
  }
}

/**
 * Dibuja un resaltado.
 *
 * Es un rectángulo translúcido, nada más. **No marca el texto que hay debajo**: el
 * texto no se toca y sigue siendo seleccionable, igual que al pasar un rotulador
 * sobre un papel ya impreso.
 */
function dibujarResaltado(
  peticion: PeticionDibujo,
  elemento: ElementoResaltado,
): void {
  const { pagina, pdfLib, contexto } = peticion
  const colocacion = calcularColocacionElemento(elemento, contexto)
  const caja = colocacion.cajaEnPagina

  pagina.drawRectangle({
    x: colocacion.x,
    y: colocacion.y,
    width: caja.ancho,
    height: caja.alto,
    color: aColorPdf(
      pdfLib,
      interpretarColorConReserva(elemento.color, NEGRO),
    ),
    opacity: elemento.opacidad,
    borderWidth: 0,
    rotate: pdfLib.degrees(colocacion.rotacionGrados),
  })
}

/** Medidas visibles de la página del contexto. */
function medidasDeContexto(contexto: ContextoPagina): {
  readonly ancho: number
  readonly alto: number
} {
  const girada =
    normalizarRotacion(contexto.rotacion) === 90 ||
    normalizarRotacion(contexto.rotacion) === 270

  return girada
    ? { ancho: contexto.caja.alto, alto: contexto.caja.ancho }
    : { ancho: contexto.caja.ancho, alto: contexto.caja.alto }
}

/** Traduce un punto visible a coordenadas PDF con el contexto de la página. */
function aPdf(
  peticion: PeticionDibujo,
  visible: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } {
  const colocacion = calcularColocacionElemento(
    {
      ...peticion.elemento,
      izquierda: 0,
      superior: 0,
      ancho: 1,
      alto: 1,
      giro: 0,
    },
    peticion.contexto,
    visible,
  )

  return { x: colocacion.x, y: colocacion.y }
}

/** Convierte un color propio al de pdf-lib. */
function aColorPdf(pdfLib: ModuloPdfLib, color: ColorRgb) {
  return pdfLib.rgb(color.rojo, color.verde, color.azul)
}

/**
 * Tipografías incrustadas una sola vez por documento.
 *
 * Sin esta memoria, un documento con cincuenta textos incrustaría cincuenta veces la
 * misma tipografía y el archivo crecería sin motivo.
 */
class CacheTipografias {
  private readonly enMemoria = new Map<string, PDFFont>()
  private readonly documento: PDFDocument
  private readonly pdfLib: ModuloPdfLib

  constructor(documento: PDFDocument, pdfLib: ModuloPdfLib) {
    this.documento = documento
    this.pdfLib = pdfLib
  }

  async obtener(clave: string): Promise<PDFFont> {
    const guardada = this.enMemoria.get(clave)

    if (guardada !== undefined) {
      return guardada
    }

    const nombre =
      TIPOGRAFIAS_ESTANDAR[clave as keyof typeof TIPOGRAFIAS_ESTANDAR] ??
      TIPOGRAFIAS_ESTANDAR.helvetica

    const tipografia = await this.documento.embedFont(
      this.pdfLib.StandardFonts[nombre],
    )

    this.enMemoria.set(clave, tipografia)

    return tipografia
  }
}

/** Imágenes incrustadas una sola vez, comparando por identidad del elemento. */
class CacheImagenes {
  private readonly enMemoria = new Map<
    Uint8Array,
    Awaited<ReturnType<PDFDocument['embedPng']>>
  >()
  private readonly documento: PDFDocument

  constructor(documento: PDFDocument) {
    this.documento = documento
  }

  async obtener(
    elemento: ElementoImagen,
  ): Promise<Awaited<ReturnType<PDFDocument['embedPng']>>> {
    const guardada = this.enMemoria.get(elemento.bytes)

    if (guardada !== undefined) {
      return guardada
    }

    const incrustada =
      elemento.formato === 'png'
        ? await this.documento.embedPng(elemento.bytes)
        : await this.documento.embedJpg(elemento.bytes)

    this.enMemoria.set(elemento.bytes, incrustada)

    return incrustada
  }
}

/** Carga pdf-lib y aplica la edición, para quien no lo tenga ya cargado. */
export async function aplicarEdicionConCarga(
  documento: PDFDocument,
  elementos: readonly ElementoSuperpuesto[],
  nombreArchivo: string,
  opciones: OpcionesEdicion = {},
): Promise<ResultadoEdicion> {
  const pdfLib = await cargarPdfLib()

  return aplicarEdicion(
    { documento, pdfLib, elementos, nombreArchivo },
    opciones,
  )
}

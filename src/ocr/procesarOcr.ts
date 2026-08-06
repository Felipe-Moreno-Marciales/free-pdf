import { lienzoABlob } from '../imagenes/convertirCanvas'
import { crearLienzo, obtenerContexto } from '../imagenes/dibujarImagen'
import { descodificarImagen } from '../imagenes/cargarImagen'
import { detectarFormatoImagen } from '../imagenes/validarImagen'
import {
  cederElControl,
  comprobarCancelacion,
  OperacionCancelada,
} from '../pdf/cancelacion'
import { liberarDocumentoPdf, liberarLienzo } from '../pdf/liberarDocumentoPdf'
import { abrirDocumentoPdfJs } from '../pdf/renderizarMiniaturaPdf'
import { renderizarPaginaAEscala } from '../pdf/renderizarPaginaCompleta'
import { esArchivoPdf } from '../utilidades/validacionArchivos'
import {
  crearMotorOcr,
  type IdiomaOcr,
  type MensajeProgresoMotor,
} from './motorOcr'

export interface PaginaOcr {
  readonly origen: string
  readonly numeroPagina: number | null
  readonly texto: string
}

export interface ResultadoOcr {
  readonly paginas: readonly PaginaOcr[]
  readonly texto: string
  readonly contieneTexto: boolean
}

export interface ProgresoOcr {
  readonly completadas: number
  readonly total: number
  readonly actual: number
  readonly origen: string
  readonly estadoMotor: string
  readonly progresoPagina: number
}

export interface DependenciasOcr {
  readonly crearMotor: typeof crearMotorOcr
}

const DEPENDENCIAS: DependenciasOcr = { crearMotor: crearMotorOcr }

function limpiarTexto(texto: string): string {
  return texto.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
}

/** Convierte WebP a PNG porque el núcleo OCR no garantiza descodificar WebP. */
async function normalizarImagen(archivo: File): Promise<{
  readonly blob: Blob
  readonly liberar: () => void
}> {
  if (detectarFormatoImagen(archivo) !== 'webp') {
    return { blob: archivo, liberar: () => undefined }
  }

  const imagen = await descodificarImagen(archivo, archivo.name)
  const lienzo = crearLienzo(
    imagen.dimensiones.ancho,
    imagen.dimensiones.alto,
  )
  try {
    obtenerContexto(lienzo).drawImage(imagen.fuente, 0, 0)
    const blob = await lienzoABlob(lienzo, 'png')
    return {
      blob,
      liberar: () => {
        liberarLienzo(lienzo)
        imagen.liberar()
      },
    }
  } catch (error) {
    liberarLienzo(lienzo)
    imagen.liberar()
    throw error
  }
}

/**
 * Ejecuta una promesa interrumpiéndola en cuanto se cancela la señal.
 *
 * Tesseract no expone cancelación por trabajo; destruir el trabajador es la
 * única interrupción real. La carrera evita esperar una respuesta del trabajador
 * ya terminado.
 */
async function conCancelacion<Resultado>(
  promesa: Promise<Resultado>,
  senal: AbortSignal,
): Promise<Resultado> {
  if (senal.aborted) throw new OperacionCancelada()
  let rechazarCancelacion: ((motivo: OperacionCancelada) => void) | null = null
  const alAbortar = (): void =>
    rechazarCancelacion?.(new OperacionCancelada())
  const cancelacion = new Promise<never>((_resolver, rechazar) => {
    rechazarCancelacion = rechazar
    senal.addEventListener('abort', alAbortar, { once: true })
  })
  try {
    return await Promise.race([promesa, cancelacion])
  } finally {
    senal.removeEventListener('abort', alAbortar)
  }
}

/** Reconoce imágenes o las páginas de un único PDF de forma secuencial. */
export async function procesarOcr(
  archivos: readonly File[],
  idioma: IdiomaOcr,
  senal: AbortSignal,
  alProgreso?: (progreso: ProgresoOcr) => void,
  dependencias: DependenciasOcr = DEPENDENCIAS,
): Promise<ResultadoOcr> {
  if (archivos.length === 0) {
    throw new Error('Selecciona al menos una imagen o un documento PDF.')
  }

  let progresoMotor: MensajeProgresoMotor = {
    estado: 'Preparando el motor',
    fraccion: 0,
  }
  let actual = 1
  let total = archivos.length
  let origen = archivos[0]?.name ?? ''
  const informar = (): void =>
    alProgreso?.({
      completadas: actual - 1,
      total,
      actual,
      origen,
      estadoMotor: progresoMotor.estado,
      progresoPagina: progresoMotor.fraccion,
    })

  const motor = await dependencias.crearMotor(idioma, (mensaje) => {
    progresoMotor = mensaje
    informar()
  })
  const alAbortar = (): void => {
    void motor.destruir()
  }
  senal.addEventListener('abort', alAbortar, { once: true })
  const paginas: PaginaOcr[] = []

  try {
    const pdf = archivos.length === 1 && esArchivoPdf(archivos[0] as File)
    if (pdf) {
      const archivo = archivos[0] as File
      const abierto = await abrirDocumentoPdfJs(archivo)
      total = abierto.numeroPaginas
      try {
        for (let numero = 1; numero <= total; numero += 1) {
          comprobarCancelacion(senal)
          actual = numero
          origen = archivo.name
          progresoMotor = { estado: 'Preparando la página', fraccion: 0 }
          informar()
          const dibujada = await renderizarPaginaAEscala(
            abierto.documento,
            numero,
            2.5,
            senal,
          )
          if (dibujada === null) throw new OperacionCancelada()
          try {
            const blob = await lienzoABlob(dibujada.lienzo, 'png')
            const texto = limpiarTexto(
              await conCancelacion(motor.reconocer(blob), senal),
            )
            paginas.push({
              origen: archivo.name,
              numeroPagina: numero,
              texto,
            })
          } finally {
            liberarLienzo(dibujada.lienzo)
          }
          progresoMotor = { estado: 'Página terminada', fraccion: 1 }
          informar()
          await cederElControl()
        }
      } finally {
        await liberarDocumentoPdf(abierto)
      }
    } else {
      total = archivos.length
      for (const [indice, archivo] of archivos.entries()) {
        comprobarCancelacion(senal)
        actual = indice + 1
        origen = archivo.name
        progresoMotor = { estado: 'Preparando la imagen', fraccion: 0 }
        informar()
        const normalizada = await normalizarImagen(archivo)
        try {
          const texto = limpiarTexto(
            await conCancelacion(motor.reconocer(normalizada.blob), senal),
          )
          paginas.push({
            origen: archivo.name,
            numeroPagina: null,
            texto,
          })
        } finally {
          normalizada.liberar()
        }
        progresoMotor = { estado: 'Imagen terminada', fraccion: 1 }
        informar()
        await cederElControl()
      }
    }
  } finally {
    senal.removeEventListener('abort', alAbortar)
    await motor.destruir()
  }

  const texto = paginas.map((pagina) => pagina.texto).join('\n\n').trim()
  return {
    paginas,
    texto,
    contieneTexto: paginas.some((pagina) => pagina.texto !== ''),
  }
}

export function generarTextoOcr(resultado: ResultadoOcr): string {
  return `${resultado.paginas.map((pagina) => pagina.texto).join('\n\n').trim()}\n`
}

export function generarMarkdownOcr(resultado: ResultadoOcr): string {
  const paginas = resultado.paginas.map((pagina) => {
    const titulo =
      pagina.numeroPagina === null
        ? `## ${pagina.origen}`
        : `## Página ${pagina.numeroPagina}`
    return `${titulo}\n\n${pagina.texto}`
  })
  return `${paginas.join('\n\n---\n\n').trim()}\n`
}

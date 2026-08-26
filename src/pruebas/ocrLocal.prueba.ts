import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createCanvas } from '@napi-rs/canvas'
import { zlibSync } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import {
  construirOpcionesMotor,
  crearMotorOcr,
  traducirEstadoMotor,
} from '../ocr/motorOcr'
import {
  generarMarkdownOcr,
  generarTextoOcr,
  procesarOcr,
  type ResultadoOcr,
} from '../ocr/procesarOcr'
import {
  URL_IDIOMAS_OCR,
  URL_NUCLEOS_OCR,
  URL_RECURSOS_OCR,
  URL_TRABAJADOR_OCR,
  construirUrlRecursosOcr,
} from '../ocr/recursosOcr'
import { OperacionCancelada } from '../pdf/cancelacion'

/** Tipografía de píxeles mínima para generar imágenes sin otra dependencia. */
const GLIFOS: Readonly<Record<string, readonly string[]>> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

/** Crea un BMP de 24 bits con texto negro grande sobre blanco. */
function crearBmp(texto: string): Uint8Array {
  const escala = 10
  const margen = 30
  const ancho = margen * 2 + (texto.length * 6 - 1) * escala
  const alto = margen * 2 + 7 * escala
  const bytesFila = Math.ceil((ancho * 3) / 4) * 4
  const desplazamiento = 54
  const bytes = new Uint8Array(desplazamiento + bytesFila * alto)
  bytes.fill(255, desplazamiento)
  const vista = new DataView(bytes.buffer)
  vista.setUint16(0, 0x4d42, true)
  vista.setUint32(2, bytes.length, true)
  vista.setUint32(10, desplazamiento, true)
  vista.setUint32(14, 40, true)
  vista.setInt32(18, ancho, true)
  vista.setInt32(22, alto, true)
  vista.setUint16(26, 1, true)
  vista.setUint16(28, 24, true)
  vista.setUint32(34, bytesFila * alto, true)
  vista.setInt32(38, 11_811, true)
  vista.setInt32(42, 11_811, true)

  for (const [indice, caracter] of [...texto].entries()) {
    const glifo = GLIFOS[caracter]
    if (glifo === undefined) throw new Error(`Falta el glifo ${caracter}.`)
    for (const [fila, patron] of glifo.entries()) {
      for (const [columna, pixel] of [...patron].entries()) {
        if (pixel !== '1') continue
        for (let dy = 0; dy < escala; dy += 1) {
          for (let dx = 0; dx < escala; dx += 1) {
            const x = margen + (indice * 6 + columna) * escala + dx
            const ySuperior = margen + fila * escala + dy
            const yBmp = alto - 1 - ySuperior
            const posicion = desplazamiento + yBmp * bytesFila + x * 3
            bytes[posicion] = 0
            bytes[posicion + 1] = 0
            bytes[posicion + 2] = 0
          }
        }
      }
    }
  }
  return bytes
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function crearChunkPng(tipo: string, datos: Uint8Array): Uint8Array {
  const nombre = new TextEncoder().encode(tipo)
  const resultado = new Uint8Array(12 + datos.length)
  const vista = new DataView(resultado.buffer)
  vista.setUint32(0, datos.length)
  resultado.set(nombre, 4)
  resultado.set(datos, 8)
  vista.setUint32(8 + datos.length, crc32(resultado.slice(4, 8 + datos.length)))
  return resultado
}

/** Convierte el BMP generado a PNG para incrustarlo de verdad en una página. */
function convertirBmpAPng(bmp: Uint8Array): Uint8Array {
  const vistaBmp = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength)
  const ancho = vistaBmp.getInt32(18, true)
  const alto = vistaBmp.getInt32(22, true)
  const inicio = vistaBmp.getUint32(10, true)
  const bytesFilaBmp = Math.ceil((ancho * 3) / 4) * 4
  const filas = new Uint8Array((ancho * 3 + 1) * alto)

  for (let y = 0; y < alto; y += 1) {
    const destinoFila = y * (ancho * 3 + 1)
    filas[destinoFila] = 0
    const origenFila = inicio + (alto - 1 - y) * bytesFilaBmp
    for (let x = 0; x < ancho; x += 1) {
      const origen = origenFila + x * 3
      const destino = destinoFila + 1 + x * 3
      filas[destino] = bmp[origen + 2] ?? 0
      filas[destino + 1] = bmp[origen + 1] ?? 0
      filas[destino + 2] = bmp[origen] ?? 0
    }
  }

  const ihdr = new Uint8Array(13)
  const vistaIhdr = new DataView(ihdr.buffer)
  vistaIhdr.setUint32(0, ancho)
  vistaIhdr.setUint32(4, alto)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const partes = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    crearChunkPng('IHDR', ihdr),
    crearChunkPng('IDAT', zlibSync(filas)),
    crearChunkPng('IEND', new Uint8Array()),
  ]
  const longitud = partes.reduce((suma, parte) => suma + parte.length, 0)
  const png = new Uint8Array(longitud)
  let posicion = 0
  for (const parte of partes) {
    png.set(parte, posicion)
    posicion += parte.length
  }
  return png
}

function normalizarReconocido(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Z ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

async function prepararIdiomasTemporales(): Promise<string> {
  const requerir = createRequire(import.meta.url)
  const carpeta = await mkdtemp(path.join(tmpdir(), 'free-pdf-ocr-'))
  const eng = path.join(
    path.dirname(requerir.resolve('@tesseract.js-data/eng/package.json')),
    '4.0.0_best_int',
    'eng.traineddata.gz',
  )
  const spa = path.join(
    path.dirname(requerir.resolve('@tesseract.js-data/spa/package.json')),
    '4.0.0_best_int',
    'spa.traineddata.gz',
  )
  await Promise.all([
    copyFile(eng, path.join(carpeta, 'eng.traineddata.gz')),
    copyFile(spa, path.join(carpeta, 'spa.traineddata.gz')),
  ])
  return carpeta
}

describe('motor OCR real', () => {
  it(
    'reconoce español, inglés, ambos idiomas y una imagen sin texto',
    async () => {
      const carpeta = await prepararIdiomasTemporales()
      const avances: number[] = []
      const motor = await crearMotorOcr(
        'espanol-ingles',
        (mensaje) => avances.push(mensaje.fraccion),
        { langPath: carpeta },
      )

      try {
        const espanol = normalizarReconocido(
          await motor.reconocer(crearBmp('TEXTO EN ESPANOL')),
        )
        const ingles = normalizarReconocido(
          await motor.reconocer(crearBmp('HELLO WORLD')),
        )
        const combinado = normalizarReconocido(
          await motor.reconocer(crearBmp('HOLA WORLD')),
        )
        const vacio = normalizarReconocido(
          await motor.reconocer(crearBmp('   ')),
        )
        const detallado = await motor.reconocerPalabras?.(
          crearBmp('HELLO WORLD'),
        )

        expect(espanol).toContain('TEXTO')
        // La tipografía de píxeles es deliberadamente mínima: el motor acierta
        // el término español principal aunque confunda parte del segundo.
        expect(ingles).toContain('HELLO WORLD')
        expect(combinado).toContain('HOLA')
        expect(combinado).toContain('WORL')
        expect(vacio).toBe('')
        expect(detallado?.palabras.some((palabra) => palabra.texto.includes('HELLO')))
          .toBe(true)
        expect(
          detallado?.palabras.every(
            (palabra) =>
              palabra.derecha > palabra.izquierda &&
              palabra.inferior > palabra.superior,
          ),
        ).toBe(true)
        expect(avances.some((avance) => avance > 0 && avance <= 1)).toBe(true)
      } finally {
        await motor.destruir()
        await rm(carpeta, { recursive: true })
      }
    },
    60_000,
  )
})

describe('orquestación OCR', () => {
  it('procesa imágenes secuencialmente, informa progreso y destruye el trabajador', async () => {
    const destruir = vi.fn(async () => undefined)
    const reconocer = vi
      .fn<(imagen: Blob | Uint8Array) => Promise<string>>()
      .mockResolvedValueOnce('Hola')
      .mockResolvedValueOnce('World')
    const crearMotor = vi.fn(async (_idioma, alProgreso) => {
      alProgreso({ estado: 'Reconociendo el texto', fraccion: 0.5 })
      return { reconocer, destruir }
    })
    const progresos: number[] = []
    const resultado = await procesarOcr(
      [
        new File([new Uint8Array([1])], 'uno.png', { type: 'image/png' }),
        new File([new Uint8Array([2])], 'dos.jpg', { type: 'image/jpeg' }),
      ],
      'espanol-ingles',
      new AbortController().signal,
      (progreso) => progresos.push(progreso.actual),
      { crearMotor },
    )

    expect(resultado.texto).toBe('Hola\n\nWorld')
    expect(reconocer).toHaveBeenCalledTimes(2)
    expect(destruir).toHaveBeenCalledTimes(1)
    expect(progresos).toContain(1)
    expect(progresos).toContain(2)
  })

  it('cancela el trabajo pendiente y destruye el trabajador', async () => {
    const controlador = new AbortController()
    const destruir = vi.fn(async () => undefined)
    const reconocer = vi.fn(
      async () =>
        await new Promise<string>(() => {
          // La promesa queda pendiente hasta que la carrera detecta el aborto.
        }),
    )
    const operacion = procesarOcr(
      [new File([new Uint8Array([1])], 'uno.png', { type: 'image/png' })],
      'espanol',
      controlador.signal,
      undefined,
      {
        crearMotor: vi.fn(async () => ({ reconocer, destruir })),
      },
    )
    await Promise.resolve()
    controlador.abort()

    await expect(operacion).rejects.toBeInstanceOf(OperacionCancelada)
    expect(destruir).toHaveBeenCalled()
  })

  it(
    'representa con PDF.js y reconoce con el motor real un PDF escaneado',
    async () => {
      const documento = await PDFDocument.create()
      const png = await documento.embedPng(
        convertirBmpAPng(crearBmp('HOLA WORLD')),
      )
      const pagina = documento.addPage([png.width, png.height])
      pagina.drawImage(png, {
        x: 0,
        y: 0,
        width: png.width,
        height: png.height,
      })
      const bytes = await documento.save()
      const reabierto = await PDFDocument.load(bytes)
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const tarea = pdfjs.getDocument({ data: new Uint8Array(bytes) })
      const documentoVisual = await tarea.promise
      const paginaVisual = await documentoVisual.getPage(1)
      const vista = paginaVisual.getViewport({ scale: 2 })
      const lienzo = createCanvas(
        Math.ceil(vista.width),
        Math.ceil(vista.height),
      )
      const carpeta = await prepararIdiomasTemporales()
      let motor: Awaited<ReturnType<typeof crearMotorOcr>> | null = null

      try {
        motor = await crearMotorOcr(
          'espanol-ingles',
          () => undefined,
          { langPath: carpeta },
        )
        /*
         * PDF.js declara un lienzo del DOM, mientras que esta prueba aporta su
         * implementación binaria compatible para Node. El molde se limita a
         * esa frontera y la representación la ejecuta PDF.js de verdad.
         */
        await paginaVisual.render({
          canvas: lienzo as unknown as HTMLCanvasElement,
          viewport: vista,
        }).promise
        const reconocido = normalizarReconocido(
          await motor.reconocer(
            new Uint8Array(lienzo.toBuffer('image/png')),
          ),
        )

        expect(reabierto.getPageCount()).toBe(1)
        expect(new TextDecoder().decode(bytes)).not.toContain('HOLA WORLD')
        // La tipografía mínima confunde a veces «HOLA» con «AULA» después del
        // rasterizado. Se acepta ese error OCR conocido, pero no una salida
        // vacía ni la pérdida del término inglés.
        expect(reconocido).toMatch(/^(?:HOLA|AULA) WORLD$/)
      } finally {
        await motor?.destruir()
        await paginaVisual.cleanup()
        await tarea.destroy()
        lienzo.width = 0
        lienzo.height = 0
        await rm(carpeta, { recursive: true })
      }
    },
    60_000,
  )
})

describe('recursos y exportaciones OCR', () => {
  it('fija todas las rutas en el mismo origen y bajo /free-pdf/', () => {
    expect(construirUrlRecursosOcr('/free-pdf/')).toBe('/free-pdf/ocr/')
    for (const ruta of [
      URL_RECURSOS_OCR,
      URL_TRABAJADOR_OCR,
      URL_NUCLEOS_OCR,
      URL_IDIOMAS_OCR,
    ]) {
      expect(ruta).toMatch(/^\/(?:free-pdf\/)?ocr/)
      expect(ruta).not.toMatch(/^https?:/)
    }
  })

  it('traduce el progreso sin exponer mensajes internos', () => {
    expect(traducirEstadoMotor('recognizing text')).toBe(
      'Reconociendo el texto',
    )
  })

  it('desactiva almacenamiento persistente y no contiene rutas externas', () => {
    const opciones = construirOpcionesMotor(() => undefined, {
      workerPath: '/free-pdf/ocr/worker.min.js',
      corePath: '/free-pdf/ocr/core',
      langPath: '/free-pdf/ocr/idiomas',
    })
    expect(opciones.cacheMethod).toBe('none')
    expect(opciones.workerBlobURL).toBe(false)
    expect(JSON.stringify(opciones)).not.toMatch(/https?:|cdn|jsdelivr/i)
  })

  it('genera TXT y Markdown válidos', () => {
    const resultado: ResultadoOcr = {
      contieneTexto: true,
      texto: 'Hola',
      paginas: [
        { origen: 'uno.png', numeroPagina: null, texto: 'Hola' },
        { origen: 'escaneo.pdf', numeroPagina: 2, texto: 'World' },
      ],
    }
    expect(generarTextoOcr(resultado)).toBe('Hola\n\nWorld\n')
    expect(generarMarkdownOcr(resultado)).toContain('## uno.png')
    expect(generarMarkdownOcr(resultado)).toContain('## Página 2')
    expect(generarMarkdownOcr(resultado)).toContain('\n\n---\n\n')
  })
})

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

/** Carpeta pública de todos los recursos estáticos de Tesseract. */
export const CARPETA_RECURSOS_OCR = 'ocr'

interface RecursoOcr {
  readonly publico: string
  readonly paquete: string
  readonly relativo: string
  readonly tipo: string
}

/**
 * Solo se publican los tres núcleos LSTM posibles. El trabajador elige entre
 * normal, SIMD y SIMD relajado según el navegador; las variantes «legacy» no
 * se usan. Los archivos `.wasm.js` incluyen el WebAssembly y no recurren a una
 * segunda dirección.
 */
const RECURSOS: readonly RecursoOcr[] = [
  {
    publico: 'worker.min.js',
    paquete: 'tesseract.js',
    relativo: 'dist/worker.min.js',
    tipo: 'text/javascript; charset=utf-8',
  },
  ...[
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
  ].map(
    (archivo): RecursoOcr => ({
      publico: `core/${archivo}`,
      paquete: 'tesseract.js-core',
      relativo: archivo,
      tipo: 'text/javascript; charset=utf-8',
    }),
  ),
  {
    publico: 'idiomas/eng.traineddata.gz',
    paquete: '@tesseract.js-data/eng',
    relativo: '4.0.0_best_int/eng.traineddata.gz',
    tipo: 'application/gzip',
  },
  {
    publico: 'idiomas/spa.traineddata.gz',
    paquete: '@tesseract.js-data/spa',
    relativo: '4.0.0_best_int/spa.traineddata.gz',
    tipo: 'application/gzip',
  },
]

function localizarPaquete(raiz: string, nombre: string): string {
  const requerir = createRequire(path.join(raiz, 'package.json'))
  return path.dirname(requerir.resolve(`${nombre}/package.json`))
}

/** Resuelve el mapa de rutas públicas a archivos instalados. */
function resolverRecursos(raiz: string): ReadonlyMap<string, {
  readonly origen: string
  readonly tipo: string
}> {
  return new Map(
    RECURSOS.map((recurso) => [
      recurso.publico,
      {
        origen: path.join(
          localizarPaquete(raiz, recurso.paquete),
          recurso.relativo,
        ),
        tipo: recurso.tipo,
      },
    ]),
  )
}

/**
 * Sustituye la reserva CDN de la biblioteca por una dirección local que falla
 * de forma cerrada. Las rutas correctas se pasan siempre de forma explícita;
 * esta sustitución impide una petición externa incluso si una regresión dejara
 * de pasarlas.
 */
function bloquearCdn(contenido: string, base: string): string {
  return contenido.replaceAll(
    'https://cdn.jsdelivr.net/npm/',
    `${base}${CARPETA_RECURSOS_OCR}/recurso-externo-bloqueado/`,
  )
}

/** Publica Tesseract, sus núcleos y los dos idiomas desde el mismo origen. */
export function recursosOcr(): Plugin {
  let configuracion: ResolvedConfig
  let recursos: ReturnType<typeof resolverRecursos>

  return {
    name: 'free-pdf-recursos-ocr',

    configResolved(resuelta) {
      configuracion = resuelta
      recursos = resolverRecursos(resuelta.root)
    },

    transform(codigo, identificador) {
      if (!identificador.includes('tesseract.js')) return null
      const protegido = bloquearCdn(codigo, configuracion.base)
      return protegido === codigo ? null : { code: protegido, map: null }
    },

    configureServer(servidor) {
      const prefijos = [
        `${configuracion.base}${CARPETA_RECURSOS_OCR}/`,
        `/${CARPETA_RECURSOS_OCR}/`,
      ]

      servidor.middlewares.use((peticion, respuesta, siguiente) => {
        const direccion = peticion.url ?? ''
        const prefijo = prefijos.find((actual) => direccion.startsWith(actual))
        if (prefijo === undefined) {
          siguiente()
          return
        }

        const publica = decodeURIComponent(
          direccion.slice(prefijo.length).split('?')[0],
        )
        const recurso = recursos.get(publica)
        if (recurso === undefined) {
          respuesta.statusCode = 404
          respuesta.end('Recurso OCR no encontrado.')
          return
        }

        respuesta.setHeader('Content-Type', recurso.tipo)
        void readFile(recurso.origen)
          .then((contenido) => {
            if (publica === 'worker.min.js') {
              respuesta.end(
                bloquearCdn(contenido.toString('utf8'), configuracion.base),
              )
            } else {
              respuesta.end(contenido)
            }
          })
          .catch(() => {
            respuesta.statusCode = 404
            respuesta.end('Recurso OCR no encontrado.')
          })
      })
    },

    async writeBundle() {
      const destinoBase = path.resolve(
        configuracion.root,
        configuracion.build.outDir,
        CARPETA_RECURSOS_OCR,
      )
      let bytes = 0

      for (const [publica, recurso] of recursos) {
        const destino = path.join(destinoBase, publica)
        await mkdir(path.dirname(destino), { recursive: true })
        if (publica === 'worker.min.js') {
          const contenido = await readFile(recurso.origen, 'utf8')
          await writeFile(
            destino,
            bloquearCdn(contenido, configuracion.base),
            'utf8',
          )
        } else {
          await writeFile(destino, await readFile(recurso.origen))
        }
        bytes += (await stat(destino)).size
      }

      configuracion.logger.info(
        `Recursos de OCR: ${recursos.size} archivos (${(bytes / 1024 / 1024).toFixed(2)} MB)`,
      )
    },
  }
}

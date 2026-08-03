import { createReadStream } from 'node:fs'
import { cp, readdir, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

/**
 * Complemento de Vite que sirve los recursos auxiliares de PDF.js desde la
 * propia aplicación.
 *
 * PDF.js necesita varios archivos externos para representar bien los documentos
 * complejos: las tablas de caracteres (CMaps) de los alfabetos asiáticos, las
 * tipografías estándar del formato PDF, los módulos WebAssembly que descodifican
 * JBIG2 y JPEG 2000, y el perfil de color predeterminado. Por omisión los busca
 * en una CDN, lo que está descartado en este proyecto.
 *
 * En lugar de eso, este complemento los toma del paquete `pdfjs-dist` instalado
 * y los publica bajo `<base>pdfjs/`:
 *
 * - En desarrollo, mediante un middleware que los lee de `node_modules`.
 * - En la compilación, copiándolos dentro de `dist`.
 *
 * Así no se guarda ningún binario en el repositorio, las rutas respetan la ruta
 * base de GitHub Pages y todas las peticiones van al mismo origen.
 */

/** Carpeta pública bajo la que se publican los recursos. */
export const CARPETA_RECURSOS_PDFJS = 'pdfjs'

/** Recurso de `pdfjs-dist` que se publica. */
interface RecursoPdfJs {
  /** Carpeta dentro del paquete `pdfjs-dist`. */
  readonly carpeta: string
  /** Archivos que no se copian, por no ser necesarios. */
  readonly excluir?: RegExp
}

/**
 * Recursos que se publican.
 *
 * De la carpeta `wasm` se excluye `quickjs-eval`, que son casi quinientos
 * kilobytes destinados a ejecutar el JavaScript incrustado en algunos PDF. Esa
 * capacidad no se activa nunca en esta aplicación, así que no se distribuye.
 */
const RECURSOS: readonly RecursoPdfJs[] = [
  { carpeta: 'cmaps' },
  { carpeta: 'standard_fonts' },
  { carpeta: 'wasm', excluir: /^quickjs-eval\./ },
  { carpeta: 'iccs' },
]

/** Tipo de contenido de cada extensión que se sirve. */
const TIPOS_CONTENIDO: Readonly<Record<string, string>> = {
  '.bcmap': 'application/octet-stream',
  '.icc': 'application/vnd.iccprofile',
  '.js': 'text/javascript; charset=utf-8',
  '.pfb': 'application/x-font-type1',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
}

/** Localiza la carpeta del paquete `pdfjs-dist` instalado. */
function localizarPdfJs(raiz: string): string {
  const requerir = createRequire(path.join(raiz, 'package.json'))
  const manifiesto = requerir.resolve('pdfjs-dist/package.json')

  return path.dirname(manifiesto)
}

/** Comprueba que una ruta resuelta siga dentro de la carpeta permitida. */
function estaDentro(carpeta: string, ruta: string): boolean {
  const relativa = path.relative(carpeta, ruta)

  return (
    relativa !== '' &&
    !relativa.startsWith('..') &&
    !path.isAbsolute(relativa)
  )
}

/** Suma el tamaño de los archivos copiados de un recurso. */
async function medirCarpeta(
  carpeta: string,
  excluir: RegExp | undefined,
): Promise<{ readonly archivos: number; readonly bytes: number }> {
  let archivos = 0
  let bytes = 0

  for (const entrada of await readdir(carpeta, { withFileTypes: true })) {
    if (!entrada.isFile() || excluir?.test(entrada.name) === true) {
      continue
    }

    archivos += 1
    bytes += (await stat(path.join(carpeta, entrada.name))).size
  }

  return { archivos, bytes }
}

/** Da formato a un tamaño en bytes para el resumen de la compilación. */
function formatearTamano(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** Crea el complemento que publica los recursos auxiliares de PDF.js. */
export function recursosPdfJs(): Plugin {
  let configuracion: ResolvedConfig
  let carpetaPdfJs: string

  return {
    name: 'free-pdf-recursos-pdfjs',

    configResolved(resuelta) {
      configuracion = resuelta
      carpetaPdfJs = localizarPdfJs(resuelta.root)
    },

    configureServer(servidor) {
      const prefijos = [
        `${configuracion.base}${CARPETA_RECURSOS_PDFJS}/`,
        `/${CARPETA_RECURSOS_PDFJS}/`,
      ]

      servidor.middlewares.use((peticion, respuesta, siguiente) => {
        const direccion = peticion.url ?? ''
        const prefijo = prefijos.find((candidato) =>
          direccion.startsWith(candidato),
        )

        if (prefijo === undefined) {
          siguiente()
          return
        }

        const relativa = decodeURIComponent(
          direccion.slice(prefijo.length).split('?')[0],
        )
        const ruta = path.resolve(carpetaPdfJs, relativa)

        if (!estaDentro(carpetaPdfJs, ruta)) {
          respuesta.statusCode = 403
          respuesta.end('Ruta no permitida.')
          return
        }

        const tipo = TIPOS_CONTENIDO[path.extname(ruta).toLowerCase()]
        if (tipo !== undefined) {
          respuesta.setHeader('Content-Type', tipo)
        }

        createReadStream(ruta)
          .on('error', () => {
            respuesta.statusCode = 404
            respuesta.end('Recurso de PDF.js no encontrado.')
          })
          .pipe(respuesta)
      })
    },

    async writeBundle() {
      const destinoBase = path.resolve(
        configuracion.root,
        configuracion.build.outDir,
        CARPETA_RECURSOS_PDFJS,
      )

      for (const recurso of RECURSOS) {
        const origen = path.join(carpetaPdfJs, recurso.carpeta)
        const destino = path.join(destinoBase, recurso.carpeta)

        await cp(origen, destino, {
          recursive: true,
          filter: (ruta) => {
            const nombre = path.basename(ruta)

            return recurso.excluir?.test(nombre) !== true
          },
        })

        const medida = await medirCarpeta(destino, undefined)
        configuracion.logger.info(
          `Recursos de PDF.js: ${recurso.carpeta} (${medida.archivos} archivos, ${formatearTamano(
            medida.bytes,
          )})`,
        )
      }
    },
  }
}

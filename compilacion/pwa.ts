import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

const PREFIJO_CACHE = 'free-pdf-'
const NOMBRE_SERVICE_WORKER = 'service-worker.js'

/** Enumera recursivamente los archivos de una carpeta con rutas públicas `/`. */
async function listarArchivos(
  carpeta: string,
  relativa = '',
): Promise<readonly string[]> {
  const entradas = await readdir(path.join(carpeta, relativa), {
    withFileTypes: true,
  })
  const resultados = await Promise.all(
    entradas.map(async (entrada): Promise<readonly string[]> => {
      const ruta = path.posix.join(relativa, entrada.name)

      if (entrada.isDirectory()) {
        return listarArchivos(carpeta, ruta)
      }

      if (
        !entrada.isFile() ||
        entrada.name === NOMBRE_SERVICE_WORKER ||
        entrada.name.endsWith('.map')
      ) {
        return []
      }

      return [ruta]
    }),
  )

  return resultados.flat().sort()
}

/** Crea una versión corta que cambia si cambia cualquier recurso compilado. */
async function crearVersion(
  carpeta: string,
  recursos: readonly string[],
): Promise<string> {
  const resumen = createHash('sha256')

  for (const recurso of recursos) {
    resumen.update(recurso)
    resumen.update(await readFile(path.join(carpeta, recurso)))
  }

  return resumen.digest('hex').slice(0, 16)
}

/**
 * Genera el service worker autónomo.
 *
 * Las rutas son relativas a `self.registration.scope`, por lo que el mismo
 * código funciona bajo `/free-pdf/` en GitHub Pages y bajo cualquier otra base
 * si el proyecto se publica en otro lugar.
 */
export function crearCodigoServiceWorker(
  recursos: readonly string[],
  version: string,
): string {
  return `/* Generado durante la compilación. No editar directamente. */
const PREFIJO_CACHE = ${JSON.stringify(PREFIJO_CACHE)};
const NOMBRE_CACHE = PREFIJO_CACHE + ${JSON.stringify(version)};
const RECURSOS = ${JSON.stringify(recursos)};
const INICIO = new URL('index.html', self.registration.scope).href;

const direccionesPrecarga = RECURSOS.map(
  (ruta) => new URL(ruta, self.registration.scope).href,
);

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(direccionesPrecarga)),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter(
              (nombre) =>
                nombre.startsWith(PREFIJO_CACHE) && nombre !== NOMBRE_CACHE,
            )
            .map((nombre) => caches.delete(nombre)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function responder(solicitud) {
  const cache = await caches.open(NOMBRE_CACHE);
  const guardada = await cache.match(solicitud, { ignoreSearch: true });

  if (guardada !== undefined) {
    return guardada;
  }

  if (solicitud.mode === 'navigate') {
    const inicio = await cache.match(INICIO);
    if (inicio !== undefined) return inicio;
  }

  return fetch(solicitud);
}

self.addEventListener('fetch', (evento) => {
  const solicitud = evento.request;
  const direccion = new URL(solicitud.url);

  if (
    solicitud.method !== 'GET' ||
    direccion.origin !== self.location.origin ||
    !direccion.href.startsWith(self.registration.scope)
  ) {
    return;
  }

  evento.respondWith(responder(solicitud));
});
`
}

/**
 * Genera el precaché una vez que el resto de complementos ya copió PDF.js,
 * qpdf y OCR al resultado final.
 */
export function aplicacionPwa(): Plugin {
  let configuracion: ResolvedConfig

  return {
    name: 'free-pdf-pwa',
    apply: 'build',

    configResolved(resuelta) {
      configuracion = resuelta
    },

    async writeBundle() {
      const destino = path.resolve(
        configuracion.root,
        configuracion.build.outDir,
      )
      const recursos = await listarArchivos(destino)
      const huellaRecursos = await crearVersion(destino, recursos)
      const version = createHash('sha256')
        .update(huellaRecursos)
        .update(crearCodigoServiceWorker(recursos, 'version-provisional'))
        .digest('hex')
        .slice(0, 16)
      const codigo = crearCodigoServiceWorker(recursos, version)

      await writeFile(path.join(destino, NOMBRE_SERVICE_WORKER), codigo, 'utf8')

      let bytes = 0
      for (const recurso of recursos) {
        bytes += (await stat(path.join(destino, recurso))).size
      }

      configuracion.logger.info(
        `PWA: ${recursos.length} recursos preparados para uso sin conexión (${(
          bytes /
          1024 /
          1024
        ).toFixed(2)} MB)`,
      )
    },
  }
}

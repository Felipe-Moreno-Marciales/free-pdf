import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { aplicacionPwa } from './compilacion/pwa.ts'
import { recursosOcr } from './compilacion/recursosOcr.ts'
import { recursosPdfJs } from './compilacion/recursosPdfJs.ts'

const MODULO_NODE_NO_DISPONIBLE = fileURLToPath(
  new URL('./compilacion/moduloNodeNoDisponible.ts', import.meta.url),
)

export default defineConfig({
  // El complemento propio publica los recursos auxiliares de PDF.js —tablas de
  // caracteres, tipografías estándar, módulos WebAssembly y perfiles de color—
  // desde el mismo origen, en lugar de recurrir a una CDN.
  plugins: [react(), recursosPdfJs(), recursosOcr(), aplicacionPwa()],
  // El pegamento universal de qpdf conserva ramas exclusivas de Node detrás
  // de una comprobación de entorno. En el navegador nunca se ejecutan: los
  // alias evitan incorporar polirellenos y eliminan avisos falsos del bundler.
  resolve: {
    alias: [
      {
        find: /^(?:fs|path|crypto)$/,
        replacement: MODULO_NODE_NO_DISPONIBLE,
      },
    ],
  },
  // Ruta pública del sitio en GitHub Pages: https://<usuario>.github.io/free-pdf/
  base: '/free-pdf/',
})

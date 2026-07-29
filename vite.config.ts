import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { aplicacionPwa } from './compilacion/pwa.ts'
import { recursosOcr } from './compilacion/recursosOcr.ts'
import { recursosPdfJs } from './compilacion/recursosPdfJs.ts'

export default defineConfig({
  // El complemento propio publica los recursos auxiliares de PDF.js —tablas de
  // caracteres, tipografías estándar, módulos WebAssembly y perfiles de color—
  // desde el mismo origen, en lugar de recurrir a una CDN.
  plugins: [react(), recursosPdfJs(), recursosOcr(), aplicacionPwa()],
  // Ruta pública del sitio en GitHub Pages: https://<usuario>.github.io/free-pdf/
  base: '/free-pdf/',
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { recursosPdfJs } from './compilacion/recursosPdfJs.ts'

export default defineConfig({
  // El complemento propio publica los recursos auxiliares de PDF.js —tablas de
  // caracteres, tipografías estándar, módulos WebAssembly y perfiles de color—
  // desde el mismo origen, en lugar de recurrir a una CDN.
  plugins: [react(), recursosPdfJs()],
  // Ruta pública del sitio en GitHub Pages: https://<usuario>.github.io/free-pdf/
  base: '/free-pdf/',
})

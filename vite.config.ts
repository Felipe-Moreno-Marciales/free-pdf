import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Ruta pública del sitio en GitHub Pages: https://<usuario>.github.io/free-pdf/
  base: '/free-pdf/',
})

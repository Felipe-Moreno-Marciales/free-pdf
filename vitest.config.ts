import { defineConfig } from 'vitest/config'

/**
 * Configuración de las pruebas.
 *
 * Se usan dos proyectos con entornos distintos:
 *
 * - `logica` cubre la lógica pura y el procesamiento con pdf-lib, que no
 *   necesitan navegador y se ejecutan en Node. Sus archivos llevan la extensión
 *   `.prueba.ts`.
 * - `interfaz` cubre los componentes de React, que sí necesitan un documento, y
 *   se ejecuta en `jsdom`. Sus archivos llevan la extensión `.prueba.tsx`.
 *
 * Separarlos por extensión evita cargar `jsdom` en las pruebas que no lo
 * necesitan, que son la mayoría y las más rápidas.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'logica',
          environment: 'node',
          include: ['src/pruebas/**/*.prueba.ts'],
          globals: false,
        },
      },
      {
        test: {
          name: 'interfaz',
          environment: 'jsdom',
          include: ['src/pruebas/**/*.prueba.tsx'],
          globals: false,
          setupFiles: ['src/pruebas/ayudas/preparacionInterfaz.ts'],
        },
      },
    ],
  },
})

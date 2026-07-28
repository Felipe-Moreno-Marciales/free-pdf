import { defineConfig } from 'vitest/config'

/**
 * Configuración de las pruebas.
 *
 * Las pruebas cubren la lógica pura y el procesamiento con pdf-lib, que no
 * necesitan navegador, así que se ejecutan en Node. Los archivos siguen la
 * convención del proyecto y llevan la extensión `.prueba.ts`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/pruebas/**/*.prueba.ts'],
    globals: false,
  },
})

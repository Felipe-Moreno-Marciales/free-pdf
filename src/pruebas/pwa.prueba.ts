import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { crearCodigoServiceWorker } from '../../compilacion/pwa.ts'

interface IconoManifiesto {
  readonly src: string
  readonly sizes: string
  readonly type: string
  readonly purpose: string
}

interface ManifiestoPwa {
  readonly name: string
  readonly short_name: string
  readonly start_url: string
  readonly scope: string
  readonly display: string
  readonly background_color: string
  readonly theme_color: string
  readonly prefer_related_applications: boolean
  readonly icons: readonly IconoManifiesto[]
}

async function leerManifiesto(): Promise<ManifiestoPwa> {
  const contenido = await readFile(
    path.resolve(process.cwd(), 'public/manifest.webmanifest'),
    'utf8',
  )

  return JSON.parse(contenido) as ManifiestoPwa
}

function dimensionesPng(contenido: Uint8Array): {
  readonly ancho: number
  readonly alto: number
} {
  const vista = new DataView(
    contenido.buffer,
    contenido.byteOffset,
    contenido.byteLength,
  )

  return {
    ancho: vista.getUint32(16),
    alto: vista.getUint32(20),
  }
}

describe('aplicación web progresiva', () => {
  it('declara los datos necesarios para una instalación autónoma', async () => {
    const manifiesto = await leerManifiesto()

    expect(manifiesto.name).toContain('Free PDF')
    expect(manifiesto.short_name).toBe('Free PDF')
    expect(manifiesto.start_url).toBe('./')
    expect(manifiesto.scope).toBe('./')
    expect(manifiesto.display).toBe('standalone')
    expect(manifiesto.background_color).toBe('#0c1b2e')
    expect(manifiesto.theme_color).toBe('#2196f3')
    expect(manifiesto.prefer_related_applications).toBe(false)
    expect(manifiesto.icons.some((icono) => icono.sizes === '192x192')).toBe(
      true,
    )
    expect(manifiesto.icons.some((icono) => icono.sizes === '512x512')).toBe(
      true,
    )
    expect(manifiesto.icons.some((icono) => icono.purpose === 'maskable')).toBe(
      true,
    )
  })

  it('incluye iconos PNG reales con las medidas declaradas', async () => {
    for (const tamano of [192, 512]) {
      const icono = await readFile(
        path.resolve(process.cwd(), `public/icono-${tamano}.png`),
      )

      expect([...icono.subarray(0, 8)]).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
      ])
      expect(dimensionesPng(icono)).toEqual({
        ancho: tamano,
        alto: tamano,
      })
    }
  })

  it('genera un precaché versionado y conserva actualizaciones seguras', () => {
    const codigo = crearCodigoServiceWorker(
      [
        'index.html',
        'assets/aplicacion.js',
        'assets/qpdf.wasm',
        'ocr/idiomas/spa.traineddata.gz',
        'pdfjs/cmaps/UniJIS-UTF8-H.bcmap',
      ],
      'version-prueba',
    )

    expect(codigo).toContain('free-pdf-')
    expect(codigo).toContain('version-prueba')
    expect(codigo).toContain('cache.addAll')
    expect(codigo).toContain('ocr/idiomas/spa.traineddata.gz')
    expect(codigo).toContain('pdfjs/cmaps/UniJIS-UTF8-H.bcmap')
    expect(codigo).toContain('caches.delete')
    expect(codigo).toContain("solicitud.method !== 'GET'")
    expect(codigo).not.toContain('skipWaiting')
  })
})

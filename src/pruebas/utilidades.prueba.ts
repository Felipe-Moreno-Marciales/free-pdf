import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { crearBlobZip } from '../utilidades/descargarZip'
import { formatearTamanoArchivo } from '../utilidades/formatearTamano'
import {
  construirNombreDerivado,
  normalizarNombreBase,
  numerarConCeros,
  quitarExtensionPdf,
} from '../utilidades/nombresArchivo'
import { obtenerMensajeError } from '../utilidades/errores'
import { bytesDeBlob } from './ayudas/crearPdfPrueba'

describe('formatearTamanoArchivo', () => {
  it('muestra los bytes sin decimales', () => {
    expect(formatearTamanoArchivo(512)).toBe('512 B')
  })

  it('usa la coma como separador decimal', () => {
    expect(formatearTamanoArchivo(2048)).toBe('2,0 kB')
  })

  it('escala hasta megabytes', () => {
    expect(formatearTamanoArchivo(1572864)).toBe('1,5 MB')
  })

  it('devuelve 0 B ante valores no válidos', () => {
    expect(formatearTamanoArchivo(0)).toBe('0 B')
    expect(formatearTamanoArchivo(-5)).toBe('0 B')
    expect(formatearTamanoArchivo(Number.NaN)).toBe('0 B')
  })
})

describe('nombresArchivo', () => {
  it('quita la extensión .pdf sin distinguir mayúsculas', () => {
    expect(quitarExtensionPdf('informe.pdf')).toBe('informe')
    expect(quitarExtensionPdf('informe.PDF')).toBe('informe')
    expect(quitarExtensionPdf('informe')).toBe('informe')
  })

  it('normaliza los caracteres problemáticos', () => {
    expect(normalizarNombreBase('mi informe: final/v2.pdf')).toBe(
      'mi-informe-final-v2',
    )
  })

  it('recurre a un nombre de reserva si no queda nada utilizable', () => {
    expect(normalizarNombreBase('///.pdf')).toBe('documento')
  })

  it('construye el nombre derivado con el sufijo', () => {
    expect(construirNombreDerivado('informe.pdf', 'paginas-1-3')).toBe(
      'informe-paginas-1-3.pdf',
    )
  })

  it('rellena con ceros según el ancho del total', () => {
    expect(numerarConCeros(3, 9)).toBe('3')
    expect(numerarConCeros(3, 10)).toBe('03')
    expect(numerarConCeros(3, 100)).toBe('003')
  })
})

describe('obtenerMensajeError', () => {
  it('usa el mensaje de un Error', () => {
    expect(obtenerMensajeError(new Error('Algo falló'), 'reserva')).toBe(
      'Algo falló',
    )
  })

  it('acepta una cadena lanzada directamente', () => {
    expect(obtenerMensajeError('texto suelto', 'reserva')).toBe('texto suelto')
  })

  it('recurre al texto de reserva con valores inesperados', () => {
    expect(obtenerMensajeError(null, 'reserva')).toBe('reserva')
    expect(obtenerMensajeError(undefined, 'reserva')).toBe('reserva')
    expect(obtenerMensajeError(42, 'reserva')).toBe('reserva')
    expect(obtenerMensajeError(new Error('   '), 'reserva')).toBe('reserva')
  })
})

describe('crearBlobZip', () => {
  it('empaqueta los archivos con su contenido', async () => {
    const blob = crearBlobZip([
      { nombreArchivo: 'a.pdf', contenido: new Uint8Array([1, 2, 3]) },
      { nombreArchivo: 'b.pdf', contenido: new Uint8Array([4, 5]) },
    ])

    expect(blob.type).toBe('application/zip')

    const contenido = unzipSync(await bytesDeBlob(blob))
    expect(Object.keys(contenido).sort()).toEqual(['a.pdf', 'b.pdf'])
    expect([...contenido['a.pdf']]).toEqual([1, 2, 3])
  })

  it('evita que dos archivos con el mismo nombre se sobrescriban', async () => {
    const blob = crearBlobZip([
      { nombreArchivo: 'a.pdf', contenido: new Uint8Array([1]) },
      { nombreArchivo: 'a.pdf', contenido: new Uint8Array([2]) },
      { nombreArchivo: 'a.pdf', contenido: new Uint8Array([3]) },
    ])

    const contenido = unzipSync(await bytesDeBlob(blob))
    expect(Object.keys(contenido).sort()).toEqual(['a-2.pdf', 'a-3.pdf', 'a.pdf'])
  })
})

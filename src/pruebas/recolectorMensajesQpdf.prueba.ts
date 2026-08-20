import { describe, expect, it } from 'vitest'
import {
  crearColaOperacionesQpdf,
  crearRecolectorMensajesQpdf,
  LIMITES_MENSAJES_QPDF,
} from '../seguridad/qpdf/recolectorMensajesQpdf'

describe('recolector acotado de mensajes de qpdf', () => {
  it('conserva el inicio y el final y resume los mensajes intermedios', () => {
    const recolector = crearRecolectorMensajesQpdf()
    const total =
      LIMITES_MENSAJES_QPDF.iniciales + LIMITES_MENSAJES_QPDF.finales + 10
    recolector.reiniciar([])

    for (let indice = 0; indice < total; indice += 1) {
      recolector.recoger(`mensaje ${indice}`)
    }

    const mensajes = recolector.vaciar()
    expect(mensajes).toHaveLength(
      LIMITES_MENSAJES_QPDF.iniciales +
        LIMITES_MENSAJES_QPDF.finales +
        1,
    )
    expect(mensajes[0]).toBe('mensaje 0')
    expect(mensajes[LIMITES_MENSAJES_QPDF.iniciales - 1]).toBe(
      `mensaje ${LIMITES_MENSAJES_QPDF.iniciales - 1}`,
    )
    expect(mensajes[LIMITES_MENSAJES_QPDF.iniciales]).toBe(
      'Se omitieron 10 mensajes repetitivos de qpdf.',
    )
    expect(mensajes.at(-1)).toBe(`mensaje ${total - 1}`)
  })

  it('depura secretos antes de almacenar y acota cada mensaje', () => {
    const recolector = crearRecolectorMensajesQpdf()
    const secreto = 'clave-confidencial'
    recolector.reiniciar([secreto])
    recolector.recoger(
      `${secreto} ${'x'.repeat(LIMITES_MENSAJES_QPDF.longitud * 2)}`,
    )

    const mensaje = recolector.vaciar()[0]
    expect(mensaje).not.toContain(secreto)
    expect(mensaje).not.toContain('clave-confidencial')
    expect(mensaje?.length).toBe(LIMITES_MENSAJES_QPDF.longitud)
  })

  it('oculta completo el secreto más largo cuando varios empiezan igual', () => {
    const recolector = crearRecolectorMensajesQpdf()
    const secretos = ['clave', 'clave-larga']
    recolector.reiniciar(secretos)
    recolector.recoger('WARNING clave-larga')

    const mensaje = recolector.vaciar()[0] ?? ''
    for (const secreto of secretos) {
      expect(mensaje).not.toContain(secreto)
    }
    expect(mensaje).not.toContain('-larga')
  })

  it('usa un marcador ajeno a contraseñas con palabras y símbolos', () => {
    const recolector = crearRecolectorMensajesQpdf()
    const secretos = [
      'contraseña',
      'oculta',
      '█',
      '■',
      '◆',
      '●',
      '※',
      '¤',
      '§',
    ]
    recolector.reiniciar(secretos)
    recolector.recoger(secretos.join(' '))

    const mensaje = recolector.vaciar()[0] ?? ''
    for (const secreto of secretos) {
      expect(mensaje).not.toContain(secreto)
    }
  })

  it('oculta secretos repartidos entre argumentos y en el resumen', () => {
    const recolector = crearRecolectorMensajesQpdf()
    const secretos = ['clave con espacios', 'qpdf']
    const total =
      LIMITES_MENSAJES_QPDF.iniciales + LIMITES_MENSAJES_QPDF.finales + 1
    recolector.reiniciar(secretos)
    recolector.recoger('clave', 'con', 'espacios')

    for (let indice = 1; indice < total; indice += 1) {
      recolector.recoger(`mensaje ${indice}`)
    }

    for (const mensaje of recolector.vaciar()) {
      for (const secreto of secretos) {
        expect(mensaje).not.toContain(secreto)
      }
    }
  })

  it('queda vacío después de entregar una operación', () => {
    const recolector = crearRecolectorMensajesQpdf()
    recolector.reiniciar([])
    recolector.recoger('primera operación')

    expect(recolector.vaciar()).toEqual(['primera operación'])
    expect(recolector.vaciar()).toEqual([])
  })
})

describe('cola de operaciones de qpdf', () => {
  it('ejecuta en orden sin solapar operaciones asíncronas', async () => {
    const cola = crearColaOperacionesQpdf()
    const eventos: string[] = []
    let liberarPrimera: (() => void) | undefined

    const primera = cola.encolar(async () => {
      eventos.push('primera-inicio')
      await new Promise<void>((resolver) => {
        liberarPrimera = resolver
      })
      eventos.push('primera-fin')
    })
    const segunda = cola.encolar(async () => {
      eventos.push('segunda')
    })

    await Promise.resolve()
    expect(eventos).toEqual(['primera-inicio'])

    liberarPrimera?.()
    await Promise.all([primera, segunda])
    expect(eventos).toEqual(['primera-inicio', 'primera-fin', 'segunda'])
  })

  it('continúa después de una operación fallida', async () => {
    const cola = crearColaOperacionesQpdf()
    const fallo = cola.encolar(async () => {
      throw new Error('fallo controlado')
    })
    const siguiente = cola.encolar(async () => undefined)

    await expect(fallo).rejects.toThrow('fallo controlado')
    await expect(siguiente).resolves.toBeUndefined()
  })
})

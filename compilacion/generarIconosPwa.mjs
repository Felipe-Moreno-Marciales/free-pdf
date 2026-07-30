import { createCanvas } from '@napi-rs/canvas'
import { writeFile } from 'node:fs/promises'

const AZUL = '#2196f3'
const AZUL_CLARO = '#bbdefb'
const BLANCO = '#ffffff'
const DESTINO = new URL('../public/', import.meta.url)
const TAMANOS = [180, 192, 512]

function rectanguloRedondeado(contexto, x, y, ancho, alto, radio) {
  contexto.beginPath()
  contexto.moveTo(x + radio, y)
  contexto.lineTo(x + ancho - radio, y)
  contexto.quadraticCurveTo(x + ancho, y, x + ancho, y + radio)
  contexto.lineTo(x + ancho, y + alto - radio)
  contexto.quadraticCurveTo(
    x + ancho,
    y + alto,
    x + ancho - radio,
    y + alto,
  )
  contexto.lineTo(x + radio, y + alto)
  contexto.quadraticCurveTo(x, y + alto, x, y + alto - radio)
  contexto.lineTo(x, y + radio)
  contexto.quadraticCurveTo(x, y, x + radio, y)
  contexto.closePath()
}

function crearIcono(tamano) {
  const lienzo = createCanvas(tamano, tamano)
  const contexto = lienzo.getContext('2d')
  const escala = tamano / 32

  contexto.fillStyle = AZUL
  contexto.fillRect(0, 0, tamano, tamano)
  contexto.scale(escala, escala)
  contexto.lineWidth = 2.2
  contexto.lineJoin = 'round'

  contexto.strokeStyle = AZUL_CLARO
  rectanguloRedondeado(contexto, 8, 6.5, 10.8, 14, 2.6)
  contexto.stroke()

  contexto.fillStyle = AZUL
  contexto.strokeStyle = BLANCO
  rectanguloRedondeado(contexto, 13.2, 11.5, 10.8, 14, 2.6)
  contexto.fill()
  contexto.stroke()

  return lienzo.encode('png')
}

for (const tamano of TAMANOS) {
  await writeFile(
    new URL(`icono-${tamano}.png`, DESTINO),
    await crearIcono(tamano),
  )
}

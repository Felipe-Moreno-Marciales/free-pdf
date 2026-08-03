import { useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { describirDimensiones } from '../imagenes/orientacionImagen'
import type {
  DesplazamientoImagen,
  ImagenSeleccionada,
} from '../imagenes/tipos'
import { describirFormato } from '../imagenes/validarImagen'
import { describirRotacion } from '../pdf/rotaciones'
import type { SentidoGiro } from '../pdf/tipos'
import { formatearTamanoArchivo } from '../utilidades/formatearTamano'
import {
  IconoAlFinal,
  IconoAlInicio,
  IconoFlechaDerecha,
  IconoFlechaIzquierda,
  IconoPapelera,
  IconoRotarDerecha,
  IconoRotarIzquierda,
} from './Iconos'
import { MiniaturaImagen } from './MiniaturaImagen'

interface PropiedadesListaImagenes {
  /** Imágenes elegidas, en el orden en el que se usarán. */
  readonly imagenes: readonly ImagenSeleccionada[]
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Mueve una imagen dentro de la lista. */
  readonly alMover: (id: string, desplazamiento: DesplazamientoImagen) => void
  /** Mueve una imagen de una posición a otra, para el arrastre. */
  readonly alReordenar: (
    posicionOrigen: number,
    posicionDestino: number,
  ) => void
  /** Gira una imagen un cuarto de vuelta. */
  readonly alGirar: (id: string, sentido: SentidoGiro) => void
  /** Quita una imagen de la lista. */
  readonly alEliminar: (id: string) => void
  /** Controles adicionales que se muestran en cada tarjeta. */
  readonly renderizarExtra?: (imagen: ImagenSeleccionada) => ReactNode
}

/**
 * Lista ordenada de las imágenes seleccionadas.
 *
 * Se usa `<ol>` porque el orden es significativo: determina la secuencia de
 * páginas del documento final. Cada tarjeta ofrece los mismos movimientos que el
 * arrastre —anterior, siguiente, al inicio y al final—, así que la lista se puede
 * reordenar por completo con el teclado y en una pantalla táctil, donde el
 * arrastre nativo de HTML no está disponible.
 */
export function ListaImagenes({
  imagenes,
  deshabilitado,
  alMover,
  alReordenar,
  alGirar,
  alEliminar,
  renderizarExtra,
}: PropiedadesListaImagenes) {
  const [posicionArrastrada, establecerPosicionArrastrada] = useState<
    number | null
  >(null)
  const [posicionDestino, establecerPosicionDestino] = useState<number | null>(
    null,
  )

  const sePuedeArrastrar = !deshabilitado

  const iniciarArrastre = (
    evento: DragEvent<HTMLLIElement>,
    posicion: number,
  ): void => {
    if (!sePuedeArrastrar) {
      return
    }

    evento.dataTransfer.effectAllowed = 'move'
    // Firefox exige que se escriba algún dato para permitir el arrastre.
    evento.dataTransfer.setData('text/plain', String(posicion))
    establecerPosicionArrastrada(posicion)
  }

  const arrastrarEncima = (
    evento: DragEvent<HTMLLIElement>,
    posicion: number,
  ): void => {
    if (!sePuedeArrastrar || posicionArrastrada === null) {
      return
    }

    evento.preventDefault()
    evento.dataTransfer.dropEffect = 'move'
    establecerPosicionDestino(posicion)
  }

  const soltar = (evento: DragEvent<HTMLLIElement>, posicion: number): void => {
    if (!sePuedeArrastrar) {
      return
    }

    evento.preventDefault()

    if (posicionArrastrada !== null && posicionArrastrada !== posicion) {
      alReordenar(posicionArrastrada, posicion)
    }

    establecerPosicionArrastrada(null)
    establecerPosicionDestino(null)
  }

  const terminarArrastre = (): void => {
    establecerPosicionArrastrada(null)
    establecerPosicionDestino(null)
  }

  return (
    <ol className="lista-imagenes">
      {imagenes.map((imagen, posicion) => {
        const esPrimera = posicion === 0
        const esUltima = posicion === imagenes.length - 1

        return (
          <li
            className="lista-imagenes__elemento"
            key={imagen.id}
            data-arrastrando={posicionArrastrada === posicion}
            data-destino={posicionDestino === posicion}
            draggable={sePuedeArrastrar}
            onDragStart={(evento) => iniciarArrastre(evento, posicion)}
            onDragOver={(evento) => arrastrarEncima(evento, posicion)}
            onDrop={(evento) => soltar(evento, posicion)}
            onDragEnd={terminarArrastre}
          >
            <MiniaturaImagen
              contenido={imagen.archivo}
              nombre={imagen.nombre}
              rotacion={imagen.rotacion}
              descripcion={`Página ${posicion + 1} de ${imagenes.length}: «${
                imagen.nombre
              }», ${describirFormato(imagen.formato)}, ${describirDimensiones(
                imagen.dimensiones,
              )}, ${describirRotacion(imagen.rotacion)}.`}
            />

            <div className="lista-imagenes__datos">
              <p className="lista-imagenes__posicion">Página {posicion + 1}</p>
              <p className="lista-imagenes__nombre" title={imagen.nombre}>
                {imagen.nombre}
              </p>
              <p className="lista-imagenes__detalle">
                {describirFormato(imagen.formato)} ·{' '}
                {describirDimensiones(imagen.dimensiones)} ·{' '}
                {formatearTamanoArchivo(imagen.tamano)}
              </p>
              {imagen.rotacion !== 0 && (
                <p className="lista-imagenes__detalle">
                  Girada {imagen.rotacion}°
                </p>
              )}
            </div>

            {renderizarExtra !== undefined && (
              <div className="lista-imagenes__extra">
                {renderizarExtra(imagen)}
              </div>
            )}

            <div
              className="lista-imagenes__acciones"
              role="group"
              aria-label={`Acciones de «${imagen.nombre}»`}
            >
              <button
                className="boton-icono"
                type="button"
                disabled={deshabilitado || esPrimera}
                onClick={() => alMover(imagen.id, 'inicio')}
                aria-label={`Llevar «${imagen.nombre}» al principio`}
              >
                <IconoAlInicio className="boton-icono__icono" />
              </button>

              <button
                className="boton-icono"
                type="button"
                disabled={deshabilitado || esPrimera}
                onClick={() => alMover(imagen.id, 'anterior')}
                aria-label={`Mover «${imagen.nombre}» una posición hacia atrás`}
              >
                <IconoFlechaIzquierda className="boton-icono__icono" />
              </button>

              <button
                className="boton-icono"
                type="button"
                disabled={deshabilitado || esUltima}
                onClick={() => alMover(imagen.id, 'siguiente')}
                aria-label={`Mover «${imagen.nombre}» una posición hacia delante`}
              >
                <IconoFlechaDerecha className="boton-icono__icono" />
              </button>

              <button
                className="boton-icono"
                type="button"
                disabled={deshabilitado || esUltima}
                onClick={() => alMover(imagen.id, 'final')}
                aria-label={`Llevar «${imagen.nombre}» al final`}
              >
                <IconoAlFinal className="boton-icono__icono" />
              </button>

              <button
                className="boton-icono"
                type="button"
                disabled={deshabilitado}
                onClick={() => alGirar(imagen.id, 'izquierda')}
                aria-label={`Girar «${imagen.nombre}» 90 grados a la izquierda`}
              >
                <IconoRotarIzquierda className="boton-icono__icono" />
              </button>

              <button
                className="boton-icono"
                type="button"
                disabled={deshabilitado}
                onClick={() => alGirar(imagen.id, 'derecha')}
                aria-label={`Girar «${imagen.nombre}» 90 grados a la derecha`}
              >
                <IconoRotarDerecha className="boton-icono__icono" />
              </button>

              <button
                className="boton-icono boton-icono--peligro"
                type="button"
                disabled={deshabilitado}
                onClick={() => alEliminar(imagen.id)}
                aria-label={`Quitar «${imagen.nombre}» de la lista`}
              >
                <IconoPapelera className="boton-icono__icono" />
              </button>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

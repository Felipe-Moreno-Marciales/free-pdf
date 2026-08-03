import { useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { crearIdentificadorPagina } from '../pdf/crearIdentificadorPagina'
import { describirRotacion } from '../pdf/rotaciones'
import type { PaginaCuadricula } from '../pdf/tipos'
import { MiniaturaPaginaPdf } from './MiniaturaPaginaPdf'

interface PropiedadesCuadriculaPaginasPdf {
  /** Documento abierto con PDF.js. */
  readonly documento: PDFDocumentProxy
  /** Identificador del documento, para las claves de React. */
  readonly idDocumento: string
  /** Páginas en el orden en que deben mostrarse. */
  readonly paginas: readonly PaginaCuadricula[]
  /** Bloquea toda interacción mientras hay un proceso en curso. */
  readonly deshabilitada: boolean
  /** Si se facilita, cada miniatura funciona como casilla de selección. */
  readonly alAlternarPagina: ((indiceOriginal: number) => void) | null
  /** Si se facilita, las miniaturas se pueden reordenar arrastrándolas. */
  readonly alReordenar:
    | ((posicionOrigen: number, posicionDestino: number) => void)
    | null
  /** Controles adicionales que se muestran debajo de cada miniatura. */
  readonly renderizarAcciones:
    | ((pagina: PaginaCuadricula, posicion: number) => ReactNode)
    | null
  /** Explica qué implica marcar una página, por ejemplo «se extraerá». */
  readonly textoSeleccion: string
  /** Muestra la posición actual además del número original de la página. */
  readonly mostrarPosicion: boolean
}

/**
 * Cuadrícula de miniaturas compartida por las herramientas de páginas.
 *
 * Según las propiedades que reciba, cada miniatura puede funcionar como casilla
 * de selección, mostrar controles propios y permitir el reordenado arrastrando.
 * El arrastre es siempre un añadido: las herramientas que lo usan ofrecen
 * además botones equivalentes, así que la cuadrícula se puede manejar por
 * completo con el teclado.
 */
export function CuadriculaPaginasPdf({
  documento,
  idDocumento,
  paginas,
  deshabilitada,
  alAlternarPagina,
  alReordenar,
  renderizarAcciones,
  textoSeleccion,
  mostrarPosicion,
}: PropiedadesCuadriculaPaginasPdf) {
  const [posicionArrastrada, establecerPosicionArrastrada] = useState<
    number | null
  >(null)
  const [posicionDestino, establecerPosicionDestino] = useState<number | null>(
    null,
  )

  const sePuedeArrastrar = alReordenar !== null && !deshabilitada

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
    if (!sePuedeArrastrar || alReordenar === null) {
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
    <ol className="cuadricula-paginas">
      {paginas.map((pagina, posicion) => {
        const numeroOriginal = pagina.indiceOriginal + 1
        const descripcion = construirDescripcion(
          numeroOriginal,
          paginas.length,
          posicion,
          pagina,
          textoSeleccion,
          mostrarPosicion,
        )

        return (
          <li
            className="cuadricula-paginas__elemento"
            key={crearIdentificadorPagina(idDocumento, pagina.indiceOriginal)}
            data-seleccionada={pagina.seleccionada}
            data-arrastrando={posicionArrastrada === posicion}
            data-destino={posicionDestino === posicion}
            draggable={sePuedeArrastrar}
            onDragStart={(evento) => iniciarArrastre(evento, posicion)}
            onDragOver={(evento) => arrastrarEncima(evento, posicion)}
            onDrop={(evento) => soltar(evento, posicion)}
            onDragEnd={terminarArrastre}
          >
            {alAlternarPagina === null ? (
              <div className="tarjeta-pagina">
                <MiniaturaPaginaPdf
                  documento={documento}
                  numeroPagina={numeroOriginal}
                  rotacion={pagina.rotacion}
                />
                <span className="tarjeta-pagina__etiqueta">
                  {construirEtiquetaVisible(
                    numeroOriginal,
                    posicion,
                    mostrarPosicion,
                  )}
                </span>
                <span className="solo-lector-pantalla">{descripcion}</span>
              </div>
            ) : (
              <button
                className="tarjeta-pagina tarjeta-pagina--pulsable"
                type="button"
                disabled={deshabilitada}
                aria-pressed={pagina.seleccionada}
                onClick={() => alAlternarPagina(pagina.indiceOriginal)}
              >
                <MiniaturaPaginaPdf
                  documento={documento}
                  numeroPagina={numeroOriginal}
                  rotacion={pagina.rotacion}
                />
                <span className="tarjeta-pagina__etiqueta">
                  {construirEtiquetaVisible(
                    numeroOriginal,
                    posicion,
                    mostrarPosicion,
                  )}
                </span>
                <span className="solo-lector-pantalla">{descripcion}</span>
              </button>
            )}

            {renderizarAcciones !== null && (
              <div className="tarjeta-pagina__acciones">
                {renderizarAcciones(pagina, posicion)}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Texto visible bajo la miniatura. */
function construirEtiquetaVisible(
  numeroOriginal: number,
  posicion: number,
  mostrarPosicion: boolean,
): string {
  return mostrarPosicion
    ? `${posicion + 1}. Página ${numeroOriginal}`
    : `Página ${numeroOriginal}`
}

/** Descripción completa que leen los lectores de pantalla. */
function construirDescripcion(
  numeroOriginal: number,
  total: number,
  posicion: number,
  pagina: PaginaCuadricula,
  textoSeleccion: string,
  mostrarPosicion: boolean,
): string {
  const partes = [`Página ${numeroOriginal} de ${total}`]

  if (mostrarPosicion) {
    partes.push(`posición actual ${posicion + 1}`)
  }

  partes.push(describirRotacion(pagina.rotacion))
  partes.push(pagina.seleccionada ? textoSeleccion : 'sin marcar')

  return `${partes.join(', ')}.`
}

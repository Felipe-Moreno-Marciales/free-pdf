import type {
  DireccionMovimiento,
  PdfSeleccionado,
} from '../funcionalidades/unir-pdf/tipos'
import { formatearTamanoArchivo } from '../utilidades/formatearTamano'
import {
  IconoArchivoPdf,
  IconoFlechaAbajo,
  IconoFlechaArriba,
  IconoPapelera,
} from './Iconos'

interface PropiedadesListaArchivosPdf {
  /** Archivos seleccionados, en el orden en que se unirán. */
  readonly archivos: readonly PdfSeleccionado[]
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Mueve un archivo una posición hacia arriba o hacia abajo. */
  readonly alMover: (id: string, direccion: DireccionMovimiento) => void
  /** Quita un archivo de la selección. */
  readonly alEliminar: (id: string) => void
}

/**
 * Lista ordenada de los archivos seleccionados.
 *
 * Se usa `<ol>` porque el orden es significativo: determina la secuencia de
 * páginas del documento final.
 */
export function ListaArchivosPdf({
  archivos,
  deshabilitado,
  alMover,
  alEliminar,
}: PropiedadesListaArchivosPdf) {
  return (
    <ol className="lista-archivos">
      {archivos.map((seleccionado, indice) => {
        const esPrimero = indice === 0
        const esUltimo = indice === archivos.length - 1

        return (
          <li className="lista-archivos__elemento" key={seleccionado.id}>
            <span className="lista-archivos__posicion">{indice + 1}</span>
            <IconoArchivoPdf className="lista-archivos__icono" />

            <span className="lista-archivos__detalles">
              <span className="lista-archivos__nombre">
                {seleccionado.nombre}
              </span>
              <span className="lista-archivos__tamano">
                {formatearTamanoArchivo(seleccionado.tamano)}
              </span>
            </span>

            <span className="lista-archivos__acciones">
              <button
                className="boton-icono"
                type="button"
                disabled={deshabilitado || esPrimero}
                onClick={() => alMover(seleccionado.id, 'arriba')}
                aria-label={`Mover «${seleccionado.nombre}» una posición hacia arriba`}
              >
                <IconoFlechaArriba className="boton-icono__icono" />
              </button>

              <button
                className="boton-icono"
                type="button"
                disabled={deshabilitado || esUltimo}
                onClick={() => alMover(seleccionado.id, 'abajo')}
                aria-label={`Mover «${seleccionado.nombre}» una posición hacia abajo`}
              >
                <IconoFlechaAbajo className="boton-icono__icono" />
              </button>

              <button
                className="boton-icono boton-icono--peligro"
                type="button"
                disabled={deshabilitado}
                onClick={() => alEliminar(seleccionado.id)}
                aria-label={`Quitar «${seleccionado.nombre}» de la lista`}
              >
                <IconoPapelera className="boton-icono__icono" />
              </button>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

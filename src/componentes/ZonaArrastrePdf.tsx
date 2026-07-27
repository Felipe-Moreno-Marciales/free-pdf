import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { ATRIBUTO_ACCEPT_PDF } from '../utilidades/validacionArchivos'
import { IconoSubir } from './Iconos'

interface PropiedadesZonaArrastrePdf {
  /** Se ejecuta con los archivos elegidos o soltados por la persona. */
  readonly alSeleccionarArchivos: (archivos: readonly File[]) => void
  /** Bloquea la zona mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
}

/**
 * Zona para elegir archivos PDF haciendo clic, con el teclado o arrastrando.
 *
 * El control real es un `input` de tipo `file` asociado a la etiqueta visible.
 * Así se conserva el comportamiento nativo del navegador: la etiqueta abre el
 * selector al hacer clic y el `input` es accesible con el teclado.
 */
export function ZonaArrastrePdf({
  alSeleccionarArchivos,
  deshabilitado,
}: PropiedadesZonaArrastrePdf) {
  const idCampo = useId()
  const idAyuda = useId()
  const [estaArrastrando, establecerEstaArrastrando] = useState(false)

  // Los eventos `dragenter` y `dragleave` se disparan también al pasar por los
  // elementos hijos, así que se cuenta la profundidad para evitar parpadeos.
  const profundidadArrastre = useRef(0)

  const gestionarCambio = (evento: ChangeEvent<HTMLInputElement>): void => {
    const elegidos = evento.target.files
    if (elegidos !== null && elegidos.length > 0) {
      alSeleccionarArchivos(Array.from(elegidos))
    }

    // Se limpia el valor para poder volver a elegir el mismo archivo más tarde.
    evento.target.value = ''
  }

  const gestionarEntradaArrastre = (evento: DragEvent<HTMLDivElement>): void => {
    evento.preventDefault()
    if (deshabilitado) {
      return
    }

    profundidadArrastre.current += 1
    establecerEstaArrastrando(true)
  }

  const gestionarArrastreEncima = (evento: DragEvent<HTMLDivElement>): void => {
    evento.preventDefault()
    if (!deshabilitado) {
      evento.dataTransfer.dropEffect = 'copy'
    }
  }

  const gestionarSalidaArrastre = (evento: DragEvent<HTMLDivElement>): void => {
    evento.preventDefault()
    profundidadArrastre.current = Math.max(0, profundidadArrastre.current - 1)

    if (profundidadArrastre.current === 0) {
      establecerEstaArrastrando(false)
    }
  }

  const gestionarSoltar = (evento: DragEvent<HTMLDivElement>): void => {
    evento.preventDefault()
    profundidadArrastre.current = 0
    establecerEstaArrastrando(false)

    if (deshabilitado) {
      return
    }

    const soltados = Array.from(evento.dataTransfer.files)
    if (soltados.length > 0) {
      alSeleccionarArchivos(soltados)
    }
  }

  return (
    <div
      className="zona-arrastre"
      data-arrastrando={estaArrastrando}
      data-deshabilitado={deshabilitado}
      onDragEnter={gestionarEntradaArrastre}
      onDragOver={gestionarArrastreEncima}
      onDragLeave={gestionarSalidaArrastre}
      onDrop={gestionarSoltar}
    >
      <input
        className="zona-arrastre__campo"
        id={idCampo}
        type="file"
        accept={ATRIBUTO_ACCEPT_PDF}
        multiple
        disabled={deshabilitado}
        onChange={gestionarCambio}
        aria-label="Seleccionar archivos PDF"
        aria-describedby={idAyuda}
      />

      <label className="zona-arrastre__etiqueta" htmlFor={idCampo}>
        <IconoSubir className="zona-arrastre__icono" />
        <span className="zona-arrastre__titulo">
          Arrastra tus archivos PDF o pulsa para seleccionarlos
        </span>
        <span className="zona-arrastre__ayuda" id={idAyuda}>
          Puedes elegir varios a la vez y añadir más después. Solo se aceptan
          archivos con extensión .pdf.
        </span>
      </label>
    </div>
  )
}

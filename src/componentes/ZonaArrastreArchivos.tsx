import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { IconoSubir } from './Iconos'

interface PropiedadesZonaArrastreArchivos {
  /** Se ejecuta con los archivos elegidos o soltados por la persona. */
  readonly alSeleccionarArchivos: (archivos: readonly File[]) => void
  /** Bloquea la zona mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Valor del atributo `accept` del selector de archivos. */
  readonly accept: string
  /** Permite elegir varios archivos a la vez. */
  readonly permitirVarios: boolean
  /** Texto principal de la zona. */
  readonly titulo: string
  /** Texto de ayuda que describe qué archivos se aceptan. */
  readonly ayuda: string
  /** Nombre accesible del selector de archivos. */
  readonly nombreAccesible: string
}

/**
 * Zona para elegir archivos haciendo clic, con el teclado o arrastrando.
 *
 * El control real es un `input` de tipo `file` asociado a la etiqueta visible.
 * Así se conserva el comportamiento nativo del navegador: la etiqueta abre el
 * selector al hacer clic y el `input` es accesible con el teclado, de modo que
 * arrastrar nunca es la única forma de aportar archivos.
 *
 * Es la base común de `ZonaArrastrePdf` y de `ZonaArrastreImagenes`, que solo
 * cambian los formatos admitidos y los textos.
 */
export function ZonaArrastreArchivos({
  alSeleccionarArchivos,
  deshabilitado,
  accept,
  permitirVarios,
  titulo,
  ayuda,
  nombreAccesible,
}: PropiedadesZonaArrastreArchivos) {
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
        accept={accept}
        multiple={permitirVarios}
        disabled={deshabilitado}
        onChange={gestionarCambio}
        aria-label={nombreAccesible}
        aria-describedby={idAyuda}
      />

      <label className="zona-arrastre__etiqueta" htmlFor={idCampo}>
        <IconoSubir className="zona-arrastre__icono" />
        <span className="zona-arrastre__titulo">{titulo}</span>
        <span className="zona-arrastre__ayuda" id={idAyuda}>
          {ayuda}
        </span>
      </label>
    </div>
  )
}

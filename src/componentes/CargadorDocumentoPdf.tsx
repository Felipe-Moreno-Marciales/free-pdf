import { useId } from 'react'
import type { DocumentoCargado } from '../ganchos/useDocumentoPdf'
import { formatearTamanoArchivo } from '../utilidades/formatearTamano'
import { ATRIBUTO_ACCEPT_PDF } from '../utilidades/validacionArchivos'
import { IconoArchivoPdf, IconoRestablecer } from './Iconos'
import { ZonaArrastrePdf } from './ZonaArrastrePdf'

interface PropiedadesCargadorDocumentoPdf {
  /** Documento actualmente cargado, o `null` si no hay ninguno. */
  readonly documento: DocumentoCargado | null
  /** Bloquea los controles mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Recibe los archivos elegidos o soltados. */
  readonly alSeleccionarArchivos: (archivos: readonly File[]) => void
  /** Cierra el documento actual y vuelve al estado inicial. */
  readonly alRestablecer: () => void
}

/**
 * Experiencia compartida para abrir un único documento PDF.
 *
 * Mientras no hay documento se muestra la zona de arrastre. En cuanto hay uno
 * abierto se muestran su nombre, su tamaño y su número de páginas, junto con
 * los botones para reemplazarlo o cerrarlo. El documento vive solo en memoria:
 * no se guarda en `localStorage`, `sessionStorage`, `IndexedDB` ni cookies.
 */
export function CargadorDocumentoPdf({
  documento,
  deshabilitado,
  alSeleccionarArchivos,
  alRestablecer,
}: PropiedadesCargadorDocumentoPdf) {
  const idCampo = useId()

  if (documento === null) {
    return (
      <ZonaArrastrePdf
        alSeleccionarArchivos={alSeleccionarArchivos}
        deshabilitado={deshabilitado}
        permitirVarios={false}
        titulo="Arrastra tu archivo PDF o pulsa para seleccionarlo"
        ayuda="Esta herramienta trabaja con un documento a la vez. Solo se aceptan archivos con extensión .pdf."
        nombreAccesible="Seleccionar un archivo PDF"
      />
    )
  }

  return (
    <div className="documento-cargado">
      <IconoArchivoPdf className="documento-cargado__icono" />

      <div className="documento-cargado__datos">
        <p className="documento-cargado__nombre">
          {documento.seleccionado.nombre}
        </p>
        <p className="documento-cargado__detalle">
          {documento.numeroPaginas}{' '}
          {documento.numeroPaginas === 1 ? 'página' : 'páginas'} ·{' '}
          {formatearTamanoArchivo(documento.seleccionado.tamano)}
        </p>
      </div>

      <div className="documento-cargado__acciones">
        {/*
          El «input» real queda oculto a la vista pero sigue siendo enfocable,
          y la etiqueta asociada actúa como botón visible.
        */}
        <div className="selector-archivo">
          <input
            className="selector-archivo__campo"
            id={idCampo}
            type="file"
            accept={ATRIBUTO_ACCEPT_PDF}
            disabled={deshabilitado}
            aria-label="Cambiar el documento cargado"
            onChange={(evento) => {
              const elegidos = evento.target.files
              if (elegidos !== null && elegidos.length > 0) {
                alSeleccionarArchivos(Array.from(elegidos))
              }
              evento.target.value = ''
            }}
          />
          <label className="boton boton--secundario" htmlFor={idCampo}>
            Cambiar documento
          </label>
        </div>

        <button
          className="boton boton--discreto"
          type="button"
          disabled={deshabilitado}
          onClick={alRestablecer}
        >
          <IconoRestablecer className="boton__icono" />
          Empezar de nuevo
        </button>
      </div>
    </div>
  )
}

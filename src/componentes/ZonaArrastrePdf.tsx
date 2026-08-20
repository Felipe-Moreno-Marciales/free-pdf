import type { Ref } from 'react'
import { ATRIBUTO_ACCEPT_PDF } from '../utilidades/validacionArchivos'
import { ZonaArrastreArchivos } from './ZonaArrastreArchivos'

interface PropiedadesZonaArrastrePdf {
  /** Se ejecuta con los archivos elegidos o soltados por la persona. */
  readonly alSeleccionarArchivos: (archivos: readonly File[]) => void
  /** Bloquea la zona mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Permite elegir varios archivos a la vez. */
  readonly permitirVarios?: boolean
  /** Texto principal de la zona. */
  readonly titulo?: string
  /** Texto de ayuda que describe qué archivos se aceptan. */
  readonly ayuda?: string
  /** Nombre accesible del selector de archivos. */
  readonly nombreAccesible?: string
  /** Referencia opcional al selector nativo para restaurar el foco. */
  readonly referenciaCampo?: Ref<HTMLInputElement>
}

/**
 * Zona para elegir archivos PDF haciendo clic, con el teclado o arrastrando.
 *
 * Los textos son configurables porque la misma zona se usa para unir varios
 * documentos y para abrir uno solo en el resto de herramientas.
 *
 * El comportamiento vive en `ZonaArrastreArchivos`, que se comparte con la zona
 * de imágenes: así el arrastre, el selector nativo y los textos accesibles se
 * escriben una sola vez.
 */
export function ZonaArrastrePdf({
  alSeleccionarArchivos,
  deshabilitado,
  permitirVarios = true,
  titulo = 'Arrastra tus archivos PDF o pulsa para seleccionarlos',
  ayuda = 'Puedes elegir varios a la vez y añadir más después. Solo se aceptan archivos con extensión .pdf.',
  nombreAccesible = 'Seleccionar archivos PDF',
  referenciaCampo,
}: PropiedadesZonaArrastrePdf) {
  return (
    <ZonaArrastreArchivos
      alSeleccionarArchivos={alSeleccionarArchivos}
      deshabilitado={deshabilitado}
      accept={ATRIBUTO_ACCEPT_PDF}
      permitirVarios={permitirVarios}
      titulo={titulo}
      ayuda={ayuda}
      nombreAccesible={nombreAccesible}
      referenciaCampo={referenciaCampo}
    />
  )
}

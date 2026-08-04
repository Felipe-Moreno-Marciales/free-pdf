import {
  ATRIBUTO_ACCEPT_IMAGENES,
  FORMATOS_ADMITIDOS_TEXTO,
} from '../imagenes/validarImagen'
import { ZonaArrastreArchivos } from './ZonaArrastreArchivos'

interface PropiedadesZonaArrastreImagenes {
  /** Se ejecuta con las imágenes elegidas o soltadas por la persona. */
  readonly alSeleccionarArchivos: (archivos: readonly File[]) => void
  /** Bloquea la zona mientras hay un proceso en curso. */
  readonly deshabilitado: boolean
  /** Permite elegir varias imágenes a la vez. */
  readonly permitirVarias?: boolean
  /** Texto principal de la zona. */
  readonly titulo?: string
  /** Texto de ayuda que describe qué imágenes se aceptan. */
  readonly ayuda?: string
  /** Nombre accesible del selector de archivos. */
  readonly nombreAccesible?: string
}

/**
 * Zona para elegir imágenes haciendo clic, con el teclado o arrastrando.
 *
 * Comparte todo el comportamiento con la zona de documentos PDF; solo cambian
 * los formatos admitidos y los textos.
 */
export function ZonaArrastreImagenes({
  alSeleccionarArchivos,
  deshabilitado,
  permitirVarias = true,
  titulo = 'Arrastra tus imágenes o pulsa para seleccionarlas',
  ayuda = `Puedes elegir varias a la vez y añadir más después. Se aceptan ${FORMATOS_ADMITIDOS_TEXTO}.`,
  nombreAccesible = 'Seleccionar imágenes',
}: PropiedadesZonaArrastreImagenes) {
  return (
    <ZonaArrastreArchivos
      alSeleccionarArchivos={alSeleccionarArchivos}
      deshabilitado={deshabilitado}
      accept={ATRIBUTO_ACCEPT_IMAGENES}
      permitirVarios={permitirVarias}
      titulo={titulo}
      ayuda={ayuda}
      nombreAccesible={nombreAccesible}
    />
  )
}

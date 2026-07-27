import { IconoCandado } from './Iconos'

/** Recordatorio de que el procesamiento nunca sale del navegador. */
export function AvisoPrivacidad() {
  return (
    <aside className="privacidad" aria-label="Aviso de privacidad">
      <IconoCandado className="privacidad__icono" />
      <p className="privacidad__texto">
        Tus archivos se procesan en este navegador y nunca se suben a un
        servidor.
      </p>
    </aside>
  )
}

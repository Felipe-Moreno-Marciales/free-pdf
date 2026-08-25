import { useEffect } from 'react'

/** Lo que necesita el gancho para atender los atajos. */
export interface OpcionesAtajosHistorial {
  readonly deshacer: () => void
  readonly rehacer: () => void
  /** Con `false` no se escucha nada, por ejemplo mientras se genera el PDF. */
  readonly activo: boolean
}

/**
 * Atajos de teclado para deshacer y rehacer.
 *
 * Se atienden las tres combinaciones habituales: Ctrl+Z deshace, y tanto Ctrl+Y como
 * Ctrl+Mayús+Z rehacen. En macOS la tecla es Cmd, que llega como `metaKey`.
 *
 * **No se interceptan dentro de un campo de escritura.** Quien está corrigiendo una
 * palabra en el panel espera que Ctrl+Z deshaga sus letras, no que retroceda un paso
 * del documento entero; el navegador ya hace lo primero y quitárselo sería peor que
 * no ofrecer el atajo.
 */
export function useAtajosHistorial({
  deshacer,
  rehacer,
  activo,
}: OpcionesAtajosHistorial): void {
  useEffect(() => {
    if (!activo || typeof window === 'undefined') {
      return
    }

    const alPulsar = (evento: KeyboardEvent): void => {
      if (!(evento.ctrlKey || evento.metaKey) || evento.altKey) {
        return
      }

      if (estaEscribiendo(evento.target)) {
        return
      }

      const tecla = evento.key.toLowerCase()

      if (tecla === 'z' && !evento.shiftKey) {
        evento.preventDefault()
        deshacer()
        return
      }

      if (tecla === 'y' || (tecla === 'z' && evento.shiftKey)) {
        evento.preventDefault()
        rehacer()
      }
    }

    window.addEventListener('keydown', alPulsar)

    return () => {
      window.removeEventListener('keydown', alPulsar)
    }
  }, [activo, deshacer, rehacer])
}

/** Si el foco está en algo donde se escribe texto. */
function estaEscribiendo(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) {
    return false
  }

  return (
    objetivo instanceof HTMLInputElement ||
    objetivo instanceof HTMLTextAreaElement ||
    objetivo.isContentEditable
  )
}

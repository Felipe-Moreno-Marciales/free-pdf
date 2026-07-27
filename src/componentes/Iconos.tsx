import type { ReactNode } from 'react'

/**
 * Iconos SVG propios del proyecto.
 *
 * Se dibujan con trazos sobre `currentColor`, así que heredan el color del
 * texto. Son decorativos: la información siempre está también en el texto
 * visible o en el nombre accesible del control que los contiene.
 */
interface PropiedadesIcono {
  readonly className?: string
}

interface PropiedadesIconoTrazo extends PropiedadesIcono {
  readonly children: ReactNode
}

/** Lienzo común de los iconos de trazo. */
function IconoTrazo({ className, children }: PropiedadesIconoTrazo) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Marca del proyecto: dos documentos que se combinan. */
export function IconoLogotipo({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="3" y="2" width="12" height="15" rx="2.5" />
      <rect x="9" y="7" width="12" height="15" rx="2.5" />
    </IconoTrazo>
  )
}

/** Documento PDF. */
export function IconoArchivoPdf({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </IconoTrazo>
  )
}

/** Dos caminos que confluyen en uno: la acción de unir. */
export function IconoUnir({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M5 4v3a5 5 0 0 0 5 5h9" />
      <path d="M5 20v-3a5 5 0 0 1 5-5" />
      <path d="M16 9l3 3-3 3" />
    </IconoTrazo>
  )
}

/** Flecha hacia una bandeja: seleccionar archivos. */
export function IconoSubir({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M12 16V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </IconoTrazo>
  )
}

/** Descargar el documento resultante. */
export function IconoDescargar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M12 4v12" />
      <path d="M8 12l4 4 4-4" />
      <path d="M4 19h16" />
    </IconoTrazo>
  )
}

/** Mover un elemento hacia arriba. */
export function IconoFlechaArriba({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </IconoTrazo>
  )
}

/** Mover un elemento hacia abajo. */
export function IconoFlechaAbajo({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </IconoTrazo>
  )
}

/** Quitar un elemento de la lista. */
export function IconoPapelera({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 7h16" />
      <path d="M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1Z" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v7" />
      <path d="M14 11v7" />
    </IconoTrazo>
  )
}

/** Escudo con una marca de verificación: procesamiento local. */
export function IconoEscudo({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M12 3l7 3v6c0 4.5-3 7.9-7 9-4-1.1-7-4.5-7-9V6l7-3Z" />
      <path d="M9.5 12.4l1.8 1.8 3.4-3.6" />
    </IconoTrazo>
  )
}

/** Signos de mayor y menor: código abierto. */
export function IconoCodigo({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M9 7l-5 5 5 5" />
      <path d="M15 7l5 5-5 5" />
    </IconoTrazo>
  )
}

/** Ojo tachado: sin registros ni seguimiento. */
export function IconoOjoTachado({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.7 5.2A9.6 9.6 0 0 1 12 5c6 0 10 4.5 10 7 0 1-.7 2.3-1.9 3.5" />
      <path d="M6.4 7.6C3.7 9.2 2 11.1 2 12c0 2.5 4 7 10 7 1.5 0 2.9-.3 4.1-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </IconoTrazo>
  )
}

/** Candado cerrado: aviso de privacidad. */
export function IconoCandado({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5V17" />
    </IconoTrazo>
  )
}

/** Marca de verificación: operación completada. */
export function IconoVerificado({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.4l2.7 2.7L16 9.6" />
    </IconoTrazo>
  )
}

/** Señal de atención: error o advertencia. */
export function IconoAlerta({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </IconoTrazo>
  )
}

/** Círculo incompleto que gira mientras se procesa. */
export function IconoCargando({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </IconoTrazo>
  )
}

/** Marca de GitHub. */
export function IconoGitHub({ className }: PropiedadesIcono) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 1.5a10.5 10.5 0 0 0-3.32 20.47c.52.1.71-.23.71-.5v-1.75c-2.9.63-3.52-1.4-3.52-1.4-.47-1.2-1.16-1.52-1.16-1.52-.95-.65.07-.64.07-.64 1.05.08 1.6 1.08 1.6 1.08.94 1.6 2.45 1.14 3.05.87.1-.68.37-1.15.67-1.41-2.32-.27-4.76-1.16-4.76-5.16 0-1.14.4-2.07 1.07-2.8-.11-.27-.47-1.33.1-2.77 0 0 .87-.28 2.85 1.07a9.9 9.9 0 0 1 5.2 0c1.97-1.35 2.84-1.07 2.84-1.07.57 1.44.21 2.5.1 2.77.67.73 1.07 1.66 1.07 2.8 0 4.01-2.45 4.89-4.78 5.15.38.33.72.97.72 1.96v2.9c0 .28.19.61.72.5A10.5 10.5 0 0 0 12 1.5Z" />
    </svg>
  )
}

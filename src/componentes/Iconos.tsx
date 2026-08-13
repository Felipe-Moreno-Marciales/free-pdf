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
  /** Conserva la escala visual completa usada como referencia en el catálogo. */
  readonly tamanoReferencia?: boolean
}

/** Lienzo común de los iconos de trazo. */
function IconoTrazo({
  className,
  children,
  tamanoReferencia = false,
}: PropiedadesIconoTrazo) {
  const clases = tamanoReferencia
    ? `${className ?? ''} icono-tamano-referencia`.trim()
    : className

  return (
    <svg
      className={clases}
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

/** Tijeras sobre una línea de corte: dividir un documento. */
export function IconoDividir({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M20 4L8.6 16.4" />
      <path d="M20 20L8.6 7.6" />
    </IconoTrazo>
  )
}

/** Página que sale de un grupo: extraer páginas. */
export function IconoExtraer({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M15 8h5" />
      <path d="M17.5 5.5L20 8l-2.5 2.5" />
      <path d="M15 14v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1Z" />
    </IconoTrazo>
  )
}

/** Documento con un aspa: eliminar páginas. */
export function IconoEliminarPaginas({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M10 13l4 4" />
      <path d="M14 13l-4 4" />
    </IconoTrazo>
  )
}

/** Cuadrícula con flechas: organizar páginas. */
export function IconoOrganizar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 17.5h7" />
      <path d="M18.5 15l2.5 2.5-2.5 2.5" />
    </IconoTrazo>
  )
}

/** Flecha circular a la derecha: rotar páginas. */
export function IconoRotarDerecha({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M20.5 9A9 9 0 1 0 12 21" />
      <path d="M21 3.5V9h-5.5" />
    </IconoTrazo>
  )
}

/** Flecha circular a la izquierda: rotar en sentido contrario. */
export function IconoRotarIzquierda({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M3.5 9A9 9 0 1 1 12 21" />
      <path d="M3 3.5V9h5.5" />
    </IconoTrazo>
  )
}

/** Media vuelta: rotar 180 grados. */
export function IconoMediaVuelta({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 12a8 8 0 0 1 16 0" />
      <path d="M1.5 9.5L4 12l2.5-2.5" />
      <path d="M17.5 9.5L20 12l2.5-2.5" />
      <path d="M8 17h8" />
    </IconoTrazo>
  )
}

/** Flecha hacia la izquierda. */
export function IconoFlechaIzquierda({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </IconoTrazo>
  )
}

/** Flecha hacia la derecha. */
export function IconoFlechaDerecha({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </IconoTrazo>
  )
}

/** Flecha con tope a la izquierda: llevar al inicio. */
export function IconoAlInicio({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 5v14" />
      <path d="M20 12H8" />
      <path d="M13 7l-5 5 5 5" />
    </IconoTrazo>
  )
}

/** Flecha con tope a la derecha: llevar al final. */
export function IconoAlFinal({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M20 5v14" />
      <path d="M4 12h12" />
      <path d="M11 7l5 5-5 5" />
    </IconoTrazo>
  )
}

/** Flecha que vuelve atrás: regresar o restablecer. */
export function IconoVolver({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M20 12a8 8 0 1 1-8-8h8" />
      <path d="M16.5 0.5L20 4l-3.5 3.5" />
    </IconoTrazo>
  )
}

/** Flecha circular: restablecer al estado inicial. */
export function IconoRestablecer({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4.5V10h5.5" />
    </IconoTrazo>
  )
}

/** Recuadro con una marca: seleccionar todas. */
export function IconoSeleccionarTodas({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8.5 12.2l2.6 2.6L16 9.8" />
    </IconoTrazo>
  )
}

/** Recuadro vacío: deseleccionar todas. */
export function IconoDeseleccionar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </IconoTrazo>
  )
}

/** Dos flechas cruzadas: invertir la selección. */
export function IconoInvertir({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 8h13" />
      <path d="M14 5l3 3-3 3" />
      <path d="M20 16H7" />
      <path d="M10 13l-3 3 3 3" />
    </IconoTrazo>
  )
}

/** Paquete comprimido: descarga en ZIP. */
export function IconoPaquete({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 8.5L12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
      <path d="M4 8.5L12 13l8-4.5" />
      <path d="M12 13v7" />
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

/**
 * Escudo con lupa: inspeccionar características sensibles sin ejecutarlas.
 *
 * Reutiliza el contorno cerrado de `IconoEscudo`, así que ocupa exactamente el
 * mismo lienzo que el resto de la categoría de seguridad. La lupa va dentro del
 * escudo: el trazo más externo queda a 4 unidades del borde del `viewBox`, con
 * holgura de sobra para el `scale(1.15)` que la tarjeta aplica al icono.
 */
export function IconoInspeccionarSeguridad({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M12 3l7 3v6c0 4.5-3 7.9-7 9-4-1.1-7-4.5-7-9V6l7-3Z" />
      <circle cx="11.5" cy="10.5" r="2.85" />
      <path d="m13.5 12.5 2.1 2.1" />
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

/** Fotografías apiladas: imágenes a PDF. */
export function IconoImagenAPdf({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className} tamanoReferencia>
      <path d="M4 16V5a2 2 0 0 1 2-2h11" />
      <rect x="7" y="6" width="14" height="15" rx="2" />
      <circle cx="16.5" cy="10.5" r="1.5" />
      <path d="m7 18 4.2-4.2a2 2 0 0 1 2.8 0l1.2 1.2 1-1a2 2 0 0 1 2.8 0l2 2" />
    </IconoTrazo>
  )
}

/** Documento que contiene una imagen: PDF a imágenes. */
export function IconoPdfAImagenes({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className} tamanoReferencia>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <circle cx="9" cy="12" r="1.25" />
      <path d="m6.5 19 3.2-3.2a1.8 1.8 0 0 1 2.6 0l0.7 0.7 1.2-1.2a1.8 1.8 0 0 1 2.6 0l2.7 2.7" />
    </IconoTrazo>
  )
}

/** Página con un número en su esquina: numerar páginas. */
export function IconoNumerarPaginas({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13.5l1.5-1v5" />
      <path d="M13 13.2a1.6 1.6 0 0 1 2.7 1.1c0 1.2-2.7 1.9-2.7 3.2h2.8" />
    </IconoTrazo>
  )
}

/** Gota sobre una página inclinada: marca de agua. */
export function IconoMarcaDeAgua({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M12 10.5c1.6 1.9 2.6 3.3 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.3 1-2.7 2.6-4.6Z" />
    </IconoTrazo>
  )
}

/** Escuadras de recorte: recortar PDF. */
export function IconoRecortar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M2 6h14a2 2 0 0 1 2 2v14" />
    </IconoTrazo>
  )
}

/** Cámara sobre una hoja: escanear a PDF. */
export function IconoEscanear({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M3 8V6a2 2 0 0 1 2-2h2" />
      <path d="M21 8V6a2 2 0 0 0-2-2h-2" />
      <path d="M3 16v2a2 2 0 0 0 2 2h2" />
      <path d="M21 16v2a2 2 0 0 1-2 2h-2" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M9.5 8.8l1-1.6h3l1 1.6" />
    </IconoTrazo>
  )
}

/** Cámara fotográfica. */
export function IconoCamara({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 8.5h2.2l1.3-2h9l1.3 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z" />
      <circle cx="12" cy="14" r="3.2" />
    </IconoTrazo>
  )
}

/** Obturador: tomar una fotografía. */
export function IconoObturador({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </IconoTrazo>
  )
}

/** Dos cámaras enfrentadas: cambiar de cámara. */
export function IconoCambiarCamara({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 10a8 8 0 0 1 13-3" />
      <path d="M17 3.5V7h-3.5" />
      <path d="M20 14a8 8 0 0 1-13 3" />
      <path d="M7 20.5V17h3.5" />
    </IconoTrazo>
  )
}

/** Cuadrado tachado: detener la cámara o cancelar. */
export function IconoDetener({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </IconoTrazo>
  )
}

/** Ojo abierto: mostrar la contraseña. */
export function IconoOjo({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M2 12c0-2.5 4-7 10-7s10 4.5 10 7c0 2.5-4 7-10 7S2 14.5 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </IconoTrazo>
  )
}

/** Lápiz: editar y anotar. */
export function IconoEditar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 6.5l3 3" />
      <path d="M4 20h16" />
    </IconoTrazo>
  )
}

/** Rúbrica sobre una línea: firma visual. */
export function IconoFirma({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M3 16c2.5 0 3.5-9 6-9s1.5 9 4 9 2-5 4-5 1.5 2.5 4 2.5" />
      <path d="M3 20h18" />
    </IconoTrazo>
  )
}

/** Documento con casillas: formularios PDF. */
export function IconoFormulario({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <rect x="8" y="11.5" width="3" height="3" rx="0.6" />
      <path d="M13 13h3" />
      <path d="M8 18h8" />
    </IconoTrazo>
  )
}

/** Candado con llave: proteger PDF. */
export function IconoProteger({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15" r="1.4" />
      <path d="M12 16.4V18" />
    </IconoTrazo>
  )
}

/** Candado abierto: desbloquear PDF. */
export function IconoDesbloquear({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
      <circle cx="12" cy="15" r="1.4" />
    </IconoTrazo>
  )
}

/** Franja tachada sobre un documento: censurar permanentemente. */
export function IconoCensurar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <rect x="7.5" y="11" width="9" height="2.6" rx="0.4" fill="currentColor" />
      <rect x="7.5" y="16" width="6" height="2.6" rx="0.4" fill="currentColor" />
    </IconoTrazo>
  )
}

/** Cuadrado con esquinas de selección: seleccionar un área. */
export function IconoSeleccionArea({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    </IconoTrazo>
  )
}

/** Letra T: añadir texto. */
export function IconoTexto({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M5 6h14" />
      <path d="M12 6v13" />
      <path d="M9 19h6" />
    </IconoTrazo>
  )
}

/** Trazo libre: dibujar. */
export function IconoDibujar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M3 17c3-6 5 3 8-2s4 2 6-3" />
      <circle cx="20" cy="10" r="1.2" fill="currentColor" />
    </IconoTrazo>
  )
}

/** Marcador ancho: resaltar. */
export function IconoResaltar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 15l6-6 4 4-6 6H4v-4Z" />
      <path d="M12.5 6.5l3-3 4.5 4.5-3 3" />
      <path d="M3 21h18" />
    </IconoTrazo>
  )
}

/** Rectángulo: forma rectangular. */
export function IconoRectangulo({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="4" y="6" width="16" height="12" rx="1.5" />
    </IconoTrazo>
  )
}

/** Elipse: forma ovalada. */
export function IconoElipse({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <ellipse cx="12" cy="12" rx="8" ry="6" />
    </IconoTrazo>
  )
}

/** Línea diagonal: forma de línea. */
export function IconoLinea({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M5 19L19 5" />
    </IconoTrazo>
  )
}

/** Flecha diagonal: forma de flecha. */
export function IconoFlechaForma({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M5 19L19 5" />
      <path d="M13 5h6v6" />
    </IconoTrazo>
  )
}

/** Nota adhesiva: nota visual. */
export function IconoNota({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M5 4h14a1 1 0 0 1 1 1v10l-5 5H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M20 15h-4a1 1 0 0 0-1 1v4" />
      <path d="M8.5 9h7" />
      <path d="M8.5 12.5h4" />
    </IconoTrazo>
  )
}

/** Flecha curva hacia atrás: deshacer. */
export function IconoDeshacer({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M4 9h9a5.5 5.5 0 0 1 0 11H8" />
      <path d="M7.5 5.5L4 9l3.5 3.5" />
    </IconoTrazo>
  )
}

/** Flecha curva hacia delante: rehacer. */
export function IconoRehacer({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M20 9h-9a5.5 5.5 0 0 0 0 11h5" />
      <path d="M16.5 5.5L20 9l-3.5 3.5" />
    </IconoTrazo>
  )
}

/** Capas apiladas: orden de los elementos. */
export function IconoCapas({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="M4 12.5L12 17l8-4.5" />
      <path d="M4 17L12 21.5 20 17" />
    </IconoTrazo>
  )
}

/** Dos hojas: duplicar un elemento. */
export function IconoDuplicar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect x="4" y="4" width="11" height="13" rx="2" />
      <path d="M9 20h9a2 2 0 0 0 2-2V9" />
    </IconoTrazo>
  )
}

/** Lupa: buscar texto. */
export function IconoBuscar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
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

/** Sol: tema claro. */
export function IconoSol({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <circle cx="12" cy="12" r="3.75" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.42 1.42" />
      <path d="m17.65 17.65 1.42 1.42" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.35 17.65-1.42 1.42" />
      <path d="m19.07 4.93-1.42 1.42" />
    </IconoTrazo>
  )
}

/** Luna creciente: tema oscuro. */
export function IconoLuna({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <path d="M20.4 15.1A8.5 8.5 0 0 1 8.9 3.6 8.5 8.5 0 1 0 20.4 15.1Z" />
    </IconoTrazo>
  )
}

/** Llave inglesa: reparar un documento dañado. */
export function IconoReparar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className} tamanoReferencia>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8Z" />
      <circle cx="5.1" cy="18.9" r="0.75" fill="currentColor" stroke="none" />
    </IconoTrazo>
  )
}

/** Dos documentos enfrentados: comparar. */
export function IconoComparar({ className }: PropiedadesIcono) {
  return (
    <IconoTrazo className={className}>
      <rect height="16" rx="1.5" width="8" x="2.5" y="4" />
      <rect height="16" rx="1.5" width="8" x="13.5" y="4" />
      <path d="M12 2.5v19" />
    </IconoTrazo>
  )
}

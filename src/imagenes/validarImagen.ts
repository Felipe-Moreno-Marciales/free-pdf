import type { FormatoImagen, MotivoDescarteImagen } from './tipos'

/**
 * Validación de las imágenes que la persona selecciona.
 *
 * Este módulo es puro: no descodifica nada ni depende del navegador, así que se
 * puede probar por separado. La descodificación real ocurre después, al
 * dibujar la imagen en un `canvas`.
 */

/** Extensiones admitidas de cada formato. */
const EXTENSIONES_POR_FORMATO: Readonly<
  Record<FormatoImagen, readonly string[]>
> = {
  jpeg: ['.jpg', '.jpeg'],
  png: ['.png'],
  webp: ['.webp'],
}

/** Tipos MIME admitidos de cada formato. */
const TIPOS_MIME_POR_FORMATO: Readonly<
  Record<FormatoImagen, readonly string[]>
> = {
  jpeg: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
}

/** Formatos admitidos, en el orden en el que se comprueban. */
const FORMATOS: readonly FormatoImagen[] = ['jpeg', 'png', 'webp']

/** Valor del atributo `accept` del selector de imágenes. */
export const ATRIBUTO_ACCEPT_IMAGENES =
  'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

/** Lista de formatos admitidos, para mostrarla en la interfaz. */
export const FORMATOS_ADMITIDOS_TEXTO = 'JPEG, JPG, PNG y WebP'

/**
 * Tamaño a partir del cual se avisa del consumo de memoria.
 *
 * No se rechaza ninguna imagen por su tamaño: solo se advierte, porque
 * descodificar una fotografía muy grande puede ocupar bastante memoria.
 */
export const TAMANO_AVISO_MEMORIA = 12 * 1024 * 1024

/** Número de píxeles a partir del cual se avisa del consumo de memoria. */
export const PIXELES_AVISO_MEMORIA = 24_000_000

/** Nombre visible de cada formato. */
const NOMBRE_FORMATO: Readonly<Record<FormatoImagen, string>> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
}

/** Devuelve el nombre visible de un formato. */
export function describirFormato(formato: FormatoImagen): string {
  return NOMBRE_FORMATO[formato]
}

/**
 * Detecta el formato de un archivo a partir de su extensión y su tipo MIME.
 *
 * Manda la extensión, porque es lo que el sistema de archivos garantiza. El
 * tipo MIME solo se usa como comprobación adicional cuando el navegador lo
 * informa: hay sistemas que lo dejan vacío.
 */
export function detectarFormatoImagen(archivo: File): FormatoImagen | null {
  const nombre = archivo.name.toLowerCase()
  const tipoMime = archivo.type.trim().toLowerCase()

  for (const formato of FORMATOS) {
    const coincideExtension = EXTENSIONES_POR_FORMATO[formato].some(
      (extension) => nombre.endsWith(extension),
    )

    if (!coincideExtension) {
      continue
    }

    if (
      tipoMime !== '' &&
      !TIPOS_MIME_POR_FORMATO[formato].includes(tipoMime)
    ) {
      return null
    }

    return formato
  }

  return null
}

/** Comprueba si un archivo se puede tratar como imagen admitida. */
export function esArchivoImagen(archivo: File): boolean {
  return detectarFormatoImagen(archivo) !== null
}

/** Resultado de comprobar si un archivo se puede usar como imagen. */
export interface ResultadoValidacionImagen {
  /** `true` cuando el archivo se puede procesar. */
  readonly valido: boolean
  /** Formato detectado, o `null` si el archivo no es válido. */
  readonly formato: FormatoImagen | null
  /** Motivo del rechazo, o `null` si el archivo es válido. */
  readonly motivo: MotivoDescarteImagen | null
  /** Mensaje en español listo para mostrar, o `null` si el archivo es válido. */
  readonly mensaje: string | null
}

/**
 * Comprueba que un archivo se pueda tratar como imagen.
 *
 * Se exige una extensión admitida, un tipo MIME coherente cuando el navegador
 * lo informa, y que el archivo no esté vacío. No se lee el contenido: eso
 * ocurre más adelante, al descodificarla.
 */
export function validarArchivoImagen(
  archivo: File,
): ResultadoValidacionImagen {
  const formato = detectarFormatoImagen(archivo)

  if (formato === null) {
    return {
      valido: false,
      formato: null,
      motivo: 'formato-no-admitido',
      mensaje: `«${archivo.name}» no es una imagen admitida. Se aceptan ${FORMATOS_ADMITIDOS_TEXTO}.`,
    }
  }

  if (archivo.size === 0) {
    return {
      valido: false,
      formato,
      motivo: 'vacia',
      mensaje: `«${archivo.name}» está vacío, así que no se puede procesar.`,
    }
  }

  return { valido: true, formato, motivo: null, mensaje: null }
}

/** Describe un motivo de descarte en español, en plural. */
export function describirMotivoDescarte(
  motivo: MotivoDescarteImagen,
  cantidad: number,
): string {
  const plural = cantidad !== 1

  switch (motivo) {
    case 'formato-no-admitido':
      return plural
        ? `${cantidad} archivos no tienen un formato de imagen admitido`
        : '1 archivo no tiene un formato de imagen admitido'
    case 'vacia':
      return plural
        ? `${cantidad} archivos están vacíos`
        : '1 archivo está vacío'
    case 'duplicada':
      return plural
        ? `${cantidad} imágenes ya estaban en la lista`
        : '1 imagen ya estaba en la lista'
  }
}

/**
 * Construye el aviso que resume las imágenes descartadas.
 * Devuelve `null` cuando no se descartó ninguna.
 */
export function resumirDescartes(
  motivos: readonly MotivoDescarteImagen[],
): string | null {
  if (motivos.length === 0) {
    return null
  }

  const cuentas = new Map<MotivoDescarteImagen, number>()
  for (const motivo of motivos) {
    cuentas.set(motivo, (cuentas.get(motivo) ?? 0) + 1)
  }

  const partes = [...cuentas.entries()].map(([motivo, cantidad]) =>
    describirMotivoDescarte(motivo, cantidad),
  )

  return `No se añadieron algunas imágenes: ${partes.join('; ')}.`
}

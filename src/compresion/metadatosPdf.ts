import type { PDFDocument } from 'pdf-lib'

/**
 * Borrado de los metadatos de un documento.
 *
 * Es opcional a propósito. Los metadatos ocupan poquísimo, así que borrarlos **no es
 * una medida de compresión**: es una medida de privacidad. Un PDF suele llevar el
 * nombre de quien lo creó, el programa con el que se hizo y las fechas exactas, y
 * mucha gente no sabe que eso viaja con el archivo.
 *
 * Por eso se ofrece aquí, donde alguien ya está preparando un documento para
 * enviarlo, y por eso la interfaz explica qué se borra en lugar de llamarlo
 * «optimizar».
 */

/** Metadatos que se han encontrado en un documento. */
export interface MetadatosDocumento {
  readonly titulo: string
  readonly autor: string
  readonly asunto: string
  readonly palabrasClave: readonly string[]
  readonly creador: string
  readonly productor: string
  readonly fechaCreacion: Date | null
  readonly fechaModificacion: Date | null
}

/**
 * Lee los metadatos de un documento.
 *
 * Cada lectura va en su propio `try`: pdf-lib lanza si una entrada tiene un tipo
 * inesperado, y un documento con la fecha mal escrita no debe impedir leer el autor.
 */
export function leerMetadatos(documento: PDFDocument): MetadatosDocumento {
  return {
    titulo: leerTexto(() => documento.getTitle()),
    autor: leerTexto(() => documento.getAuthor()),
    asunto: leerTexto(() => documento.getSubject()),
    palabrasClave: leerLista(() => documento.getKeywords()),
    creador: leerTexto(() => documento.getCreator()),
    productor: leerTexto(() => documento.getProducer()),
    fechaCreacion: leerFecha(() => documento.getCreationDate()),
    fechaModificacion: leerFecha(() => documento.getModificationDate()),
  }
}

/** Lee un texto, devolviendo cadena vacía si no se puede. */
function leerTexto(obtener: () => string | undefined): string {
  try {
    return obtener() ?? ''
  } catch {
    return ''
  }
}

/**
 * Lee las palabras clave como lista.
 *
 * No hay una única convención para separarlas. La mayoría de los programas escriben
 * comas o puntos y comas, pero pdf-lib las une con espacios, así que un documento
 * generado con la propia biblioteca llega como `«finanzas interno»`.
 *
 * La regla: si hay comas o puntos y comas se separa por ellos, porque entonces una
 * palabra clave sí puede contener espacios («cuentas anuales»). Solo cuando no hay
 * ningún separador explícito se recurre a los espacios.
 */
function leerLista(obtener: () => string | undefined): readonly string[] {
  const texto = leerTexto(obtener)

  if (texto === '') {
    return []
  }

  const separador = /[,;]/.test(texto) ? /[,;]/ : /\s+/

  return texto
    .split(separador)
    .map((palabra) => palabra.trim())
    .filter((palabra) => palabra !== '')
}

/** Lee una fecha, devolviendo `null` si no se puede. */
function leerFecha(obtener: () => Date | undefined): Date | null {
  try {
    return obtener() ?? null
  } catch {
    return null
  }
}

/** `true` cuando el documento lleva algún metadato que identifique a alguien. */
export function hayMetadatos(metadatos: MetadatosDocumento): boolean {
  return (
    metadatos.titulo !== '' ||
    metadatos.autor !== '' ||
    metadatos.asunto !== '' ||
    metadatos.palabrasClave.length > 0 ||
    metadatos.creador !== '' ||
    metadatos.productor !== ''
  )
}

/** Cuenta cuántos metadatos con contenido hay. */
export function contarMetadatos(metadatos: MetadatosDocumento): number {
  let cuenta = 0

  for (const valor of [
    metadatos.titulo,
    metadatos.autor,
    metadatos.asunto,
    metadatos.creador,
    metadatos.productor,
  ]) {
    if (valor !== '') {
      cuenta += 1
    }
  }

  if (metadatos.palabrasClave.length > 0) {
    cuenta += 1
  }

  if (metadatos.fechaCreacion !== null) {
    cuenta += 1
  }

  if (metadatos.fechaModificacion !== null) {
    cuenta += 1
  }

  return cuenta
}

/**
 * Borra los metadatos de un documento, modificándolo en el sitio.
 *
 * Las fechas no se pueden dejar sin valor con pdf-lib, así que se fijan a un instante
 * fijo y neutro en lugar de a la fecha de hoy. Poner la fecha actual delataría cuándo
 * se procesó el documento, que es justo lo que se está tratando de evitar.
 */
export function borrarMetadatos(documento: PDFDocument): void {
  const neutra = new Date(0)

  documento.setTitle('')
  documento.setAuthor('')
  documento.setSubject('')
  documento.setKeywords([])
  documento.setCreator('')
  documento.setProducer('')
  documento.setCreationDate(neutra)
  documento.setModificationDate(neutra)
}

/** Describe en español qué metadatos se van a borrar. */
export function describirMetadatos(
  metadatos: MetadatosDocumento,
): readonly { readonly clave: string; readonly valor: string }[] {
  const filas: { readonly clave: string; readonly valor: string }[] = []

  const anadir = (clave: string, valor: string): void => {
    if (valor !== '') {
      filas.push({ clave, valor })
    }
  }

  anadir('Título', metadatos.titulo)
  anadir('Autor', metadatos.autor)
  anadir('Asunto', metadatos.asunto)
  anadir('Palabras clave', metadatos.palabrasClave.join(', '))
  anadir('Creado con', metadatos.creador)
  anadir('Producido con', metadatos.productor)

  if (metadatos.fechaCreacion !== null) {
    anadir('Fecha de creación', formatearFecha(metadatos.fechaCreacion))
  }

  if (metadatos.fechaModificacion !== null) {
    anadir('Última modificación', formatearFecha(metadatos.fechaModificacion))
  }

  return filas
}

/** Formatea una fecha en español, sin depender de la zona horaria del sistema. */
export function formatearFecha(fecha: Date): string {
  const dia = String(fecha.getUTCDate()).padStart(2, '0')
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0')

  return `${dia}/${mes}/${fecha.getUTCFullYear()}`
}

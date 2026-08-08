import { PDFDocument, rgb } from 'pdf-lib'

/**
 * Ayudas para generar formularios PDF dentro de las propias pruebas.
 *
 * Los formularios se construyen con las API reales de pdf-lib, así que los campos
 * que las pruebas inspeccionan son campos AcroForm de verdad, con sus apariencias
 * y sus banderas. El repositorio no guarda ningún archivo binario.
 */

/** Opciones del formulario de prueba. */
export interface OpcionesFormularioPrueba {
  /** Número de páginas del documento. */
  readonly numeroPaginas?: number
  /** Añade un campo de texto de una sola línea. */
  readonly conTexto?: boolean
  /** Longitud máxima del campo de texto. */
  readonly longitudMaxima?: number
  /** Añade un campo de texto de varias líneas. */
  readonly conMultilinea?: boolean
  /** Añade una casilla de verificación. */
  readonly conCasilla?: boolean
  /** Añade un grupo de botones de opción. */
  readonly conOpciones?: boolean
  /** Añade una lista desplegable. */
  readonly conDesplegable?: boolean
  /** Añade una lista de opciones. */
  readonly conLista?: boolean
  /** Marca el campo de texto como solo lectura. */
  readonly textoSoloLectura?: boolean
  /** Marca el campo de texto como obligatorio. */
  readonly textoObligatorio?: boolean
  /** Añade un campo de contraseña. */
  readonly conContrasena?: boolean
}

/** Nombres de los campos que genera la ayuda. */
export const NOMBRES_PRUEBA = {
  texto: 'nombre-completo',
  multilinea: 'observaciones',
  casilla: 'acepta-condiciones',
  opciones: 'forma-de-pago',
  desplegable: 'provincia',
  lista: 'intereses',
  contrasena: 'clave-secreta',
} as const

/** Opciones del grupo de botones de opción. */
export const OPCIONES_PAGO: readonly string[] = ['Tarjeta', 'Transferencia']

/** Opciones de la lista desplegable. */
export const OPCIONES_PROVINCIA: readonly string[] = [
  'Sevilla',
  'Granada',
  'Málaga',
]

/** Opciones de la lista de opciones. */
export const OPCIONES_INTERESES: readonly string[] = [
  'Lectura',
  'Cine',
  'Música',
]

/**
 * Genera los bytes de un documento con los campos de formulario indicados.
 *
 * Por omisión crea un formulario con un campo de cada clase, que es lo que necesita
 * la mayoría de las pruebas.
 */
export async function crearBytesFormulario(
  opciones: OpcionesFormularioPrueba = {},
): Promise<Uint8Array> {
  const {
    numeroPaginas = 1,
    conTexto = true,
    longitudMaxima,
    conMultilinea = true,
    conCasilla = true,
    conOpciones = true,
    conDesplegable = true,
    conLista = true,
    textoSoloLectura = false,
    textoObligatorio = false,
    conContrasena = false,
  } = opciones

  const documento = await PDFDocument.create()

  for (let indice = 0; indice < numeroPaginas; indice += 1) {
    documento.addPage([400, 600])
  }

  const primera = documento.getPage(0)
  const formulario = documento.getForm()

  const apariencia = {
    width: 200,
    height: 20,
    textColor: rgb(0, 0, 0),
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1,
  }

  if (conTexto) {
    const campo = formulario.createTextField(NOMBRES_PRUEBA.texto)

    // La longitud máxima se fija antes del valor: pdf-lib rechaza un máximo
    // menor que el texto que el campo ya contiene.
    if (longitudMaxima !== undefined) {
      campo.setMaxLength(longitudMaxima)
      campo.setText('ab')
    } else {
      campo.setText('Valor inicial')
    }

    if (textoSoloLectura) {
      campo.enableReadOnly()
    }

    if (textoObligatorio) {
      campo.enableRequired()
    }

    campo.addToPage(primera, { ...apariencia, x: 20, y: 560 })
  }

  if (conMultilinea) {
    const campo = formulario.createTextField(NOMBRES_PRUEBA.multilinea)
    campo.enableMultiline()
    campo.addToPage(primera, { ...apariencia, x: 20, y: 480, height: 60 })
  }

  if (conCasilla) {
    const campo = formulario.createCheckBox(NOMBRES_PRUEBA.casilla)
    campo.addToPage(primera, { ...apariencia, x: 20, y: 440, width: 20 })
  }

  if (conOpciones) {
    const campo = formulario.createRadioGroup(NOMBRES_PRUEBA.opciones)

    OPCIONES_PAGO.forEach((opcion, indice) => {
      campo.addOptionToPage(opcion, primera, {
        ...apariencia,
        x: 20,
        y: 400 - indice * 26,
        width: 20,
      })
    })
  }

  if (conDesplegable) {
    const campo = formulario.createDropdown(NOMBRES_PRUEBA.desplegable)
    campo.setOptions([...OPCIONES_PROVINCIA])
    campo.addToPage(primera, { ...apariencia, x: 20, y: 330 })
  }

  if (conLista) {
    const campo = formulario.createOptionList(NOMBRES_PRUEBA.lista)
    campo.setOptions([...OPCIONES_INTERESES])
    campo.addToPage(primera, { ...apariencia, x: 20, y: 250, height: 60 })
  }

  if (conContrasena) {
    const campo = formulario.createTextField(NOMBRES_PRUEBA.contrasena)
    campo.enablePassword()
    campo.setText('no-debe-leerse')
    campo.addToPage(primera, { ...apariencia, x: 20, y: 200 })
  }

  return await documento.save()
}

/** Genera el formulario de prueba directamente como `File`. */
export async function crearArchivoFormulario(
  nombre = 'formulario.pdf',
  opciones: OpcionesFormularioPrueba = {},
): Promise<File> {
  const bytes = await crearBytesFormulario(opciones)
  const contenido = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(contenido).set(bytes)

  return new File([contenido], nombre, {
    type: 'application/pdf',
    lastModified: 1_700_000_000_000,
  })
}

/** Genera un PDF sin ningún campo de formulario. */
export async function crearArchivoSinFormulario(
  nombre = 'sin-formulario.pdf',
): Promise<File> {
  const documento = await PDFDocument.create()
  documento.addPage([400, 600])
  documento.addPage([400, 600])

  const bytes = await documento.save()
  const contenido = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(contenido).set(bytes)

  return new File([contenido], nombre, { type: 'application/pdf' })
}

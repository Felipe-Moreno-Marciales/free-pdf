import type { PDFDocument, PDFField, PDFForm } from 'pdf-lib'
import { abrirDocumentoDesdeArchivo, type ModuloPdfLib } from '../pdf/cargarDocumentoPdf'
import { envolverErrorPdf } from '../pdf/erroresPdf'
import type {
  CampoDetectado,
  ClaseCampo,
  InspeccionFormulario,
  ValorCampo,
} from './tipos'

/**
 * Inspección de los formularios que ya existen en un documento.
 *
 * Se usan las API de formularios de pdf-lib, que cubren los campos AcroForm. Los
 * formularios XFA son otra tecnología, en desuso y con una estructura
 * completamente distinta: se detectan para poder avisar, pero no se manipulan.
 *
 * Un detalle importante de privacidad: **el valor de los campos de contraseña no
 * se lee nunca**. Mostrarlo sería filtrar precisamente lo que el documento intenta
 * ocultar.
 */

/** Deduce la clase de un campo a partir de su tipo real. */
export function deducirClase(
  pdfLib: ModuloPdfLib,
  campo: PDFField,
): ClaseCampo {
  if (campo instanceof pdfLib.PDFTextField) {
    return campo.isMultiline() ? 'texto-multilinea' : 'texto'
  }

  if (campo instanceof pdfLib.PDFCheckBox) {
    return 'casilla'
  }

  if (campo instanceof pdfLib.PDFRadioGroup) {
    return 'opcion'
  }

  if (campo instanceof pdfLib.PDFDropdown) {
    return 'desplegable'
  }

  if (campo instanceof pdfLib.PDFOptionList) {
    return 'lista'
  }

  if (campo instanceof pdfLib.PDFButton) {
    return 'boton'
  }

  if (campo instanceof pdfLib.PDFSignature) {
    return 'firma'
  }

  return 'no-compatible'
}

/**
 * Deduce en qué página aparece un campo.
 *
 * Un campo puede tener varios widgets, incluso en páginas distintas; se devuelve la
 * primera que se encuentra. Si el documento no declara la página del widget, se
 * devuelve `null` en lugar de inventar un número.
 */
export function deducirPagina(
  documento: PDFDocument,
  campo: PDFField,
): number | null {
  try {
    const referenciasPagina = documento
      .getPages()
      .map((pagina) => pagina.ref.toString())

    for (const widget of campo.acroField.getWidgets()) {
      const referencia = widget.P()?.toString()

      if (referencia === undefined) {
        continue
      }

      const indice = referenciasPagina.indexOf(referencia)
      if (indice !== -1) {
        return indice + 1
      }
    }
  } catch {
    // Un documento con una estructura inesperada no debe impedir la inspección.
  }

  return null
}

/** Lee el valor actual de un campo, según su clase. */
function leerValor(
  pdfLib: ModuloPdfLib,
  campo: PDFField,
  clase: ClaseCampo,
  esContrasena: boolean,
): ValorCampo {
  try {
    if (clase === 'texto' || clase === 'texto-multilinea') {
      // El valor de un campo de contraseña no se lee: sería una filtración.
      if (esContrasena) {
        return { clase: 'texto', texto: '' }
      }

      const texto =
        campo instanceof pdfLib.PDFTextField ? (campo.getText() ?? '') : ''

      return { clase: 'texto', texto }
    }

    if (clase === 'casilla') {
      return {
        clase: 'casilla',
        marcada:
          campo instanceof pdfLib.PDFCheckBox ? campo.isChecked() : false,
      }
    }

    if (clase === 'opcion') {
      return {
        clase: 'opcion',
        elegida:
          campo instanceof pdfLib.PDFRadioGroup
            ? (campo.getSelected() ?? null)
            : null,
      }
    }

    if (clase === 'desplegable' || clase === 'lista') {
      const elegidas =
        campo instanceof pdfLib.PDFDropdown ||
        campo instanceof pdfLib.PDFOptionList
          ? campo.getSelected()
          : []

      return { clase: 'seleccion', elegidas }
    }
  } catch {
    // Un campo con una apariencia dañada no debe romper la inspección completa.
  }

  return { clase: 'texto', texto: '' }
}

/** Lee las opciones admitidas de un campo de elección. */
function leerOpciones(
  pdfLib: ModuloPdfLib,
  campo: PDFField,
): readonly string[] {
  try {
    if (
      campo instanceof pdfLib.PDFRadioGroup ||
      campo instanceof pdfLib.PDFDropdown ||
      campo instanceof pdfLib.PDFOptionList
    ) {
      return campo.getOptions()
    }
  } catch {
    // Sin opciones legibles se devuelve una lista vacía.
  }

  return []
}

/** Describe un único campo del formulario. */
export function describirCampo(
  pdfLib: ModuloPdfLib,
  documento: PDFDocument,
  campo: PDFField,
): CampoDetectado {
  const clase = deducirClase(pdfLib, campo)

  const esContrasena =
    campo instanceof pdfLib.PDFTextField ? campo.isPassword() : false

  const longitudMaxima =
    campo instanceof pdfLib.PDFTextField
      ? (campo.getMaxLength() ?? null)
      : null

  const multiseleccion =
    campo instanceof pdfLib.PDFDropdown ||
    campo instanceof pdfLib.PDFOptionList
      ? campo.isMultiselect()
      : false

  return {
    nombre: campo.getName(),
    clase,
    pagina: deducirPagina(documento, campo),
    soloLectura: campo.isReadOnly(),
    obligatorio: campo.isRequired(),
    valor: leerValor(pdfLib, campo, clase, esContrasena),
    opciones: leerOpciones(pdfLib, campo),
    longitudMaxima,
    multilinea: clase === 'texto-multilinea',
    multiseleccion,
    esContrasena,
  }
}

/** Documento abierto junto con su formulario, para reutilizarlo. */
export interface FormularioAbierto {
  readonly pdfLib: ModuloPdfLib
  readonly documento: PDFDocument
  readonly formulario: PDFForm
  readonly inspeccion: InspeccionFormulario
}

/**
 * Abre un documento y describe su formulario.
 *
 * Se devuelve también el documento abierto para que la herramienta pueda reutilizar
 * el mismo objeto al rellenar, en lugar de volver a leer el archivo.
 */
export async function inspeccionarFormulario(
  archivo: File,
): Promise<FormularioAbierto> {
  try {
    const { pdfLib, documento } = await abrirDocumentoDesdeArchivo(archivo)
    const formulario = documento.getForm()

    const campos = formulario
      .getFields()
      .map((campo) => describirCampo(pdfLib, documento, campo))

    return {
      pdfLib,
      documento,
      formulario,
      inspeccion: {
        campos,
        numeroPaginas: documento.getPageCount(),
        tieneXfa: leerTieneXfa(formulario),
      },
    }
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudo leer el formulario del documento. Puede estar dañado.',
    )
  }
}

/** Comprueba si el documento declara un formulario XFA. */
function leerTieneXfa(formulario: PDFForm): boolean {
  try {
    return formulario.hasXFA()
  } catch {
    return false
  }
}

/** Nombre visible de cada clase de campo. */
const NOMBRE_CLASE: Readonly<Record<ClaseCampo, string>> = {
  texto: 'Texto',
  'texto-multilinea': 'Texto de varias líneas',
  casilla: 'Casilla de verificación',
  opcion: 'Botones de opción',
  desplegable: 'Lista desplegable',
  lista: 'Lista de opciones',
  boton: 'Botón',
  firma: 'Campo de firma',
  'no-compatible': 'Tipo no compatible',
}

/** Devuelve el nombre visible de una clase de campo. */
export function describirClase(clase: ClaseCampo): string {
  return NOMBRE_CLASE[clase]
}

/** `true` cuando la herramienta puede rellenar campos de esa clase. */
export function esRellenable(clase: ClaseCampo): boolean {
  return (
    clase === 'texto' ||
    clase === 'texto-multilinea' ||
    clase === 'casilla' ||
    clase === 'opcion' ||
    clase === 'desplegable' ||
    clase === 'lista'
  )
}

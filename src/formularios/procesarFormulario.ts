import type { PDFDocument, PDFForm } from 'pdf-lib'
import { abrirDocumentoDesdeArchivo, type ModuloPdfLib } from '../pdf/cargarDocumentoPdf'
import { interpretarColorConReserva, BLANCO, NEGRO } from '../pdf/colores'
import { ErrorPdf, envolverErrorPdf } from '../pdf/erroresPdf'
import { guardarComoResultado } from '../pdf/guardarDocumentoPdf'
import type { ResultadoDocumento } from '../pdf/tipos'
import { describirCampo } from './inspeccionarFormulario'
import { limpiarOpciones, validarValores } from './validarCamposFormulario'
import type {
  CampoNuevo,
  PeticionFormulario,
  ValorCampo,
} from './tipos'

/** Nombre predeterminado del documento resultante. */
export const NOMBRE_FORMULARIO = 'free-pdf-formulario.pdf'

/**
 * Genera el documento con los valores aplicados y los campos nuevos creados.
 *
 * El orden importa: primero se crean los campos nuevos y después se rellenan los
 * existentes, de modo que un campo nuevo con valor predeterminado quede con su
 * valor puesto y sus apariencias generadas.
 *
 * Sobre el aplanado: convierte las apariencias de los campos en contenido normal de
 * la página. El formulario deja de ser editable, y la fidelidad depende de que las
 * apariencias se hayan generado correctamente. pdf-lib las genera al establecer los
 * valores, así que se fuerza esa generación antes de aplanar.
 */
export async function procesarFormulario(
  peticion: PeticionFormulario,
): Promise<ResultadoDocumento> {
  try {
    return await ejecutar(peticion)
  } catch (error) {
    throw envolverErrorPdf(
      error,
      'No se pudo generar el formulario. El documento puede tener una estructura que no se admite.',
    )
  }
}

/** Realiza el procesamiento propiamente dicho. */
async function ejecutar(
  peticion: PeticionFormulario,
): Promise<ResultadoDocumento> {
  const { pdfLib, documento } = await abrirDocumentoDesdeArchivo(
    peticion.archivo,
  )
  const formulario = documento.getForm()

  // Se vuelve a describir el formulario sobre el documento recién abierto: los
  // valores se validan contra lo que hay de verdad en el archivo, no contra lo que
  // la interfaz recordaba.
  const campos = formulario
    .getFields()
    .map((campo) => describirCampo(pdfLib, documento, campo))

  const validacion = validarValores(campos, peticion.valores)
  if (!validacion.valida) {
    const primero = validacion.problemas[0]

    throw new ErrorPdf(
      `No se pudo rellenar «${primero.campo}»: ${primero.mensaje}`,
    )
  }

  for (const campoNuevo of peticion.camposNuevos) {
    crearCampo(pdfLib, documento, formulario, campoNuevo)
  }

  aplicarValores(pdfLib, formulario, peticion.valores)

  if (peticion.aplanar) {
    aplanar(formulario)
  }

  return await guardarComoResultado(documento, NOMBRE_FORMULARIO)
}

/** Aplica los valores a los campos existentes. */
export function aplicarValores(
  pdfLib: ModuloPdfLib,
  formulario: PDFForm,
  valores: ReadonlyMap<string, ValorCampo>,
): void {
  for (const [nombre, valor] of valores) {
    const campo = formulario.getFieldMaybe(nombre)

    if (campo === undefined || campo.isReadOnly()) {
      continue
    }

    try {
      aplicarValor(pdfLib, campo, valor)
    } catch (error) {
      throw new ErrorPdf(
        `No se pudo escribir el valor de «${nombre}». Comprueba que el valor sea admisible para ese campo.`,
        { cause: error },
      )
    }
  }
}

/** Aplica un único valor al campo que corresponda. */
function aplicarValor(
  pdfLib: ModuloPdfLib,
  campo: ReturnType<PDFForm['getFieldMaybe']> & object,
  valor: ValorCampo,
): void {
  if (valor.clase === 'texto' && campo instanceof pdfLib.PDFTextField) {
    campo.setText(valor.texto === '' ? undefined : valor.texto)
    return
  }

  if (valor.clase === 'casilla' && campo instanceof pdfLib.PDFCheckBox) {
    if (valor.marcada) {
      campo.check()
    } else {
      campo.uncheck()
    }
    return
  }

  if (valor.clase === 'opcion' && campo instanceof pdfLib.PDFRadioGroup) {
    if (valor.elegida === null) {
      campo.clear()
    } else {
      campo.select(valor.elegida)
    }
    return
  }

  if (valor.clase === 'seleccion') {
    if (campo instanceof pdfLib.PDFDropdown) {
      if (valor.elegidas.length === 0) {
        campo.clear()
      } else {
        campo.select([...valor.elegidas])
      }
      return
    }

    if (campo instanceof pdfLib.PDFOptionList) {
      if (valor.elegidas.length === 0) {
        campo.clear()
      } else {
        campo.select([...valor.elegidas])
      }
    }
  }
}

/**
 * Crea un campo nuevo y lo coloca en su página.
 *
 * Las coordenadas llegan en el sistema del PDF —origen en la esquina inferior
 * izquierda—, que es el que espera `addToPage`.
 */
export function crearCampo(
  pdfLib: ModuloPdfLib,
  documento: PDFDocument,
  formulario: PDFForm,
  definicion: CampoNuevo,
): void {
  const paginas = documento.getPages()
  const pagina = paginas[definicion.pagina - 1]

  if (pagina === undefined) {
    throw new ErrorPdf(
      `No se pudo crear «${definicion.nombre}»: la página ${definicion.pagina} no existe.`,
    )
  }

  if (formulario.getFieldMaybe(definicion.nombre) !== undefined) {
    throw new ErrorPdf(
      `Ya existe un campo llamado «${definicion.nombre}» en el documento. Elige otro nombre.`,
    )
  }

  const apariencia = construirApariencia(pdfLib, definicion)

  try {
    switch (definicion.clase) {
      case 'texto':
      case 'texto-multilinea': {
        const campo = formulario.createTextField(definicion.nombre)

        if (definicion.clase === 'texto-multilinea') {
          campo.enableMultiline()
        }

        if (definicion.valorPredeterminado !== '') {
          campo.setText(definicion.valorPredeterminado)
        }

        aplicarBanderas(campo, definicion)

        // El tamaño de la tipografía se fija DESPUÉS de colocar el campo: hasta
        // que existe el widget no hay apariencia predeterminada donde escribirlo,
        // y pdf-lib rechaza la operación.
        campo.addToPage(pagina, apariencia)
        campo.setFontSize(definicion.tamanoFuente)
        return
      }

      case 'casilla': {
        const campo = formulario.createCheckBox(definicion.nombre)

        aplicarBanderas(campo, definicion)
        campo.addToPage(pagina, apariencia)

        // Marcarla después de colocarla garantiza que el widget ya existe.
        if (esValorAfirmativo(definicion.valorPredeterminado)) {
          campo.check()
        }
        return
      }

      case 'opcion': {
        const campo = formulario.createRadioGroup(definicion.nombre)
        const opciones = limpiarOpciones(definicion.opciones)

        aplicarBanderas(campo, definicion)

        // Cada opción es un widget propio, apilado en vertical bajo el rectángulo.
        opciones.forEach((opcion, indice) => {
          campo.addOptionToPage(opcion, pagina, {
            ...apariencia,
            y: definicion.rectangulo.y - indice * (definicion.rectangulo.alto + 4),
            width: definicion.rectangulo.alto,
            height: definicion.rectangulo.alto,
          })
        })

        if (opciones.includes(definicion.valorPredeterminado.trim())) {
          campo.select(definicion.valorPredeterminado.trim())
        }
        return
      }

      case 'desplegable': {
        const campo = formulario.createDropdown(definicion.nombre)

        campo.setOptions([...limpiarOpciones(definicion.opciones)])
        aplicarBanderas(campo, definicion)

        if (definicion.valorPredeterminado !== '') {
          campo.select(definicion.valorPredeterminado.trim())
        }

        campo.addToPage(pagina, apariencia)
        campo.setFontSize(definicion.tamanoFuente)
        return
      }

      case 'lista': {
        const campo = formulario.createOptionList(definicion.nombre)

        campo.setOptions([...limpiarOpciones(definicion.opciones)])
        aplicarBanderas(campo, definicion)

        if (definicion.valorPredeterminado !== '') {
          campo.select(definicion.valorPredeterminado.trim())
        }

        campo.addToPage(pagina, apariencia)
        campo.setFontSize(definicion.tamanoFuente)
        return
      }
    }
  } catch (error) {
    if (error instanceof ErrorPdf) {
      throw error
    }

    throw new ErrorPdf(
      `No se pudo crear el campo «${definicion.nombre}». Comprueba su posición y sus opciones.`,
      { cause: error },
    )
  }
}

/** Construye las opciones de apariencia que espera `addToPage`. */
function construirApariencia(
  pdfLib: ModuloPdfLib,
  definicion: CampoNuevo,
): {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly textColor: ReturnType<ModuloPdfLib['rgb']>
  readonly borderColor: ReturnType<ModuloPdfLib['rgb']>
  readonly backgroundColor: ReturnType<ModuloPdfLib['rgb']>
  readonly borderWidth: number
} {
  const texto = interpretarColorConReserva(definicion.colorTexto, NEGRO)
  const borde = interpretarColorConReserva(definicion.colorBorde, NEGRO)
  const fondo = interpretarColorConReserva(definicion.colorFondo, BLANCO)

  return {
    x: definicion.rectangulo.x,
    y: definicion.rectangulo.y,
    width: definicion.rectangulo.ancho,
    height: definicion.rectangulo.alto,
    textColor: pdfLib.rgb(texto.rojo, texto.verde, texto.azul),
    borderColor: pdfLib.rgb(borde.rojo, borde.verde, borde.azul),
    backgroundColor: pdfLib.rgb(fondo.rojo, fondo.verde, fondo.azul),
    borderWidth: Math.max(0, definicion.grosorBorde),
  }
}

/** Campo con las banderas comunes que se pueden activar. */
interface CampoConBanderas {
  readonly enableReadOnly: () => void
  readonly enableRequired: () => void
}

/** Aplica las banderas de solo lectura y obligatorio. */
function aplicarBanderas(
  campo: CampoConBanderas,
  definicion: CampoNuevo,
): void {
  if (definicion.soloLectura) {
    campo.enableReadOnly()
  }

  if (definicion.obligatorio) {
    campo.enableRequired()
  }
}

/** `true` cuando el valor predeterminado de una casilla significa «marcada». */
export function esValorAfirmativo(valor: string): boolean {
  const limpio = valor.trim().toLowerCase()

  return (
    limpio === 'sí' ||
    limpio === 'si' ||
    limpio === 'true' ||
    limpio === '1' ||
    limpio === 'marcada'
  )
}

/**
 * Convierte las apariencias de los campos en contenido no editable.
 *
 * Se generan las apariencias antes de aplanar: si un campo no tuviera apariencia,
 * al aplanarlo desaparecería su contenido visible.
 */
export function aplanar(formulario: PDFForm): void {
  try {
    formulario.updateFieldAppearances()
  } catch {
    // Si pdf-lib no puede regenerar alguna apariencia se sigue adelante: aplanar
    // con las que existan es mejor que no aplanar.
  }

  try {
    formulario.flatten()
  } catch (error) {
    throw new ErrorPdf(
      'No se pudo aplanar el formulario. Prueba a guardarlo manteniéndolo editable.',
      { cause: error },
    )
  }
}

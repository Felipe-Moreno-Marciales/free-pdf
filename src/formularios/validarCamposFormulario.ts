import { esColorValido } from '../pdf/colores'
import { validarNombreCampo } from './nombresCampos'
import type {
  CampoDetectado,
  CampoNuevo,
  ProblemaFormulario,
  ValidacionFormulario,
  ValorCampo,
} from './tipos'

/**
 * Validación de los valores y de los campos nuevos.
 *
 * Todo es puro, así que se puede comprobar por separado. La validación ocurre
 * antes de tocar el documento: es preferible explicar qué está mal que generar un
 * formulario incoherente.
 */

/** Tamaño mínimo admitido de un campo, en puntos. */
export const MEDIDA_MINIMA_CAMPO = 8

/** Tamaño mínimo de la tipografía de un campo, en puntos. */
export const TAMANO_FUENTE_MINIMO = 4

/** Tamaño máximo de la tipografía de un campo, en puntos. */
export const TAMANO_FUENTE_MAXIMO = 72

/** Validación sin problemas. */
const SIN_PROBLEMAS: ValidacionFormulario = { valida: true, problemas: [] }

/** Construye el resultado a partir de los problemas encontrados. */
function construir(
  problemas: readonly ProblemaFormulario[],
): ValidacionFormulario {
  return problemas.length === 0 ? SIN_PROBLEMAS : { valida: false, problemas }
}

/**
 * Comprueba los valores que se van a escribir en los campos existentes.
 *
 * Se validan tres cosas: que el campo admita el valor que se le da, que respete la
 * longitud máxima que el propio documento declara y que las opciones elegidas
 * existan de verdad. Un campo de solo lectura no se puede rellenar.
 */
export function validarValores(
  campos: readonly CampoDetectado[],
  valores: ReadonlyMap<string, ValorCampo>,
): ValidacionFormulario {
  const problemas: ProblemaFormulario[] = []
  const porNombre = new Map(campos.map((campo) => [campo.nombre, campo]))

  for (const [nombre, valor] of valores) {
    const campo = porNombre.get(nombre)

    if (campo === undefined) {
      problemas.push({
        campo: nombre,
        mensaje: 'El campo ya no existe en el documento.',
      })
      continue
    }

    if (campo.soloLectura) {
      problemas.push({
        campo: nombre,
        mensaje: 'El campo es de solo lectura y no se puede rellenar.',
      })
      continue
    }

    problemas.push(...validarValorDeCampo(campo, valor))
  }

  return construir(problemas)
}

/** Comprueba un único valor contra su campo. */
function validarValorDeCampo(
  campo: CampoDetectado,
  valor: ValorCampo,
): readonly ProblemaFormulario[] {
  const problemas: ProblemaFormulario[] = []

  if (valor.clase === 'texto') {
    if (campo.clase !== 'texto' && campo.clase !== 'texto-multilinea') {
      return [
        { campo: campo.nombre, mensaje: 'Este campo no admite texto libre.' },
      ]
    }

    if (
      campo.longitudMaxima !== null &&
      valor.texto.length > campo.longitudMaxima
    ) {
      problemas.push({
        campo: campo.nombre,
        mensaje: `El texto supera la longitud máxima del campo, que es de ${campo.longitudMaxima} caracteres.`,
      })
    }

    if (campo.clase === 'texto' && valor.texto.includes('\n')) {
      problemas.push({
        campo: campo.nombre,
        mensaje: 'El campo es de una sola línea, así que no admite saltos de línea.',
      })
    }

    return problemas
  }

  if (valor.clase === 'casilla') {
    return campo.clase === 'casilla'
      ? []
      : [
          {
            campo: campo.nombre,
            mensaje: 'Este campo no es una casilla de verificación.',
          },
        ]
  }

  if (valor.clase === 'opcion') {
    if (campo.clase !== 'opcion') {
      return [
        {
          campo: campo.nombre,
          mensaje: 'Este campo no es un grupo de botones de opción.',
        },
      ]
    }

    if (valor.elegida !== null && !campo.opciones.includes(valor.elegida)) {
      problemas.push({
        campo: campo.nombre,
        mensaje: `«${valor.elegida}» no es una de las opciones del campo.`,
      })
    }

    return problemas
  }

  // Selección múltiple: desplegables y listas.
  if (campo.clase !== 'desplegable' && campo.clase !== 'lista') {
    return [
      {
        campo: campo.nombre,
        mensaje: 'Este campo no admite elegir entre una lista de opciones.',
      },
    ]
  }

  for (const elegida of valor.elegidas) {
    if (!campo.opciones.includes(elegida)) {
      problemas.push({
        campo: campo.nombre,
        mensaje: `«${elegida}» no es una de las opciones del campo.`,
      })
    }
  }

  if (valor.elegidas.length > 1 && !campo.multiseleccion) {
    problemas.push({
      campo: campo.nombre,
      mensaje: 'El campo solo admite elegir una opción.',
    })
  }

  return problemas
}

/**
 * Comprueba que los campos obligatorios tengan valor.
 *
 * Se separa de la validación de valores porque no impide generar el documento:
 * dejar un campo obligatorio vacío es una decisión legítima de quien rellena, y lo
 * que corresponde es avisar, no bloquear.
 */
export function comprobarObligatorios(
  campos: readonly CampoDetectado[],
  valores: ReadonlyMap<string, ValorCampo>,
): readonly ProblemaFormulario[] {
  const problemas: ProblemaFormulario[] = []

  for (const campo of campos) {
    if (!campo.obligatorio || campo.soloLectura) {
      continue
    }

    const valor = valores.get(campo.nombre) ?? campo.valor

    if (estaVacio(valor)) {
      problemas.push({
        campo: campo.nombre,
        mensaje: 'El documento marca este campo como obligatorio y está vacío.',
      })
    }
  }

  return problemas
}

/** `true` cuando un valor se considera vacío. */
export function estaVacio(valor: ValorCampo): boolean {
  switch (valor.clase) {
    case 'texto':
      return valor.texto.trim() === ''
    case 'casilla':
      return !valor.marcada
    case 'opcion':
      return valor.elegida === null
    case 'seleccion':
      return valor.elegidas.length === 0
  }
}

/**
 * Comprueba los campos que se van a crear.
 *
 * Se validan el nombre, la página, el rectángulo, los colores y las opciones. Los
 * nombres se comprueban de forma acumulativa: cada campo nuevo pasa a estar
 * ocupado para los siguientes.
 */
export function validarCamposNuevos(
  camposNuevos: readonly CampoNuevo[],
  nombresExistentes: readonly string[],
  numeroPaginas: number,
): ValidacionFormulario {
  const problemas: ProblemaFormulario[] = []
  const ocupados = new Set(nombresExistentes)

  for (const campo of camposNuevos) {
    const validacionNombre = validarNombreCampo(campo.nombre, ocupados)

    if (!validacionNombre.valido) {
      problemas.push({
        campo: campo.nombre === '' ? '(sin nombre)' : campo.nombre,
        mensaje: validacionNombre.mensaje ?? 'El nombre no es válido.',
      })
    } else {
      ocupados.add(campo.nombre.trim())
    }

    if (
      !Number.isInteger(campo.pagina) ||
      campo.pagina < 1 ||
      campo.pagina > numeroPaginas
    ) {
      problemas.push({
        campo: campo.nombre,
        mensaje: `La página ${campo.pagina} no existe: el documento tiene ${numeroPaginas}.`,
      })
    }

    problemas.push(...validarRectangulo(campo))

    if (
      !Number.isFinite(campo.tamanoFuente) ||
      campo.tamanoFuente < TAMANO_FUENTE_MINIMO ||
      campo.tamanoFuente > TAMANO_FUENTE_MAXIMO
    ) {
      problemas.push({
        campo: campo.nombre,
        mensaje: `El tamaño de la tipografía debe estar entre ${TAMANO_FUENTE_MINIMO} y ${TAMANO_FUENTE_MAXIMO} puntos.`,
      })
    }

    for (const [etiqueta, color] of [
      ['del texto', campo.colorTexto],
      ['del borde', campo.colorBorde],
      ['de fondo', campo.colorFondo],
    ] as const) {
      if (!esColorValido(color)) {
        problemas.push({
          campo: campo.nombre,
          mensaje: `El color ${etiqueta} no es un color hexadecimal válido.`,
        })
      }
    }

    problemas.push(...validarOpciones(campo))
  }

  return construir(problemas)
}

/** Comprueba la posición y el tamaño de un campo nuevo. */
function validarRectangulo(campo: CampoNuevo): readonly ProblemaFormulario[] {
  const { x, y, ancho, alto } = campo.rectangulo
  const problemas: ProblemaFormulario[] = []

  for (const [etiqueta, valor] of [
    ['la posición horizontal', x],
    ['la posición vertical', y],
  ] as const) {
    if (!Number.isFinite(valor) || valor < 0) {
      problemas.push({
        campo: campo.nombre,
        mensaje: `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} no puede ser negativa.`,
      })
    }
  }

  for (const [etiqueta, valor] of [
    ['ancho', ancho],
    ['alto', alto],
  ] as const) {
    if (!Number.isFinite(valor) || valor < MEDIDA_MINIMA_CAMPO) {
      problemas.push({
        campo: campo.nombre,
        mensaje: `El ${etiqueta} debe ser de al menos ${MEDIDA_MINIMA_CAMPO} puntos.`,
      })
    }
  }

  return problemas
}

/** Comprueba las opciones de los campos de elección. */
function validarOpciones(campo: CampoNuevo): readonly ProblemaFormulario[] {
  const necesitaOpciones =
    campo.clase === 'opcion' ||
    campo.clase === 'desplegable' ||
    campo.clase === 'lista'

  if (!necesitaOpciones) {
    return []
  }

  const limpias = campo.opciones
    .map((opcion) => opcion.trim())
    .filter((opcion) => opcion !== '')

  if (limpias.length < 2) {
    return [
      {
        campo: campo.nombre,
        mensaje: 'Escribe al menos dos opciones, una por línea.',
      },
    ]
  }

  if (new Set(limpias).size !== limpias.length) {
    return [
      { campo: campo.nombre, mensaje: 'Hay opciones repetidas.' },
    ]
  }

  if (
    campo.valorPredeterminado !== '' &&
    !limpias.includes(campo.valorPredeterminado.trim())
  ) {
    return [
      {
        campo: campo.nombre,
        mensaje: 'El valor predeterminado debe ser una de las opciones.',
      },
    ]
  }

  return []
}

/** Limpia y deduplica la lista de opciones de un campo. */
export function limpiarOpciones(
  opciones: readonly string[],
): readonly string[] {
  const limpias = opciones
    .map((opcion) => opcion.trim())
    .filter((opcion) => opcion !== '')

  return [...new Set(limpias)]
}

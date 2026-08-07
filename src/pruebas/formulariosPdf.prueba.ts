import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  describirClase,
  esRellenable,
  inspeccionarFormulario,
} from '../formularios/inspeccionarFormulario'
import {
  normalizarNombreCampo,
  proponerNombreCampo,
  reunirNombresOcupados,
  validarNombreCampo,
} from '../formularios/nombresCampos'
import {
  esValorAfirmativo,
  NOMBRE_FORMULARIO,
  procesarFormulario,
} from '../formularios/procesarFormulario'
import {
  comprobarObligatorios,
  estaVacio,
  limpiarOpciones,
  MEDIDA_MINIMA_CAMPO,
  validarCamposNuevos,
  validarValores,
} from '../formularios/validarCamposFormulario'
import type {
  CampoDetectado,
  CampoNuevo,
  ValorCampo,
} from '../formularios/tipos'
import { ErrorPdf } from '../pdf/erroresPdf'
import { bytesDeBlob } from './ayudas/crearPdfPrueba'
import {
  crearArchivoFormulario,
  crearArchivoSinFormulario,
  NOMBRES_PRUEBA,
  OPCIONES_PAGO,
  OPCIONES_PROVINCIA,
} from './ayudas/crearFormularioPrueba'

/** Campo nuevo de referencia, con valores válidos. */
const CAMPO_BASE: CampoNuevo = {
  id: '1',
  nombre: 'campo-nuevo',
  clase: 'texto',
  pagina: 1,
  rectangulo: { x: 20, y: 100, ancho: 180, alto: 20 },
  valorPredeterminado: '',
  opciones: [],
  textoAyuda: '',
  soloLectura: false,
  obligatorio: false,
  tamanoFuente: 11,
  colorTexto: '#000000',
  colorBorde: '#333333',
  colorFondo: '#ffffff',
  grosorBorde: 1,
}

/** Construye un campo nuevo partiendo del de referencia. */
function nuevo(cambios: Partial<CampoNuevo> = {}): CampoNuevo {
  return { ...CAMPO_BASE, ...cambios }
}

/** Abre el resultado con pdf-lib para inspeccionarlo. */
async function abrirResultado(blob: Blob): Promise<PDFDocument> {
  return await PDFDocument.load(await bytesDeBlob(blob))
}

describe('nombresCampos', () => {
  it('acepta un nombre sencillo', () => {
    expect(validarNombreCampo('nombre', new Set()).valido).toBe(true)
  })

  it('rechaza un nombre vacío', () => {
    expect(validarNombreCampo('   ', new Set()).valido).toBe(false)
  })

  it('rechaza los espacios', () => {
    const resultado = validarNombreCampo('mi campo', new Set())

    expect(resultado.valido).toBe(false)
    expect(resultado.mensaje).toContain('espacio')
  })

  it('rechaza el punto, que en PDF separa niveles de nombre', () => {
    expect(validarNombreCampo('grupo.campo', new Set()).valido).toBe(false)
  })

  it('rechaza los caracteres delimitadores del formato', () => {
    for (const nombre of ['a[b', 'a]b', 'a(b', 'a/b', 'a<b']) {
      expect(validarNombreCampo(nombre, new Set()).valido).toBe(false)
    }
  })

  it('rechaza un nombre ya ocupado y lo explica', () => {
    const resultado = validarNombreCampo('nombre', new Set(['nombre']))

    expect(resultado.valido).toBe(false)
    expect(resultado.mensaje).toContain('Ya existe')
    expect(resultado.mensaje).toContain('uno solo')
  })

  it('propone el nombre tal cual si está libre', () => {
    expect(proponerNombreCampo('telefono', new Set())).toBe('telefono')
  })

  it('propone un sufijo numérico cuando está ocupado', () => {
    expect(proponerNombreCampo('campo', new Set(['campo']))).toBe('campo-2')
    expect(
      proponerNombreCampo('campo', new Set(['campo', 'campo-2'])),
    ).toBe('campo-3')
  })

  it('normaliza los acentos y los espacios', () => {
    expect(normalizarNombreCampo('Año de nacimiento')).toBe(
      'Ano-de-nacimiento',
    )
  })

  it('recurre a «campo» cuando no queda nada aprovechable', () => {
    expect(normalizarNombreCampo('///')).toBe('campo')
  })

  it('reúne los nombres existentes y los nuevos', () => {
    const ocupados = reunirNombresOcupados(['a', 'b'], ['c'])

    expect(ocupados.has('a')).toBe(true)
    expect(ocupados.has('c')).toBe(true)
    expect(ocupados.size).toBe(3)
  })
})

describe('inspeccionarFormulario', () => {
  it('detecta todos los campos del formulario', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario(),
    )
    const nombres = inspeccion.campos.map((campo) => campo.nombre)

    expect(nombres).toContain(NOMBRES_PRUEBA.texto)
    expect(nombres).toContain(NOMBRES_PRUEBA.multilinea)
    expect(nombres).toContain(NOMBRES_PRUEBA.casilla)
    expect(nombres).toContain(NOMBRES_PRUEBA.opciones)
    expect(nombres).toContain(NOMBRES_PRUEBA.desplegable)
    expect(nombres).toContain(NOMBRES_PRUEBA.lista)
  })

  it('deduce la clase de cada campo', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario(),
    )
    const porNombre = new Map(
      inspeccion.campos.map((campo) => [campo.nombre, campo]),
    )

    expect(porNombre.get(NOMBRES_PRUEBA.texto)?.clase).toBe('texto')
    expect(porNombre.get(NOMBRES_PRUEBA.multilinea)?.clase).toBe(
      'texto-multilinea',
    )
    expect(porNombre.get(NOMBRES_PRUEBA.casilla)?.clase).toBe('casilla')
    expect(porNombre.get(NOMBRES_PRUEBA.opciones)?.clase).toBe('opcion')
    expect(porNombre.get(NOMBRES_PRUEBA.desplegable)?.clase).toBe(
      'desplegable',
    )
    expect(porNombre.get(NOMBRES_PRUEBA.lista)?.clase).toBe('lista')
  })

  it('lee el valor actual de un campo de texto', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario(),
    )
    const campo = inspeccion.campos.find(
      (candidato) => candidato.nombre === NOMBRES_PRUEBA.texto,
    )

    expect(campo?.valor).toEqual({ clase: 'texto', texto: 'Valor inicial' })
  })

  it('lee las opciones de los campos de elección', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario(),
    )
    const porNombre = new Map(
      inspeccion.campos.map((campo) => [campo.nombre, campo]),
    )

    expect(porNombre.get(NOMBRES_PRUEBA.opciones)?.opciones).toEqual(
      OPCIONES_PAGO,
    )
    expect(porNombre.get(NOMBRES_PRUEBA.desplegable)?.opciones).toEqual(
      OPCIONES_PROVINCIA,
    )
  })

  it('deduce la página de los campos', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario('f.pdf', { numeroPaginas: 3 }),
    )

    for (const campo of inspeccion.campos) {
      expect(campo.pagina).toBe(1)
    }
  })

  it('detecta el estado de solo lectura', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario('f.pdf', { textoSoloLectura: true }),
    )
    const campo = inspeccion.campos.find(
      (candidato) => candidato.nombre === NOMBRES_PRUEBA.texto,
    )

    expect(campo?.soloLectura).toBe(true)
  })

  it('detecta los campos obligatorios', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario('f.pdf', { textoObligatorio: true }),
    )
    const campo = inspeccion.campos.find(
      (candidato) => candidato.nombre === NOMBRES_PRUEBA.texto,
    )

    expect(campo?.obligatorio).toBe(true)
  })

  it('lee la longitud máxima declarada', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario('f.pdf', { longitudMaxima: 10 }),
    )
    const campo = inspeccion.campos.find(
      (candidato) => candidato.nombre === NOMBRES_PRUEBA.texto,
    )

    expect(campo?.longitudMaxima).toBe(10)
  })

  it('nunca lee el valor de un campo de contraseña', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoFormulario('f.pdf', { conContrasena: true }),
    )
    const campo = inspeccion.campos.find(
      (candidato) => candidato.nombre === NOMBRES_PRUEBA.contrasena,
    )

    expect(campo?.esContrasena).toBe(true)
    expect(campo?.valor).toEqual({ clase: 'texto', texto: '' })
  })

  it('informa de un documento sin campos', async () => {
    const { inspeccion } = await inspeccionarFormulario(
      await crearArchivoSinFormulario(),
    )

    expect(inspeccion.campos).toHaveLength(0)
    expect(inspeccion.numeroPaginas).toBe(2)
  })

  it('nombra las clases en español', () => {
    expect(describirClase('texto')).toBe('Texto')
    expect(describirClase('casilla')).toBe('Casilla de verificación')
    expect(describirClase('no-compatible')).toBe('Tipo no compatible')
  })

  it('distingue las clases rellenables de las que no lo son', () => {
    expect(esRellenable('texto')).toBe(true)
    expect(esRellenable('lista')).toBe(true)
    expect(esRellenable('boton')).toBe(false)
    expect(esRellenable('firma')).toBe(false)
    expect(esRellenable('no-compatible')).toBe(false)
  })
})

describe('validarValores', () => {
  /** Campo de texto de referencia. */
  const campoTexto: CampoDetectado = {
    nombre: 'texto',
    clase: 'texto',
    pagina: 1,
    soloLectura: false,
    obligatorio: false,
    valor: { clase: 'texto', texto: '' },
    opciones: [],
    longitudMaxima: null,
    multilinea: false,
    multiseleccion: false,
    esContrasena: false,
  }

  it('acepta un texto correcto', () => {
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'texto', texto: 'hola' }],
    ])

    expect(validarValores([campoTexto], valores).valida).toBe(true)
  })

  it('rechaza un campo que no existe', () => {
    const valores = new Map<string, ValorCampo>([
      ['inventado', { clase: 'texto', texto: 'x' }],
    ])
    const resultado = validarValores([campoTexto], valores)

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('ya no existe')
  })

  it('rechaza rellenar un campo de solo lectura', () => {
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'texto', texto: 'x' }],
    ])
    const resultado = validarValores(
      [{ ...campoTexto, soloLectura: true }],
      valores,
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('solo lectura')
  })

  it('rechaza superar la longitud máxima', () => {
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'texto', texto: 'demasiado largo' }],
    ])
    const resultado = validarValores(
      [{ ...campoTexto, longitudMaxima: 5 }],
      valores,
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('longitud máxima')
  })

  it('rechaza saltos de línea en un campo de una sola línea', () => {
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'texto', texto: 'a\nb' }],
    ])

    expect(validarValores([campoTexto], valores).valida).toBe(false)
  })

  it('acepta saltos de línea en un campo multilínea', () => {
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'texto', texto: 'a\nb' }],
    ])

    expect(
      validarValores(
        [{ ...campoTexto, clase: 'texto-multilinea', multilinea: true }],
        valores,
      ).valida,
    ).toBe(true)
  })

  it('rechaza un valor de clase incompatible', () => {
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'casilla', marcada: true }],
    ])

    expect(validarValores([campoTexto], valores).valida).toBe(false)
  })

  it('rechaza una opción que no existe', () => {
    const campo: CampoDetectado = {
      ...campoTexto,
      clase: 'opcion',
      opciones: ['A', 'B'],
      valor: { clase: 'opcion', elegida: null },
    }
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'opcion', elegida: 'C' }],
    ])
    const resultado = validarValores([campo], valores)

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('«C»')
  })

  it('rechaza elegir varias opciones en un campo de selección única', () => {
    const campo: CampoDetectado = {
      ...campoTexto,
      clase: 'desplegable',
      opciones: ['A', 'B'],
      multiseleccion: false,
      valor: { clase: 'seleccion', elegidas: [] },
    }
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'seleccion', elegidas: ['A', 'B'] }],
    ])

    expect(validarValores([campo], valores).valida).toBe(false)
  })

  it('acepta varias opciones cuando el campo lo permite', () => {
    const campo: CampoDetectado = {
      ...campoTexto,
      clase: 'lista',
      opciones: ['A', 'B'],
      multiseleccion: true,
      valor: { clase: 'seleccion', elegidas: [] },
    }
    const valores = new Map<string, ValorCampo>([
      ['texto', { clase: 'seleccion', elegidas: ['A', 'B'] }],
    ])

    expect(validarValores([campo], valores).valida).toBe(true)
  })

  it('comprueba los obligatorios sin bloquear', () => {
    const campo: CampoDetectado = { ...campoTexto, obligatorio: true }
    const problemas = comprobarObligatorios(
      [campo],
      new Map<string, ValorCampo>([
        ['texto', { clase: 'texto', texto: '   ' }],
      ]),
    )

    expect(problemas).toHaveLength(1)
    expect(problemas[0].mensaje).toContain('obligatorio')
  })

  it('no avisa de un obligatorio que sí tiene valor', () => {
    const campo: CampoDetectado = { ...campoTexto, obligatorio: true }

    expect(
      comprobarObligatorios(
        [campo],
        new Map<string, ValorCampo>([
          ['texto', { clase: 'texto', texto: 'algo' }],
        ]),
      ),
    ).toHaveLength(0)
  })

  it('detecta los valores vacíos de cada clase', () => {
    expect(estaVacio({ clase: 'texto', texto: '  ' })).toBe(true)
    expect(estaVacio({ clase: 'casilla', marcada: false })).toBe(true)
    expect(estaVacio({ clase: 'opcion', elegida: null })).toBe(true)
    expect(estaVacio({ clase: 'seleccion', elegidas: [] })).toBe(true)
    expect(estaVacio({ clase: 'texto', texto: 'x' })).toBe(false)
  })
})

describe('validarCamposNuevos', () => {
  it('acepta un campo bien definido', () => {
    expect(validarCamposNuevos([nuevo()], [], 1).valida).toBe(true)
  })

  it('rechaza un nombre que choca con uno existente', () => {
    const resultado = validarCamposNuevos([nuevo()], ['campo-nuevo'], 1)

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('Ya existe')
  })

  it('rechaza dos campos nuevos con el mismo nombre', () => {
    const resultado = validarCamposNuevos([nuevo(), nuevo()], [], 1)

    expect(resultado.valida).toBe(false)
  })

  it('rechaza una página que no existe', () => {
    const resultado = validarCamposNuevos([nuevo({ pagina: 5 })], [], 2)

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('no existe')
  })

  it('rechaza un tamaño demasiado pequeño', () => {
    const resultado = validarCamposNuevos(
      [nuevo({ rectangulo: { x: 0, y: 0, ancho: 2, alto: 2 } })],
      [],
      1,
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain(
      String(MEDIDA_MINIMA_CAMPO),
    )
  })

  it('rechaza una posición negativa', () => {
    const resultado = validarCamposNuevos(
      [nuevo({ rectangulo: { x: -5, y: 10, ancho: 100, alto: 20 } })],
      [],
      1,
    )

    expect(resultado.valida).toBe(false)
  })

  it('rechaza un color inválido', () => {
    const resultado = validarCamposNuevos(
      [nuevo({ colorTexto: 'azulado' })],
      [],
      1,
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('hexadecimal')
  })

  it('rechaza un tamaño de tipografía fuera de rango', () => {
    expect(validarCamposNuevos([nuevo({ tamanoFuente: 0 })], [], 1).valida).toBe(
      false,
    )
    expect(
      validarCamposNuevos([nuevo({ tamanoFuente: 500 })], [], 1).valida,
    ).toBe(false)
  })

  it('exige al menos dos opciones en un campo de elección', () => {
    const resultado = validarCamposNuevos(
      [nuevo({ clase: 'desplegable', opciones: ['Solo una'] })],
      [],
      1,
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('dos opciones')
  })

  it('rechaza opciones repetidas', () => {
    const resultado = validarCamposNuevos(
      [nuevo({ clase: 'lista', opciones: ['A', 'A'] })],
      [],
      1,
    )

    expect(resultado.valida).toBe(false)
    expect(resultado.problemas[0].mensaje).toContain('repetidas')
  })

  it('exige que el valor predeterminado sea una de las opciones', () => {
    const resultado = validarCamposNuevos(
      [
        nuevo({
          clase: 'desplegable',
          opciones: ['A', 'B'],
          valorPredeterminado: 'C',
        }),
      ],
      [],
      1,
    )

    expect(resultado.valida).toBe(false)
  })

  it('acepta un campo de elección bien definido', () => {
    expect(
      validarCamposNuevos(
        [
          nuevo({
            clase: 'desplegable',
            opciones: ['A', 'B'],
            valorPredeterminado: 'A',
          }),
        ],
        [],
        1,
      ).valida,
    ).toBe(true)
  })

  it('limpia y deduplica las opciones', () => {
    expect(limpiarOpciones([' A ', 'B', '', 'A', '  '])).toEqual(['A', 'B'])
  })
})

describe('procesarFormulario: rellenar', () => {
  it('genera un documento válido con el nombre esperado', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map(),
      camposNuevos: [],
      aplanar: false,
    })

    expect(resultado.nombreArchivo).toBe(NOMBRE_FORMULARIO)
    expect(resultado.nombreArchivo).toBe('free-pdf-formulario.pdf')
    expect(resultado.blob.type).toBe('application/pdf')
  })

  it('escribe el texto en un campo de texto', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map<string, ValorCampo>([
        [NOMBRES_PRUEBA.texto, { clase: 'texto', texto: 'Ana Pérez' }],
      ]),
      camposNuevos: [],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(
      documento.getForm().getTextField(NOMBRES_PRUEBA.texto).getText(),
    ).toBe('Ana Pérez')
  })

  it('marca y desmarca una casilla', async () => {
    const marcado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map<string, ValorCampo>([
        [NOMBRES_PRUEBA.casilla, { clase: 'casilla', marcada: true }],
      ]),
      camposNuevos: [],
      aplanar: false,
    })

    const documento = await abrirResultado(marcado.blob)

    expect(
      documento.getForm().getCheckBox(NOMBRES_PRUEBA.casilla).isChecked(),
    ).toBe(true)
  })

  it('elige un botón de opción', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map<string, ValorCampo>([
        [NOMBRES_PRUEBA.opciones, { clase: 'opcion', elegida: 'Transferencia' }],
      ]),
      camposNuevos: [],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(
      documento.getForm().getRadioGroup(NOMBRES_PRUEBA.opciones).getSelected(),
    ).toBe('Transferencia')
  })

  it('elige una opción de la lista desplegable', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map<string, ValorCampo>([
        [
          NOMBRES_PRUEBA.desplegable,
          { clase: 'seleccion', elegidas: ['Granada'] },
        ],
      ]),
      camposNuevos: [],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(
      documento.getForm().getDropdown(NOMBRES_PRUEBA.desplegable).getSelected(),
    ).toEqual(['Granada'])
  })

  it('escribe varias líneas en un campo multilínea', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map<string, ValorCampo>([
        [NOMBRES_PRUEBA.multilinea, { clase: 'texto', texto: 'linea 1\nlinea 2' }],
      ]),
      camposNuevos: [],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(
      documento.getForm().getTextField(NOMBRES_PRUEBA.multilinea).getText(),
    ).toContain('linea 2')
  })

  it('conserva el número de páginas', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario('f.pdf', { numeroPaginas: 3 }),
      valores: new Map(),
      camposNuevos: [],
      aplanar: false,
    })

    expect((await abrirResultado(resultado.blob)).getPageCount()).toBe(3)
  })

  it('rechaza un valor que supera la longitud máxima', async () => {
    await expect(
      procesarFormulario({
        archivo: await crearArchivoFormulario('f.pdf', { longitudMaxima: 4 }),
        valores: new Map<string, ValorCampo>([
          [NOMBRES_PRUEBA.texto, { clase: 'texto', texto: 'demasiado' }],
        ]),
        camposNuevos: [],
        aplanar: false,
      }),
    ).rejects.toThrow(ErrorPdf)
  })

  it('no modifica un campo de solo lectura', async () => {
    await expect(
      procesarFormulario({
        archivo: await crearArchivoFormulario('f.pdf', {
          textoSoloLectura: true,
        }),
        valores: new Map<string, ValorCampo>([
          [NOMBRES_PRUEBA.texto, { clase: 'texto', texto: 'intento' }],
        ]),
        camposNuevos: [],
        aplanar: false,
      }),
    ).rejects.toThrow(/solo lectura/)
  })

  it('el formulario sigue siendo editable si no se aplana', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map(),
      camposNuevos: [],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getFields().length).toBeGreaterThan(0)
  })
})

describe('procesarFormulario: crear campos', () => {
  it('crea un campo de texto', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [nuevo({ nombre: 'telefono' })],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getTextField('telefono')).toBeDefined()
  })

  it('crea un campo multilínea', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [
        nuevo({ nombre: 'comentario', clase: 'texto-multilinea' }),
      ],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(
      documento.getForm().getTextField('comentario').isMultiline(),
    ).toBe(true)
  })

  it('crea el campo con su valor predeterminado', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [
        nuevo({ nombre: 'ciudad', valorPredeterminado: 'Sevilla' }),
      ],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getTextField('ciudad').getText()).toBe('Sevilla')
  })

  it('crea una casilla', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [nuevo({ nombre: 'acepto', clase: 'casilla' })],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getCheckBox('acepto').isChecked()).toBe(false)
  })

  it('crea una casilla marcada cuando el valor lo indica', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [
        nuevo({ nombre: 'acepto', clase: 'casilla', valorPredeterminado: 'sí' }),
      ],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getCheckBox('acepto').isChecked()).toBe(true)
  })

  it('crea un grupo de botones de opción con sus opciones', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [
        nuevo({
          nombre: 'envio',
          clase: 'opcion',
          opciones: ['Domicilio', 'Recogida'],
        }),
      ],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getRadioGroup('envio').getOptions()).toEqual([
      'Domicilio',
      'Recogida',
    ])
  })

  it('crea una lista desplegable con su selección', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [
        nuevo({
          nombre: 'pais',
          clase: 'desplegable',
          opciones: ['España', 'Portugal'],
          valorPredeterminado: 'Portugal',
        }),
      ],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)
    const campo = documento.getForm().getDropdown('pais')

    expect(campo.getOptions()).toEqual(['España', 'Portugal'])
    expect(campo.getSelected()).toEqual(['Portugal'])
  })

  it('crea una lista de opciones', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [
        nuevo({ nombre: 'aficion', clase: 'lista', opciones: ['A', 'B'] }),
      ],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getOptionList('aficion').getOptions()).toEqual([
      'A',
      'B',
    ])
  })

  it('crea el campo como solo lectura cuando se pide', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [nuevo({ nombre: 'fijo', soloLectura: true })],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getTextField('fijo').isReadOnly()).toBe(true)
  })

  it('crea el campo como obligatorio cuando se pide', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [nuevo({ nombre: 'dni', obligatorio: true })],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getTextField('dni').isRequired()).toBe(true)
  })

  it('crea varios campos a la vez', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [
        nuevo({ id: '1', nombre: 'uno' }),
        nuevo({ id: '2', nombre: 'dos', pagina: 2 }),
      ],
      aplanar: false,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getFields()).toHaveLength(2)
  })

  it('rechaza crear un campo con un nombre que ya existe', async () => {
    await expect(
      procesarFormulario({
        archivo: await crearArchivoFormulario(),
        valores: new Map(),
        camposNuevos: [nuevo({ nombre: NOMBRES_PRUEBA.texto })],
        aplanar: false,
      }),
    ).rejects.toThrow(/Ya existe un campo/)
  })

  it('rechaza crear un campo en una página que no existe', async () => {
    await expect(
      procesarFormulario({
        archivo: await crearArchivoSinFormulario(),
        valores: new Map(),
        camposNuevos: [nuevo({ nombre: 'fuera', pagina: 9 })],
        aplanar: false,
      }),
    ).rejects.toThrow(/no existe/)
  })

  it('reconoce los valores afirmativos de una casilla', () => {
    for (const valor of ['sí', 'si', 'true', '1', 'Marcada', ' SÍ ']) {
      expect(esValorAfirmativo(valor)).toBe(true)
    }

    for (const valor of ['', 'no', 'false', '0']) {
      expect(esValorAfirmativo(valor)).toBe(false)
    }
  })
})

describe('procesarFormulario: aplanar', () => {
  it('el formulario deja de tener campos al aplanarlo', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map<string, ValorCampo>([
        [NOMBRES_PRUEBA.texto, { clase: 'texto', texto: 'Aplanado' }],
      ]),
      camposNuevos: [],
      aplanar: true,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getFields()).toHaveLength(0)
  })

  it('el documento aplanado conserva sus páginas', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario('f.pdf', { numeroPaginas: 2 }),
      valores: new Map(),
      camposNuevos: [],
      aplanar: true,
    })

    expect((await abrirResultado(resultado.blob)).getPageCount()).toBe(2)
  })

  it('los campos creados también se aplanan', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoSinFormulario(),
      valores: new Map(),
      camposNuevos: [
        nuevo({ nombre: 'nuevo', valorPredeterminado: 'contenido' }),
      ],
      aplanar: true,
    })

    const documento = await abrirResultado(resultado.blob)

    expect(documento.getForm().getFields()).toHaveLength(0)
  })

  it('el documento aplanado sigue siendo un PDF válido', async () => {
    const resultado = await procesarFormulario({
      archivo: await crearArchivoFormulario(),
      valores: new Map(),
      camposNuevos: [],
      aplanar: true,
    })

    await expect(abrirResultado(resultado.blob)).resolves.toBeDefined()
    expect(resultado.tamano).toBeGreaterThan(0)
  })
})

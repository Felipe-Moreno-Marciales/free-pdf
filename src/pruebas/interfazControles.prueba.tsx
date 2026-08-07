import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CampoNumero } from '../componentes/CampoNumero'
import { ControlDeslizante } from '../componentes/ControlDeslizante'
import {
  GrupoOpciones,
  type OpcionElegible,
} from '../componentes/GrupoOpciones'
import { SelectorColor } from '../componentes/SelectorColor'
import { SelectorPosicion } from '../componentes/SelectorPosicion'
import { SelectorRangoPaginas } from '../componentes/SelectorRangoPaginas'
import { POSICIONES_NUMERACION } from '../pdf/posicionarEnPagina'

/** Opciones de ejemplo para el grupo. */
const OPCIONES: readonly OpcionElegible<'a' | 'b' | 'c'>[] = [
  { valor: 'a', etiqueta: 'Primera' },
  { valor: 'b', etiqueta: 'Segunda', descripcion: 'Con aclaración' },
  { valor: 'c', etiqueta: 'Tercera' },
]

describe('GrupoOpciones', () => {
  it('agrupa las opciones bajo su título', () => {
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="a"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: /Tamaño/ })).toBeDefined()
  })

  it('usa campos de tipo radio, que el navegador agrupa por sí solo', () => {
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="a"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('marca la opción elegida', () => {
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="b"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByRole('radio', { name: /Segunda/ })).toHaveProperty(
      'checked',
      true,
    )
  })

  it('comunica la opción elegida al pulsarla', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="a"
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    await persona.click(screen.getByRole('radio', { name: /Tercera/ }))

    expect(alCambiar).toHaveBeenCalledWith('c')
  })

  it('se puede recorrer con las flechas del teclado', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="a"
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    screen.getByRole('radio', { name: /Primera/ }).focus()
    await persona.keyboard('{ArrowDown}')

    expect(alCambiar).toHaveBeenCalledWith('b')
  })

  it('deshabilita todas las opciones cuando corresponde', () => {
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="a"
        deshabilitado
        alCambiar={vi.fn()}
      />,
    )

    for (const opcion of screen.getAllByRole('radio')) {
      expect(opcion).toHaveProperty('disabled', true)
    }
  })

  it('no comunica ningún cambio estando deshabilitado', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="a"
        deshabilitado
        alCambiar={alCambiar}
      />,
    )

    await persona.click(screen.getByRole('radio', { name: /Tercera/ }))

    expect(alCambiar).not.toHaveBeenCalled()
  })

  it('muestra la aclaración de cada opción', () => {
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="a"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByText('Con aclaración')).toBeDefined()
  })

  it('asocia la ayuda del grupo con su descripción accesible', () => {
    render(
      <GrupoOpciones
        etiqueta="Tamaño"
        opciones={OPCIONES}
        valor="a"
        deshabilitado={false}
        alCambiar={vi.fn()}
        ayuda="Elige uno de los tres"
      />,
    )

    const grupo = screen.getByRole('group', { name: /Tamaño/ })

    expect(grupo.getAttribute('aria-describedby')).not.toBeNull()
    expect(screen.getByText('Elige uno de los tres')).toBeDefined()
  })
})

describe('CampoNumero', () => {
  it('asocia la etiqueta con el campo', () => {
    render(
      <CampoNumero
        etiqueta="Margen"
        valor={10}
        minimo={0}
        maximo={100}
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Margen')).toHaveProperty('value', '10')
  })

  it('declara el rango admitido', () => {
    render(
      <CampoNumero
        etiqueta="Margen"
        valor={10}
        minimo={2}
        maximo={80}
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    const campo = screen.getByLabelText('Margen')

    expect(campo.getAttribute('min')).toBe('2')
    expect(campo.getAttribute('max')).toBe('80')
  })

  it('comunica el número escrito', () => {
    const alCambiar = vi.fn()
    render(
      <CampoNumero
        etiqueta="Margen"
        valor={10}
        minimo={0}
        maximo={100}
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    // El campo es controlado: su valor lo fija quien lo usa, así que se comprueba
    // el cambio completo y no la escritura letra a letra, que en un control
    // controlado revierte al valor de la propiedad entre pulsación y pulsación.
    fireEvent.change(screen.getByLabelText('Margen'), {
      target: { value: '25' },
    })

    expect(alCambiar).toHaveBeenCalledWith(25)
  })

  it('no comunica nada cuando el campo queda vacío', () => {
    const alCambiar = vi.fn()
    render(
      <CampoNumero
        etiqueta="Margen"
        valor={10}
        minimo={0}
        maximo={100}
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    fireEvent.change(screen.getByLabelText('Margen'), {
      target: { value: '' },
    })

    expect(alCambiar).not.toHaveBeenCalled()
  })

  it('acepta decimales', () => {
    const alCambiar = vi.fn()
    render(
      <CampoNumero
        etiqueta="Margen"
        valor={10}
        minimo={0}
        maximo={100}
        paso={0.5}
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    fireEvent.change(screen.getByLabelText('Margen'), {
      target: { value: '12.5' },
    })

    expect(alCambiar).toHaveBeenCalledWith(12.5)
  })

  it('muestra la unidad junto al campo', () => {
    render(
      <CampoNumero
        etiqueta="Margen"
        valor={10}
        minimo={0}
        maximo={100}
        unidad="mm"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByText('mm')).toBeDefined()
  })

  it('se deshabilita cuando corresponde', () => {
    render(
      <CampoNumero
        etiqueta="Margen"
        valor={10}
        minimo={0}
        maximo={100}
        deshabilitado
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Margen')).toHaveProperty('disabled', true)
  })

  it('marca el campo como inválido y asocia el mensaje', () => {
    render(
      <CampoNumero
        etiqueta="Margen"
        valor={999}
        minimo={0}
        maximo={100}
        deshabilitado={false}
        alCambiar={vi.fn()}
        mensajeError="Fuera de rango"
      />,
    )

    const campo = screen.getByLabelText('Margen')

    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(campo.getAttribute('aria-describedby')).not.toBeNull()
    expect(screen.getByText('Fuera de rango')).toBeDefined()
  })
})

describe('ControlDeslizante', () => {
  it('asocia la etiqueta con el control', () => {
    render(
      <ControlDeslizante
        etiqueta="Opacidad"
        valor={50}
        minimo={0}
        maximo={100}
        valorLegible="50 %"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByRole('slider', { name: 'Opacidad' })).toBeDefined()
  })

  it('anuncia el valor como texto, no solo como número', () => {
    render(
      <ControlDeslizante
        etiqueta="Opacidad"
        valor={50}
        minimo={0}
        maximo={100}
        valorLegible="50 %"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('slider').getAttribute('aria-valuetext'),
    ).toBe('50 %')
  })

  it('muestra el valor también a la vista', () => {
    render(
      <ControlDeslizante
        etiqueta="Opacidad"
        valor={35}
        minimo={0}
        maximo={100}
        valorLegible="35 %"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByText('35 %')).toBeDefined()
  })

  it('es un control de rango nativo, que responde a las flechas del teclado', () => {
    render(
      <ControlDeslizante
        etiqueta="Opacidad"
        valor={50}
        minimo={0}
        maximo={100}
        paso={5}
        valorLegible="50 %"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    const control = screen.getByRole('slider')

    // El manejo del teclado lo aporta el propio navegador a los `input` de tipo
    // `range`; lo que hay que garantizar es que el control siga siendo nativo y
    // que declare su rango y su incremento.
    expect(control.getAttribute('type')).toBe('range')
    expect(control.getAttribute('step')).toBe('5')
    expect(control.getAttribute('min')).toBe('0')
    expect(control.getAttribute('max')).toBe('100')
  })

  it('comunica el valor elegido', () => {
    const alCambiar = vi.fn()
    render(
      <ControlDeslizante
        etiqueta="Opacidad"
        valor={50}
        minimo={0}
        maximo={100}
        paso={5}
        valorLegible="50 %"
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    fireEvent.change(screen.getByRole('slider'), { target: { value: '55' } })

    expect(alCambiar).toHaveBeenCalledWith(55)
  })

  it('se deshabilita cuando corresponde', () => {
    render(
      <ControlDeslizante
        etiqueta="Opacidad"
        valor={50}
        minimo={0}
        maximo={100}
        valorLegible="50 %"
        deshabilitado
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByRole('slider')).toHaveProperty('disabled', true)
  })
})

describe('SelectorColor', () => {
  it('ofrece la paleta y el campo de texto', () => {
    render(
      <SelectorColor
        etiqueta="Color"
        valor="#ff0000"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(
      screen.getByLabelText('Color: elegir en la paleta'),
    ).toBeDefined()
    expect(
      screen.getByLabelText('Color: escribir el código hexadecimal'),
    ).toHaveProperty('value', '#ff0000')
  })

  it('comunica un color válido escrito a mano', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <SelectorColor
        etiqueta="Color"
        valor="#ff0000"
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    const campo = screen.getByLabelText(
      'Color: escribir el código hexadecimal',
    )
    await persona.clear(campo)
    await persona.type(campo, '#00ff00')

    expect(alCambiar).toHaveBeenCalledWith('#00ff00')
  })

  it('normaliza la forma abreviada', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <SelectorColor
        etiqueta="Color"
        valor="#ff0000"
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    const campo = screen.getByLabelText(
      'Color: escribir el código hexadecimal',
    )
    await persona.clear(campo)
    await persona.type(campo, '#0f0')

    expect(alCambiar).toHaveBeenCalledWith('#00ff00')
  })

  it('avisa cuando el texto no es un color y no comunica nada', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <SelectorColor
        etiqueta="Color"
        valor="#ff0000"
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    const campo = screen.getByLabelText(
      'Color: escribir el código hexadecimal',
    )
    await persona.clear(campo)
    await persona.type(campo, 'granate')

    expect(screen.getByText(/notación hexadecimal/)).toBeDefined()
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(alCambiar).not.toHaveBeenCalled()
  })

  it('se deshabilitan los dos controles', () => {
    render(
      <SelectorColor
        etiqueta="Color"
        valor="#ff0000"
        deshabilitado
        alCambiar={vi.fn()}
      />,
    )

    expect(
      screen.getByLabelText('Color: elegir en la paleta'),
    ).toHaveProperty('disabled', true)
    expect(
      screen.getByLabelText('Color: escribir el código hexadecimal'),
    ).toHaveProperty('disabled', true)
  })
})

describe('SelectorPosicion', () => {
  it('cada celda tiene el nombre accesible de su posición', () => {
    render(
      <SelectorPosicion
        etiqueta="Posición"
        posiciones={POSICIONES_NUMERACION}
        valor="inferior-centro"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('radio', { name: 'Superior izquierda' }),
    ).toBeDefined()
    expect(
      screen.getByRole('radio', { name: 'Inferior derecha' }),
    ).toBeDefined()
  })

  it('indica en texto la posición elegida, no solo con la cuadrícula', () => {
    render(
      <SelectorPosicion
        etiqueta="Posición"
        posiciones={POSICIONES_NUMERACION}
        valor="superior-derecha"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(
      screen.getByText('Posición elegida: Superior derecha.'),
    ).toBeDefined()
  })

  it('comunica la posición elegida', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <SelectorPosicion
        etiqueta="Posición"
        posiciones={POSICIONES_NUMERACION}
        valor="inferior-centro"
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    await persona.click(
      screen.getByRole('radio', { name: 'Superior izquierda' }),
    )

    expect(alCambiar).toHaveBeenCalledWith('superior-izquierda')
  })

  it('muestra solo las posiciones que se le indican', () => {
    render(
      <SelectorPosicion
        etiqueta="Posición"
        posiciones={POSICIONES_NUMERACION}
        valor="inferior-centro"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(6)
    expect(screen.queryByRole('radio', { name: 'Centro' })).toBeNull()
  })
})

describe('SelectorRangoPaginas', () => {
  it('ofrece los cuatro alcances', () => {
    render(
      <SelectorRangoPaginas
        alcance="todas"
        expresion=""
        numeroPaginas={10}
        indicesAfectados={[0, 1, 2]}
        mensajeError={null}
        deshabilitado={false}
        alCambiarAlcance={vi.fn()}
        alCambiarExpresion={vi.fn()}
      />,
    )

    for (const etiqueta of [
      'Todas las páginas',
      'Páginas pares',
      'Páginas impares',
      'Rango personalizado',
    ]) {
      expect(screen.getByRole('radio', { name: etiqueta })).toBeDefined()
    }
  })

  it('oculta el campo de rangos salvo con «Rango personalizado»', () => {
    render(
      <SelectorRangoPaginas
        alcance="todas"
        expresion=""
        numeroPaginas={10}
        indicesAfectados={[]}
        mensajeError={null}
        deshabilitado={false}
        alCambiarAlcance={vi.fn()}
        alCambiarExpresion={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText('Páginas y rangos')).toBeNull()
  })

  it('muestra el campo de rangos al elegir «Rango personalizado»', () => {
    render(
      <SelectorRangoPaginas
        alcance="rango"
        expresion="1-3"
        numeroPaginas={10}
        indicesAfectados={[0, 1, 2]}
        mensajeError={null}
        deshabilitado={false}
        alCambiarAlcance={vi.fn()}
        alCambiarExpresion={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Páginas y rangos')).toHaveProperty(
      'value',
      '1-3',
    )
  })

  it('resume las páginas afectadas en texto', () => {
    render(
      <SelectorRangoPaginas
        alcance="rango"
        expresion="1-3,5"
        numeroPaginas={10}
        indicesAfectados={[0, 1, 2, 4]}
        mensajeError={null}
        deshabilitado={false}
        alCambiarAlcance={vi.fn()}
        alCambiarExpresion={vi.fn()}
      />,
    )

    expect(screen.getByText(/Se aplicará a 4 páginas: 1-3, 5\./)).toBeDefined()
  })

  it('avisa cuando la selección no incluye ninguna página', () => {
    render(
      <SelectorRangoPaginas
        alcance="rango"
        expresion=""
        numeroPaginas={10}
        indicesAfectados={[]}
        mensajeError={null}
        deshabilitado={false}
        alCambiarAlcance={vi.fn()}
        alCambiarExpresion={vi.fn()}
      />,
    )

    expect(
      screen.getByText(/Ninguna página quedará afectada/),
    ).toBeDefined()
  })

  it('marca el campo como inválido y muestra el error de la expresión', () => {
    render(
      <SelectorRangoPaginas
        alcance="rango"
        expresion="99"
        numeroPaginas={10}
        indicesAfectados={[]}
        mensajeError="La página 99 no existe."
        deshabilitado={false}
        alCambiarAlcance={vi.fn()}
        alCambiarExpresion={vi.fn()}
      />,
    )

    const campo = screen.getByLabelText('Páginas y rangos')

    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('La página 99 no existe.')).toBeDefined()
  })

  it('comunica el alcance elegido', async () => {
    const persona = userEvent.setup()
    const alCambiarAlcance = vi.fn()
    render(
      <SelectorRangoPaginas
        alcance="todas"
        expresion=""
        numeroPaginas={10}
        indicesAfectados={[]}
        mensajeError={null}
        deshabilitado={false}
        alCambiarAlcance={alCambiarAlcance}
        alCambiarExpresion={vi.fn()}
      />,
    )

    await persona.click(screen.getByRole('radio', { name: 'Páginas pares' }))

    expect(alCambiarAlcance).toHaveBeenCalledWith('pares')
  })
})

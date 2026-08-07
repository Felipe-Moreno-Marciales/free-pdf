import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LienzoFirma } from '../componentes/LienzoFirma'
import { PanelElemento } from '../componentes/PanelElemento'
import { crearForma, crearTexto, crearTrazo } from '../edicion/crearElementos'
import type { ElementoSuperpuesto, ElementoTexto } from '../edicion/tipos'
import { useCapaEdicion } from '../edicion/useCapaEdicion'

/** Texto de ejemplo ya con contenido, para que cuente como «pinta». */
function textoConContenido(pagina = 1): ElementoTexto {
  return crearTexto('semilla', pagina, { texto: 'Contenido' })
}

describe('useCapaEdicion', () => {
  it('empieza vacía y sin nada seleccionado', () => {
    const { result } = renderHook(() => useCapaEdicion())

    expect(result.current.elementos).toEqual([])
    expect(result.current.seleccionado).toBeNull()
    expect(result.current.cuantosPintan).toBe(0)
  })

  it('añade un elemento y lo deja seleccionado', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Hola' }))
    })

    expect(result.current.elementos).toHaveLength(1)
    expect(result.current.seleccionado?.clase).toBe('texto')
    expect(result.current.idSeleccionado).toBe(result.current.elementos[0]?.id)
  })

  it('da un identificador distinto a cada elemento', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })
    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })

    const [primero, segundo] = result.current.elementos

    expect(primero?.id).not.toBe(segundo?.id)
  })

  it('normaliza el elemento al añadirlo, sin dejar que se salga de la página', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) =>
        crearTexto(id, 1, { izquierda: 2, superior: -1 }),
      )
    })

    const elemento = result.current.elementos[0]

    expect(elemento?.izquierda).toBeLessThanOrEqual(1)
    expect(elemento?.superior).toBeGreaterThanOrEqual(0)
  })

  it('normaliza también al cambiar, no solo al crear', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })

    const id = result.current.elementos[0]?.id ?? ''

    act(() => {
      result.current.cambiar(id, { izquierda: 5 })
    })

    expect(result.current.elementos[0]?.izquierda).toBeLessThanOrEqual(1)
  })

  it('quita un elemento y deja de tenerlo seleccionado', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })

    const id = result.current.elementos[0]?.id ?? ''

    act(() => {
      result.current.quitar(id)
    })

    expect(result.current.elementos).toEqual([])
    expect(result.current.idSeleccionado).toBeNull()
  })

  it('al quitar un elemento no pierde la selección de otro distinto', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })

    const primero = result.current.elementos[0]?.id ?? ''

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })

    const segundo = result.current.elementos[1]?.id ?? ''

    act(() => {
      result.current.quitar(primero)
    })

    expect(result.current.idSeleccionado).toBe(segundo)
  })

  it('cuenta solo los elementos que dibujan algo', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Sí' }))
    })
    act(() => {
      // Un texto vacío no pinta nada.
      result.current.anadir((id) => crearTexto(id, 1, { texto: '' }))
    })

    expect(result.current.elementos).toHaveLength(2)
    expect(result.current.cuantosPintan).toBe(1)
  })

  it('reordena con subir y bajar, que es lo que decide qué queda encima', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'A' }))
    })
    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'B' }))
    })

    const primero = result.current.elementos[0]?.id ?? ''

    act(() => {
      result.current.subir(primero)
    })

    // El primero pasa a ser el último, es decir, se dibuja encima.
    expect(result.current.elementos[1]?.id).toBe(primero)

    act(() => {
      result.current.bajar(primero)
    })

    expect(result.current.elementos[0]?.id).toBe(primero)
  })

  it('no hace nada al subir el que ya está encima', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })

    const id = result.current.elementos[0]?.id ?? ''

    act(() => {
      result.current.subir(id)
    })

    expect(result.current.elementos).toHaveLength(1)
    expect(result.current.elementos[0]?.id).toBe(id)
  })

  it('duplica desplazando la copia, para que se vea que hay dos', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Original' }))
    })

    const original = result.current.elementos[0]
    const id = original?.id ?? ''

    act(() => {
      result.current.duplicar(id)
    })

    expect(result.current.elementos).toHaveLength(2)

    const copia = result.current.elementos[1]

    expect(copia?.id).not.toBe(id)
    expect(copia?.izquierda).toBeGreaterThan(original?.izquierda ?? 0)
    // Y queda seleccionada la copia, que es la que se acaba de crear.
    expect(result.current.idSeleccionado).toBe(copia?.id)
  })

  it('duplicar un identificador que no existe no cambia nada', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.duplicar('no-existe')
    })

    expect(result.current.elementos).toEqual([])
  })

  it('filtra los elementos por página', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })
    act(() => {
      result.current.anadir((id) => crearTexto(id, 3))
    })

    expect(result.current.elementosDePagina(1)).toHaveLength(1)
    expect(result.current.elementosDePagina(3)).toHaveLength(1)
    expect(result.current.elementosDePagina(2)).toHaveLength(0)
  })

  it('cuenta cuántos elementos hay de cada clase', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })
    act(() => {
      result.current.anadir((id) => crearForma(id, 1, 'elipse'))
    })

    expect(result.current.recuentoPorClase.texto).toBe(1)
    expect(result.current.recuentoPorClase.forma).toBe(1)
    expect(result.current.recuentoPorClase.trazo).toBe(0)
  })

  it('vaciar deja la capa como al principio', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1))
    })
    act(() => {
      result.current.vaciar()
    })

    expect(result.current.elementos).toEqual([])
    expect(result.current.idSeleccionado).toBeNull()
  })
})

describe('PanelElemento', () => {
  /** Monta el panel con un elemento y devuelve el espía de cambios. */
  function montar(elemento: ElementoSuperpuesto, numeroPaginas = 1) {
    const alCambiar = vi.fn()
    const alQuitar = vi.fn()
    const alDuplicar = vi.fn()

    render(
      <PanelElemento
        elemento={elemento}
        numeroPaginas={numeroPaginas}
        deshabilitado={false}
        alCambiar={alCambiar}
        alQuitar={alQuitar}
        alDuplicar={alDuplicar}
        alSubir={vi.fn()}
        alBajar={vi.fn()}
      />,
    )

    return { alCambiar, alQuitar, alDuplicar }
  }

  it('muestra el contenido del texto y avisa de sus cambios', () => {
    const { alCambiar } = montar(textoConContenido())

    const area = screen.getByLabelText('Contenido')

    expect((area as HTMLTextAreaElement).value).toBe('Contenido')

    fireEvent.change(area, { target: { value: 'Otro texto' } })

    expect(alCambiar).toHaveBeenCalledWith({ texto: 'Otro texto' })
  })

  it('ofrece las tipografías estándar y avisa del cambio', async () => {
    const { alCambiar } = montar(textoConContenido())

    await userEvent.selectOptions(
      screen.getByLabelText('Tipografía'),
      'times-cursiva',
    )

    expect(alCambiar).toHaveBeenCalledWith({ tipografia: 'times-cursiva' })
  })

  it('convierte los porcentajes de la posición a fracciones', () => {
    const { alCambiar } = montar(textoConContenido())

    fireEvent.change(screen.getByLabelText(/Desde la izquierda/i), {
      target: { value: '25' },
    })

    expect(alCambiar).toHaveBeenCalledWith({ izquierda: 0.25 })
  })

  it('convierte la opacidad de porcentaje a fracción', () => {
    const { alCambiar } = montar(textoConContenido())

    fireEvent.change(screen.getByLabelText(/Opacidad/i), {
      target: { value: '50' },
    })

    expect(alCambiar).toHaveBeenCalledWith({ opacidad: 0.5 })
  })

  it('no ofrece cambiar de página en un documento de una sola página', () => {
    montar(textoConContenido(), 1)

    expect(screen.queryByLabelText(/^Página/)).toBeNull()
  })

  it('ofrece cambiar de página cuando el documento tiene varias', () => {
    montar(textoConContenido(), 5)

    expect(screen.getByLabelText(/^Página/)).not.toBeNull()
  })

  it('avisa al quitar y al duplicar', async () => {
    const { alQuitar, alDuplicar } = montar(textoConContenido())

    await userEvent.click(screen.getByLabelText('Quitar este elemento'))
    await userEvent.click(screen.getByLabelText('Duplicar este elemento'))

    expect(alQuitar).toHaveBeenCalledOnce()
    expect(alDuplicar).toHaveBeenCalledOnce()
  })

  it('en una forma, activar el relleno le asigna un color en vez de dejarlo nulo', async () => {
    const { alCambiar } = montar(crearForma('f', 1, 'rectangulo'))

    await userEvent.click(screen.getByLabelText(/Rellenar la figura/i))

    const cambios = alCambiar.mock.calls[0]?.[0] as { relleno: string | null }

    expect(cambios.relleno).toBeTypeOf('string')
  })

  it('en un trazo, advierte de que el giro no se le aplica', () => {
    montar(crearTrazo('t', 1, [[{ x: 0, y: 0 }, { x: 1, y: 1 }]]))

    expect(screen.getByText(/no gira con el elemento/i)).not.toBeNull()
  })

  it('aclara que la descripción de la imagen no se guarda en el documento', () => {
    montar({
      id: 'img',
      clase: 'imagen',
      pagina: 1,
      izquierda: 0,
      superior: 0,
      ancho: 0.2,
      alto: 0.2,
      giro: 0,
      opacidad: 1,
      bytes: new Uint8Array([1]),
      formato: 'png',
      descripcion: 'Sello',
    })

    expect(screen.getByText(/no se guarda en el documento/i)).not.toBeNull()
  })
})

describe('LienzoFirma', () => {
  it('empieza sin dibujar y con los botones desactivados', () => {
    render(
      <LienzoFirma color="#000000" deshabilitado={false} alCambiar={vi.fn()} />,
    )

    expect(screen.getByText(/Sin dibujar/i)).not.toBeNull()
    expect(
      (screen.getByRole('button', { name: /Borrar/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it('deja claro con una indicación qué hay que hacer', () => {
    render(
      <LienzoFirma color="#000000" deshabilitado={false} alCambiar={vi.fn()} />,
    )

    expect(screen.getByText(/Dibuja aquí tu firma/i)).not.toBeNull()
  })

  it('el área de dibujo se anuncia a los lectores de pantalla', () => {
    render(
      <LienzoFirma color="#000000" deshabilitado={false} alCambiar={vi.fn()} />,
    )

    expect(
      screen.getByRole('application', { name: /dibujar la firma/i }),
    ).not.toBeNull()
  })

  it('con la herramienta bloqueada no se puede borrar', () => {
    render(
      <LienzoFirma color="#000000" deshabilitado alCambiar={vi.fn()} />,
    )

    expect(
      (screen.getByRole('button', { name: /Borrar/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })
})

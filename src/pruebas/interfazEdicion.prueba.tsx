import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LienzoFirma } from '../componentes/LienzoFirma'
import { LienzoEdicion } from '../componentes/LienzoEdicion'
import { PanelElemento } from '../componentes/PanelElemento'
import {
  crearForma,
  crearTexto,
  crearTextoEditado,
  crearTrazo,
} from '../edicion/crearElementos'
import { elegirTipografia } from '../edicion/seleccionTexto'
import type { ElementoSuperpuesto, ElementoTexto } from '../edicion/tipos'
import { useCapaEdicion } from '../edicion/useCapaEdicion'
import { useEditarPdf } from '../funcionalidades/editar-pdf/useEditarPdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'

vi.mock('../componentes/MiniaturaPaginaPdf', () => ({
  MiniaturaPaginaPdf: () => <div data-testid="pagina-pdf" />,
}))

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

  it('una copia queda pendiente de guardar aunque el original estuviera guardado', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) =>
        crearTexto(id, 1, { texto: 'Original', guardado: true }),
      )
    })
    const id = result.current.elementos[0]?.id ?? ''

    act(() => result.current.duplicar(id))

    expect(result.current.elementos[0]?.guardado).toBe(true)
    expect(result.current.elementos[1]?.guardado).toBe(false)
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

describe('deshacer y rehacer en useCapaEdicion', () => {
  it('no ofrece deshacer sobre una capa recién creada', () => {
    const { result } = renderHook(() => useCapaEdicion())

    expect(result.current.puedeDeshacer).toBe(false)
    expect(result.current.puedeRehacer).toBe(false)
  })

  it('recupera todo lo que «Quitar todo» había borrado', () => {
    // Es el caso que justifica el historial: la capa solo vive en memoria, así que
    // sin esto un clic destruye una sesión entera de correcciones.
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Dos' }))
    })
    act(() => result.current.vaciar())

    expect(result.current.elementos).toHaveLength(0)

    act(() => result.current.deshacer())

    expect(result.current.elementos).toHaveLength(2)
  })

  it('devuelve la selección que había en ese paso', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    const primero = result.current.idSeleccionado

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Dos' }))
    })
    act(() => result.current.deshacer())

    expect(result.current.idSeleccionado).toBe(primero)
  })

  it('funde un arrastre entero en un solo paso', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    const id = result.current.idSeleccionado ?? ''

    for (const posicion of [0.2, 0.3, 0.4, 0.5]) {
      act(() =>
        result.current.cambiar(id, {
          izquierda: posicion,
          superior: posicion,
        }),
      )
    }

    act(() => result.current.deshacer())

    // Un solo Ctrl+Z devuelve el elemento a donde estaba antes del arrastre.
    expect(result.current.elementos[0]?.izquierda).toBeCloseTo(0.1, 6)
  })

  it('separa dos gestos seguidos que tocan las mismas propiedades', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    const id = result.current.idSeleccionado ?? ''

    act(() => result.current.cambiar(id, { izquierda: 0.3 }))
    act(() => result.current.separar())
    act(() => result.current.cambiar(id, { izquierda: 0.5 }))
    act(() => result.current.deshacer())

    expect(result.current.elementos[0]?.izquierda).toBeCloseTo(0.3, 6)
  })

  it('no gasta un paso en un cambio que no cambia nada', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    const id = result.current.idSeleccionado ?? ''

    act(() => result.current.cambiar(id, { texto: 'Uno' }))

    // Solo el paso de añadir: si el cambio vacío contara, deshacer parecería roto.
    act(() => result.current.deshacer())

    expect(result.current.elementos).toHaveLength(0)
  })

  it('no gasta un paso al subir el elemento que ya está arriba', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    const id = result.current.idSeleccionado ?? ''

    act(() => result.current.subir(id))
    act(() => result.current.deshacer())

    expect(result.current.elementos).toHaveLength(0)
  })

  it('rehacer devuelve lo deshecho, y añadir algo nuevo lo descarta', () => {
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    act(() => result.current.deshacer())

    expect(result.current.puedeRehacer).toBe(true)

    act(() => result.current.rehacer())

    expect(result.current.elementos).toHaveLength(1)

    act(() => result.current.deshacer())
    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Otro' }))
    })

    expect(result.current.puedeRehacer).toBe(false)
  })

  it('reiniciar borra también el historial, para no arrastrarlo al documento siguiente', () => {
    // Vaciar deja el historial en pie: deshacer devolvería los elementos del
    // documento que se acaba de cerrar y se dibujarían sobre las páginas del nuevo.
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    act(() => result.current.reiniciar())

    expect(result.current.elementos).toHaveLength(0)
    expect(result.current.puedeDeshacer).toBe(false)
    expect(result.current.puedeRehacer).toBe(false)

    act(() => result.current.deshacer())

    expect(result.current.elementos).toHaveLength(0)
  })

  it('no reutiliza identificadores después de vaciar y deshacer', () => {
    // Si el contador retrocediera al vaciar, el elemento restaurado y el nuevo
    // compartirían identificador, y editar uno editaría los dos.
    const { result } = renderHook(() => useCapaEdicion())

    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Uno' }))
    })
    act(() => result.current.vaciar())
    act(() => result.current.deshacer())
    act(() => {
      result.current.anadir((id) => crearTexto(id, 1, { texto: 'Dos' }))
    })

    const identificadores = new Set(
      result.current.elementos.map((elemento) => elemento.id),
    )

    expect(identificadores.size).toBe(result.current.elementos.length)
  })
})

describe('guardado individual en useEditarPdf', () => {
  it('confirma el elemento y conserva la selección para mostrar el resultado', () => {
    const { result } = renderHook(() => useEditarPdf())

    act(() => {
      result.current.editarTextoExistente({
        texto: 'Audit',
        cajas: [
          { izquierda: 0.2, superior: 0.2, ancho: 0.1, alto: 0.03 },
        ],
        tamano: 18,
        tipografia: 'helvetica-negrita',
        lineaBase: 0.224,
        colorTexto: '#007f99',
        colorFondo: '#ffffff',
      })
    })

    const id = result.current.capa.seleccionado?.id ?? ''

    expect(result.current.cambiosSinGuardar).toBe(1)
    expect(result.current.capa.seleccionado?.guardado).not.toBe(true)

    act(() => result.current.guardarCambio(id))

    expect(result.current.cambiosSinGuardar).toBe(0)
    expect(result.current.capa.seleccionado?.id).toBe(id)
    expect(result.current.capa.seleccionado?.guardado).toBe(true)
  })

  it('guarda la línea base del original relativa a la caja de la corrección', () => {
    const { result } = renderHook(() => useEditarPdf())

    act(() => {
      result.current.editarTextoExistente({
        texto: 'Audit',
        cajas: [{ izquierda: 0.2, superior: 0.2, ancho: 0.1, alto: 0.04 }],
        tamano: 12,
        tipografia: 'helvetica',
        // La palabra ocupa de 0,2 a 0,24 y se apoya en 0,232: tres cuartos de su caja.
        lineaBase: 0.232,
        colorTexto: '#111111',
        colorFondo: '#ffffff',
      })
    })

    const elemento = result.current.capa.seleccionado

    expect(elemento?.clase).toBe('texto-editado')
    expect(
      elemento?.clase === 'texto-editado' ? elemento.lineaBase : 0,
    ).toBeCloseTo(0.8, 6)
  })

  it('vuelve a marcar como pendiente un elemento guardado que se modifica', () => {
    const { result } = renderHook(() => useEditarPdf())

    act(() => {
      result.current.anadirTexto()
    })
    const id = result.current.capa.seleccionado?.id ?? ''

    act(() => result.current.guardarCambio(id))
    act(() => result.current.capa.cambiar(id, { texto: 'Texto modificado' }))

    expect(result.current.capa.seleccionado?.guardado).toBe(false)
    expect(result.current.cambiosSinGuardar).toBe(1)
  })
})

describe('LienzoEdicion', () => {
  it('permite quitar el elemento seleccionado con la tecla Suprimir', () => {
    const alQuitar = vi.fn()
    const elemento = textoConContenido()

    render(
      <LienzoEdicion
        documento={{} as PDFDocumentProxy}
        numeroPagina={1}
        elementos={[elemento]}
        idSeleccionado={elemento.id}
        deshabilitado={false}
        alSeleccionar={vi.fn()}
        alMover={vi.fn()}
        alRedimensionar={vi.fn()}
        alQuitar={alQuitar}
      />,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: /Texto «Contenido»/i }), {
      key: 'Delete',
    })

    expect(alQuitar).toHaveBeenCalledWith(elemento.id)
  })

  it('muestra el tirador de tamaño solo en el elemento seleccionado', () => {
    const seleccionado = textoConContenido()
    const otro = crearTexto('otro', 1, { texto: 'Otro' })
    const { container } = render(
      <LienzoEdicion
        documento={{} as PDFDocumentProxy}
        numeroPagina={1}
        elementos={[seleccionado, otro]}
        idSeleccionado={seleccionado.id}
        deshabilitado={false}
        alSeleccionar={vi.fn()}
        alMover={vi.fn()}
        alRedimensionar={vi.fn()}
        alQuitar={vi.fn()}
      />,
    )

    expect(container.querySelectorAll('.lienzo-edicion__tirador')).toHaveLength(1)
  })

  it('convierte el área arrastrada en fracciones de la página', () => {
    const alCubrirArea = vi.fn()
    const { container } = render(
      <LienzoEdicion
        documento={{} as PDFDocumentProxy}
        numeroPagina={1}
        elementos={[]}
        idSeleccionado={null}
        deshabilitado={false}
        alSeleccionar={vi.fn()}
        alMover={vi.fn()}
        alRedimensionar={vi.fn()}
        alQuitar={vi.fn()}
        cubriendoArea
        alCubrirArea={alCubrirArea}
      />,
    )

    const pagina = container.querySelector('.lienzo-edicion__pagina')
    const selector = screen.getByRole('region', {
      name: /Arrastra sobre la zona/i,
    })

    expect(pagina).not.toBeNull()
    Object.defineProperty(pagina, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 400,
        right: 200,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    })
    Object.defineProperty(selector, 'setPointerCapture', { value: vi.fn() })

    fireEvent.pointerDown(selector, { pointerId: 1, clientX: 20, clientY: 40 })
    fireEvent.pointerMove(selector, { pointerId: 1, clientX: 120, clientY: 200 })
    fireEvent.pointerUp(selector, { pointerId: 1, clientX: 120, clientY: 200 })

    expect(alCubrirArea).toHaveBeenCalledWith({
      izquierda: 0.1,
      superior: 0.1,
      ancho: 0.5,
      alto: 0.4,
    })
  })
})

describe('PanelElemento', () => {
  /** Monta el panel con un elemento y devuelve el espía de cambios. */
  function montar(
    elemento: ElementoSuperpuesto,
    numeroPaginas = 1,
    conGuardado = false,
  ) {
    const alCambiar = vi.fn()
    const alQuitar = vi.fn()
    const alDuplicar = vi.fn()
    const alGuardar = vi.fn()

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
        {...(conGuardado ? { alGuardar } : {})}
      />,
    )

    return { alCambiar, alQuitar, alDuplicar, alGuardar }
  }

  it('muestra el contenido del texto y avisa de sus cambios', () => {
    const { alCambiar } = montar(textoConContenido())

    const area = screen.getByLabelText('Contenido')

    expect((area as HTMLTextAreaElement).value).toBe('Contenido')

    fireEvent.change(area, { target: { value: 'Otro texto' } })

    expect(alCambiar).toHaveBeenCalledWith({ texto: 'Otro texto' })
  })

  it('permite guardar individualmente un cambio pendiente', async () => {
    const { alGuardar } = montar(
      crearTextoEditado('pendiente', 1, {
        texto: 'Audit',
        guardado: false,
      }),
      1,
      true,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }))

    expect(alGuardar).toHaveBeenCalledOnce()
    expect(screen.getByText(/Vista previa en tiempo real/i)).toBeDefined()
  })

  it('indica cuando el cambio seleccionado ya está guardado', () => {
    montar(
      crearTextoEditado('guardado', 1, {
        texto: 'Audit',
        guardado: true,
      }),
      1,
      true,
    )

    expect(
      (screen.getByRole('button', { name: 'Guardado ✓' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(screen.getByText(/Guardado en esta sesión/i)).toBeDefined()
  })

  it('muestra el estilo detectado de una palabra existente y permite afinarlo', () => {
    const { alCambiar } = montar(
      crearTextoEditado('editado', 1, {
        texto: 'Computer Audit',
        tipografia: 'helvetica-negrita',
        tamano: 18,
        color: '#007f99',
        colorFondo: '#ffffff',
      }),
    )

    expect(screen.getByRole('heading', { name: 'Editar texto existente' })).toBeDefined()
    expect((screen.getByLabelText('Tipografía') as HTMLSelectElement).value).toBe(
      'helvetica-negrita',
    )
    expect((screen.getByLabelText('Cuerpo') as HTMLInputElement).value).toBe('18')

    fireEvent.change(
      screen.getByLabelText(
        'Color del fondo original: escribir el código hexadecimal',
      ),
      { target: { value: '#f0f0f0' } },
    )

    expect(alCambiar).toHaveBeenCalledWith({ colorFondo: '#f0f0f0' })
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

describe('detección de tipografía PDF', () => {
  it('conserva negrita y familia aproximada desde el nombre incrustado', () => {
    expect(
      elegirTipografia({
        familia: 'sans-serif',
        nombre: 'OpenSans-Bold',
        negrita: true,
        cursiva: false,
      }),
    ).toBe('helvetica-negrita')

    expect(
      elegirTipografia({
        familia: 'serif',
        nombre: 'TimesNewRomanPS-ItalicMT',
        negrita: false,
        cursiva: true,
      }),
    ).toBe('times-cursiva')
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

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Aplicacion } from '../Aplicacion'
import {
  CATEGORIAS,
  HERRAMIENTAS,
  agruparPorCategoria,
} from '../herramientas/catalogo'

describe('catálogo de herramientas', () => {
  it('muestra las dos categorías con su encabezado', () => {
    render(<Aplicacion />)

    for (const categoria of CATEGORIAS) {
      expect(
        screen.getByRole('heading', { name: categoria.nombre }),
      ).toBeDefined()
    }
  })

  it('muestra todas las herramientas del catálogo con su nombre', () => {
    render(<Aplicacion />)

    // El recuento se deriva del catálogo a propósito: al añadir una herramienta
    // nueva, la prueba la exige en la pantalla sin tener que actualizar un número.
    expect(HERRAMIENTAS.length).toBeGreaterThanOrEqual(12)

    for (const herramienta of HERRAMIENTAS) {
      expect(
        screen.getByRole('heading', { name: herramienta.nombre }),
      ).toBeDefined()
    }
  })

  it('cada herramienta pertenece a una categoría del catálogo', () => {
    const identificadores = new Set(CATEGORIAS.map((categoria) => categoria.id))

    for (const herramienta of HERRAMIENTAS) {
      expect(identificadores.has(herramienta.categoria)).toBe(true)
    }
  })

  it('el agrupado no pierde ni duplica ninguna herramienta', () => {
    const agrupadas = agruparPorCategoria().flatMap(
      (grupo) => grupo.herramientas,
    )

    expect(agrupadas).toHaveLength(HERRAMIENTAS.length)
    expect(new Set(agrupadas.map((h) => h.id)).size).toBe(HERRAMIENTAS.length)
  })

  it('agrupa las seis herramientas de organización en su categoría', () => {
    render(<Aplicacion />)

    const seccion = screen
      .getByRole('heading', { name: 'Organización' })
      .closest('section')

    expect(seccion).not.toBeNull()
    const enlaces = within(seccion as HTMLElement).getAllByRole('button', {
      name: /^Abrir la herramienta/,
    })

    expect(enlaces).toHaveLength(6)
  })

  it('agrupa las seis herramientas de la Fase 2 en «Creación y personalización»', () => {
    render(<Aplicacion />)

    const seccion = screen
      .getByRole('heading', { name: 'Creación y personalización' })
      .closest('section')

    const botones = within(seccion as HTMLElement).getAllByRole('button', {
      name: /^Abrir la herramienta/,
    })

    expect(botones).toHaveLength(6)
  })

  it('cada herramienta tiene un botón con su nombre accesible completo', () => {
    render(<Aplicacion />)

    for (const herramienta of HERRAMIENTAS) {
      expect(
        screen.getByRole('button', {
          name: `Abrir la herramienta ${herramienta.nombre}`,
        }),
      ).toBeDefined()
    }
  })

  it('no repite una etiqueta de disponibilidad en cada herramienta', () => {
    render(<Aplicacion />)

    expect(screen.queryByText('Disponible')).toBeNull()
  })

  it('no publica PDF/A sin conversión y validación locales verificables', () => {
    expect(
      HERRAMIENTAS.some((herramienta) => herramienta.nombre === 'PDF/A'),
    ).toBe(false)
  })

  it('muestra la categoría de seguridad con sus herramientas', () => {
    render(<Aplicacion />)

    const seccion = screen
      .getByRole('heading', { name: 'Seguridad y edición' })
      .closest('section')

    expect(seccion).not.toBeNull()
    expect(
      within(seccion as HTMLElement).getByRole('button', {
        name: 'Abrir la herramienta Inspector de seguridad PDF',
      }),
    ).toBeDefined()
    expect(
      within(seccion as HTMLElement).getByRole('button', {
        name: 'Abrir la herramienta Proteger PDF',
      }),
    ).toBeDefined()
    expect(
      within(seccion as HTMLElement).getByRole('button', {
        name: 'Abrir la herramienta Desbloquear PDF',
      }),
    ).toBeDefined()
  })
})

describe('apertura de una herramienta desde el catálogo', () => {
  it('abre «Imágenes a PDF» y muestra su panel', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    await persona.click(
      screen.getByRole('button', {
        name: 'Abrir la herramienta Imágenes a PDF',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Imágenes a PDF/ }),
      ).toBeDefined()
    })
  })

  it('la dirección refleja la herramienta abierta', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    await persona.click(
      screen.getByRole('button', {
        name: 'Abrir la herramienta Imágenes a PDF',
      }),
    )

    await waitFor(() => {
      expect(window.location.hash).toBe('#/imagenes-a-pdf')
    })
  })

  it('el panel indica a qué categoría pertenece la herramienta', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    await persona.click(
      screen.getByRole('button', {
        name: 'Abrir la herramienta Imágenes a PDF',
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('Creación y personalización')).toBeDefined()
    })
  })

  it('ofrece un botón para volver al catálogo', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    await persona.click(
      screen.getByRole('button', {
        name: 'Abrir la herramienta Imágenes a PDF',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Todas las herramientas/ }),
      ).toBeDefined()
    })
  })

  it('el botón de volver regresa al listado', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    await persona.click(
      screen.getByRole('button', {
        name: 'Abrir la herramienta Imágenes a PDF',
      }),
    )

    const volver = await waitFor(() =>
      screen.getByRole('button', { name: /Todas las herramientas/ }),
    )
    await persona.click(volver)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Herramientas disponibles' }),
      ).toBeDefined()
    })
  })

  it('deja de mostrar el catálogo mientras la herramienta está abierta', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    await persona.click(
      screen.getByRole('button', {
        name: 'Abrir la herramienta Imágenes a PDF',
      }),
    )

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Herramientas disponibles' }),
      ).toBeNull()
    })
  })

  it('abre la herramienta indicada en el hash al cargar la página', async () => {
    window.location.hash = '#/recortar'

    render(<Aplicacion />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Recortar PDF/ }),
      ).toBeDefined()
    })
  })

  it('ignora un hash que no corresponde a ninguna herramienta', () => {
    window.location.hash = '#/inventada'

    render(<Aplicacion />)

    expect(
      screen.getByRole('heading', { name: 'Herramientas disponibles' }),
    ).toBeDefined()
  })
})

describe('navegación con el teclado', () => {
  it('el enlace para saltar al contenido es el primer elemento enfocable', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    await persona.tab()

    expect(document.activeElement?.textContent).toContain(
      'Saltar al contenido principal',
    )
  })

  it('se puede abrir una herramienta con el teclado', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    const boton = screen.getByRole('button', {
      name: 'Abrir la herramienta Escanear a PDF',
    })
    boton.focus()
    await persona.keyboard('{Enter}')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 2, name: /Escanear a PDF/ }),
      ).toBeDefined()
    })
  })
})

describe('avisos de privacidad', () => {
  it('recuerda que los archivos no salen del navegador', () => {
    render(<Aplicacion />)

    expect(
      screen.getByText(/nunca se suben a un servidor/i),
    ).toBeDefined()
  })

  it('el listado explica que todo ocurre en el navegador', () => {
    render(<Aplicacion />)

    expect(
      screen.getByText(/no se suben a\s+ningún servidor/i),
    ).toBeDefined()
  })
})

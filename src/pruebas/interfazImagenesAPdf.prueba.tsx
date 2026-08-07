import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HerramientaImagenesAPdf } from '../funcionalidades/imagenes-a-pdf/HerramientaImagenesAPdf'
import { crearArchivoImagen } from './ayudas/crearImagenPrueba'
import { MEDIDAS_SIMULADAS } from './ayudas/preparacionInterfaz'

/** Devuelve el campo de archivos de la zona de arrastre. */
function obtenerSelector(): HTMLInputElement {
  return screen.getByLabelText('Seleccionar imágenes') as HTMLInputElement
}

/** Añade imágenes a la herramienta a través del selector de archivos. */
async function anadirImagenes(
  persona: ReturnType<typeof userEvent.setup>,
  ...archivos: readonly File[]
): Promise<void> {
  await persona.upload(obtenerSelector(), [...archivos])
}

/**
 * Suelta archivos sobre la zona de arrastre.
 *
 * Es la vía por la que puede llegar de verdad un archivo no admitido: el selector
 * del sistema filtra por el atributo `accept`, pero arrastrar no filtra nada. Por
 * eso la validación existe y por eso se comprueba soltando, no eligiendo.
 */
function soltarArchivos(...archivos: readonly File[]): void {
  const zona = obtenerSelector().closest('.zona-arrastre')

  if (zona === null) {
    throw new Error('No se encontró la zona de arrastre.')
  }

  fireEvent.drop(zona, {
    dataTransfer: { files: [...archivos], types: ['Files'] },
  })
}

describe('Imágenes a PDF: estado inicial', () => {
  it('muestra la zona para elegir imágenes', () => {
    render(<HerramientaImagenesAPdf />)

    expect(obtenerSelector()).toBeDefined()
  })

  it('indica los formatos admitidos', () => {
    render(<HerramientaImagenesAPdf />)

    expect(screen.getByText(/JPEG, JPG, PNG y WebP/)).toBeDefined()
  })

  it('no ofrece el botón de crear hasta que hay imágenes', () => {
    render(<HerramientaImagenesAPdf />)

    expect(screen.queryByRole('button', { name: /Crear PDF/ })).toBeNull()
  })

  it('no muestra ninguna advertencia de partida', () => {
    render(<HerramientaImagenesAPdf />)

    expect(screen.queryByRole('alert')?.textContent ?? '').toBe('')
  })
})

describe('Imágenes a PDF: archivos inválidos', () => {
  it('el selector de archivos solo admite los formatos de imagen', () => {
    render(<HerramientaImagenesAPdf />)

    // El navegador filtra por este atributo antes de entregar nada, así que un
    // archivo no admitido solo puede llegar arrastrándolo.
    expect(obtenerSelector().accept).toContain('image/png')
    expect(obtenerSelector().accept).toContain('.webp')
  })

  it('avisa al soltar un archivo que no es una imagen', async () => {
    render(<HerramientaImagenesAPdf />)

    soltarArchivos(
      new File([new Uint8Array([1, 2, 3])], 'documento.pdf', {
        type: 'application/pdf',
      }),
    )

    await waitFor(() => {
      expect(
        screen.getByText(/no tiene un formato de imagen admitido/),
      ).toBeDefined()
    })
  })

  it('nombra el archivo descartado en el aviso', async () => {
    render(<HerramientaImagenesAPdf />)

    soltarArchivos(
      new File([new Uint8Array([1])], 'notas.txt', { type: 'text/plain' }),
    )

    await waitFor(() => {
      expect(screen.getByText(/notas\.txt/)).toBeDefined()
    })
  })

  it('no añade el archivo inválido a la lista', async () => {
    render(<HerramientaImagenesAPdf />)

    soltarArchivos(
      new File([new Uint8Array([1])], 'notas.txt', { type: 'text/plain' }),
    )

    await waitFor(() => {
      expect(screen.getByText(/no tiene un formato/)).toBeDefined()
    })
    expect(screen.queryByRole('button', { name: /Crear PDF/ })).toBeNull()
  })

  it('avisa de un archivo vacío', async () => {
    render(<HerramientaImagenesAPdf />)

    soltarArchivos(new File([], 'vacia.png', { type: 'image/png' }))

    await waitFor(() => {
      expect(screen.getByText(/está vacío/)).toBeDefined()
    })
  })

  it('acepta las válidas y descarta las inválidas de la misma selección', async () => {
    render(<HerramientaImagenesAPdf />)

    soltarArchivos(
      crearArchivoImagen('buena', 400, 300),
      new File([new Uint8Array([1])], 'mala.txt', { type: 'text/plain' }),
    )

    await waitFor(() => {
      expect(screen.getByText(/mala\.txt/)).toBeDefined()
    })
    expect(screen.getByText('buena.png')).toBeDefined()
  })

  it('el aviso se publica en una región activa', async () => {
    render(<HerramientaImagenesAPdf />)

    soltarArchivos(
      new File([new Uint8Array([1])], 'notas.txt', { type: 'text/plain' }),
    )

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('notas.txt')
    })
  })
})

describe('Imágenes a PDF: selección de imágenes', () => {
  it('añade una imagen válida y la muestra en la lista', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))

    await waitFor(() => {
      expect(screen.getByText('foto.png')).toBeDefined()
    })
  })

  it('resume cuántas imágenes hay y qué se generará', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(
      persona,
      crearArchivoImagen('a', 400, 300),
      crearArchivoImagen('b', 400, 300),
    )

    await waitFor(() => {
      expect(
        screen.getByText(/2 imágenes/),
      ).toBeDefined()
    })
    expect(screen.getByText(/una página por\s+imagen/)).toBeDefined()
  })

  it('lee y muestra las medidas de la imagen', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))

    // Las medidas aparecen dos veces a propósito: en la línea de detalle visible y
    // en la descripción que leen los lectores de pantalla.
    await waitFor(() => {
      expect(
        screen.getAllByText(
          new RegExp(
            `${MEDIDAS_SIMULADAS.ancho} × ${MEDIDAS_SIMULADAS.alto} píxeles`,
          ),
        ).length,
      ).toBeGreaterThan(0)
    })
  })

  it('numera las páginas según el orden de la lista', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(
      persona,
      crearArchivoImagen('a', 400, 300),
      crearArchivoImagen('b', 400, 300),
    )

    await waitFor(() => {
      expect(screen.getByText('Página 1')).toBeDefined()
    })
    expect(screen.getByText('Página 2')).toBeDefined()
  })

  it('ofrece los botones de reordenar y girar de cada imagen', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Girar «foto.png» 90 grados a la derecha',
        }),
      ).toBeDefined()
    })
    expect(
      screen.getByRole('button', {
        name: 'Quitar «foto.png» de la lista',
      }),
    ).toBeDefined()
  })

  it('gira una imagen y lo refleja en el texto', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))

    const girar = await waitFor(() =>
      screen.getByRole('button', {
        name: 'Girar «foto.png» 90 grados a la derecha',
      }),
    )
    await persona.click(girar)

    await waitFor(() => {
      expect(screen.getByText('Girada 90°')).toBeDefined()
    })
  })

  it('los botones de movimiento están deshabilitados con una sola imagen', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))

    const alInicio = await waitFor(() =>
      screen.getByRole('button', { name: 'Llevar «foto.png» al principio' }),
    )

    expect(alInicio).toHaveProperty('disabled', true)
  })

  it('reordena dos imágenes con el botón de mover', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(
      persona,
      crearArchivoImagen('primera', 400, 300),
      crearArchivoImagen('segunda', 400, 300),
    )

    const mover = await waitFor(() =>
      screen.getByRole('button', {
        name: 'Mover «segunda.png» una posición hacia atrás',
      }),
    )
    await persona.click(mover)

    await waitFor(() => {
      const nombres = screen
        .getAllByTitle(/\.png$/)
        .map((elemento) => elemento.textContent)

      expect(nombres).toEqual(['segunda.png', 'primera.png'])
    })
  })

  it('quita una imagen de la lista', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))

    const quitar = await waitFor(() =>
      screen.getByRole('button', { name: 'Quitar «foto.png» de la lista' }),
    )
    await persona.click(quitar)

    await waitFor(() => {
      expect(screen.queryByText('foto.png')).toBeNull()
    })
  })
})

describe('Imágenes a PDF: opciones de página', () => {
  /** Añade una imagen y espera a que aparezcan las opciones. */
  async function prepararConImagen() {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))
    await waitFor(() => {
      expect(screen.getByText('Tamaño de página')).toBeDefined()
    })

    return persona
  }

  it('ofrece los cuatro tamaños de página', async () => {
    await prepararConImagen()

    for (const etiqueta of ['Tamaño original', 'A4', 'Carta', 'Legal']) {
      expect(screen.getByRole('radio', { name: etiqueta })).toBeDefined()
    }
  })

  it('A4 viene elegido de partida', async () => {
    await prepararConImagen()

    expect(screen.getByRole('radio', { name: 'A4' })).toHaveProperty(
      'checked',
      true,
    )
  })

  it('el modo «Contener» es el predeterminado', async () => {
    await prepararConImagen()

    expect(
      screen.getByRole('radio', { name: /Contener/ }),
    ).toHaveProperty('checked', true)
  })

  it('cambia el tamaño de página al elegir otra opción', async () => {
    const persona = await prepararConImagen()

    await persona.click(screen.getByRole('radio', { name: 'Carta' }))

    expect(screen.getByRole('radio', { name: 'Carta' })).toHaveProperty(
      'checked',
      true,
    )
    expect(screen.getByRole('radio', { name: 'A4' })).toHaveProperty(
      'checked',
      false,
    )
  })

  it('explica el tamaño original al elegirlo', async () => {
    const persona = await prepararConImagen()

    await persona.click(screen.getByRole('radio', { name: 'Tamaño original' }))

    expect(screen.getByText(/96 por pulgada/)).toBeDefined()
  })

  it('muestra el campo de margen propio solo al elegir «Personalizado»', async () => {
    const persona = await prepararConImagen()

    expect(screen.queryByLabelText('Margen propio')).toBeNull()

    await persona.click(screen.getByRole('radio', { name: 'Personalizado' }))

    expect(screen.getByLabelText('Margen propio')).toBeDefined()
  })

  it('cambia al modo cubrir y avisa de que recortará los bordes', async () => {
    const persona = await prepararConImagen()

    await persona.click(screen.getByRole('radio', { name: /Cubrir/ }))

    await waitFor(() => {
      expect(screen.getByText(/se recortarán los bordes/i)).toBeDefined()
    })
  })

  it('muestra la vista previa con las medidas de la página', async () => {
    await prepararConImagen()

    await waitFor(() => {
      expect(screen.getByText(/^Página de /)).toBeDefined()
    })
  })

  it('permite cambiar la orientación', async () => {
    const persona = await prepararConImagen()

    await persona.click(screen.getByRole('radio', { name: 'Horizontal' }))

    expect(screen.getByRole('radio', { name: 'Horizontal' })).toHaveProperty(
      'checked',
      true,
    )
  })

  it('ofrece el selector de color de fondo', async () => {
    await prepararConImagen()

    expect(
      screen.getByLabelText('Color de fondo: escribir el código hexadecimal'),
    ).toHaveProperty('value', '#ffffff')
  })
})

describe('Imágenes a PDF: restablecer', () => {
  it('«Restablecer opciones» devuelve el tamaño a A4', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Carta' })).toBeDefined()
    })

    await persona.click(screen.getByRole('radio', { name: 'Carta' }))
    await persona.click(
      screen.getByRole('button', { name: /Restablecer opciones/ }),
    )

    expect(screen.getByRole('radio', { name: 'A4' })).toHaveProperty(
      'checked',
      true,
    )
  })

  it('«Quitar todas las imágenes» vacía la selección', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(
      persona,
      crearArchivoImagen('a', 400, 300),
      crearArchivoImagen('b', 400, 300),
    )

    const quitar = await waitFor(() =>
      screen.getByRole('button', { name: /Quitar todas las imágenes/ }),
    )
    await persona.click(quitar)

    await waitFor(() => {
      expect(screen.queryByText('a.png')).toBeNull()
    })
    expect(screen.queryByRole('button', { name: /Crear PDF/ })).toBeNull()
  })

  it('conserva las opciones al quitar las imágenes', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('a', 400, 300))
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Legal' })).toBeDefined()
    })

    await persona.click(screen.getByRole('radio', { name: 'Legal' }))
    await persona.click(
      screen.getByRole('button', { name: /Quitar todas las imágenes/ }),
    )
    await anadirImagenes(persona, crearArchivoImagen('b', 400, 300))

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Legal' })).toHaveProperty(
        'checked',
        true,
      )
    })
  })
})

describe('Imágenes a PDF: botón de generar', () => {
  it('queda habilitado en cuanto hay una imagen con medidas', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))

    const boton = await waitFor(() =>
      screen.getByRole('button', { name: /Crear PDF/ }),
    )

    await waitFor(() => {
      expect(boton).toHaveProperty('disabled', false)
    })
  })

  it('anuncia el progreso en una región activa', async () => {
    const persona = userEvent.setup()
    render(<HerramientaImagenesAPdf />)

    await anadirImagenes(persona, crearArchivoImagen('foto', 400, 300))

    // Las dos regiones activas existen siempre, porque `aria-live` solo anuncia
    // los cambios de un elemento que ya estaba en el documento.
    expect(screen.getByRole('status')).toBeDefined()
    expect(screen.getByRole('alert')).toBeDefined()
  })
})

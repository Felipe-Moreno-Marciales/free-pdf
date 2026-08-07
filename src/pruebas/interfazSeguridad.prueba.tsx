import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CampoContrasena } from '../componentes/CampoContrasena'
import { SelectorPermisosPdf } from '../componentes/SelectorPermisosPdf'
import { HerramientaProtegerPdf } from '../funcionalidades/proteger-pdf/HerramientaProtegerPdf'
import { PERMISOS_PREDETERMINADOS } from '../seguridad/qpdf/permisosPdf'

/**
 * Pruebas de interfaz de la categoría de seguridad.
 *
 * No ejecutan qpdf: el motor se comprueba con el motor real en
 * `motorQpdf.prueba.ts`. Aquí se verifica lo que la persona ve y puede hacer, y
 * sobre todo que **las contraseñas se tratan con cuidado**: campos ocultos,
 * confirmación obligatoria y ningún valor filtrado en los mensajes.
 */

/** Crea un PDF de prueba como archivo, sin necesitar pdf-lib en la interfaz. */
function crearArchivoPdf(nombre = 'documento.pdf'): File {
  const contenido = new TextEncoder().encode(
    '%PDF-1.4\ntrailer<</Root 1 0 R>>\nstartxref\n0\n%%EOF',
  )

  return new File([contenido], nombre, { type: 'application/pdf' })
}

describe('CampoContrasena', () => {
  it('oculta la contraseña de partida', () => {
    render(
      <CampoContrasena
        etiqueta="Contraseña"
        valor="secreto"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe(
      'password',
    )
  })

  it('muestra la contraseña solo tras una acción explícita', async () => {
    const persona = userEvent.setup()
    render(
      <CampoContrasena
        etiqueta="Contraseña"
        valor="secreto"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    await persona.click(screen.getByRole('button', { name: /Mostrar/ }))

    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('text')
  })

  it('el botón anuncia su estado con aria-pressed', async () => {
    const persona = userEvent.setup()
    render(
      <CampoContrasena
        etiqueta="Contraseña"
        valor="secreto"
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    const boton = screen.getByRole('button', { name: /Mostrar/ })
    expect(boton.getAttribute('aria-pressed')).toBe('false')

    await persona.click(boton)

    expect(
      screen.getByRole('button', { name: /Ocultar/ }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('comunica lo que se escribe', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <CampoContrasena
        etiqueta="Contraseña"
        valor=""
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    await persona.type(screen.getByLabelText('Contraseña'), 'a')

    expect(alCambiar).toHaveBeenCalledWith('a')
  })

  it('indica la longitud y aconseja sobre ella', () => {
    render(
      <CampoContrasena
        etiqueta="Contraseña"
        valor="abc"
        deshabilitado={false}
        alCambiar={vi.fn()}
        mostrarFuerza
      />,
    )

    expect(screen.getByText(/3 caracteres/)).toBeDefined()
    expect(screen.getByText(/Muy corta/)).toBeDefined()
  })

  it('reconoce una contraseña de buena longitud', () => {
    render(
      <CampoContrasena
        etiqueta="Contraseña"
        valor="contraseña-muy-larga"
        deshabilitado={false}
        alCambiar={vi.fn()}
        mostrarFuerza
      />,
    )

    expect(screen.getByText(/Buena longitud/)).toBeDefined()
  })

  it('marca el campo como inválido y asocia el mensaje', () => {
    render(
      <CampoContrasena
        etiqueta="Contraseña"
        valor="abc"
        deshabilitado={false}
        alCambiar={vi.fn()}
        mensajeError="No coinciden"
      />,
    )

    const campo = screen.getByLabelText('Contraseña')

    expect(campo.getAttribute('aria-invalid')).toBe('true')
    expect(campo.getAttribute('aria-describedby')).not.toBeNull()
    expect(screen.getByText('No coinciden')).toBeDefined()
  })

  it('se deshabilita el campo y el botón', () => {
    render(
      <CampoContrasena
        etiqueta="Contraseña"
        valor="x"
        deshabilitado
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Contraseña')).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: /Mostrar/ })).toHaveProperty(
      'disabled',
      true,
    )
  })
})

describe('SelectorPermisosPdf', () => {
  it('advierte de que los permisos dependen del lector', () => {
    render(
      <SelectorPermisosPdf
        permisos={PERMISOS_PREDETERMINADOS}
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByText(/decida respetarlos/)).toBeDefined()
    expect(screen.getByText(/sí cifra el contenido/)).toBeDefined()
  })

  it('explica que la accesibilidad se permite siempre', () => {
    render(
      <SelectorPermisosPdf
        permisos={PERMISOS_PREDETERMINADOS}
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByText(/se permite siempre/)).toBeDefined()
  })

  it('no ofrece un control de accesibilidad que no tendría efecto', () => {
    render(
      <SelectorPermisosPdf
        permisos={PERMISOS_PREDETERMINADOS}
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole('checkbox', { name: /tecnología asistiva/ }),
    ).toBeNull()
  })

  it('ofrece los tres niveles de impresión', () => {
    render(
      <SelectorPermisosPdf
        permisos={PERMISOS_PREDETERMINADOS}
        deshabilitado={false}
        alCambiar={vi.fn()}
      />,
    )

    expect(screen.getByRole('radio', { name: 'Permitir imprimir' })).toBeDefined()
    expect(
      screen.getByRole('radio', { name: 'Solo baja resolución' }),
    ).toBeDefined()
    expect(
      screen.getByRole('radio', { name: 'No permitir imprimir' }),
    ).toBeDefined()
  })

  it('comunica el cambio de un permiso', async () => {
    const persona = userEvent.setup()
    const alCambiar = vi.fn()
    render(
      <SelectorPermisosPdf
        permisos={PERMISOS_PREDETERMINADOS}
        deshabilitado={false}
        alCambiar={alCambiar}
      />,
    )

    await persona.click(
      screen.getByRole('checkbox', { name: /Copiar texto e imágenes/ }),
    )

    expect(alCambiar).toHaveBeenCalledWith({ extraccion: true })
  })

  it('deshabilita todos los controles cuando corresponde', () => {
    render(
      <SelectorPermisosPdf
        permisos={PERMISOS_PREDETERMINADOS}
        deshabilitado
        alCambiar={vi.fn()}
      />,
    )

    for (const casilla of screen.getAllByRole('checkbox')) {
      expect(casilla).toHaveProperty('disabled', true)
    }
  })
})

describe('Proteger PDF: interfaz', () => {
  it('explica el cifrado antes de pedir nada', () => {
    render(<HerramientaProtegerPdf />)

    expect(screen.getByText(/AES de 256 bits/)).toBeDefined()
    expect(screen.getByText(/no se guarda en ningún sitio/)).toBeDefined()
  })

  it('pide primero el documento', () => {
    render(<HerramientaProtegerPdf />)

    expect(
      screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
    ).toBeDefined()
    expect(screen.queryByLabelText('Contraseña de apertura')).toBeNull()
  })

  it('muestra los campos de contraseña al elegir un documento', async () => {
    const persona = userEvent.setup()
    render(<HerramientaProtegerPdf />)

    await persona.upload(
      screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
      crearArchivoPdf(),
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Contraseña de apertura')).toBeDefined()
    })
    expect(
      screen.getByLabelText('Repite la contraseña de apertura'),
    ).toBeDefined()
  })

  it('el botón de proteger está deshabilitado sin contraseña', async () => {
    const persona = userEvent.setup()
    render(<HerramientaProtegerPdf />)

    await persona.upload(
      screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
      crearArchivoPdf(),
    )

    const boton = await waitFor(() =>
      screen.getByRole('button', { name: /Proteger el PDF/ }),
    )

    expect(boton).toHaveProperty('disabled', true)
  })

  it('avisa cuando las dos contraseñas no coinciden', async () => {
    const persona = userEvent.setup()
    render(<HerramientaProtegerPdf />)

    await persona.upload(
      screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
      crearArchivoPdf(),
    )

    const campo = await waitFor(() =>
      screen.getByLabelText('Contraseña de apertura'),
    )
    await persona.type(campo, 'contraseña-larga')
    await persona.type(
      screen.getByLabelText('Repite la contraseña de apertura'),
      'otra-distinta-larga',
    )

    await waitFor(() => {
      expect(screen.getByText(/no coinciden/)).toBeDefined()
    })
    expect(
      screen.getByRole('button', { name: /Proteger el PDF/ }),
    ).toHaveProperty('disabled', true)
  })

  it('habilita el botón cuando la configuración es válida', async () => {
    const persona = userEvent.setup()
    render(<HerramientaProtegerPdf />)

    await persona.upload(
      screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
      crearArchivoPdf(),
    )

    const campo = await waitFor(() =>
      screen.getByLabelText('Contraseña de apertura'),
    )
    await persona.type(campo, 'contraseña-larga')
    await persona.type(
      screen.getByLabelText('Repite la contraseña de apertura'),
      'contraseña-larga',
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Proteger el PDF/ }),
      ).toHaveProperty('disabled', false)
    })
  })

  it('explica la contraseña de propietario generada', async () => {
    const persona = userEvent.setup()
    render(<HerramientaProtegerPdf />)

    await persona.upload(
      screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
      crearArchivoPdf(),
    )

    await waitFor(() => {
      expect(screen.getByText(/se genera una aleatoria/)).toBeDefined()
    })
  })

  it('permite elegir la contraseña de propietario', async () => {
    const persona = userEvent.setup()
    render(<HerramientaProtegerPdf />)

    await persona.upload(
      screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
      crearArchivoPdf(),
    )

    const casilla = await waitFor(() =>
      screen.getByRole('checkbox', {
        name: /Elegir yo la contraseña de propietario/,
      }),
    )
    await persona.click(casilla)

    await waitFor(() => {
      expect(screen.getByLabelText('Contraseña de propietario')).toBeDefined()
    })
  })

  it('«Empezar de nuevo» vuelve a pedir el documento', async () => {
    const persona = userEvent.setup()
    render(<HerramientaProtegerPdf />)

    await persona.upload(
      screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
      crearArchivoPdf(),
    )

    const reiniciar = await waitFor(() =>
      screen.getByRole('button', { name: /Empezar de nuevo/ }),
    )
    await persona.click(reiniciar)

    await waitFor(() => {
      expect(
        screen.getByLabelText('Seleccionar el PDF que se va a proteger'),
      ).toBeDefined()
    })
  })

  it('publica los mensajes en regiones activas', () => {
    render(<HerramientaProtegerPdf />)

    expect(screen.getByRole('status')).toBeDefined()
    expect(screen.getByRole('alert')).toBeDefined()
  })

  it('rechaza un archivo que no es PDF', async () => {
    const persona = userEvent.setup()
    render(<HerramientaProtegerPdf />)

    const zona = screen
      .getByLabelText('Seleccionar el PDF que se va a proteger')
      .closest('.zona-arrastre')

    // El selector filtra por «accept», así que un archivo no admitido solo puede
    // llegar arrastrándolo: es la vía que se comprueba.
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.drop(zona as HTMLElement, {
      dataTransfer: {
        files: [new File([new Uint8Array([1])], 'notas.txt', { type: 'text/plain' })],
        types: ['Files'],
      },
    })

    await waitFor(() => {
      expect(screen.getByText(/no es un archivo PDF/)).toBeDefined()
    })
    void persona
  })
})

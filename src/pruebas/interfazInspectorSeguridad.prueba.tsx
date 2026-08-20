import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Aplicacion } from '../Aplicacion'
import { HerramientaInspeccionarSeguridad } from '../funcionalidades/inspeccionar-seguridad/HerramientaInspeccionarSeguridad'
import type {
  HallazgoSeguridad,
  InformeSeguridadPdf,
  NivelRiesgo,
} from '../seguridad/inspeccion/tipos'
import { ErrorQpdf } from '../seguridad/qpdf/erroresQpdf'

const dobles = vi.hoisted(() => ({
  analizarSeguridad: vi.fn(),
  destruir: vi.fn(),
}))

vi.mock('../seguridad/qpdf/crearProcesadorQpdf', () => ({
  crearProcesadorQpdf: () => ({
    analizarSeguridad: dobles.analizarSeguridad,
    destruir: dobles.destruir,
    estaActivo: () => true,
  }),
}))

const HALLAZGO_JAVASCRIPT: HallazgoSeguridad = {
  tipo: 'javascript',
  severidad: 'media',
  titulo: 'JavaScript incrustado',
  descripcion: 'El documento contiene una acción escrita en JavaScript.',
  cantidad: 1,
  contextos: ['objects.obj:4 0 R.value./OpenAction'],
}

const HALLAZGO_LAUNCH: HallazgoSeguridad = {
  tipo: 'launch',
  severidad: 'alta',
  titulo: 'Apertura de programas o recursos',
  descripcion:
    'El documento puede pedir a determinados lectores que abran un programa, archivo u otro recurso.',
  cantidad: 2,
  contextos: ['objects.obj:8 0 R.value./S'],
}

function crearInforme(
  nivel: NivelRiesgo,
  hallazgos: readonly HallazgoSeguridad[] = [],
): InformeSeguridadPdf {
  return {
    nivel,
    hallazgos,
    archivosIncrustados: [],
    numeroPaginas: 2,
    estructuraValida: true,
    estadoEstructura: 'valida',
    cifrado: false,
    analisisCompleto: true,
    advertenciasTecnicas: [],
  }
}

function crearArchivoPdf(nombre = 'contrato.pdf'): File {
  const archivo = new File(
    ['%PDF-1.4\ntrailer<</Root 1 0 R>>\nstartxref\n0\n%%EOF'],
    nombre,
    { type: 'application/pdf' },
  )

  Object.defineProperty(archivo, 'arrayBuffer', {
    configurable: true,
    value: vi.fn(async () => new TextEncoder().encode('%PDF-1.4').buffer),
  })

  return archivo
}

async function seleccionarPdf(archivo = crearArchivoPdf()): Promise<void> {
  const persona = userEvent.setup()
  await persona.upload(
    screen.getByLabelText('Seleccionar el PDF que se va a inspeccionar'),
    archivo,
  )
}

beforeEach(() => {
  dobles.analizarSeguridad.mockReset()
  dobles.destruir.mockReset()
})

describe('Inspector de seguridad PDF: acceso y explicación', () => {
  it('se abre desde el catálogo mediante carga diferida', async () => {
    const persona = userEvent.setup()
    render(<Aplicacion />)

    await persona.click(
      screen.getByRole('button', {
        name: 'Abrir la herramienta Inspector de seguridad PDF',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: /Inspector de seguridad PDF/,
      }),
    ).toBeDefined()
    expect(window.location.hash).toBe('#/inspeccionar-seguridad')
  })

  it('explica la privacidad, el alcance y las limitaciones antes de seleccionar', () => {
    render(<HerramientaInspeccionarSeguridad />)

    expect(screen.getByText(/Todo el análisis ocurre en tu navegador/)).toBeDefined()
    expect(screen.getByText(/no ejecuta JavaScript ni acciones/)).toBeDefined()
    expect(screen.getByText(/no sustituye a un antivirus/)).toBeDefined()
    expect(
      screen.getByLabelText('Seleccionar el PDF que se va a inspeccionar'),
    ).toBeDefined()
  })
})

describe('Inspector de seguridad PDF: análisis', () => {
  it('analiza automáticamente y anuncia el estado mientras espera', async () => {
    let resolver: ((informe: InformeSeguridadPdf) => void) | undefined
    dobles.analizarSeguridad.mockImplementation(
      () =>
        new Promise<InformeSeguridadPdf>((resuelta) => {
          resolver = resuelta
        }),
    )
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()

    expect(screen.getByRole('status').textContent).toContain(
      'Analizando la estructura del documento',
    )
    expect(
      screen.getByRole('button', { name: 'Cancelar y empezar de nuevo' }),
    ).toHaveProperty('disabled', false)
    expect(dobles.analizarSeguridad).toHaveBeenCalledTimes(1)

    resolver?.(crearInforme('sin-indicios'))
    await screen.findByText('Sin indicadores estructurales relevantes')
  })

  it('muestra archivo, tamaño, páginas y un resultado sin indicios', async () => {
    dobles.analizarSeguridad.mockResolvedValue(crearInforme('sin-indicios'))
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()

    expect(await screen.findByText('Sin indicadores estructurales relevantes')).toBeDefined()
    expect(screen.getByText('contrato.pdf')).toBeDefined()
    expect(screen.getByText(/2 páginas/)).toBeDefined()
    expect(screen.getByText('Estructura legible')).toBeDefined()
    expect(screen.queryByText('Estructura legible por qpdf')).toBeNull()
    expect(
      screen.getByText(/No se encontraron indicadores estructurales relevantes entre/),
    ).toBeDefined()
    expect(screen.getByText(/ni garantiza que el archivo sea seguro/)).toBeDefined()
  })

  it('explica un resultado que requiere precaución', async () => {
    dobles.analizarSeguridad.mockResolvedValue(
      crearInforme('precaucion', [HALLAZGO_JAVASCRIPT]),
    )
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()

    expect(await screen.findByText('Requiere precaución')).toBeDefined()
    expect(screen.getByRole('heading', { name: 'JavaScript incrustado' })).toBeDefined()
    expect(screen.getAllByText('1 coincidencia').length).toBeGreaterThan(0)
    expect(screen.getByText('Severidad: Media')).toBeDefined()
  })

  it('muestra un informe completo cuando qpdf pudo leer un PDF cifrado', async () => {
    dobles.analizarSeguridad.mockResolvedValue({
      ...crearInforme('bajo'),
      cifrado: true,
    })
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()

    const resultado = await screen.findByRole('heading', {
      name: 'Resultado del análisis',
    })
    const seccion = resultado.closest('section')

    expect(seccion).not.toBeNull()
    const filaCifrado = within(seccion as HTMLElement)
      .getByText('Documento cifrado')
      .closest('li')
    expect(filaCifrado?.textContent).toContain('Sí')
    expect(screen.queryByRole('heading', { name: 'El documento está cifrado' })).toBeNull()
  })

  it('señala con texto un resultado elevado y no depende solo del color', async () => {
    dobles.analizarSeguridad.mockResolvedValue(
      crearInforme('elevado', [HALLAZGO_LAUNCH]),
    )
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()

    expect(await screen.findByText('Riesgo estructural elevado')).toBeDefined()
    expect(
      screen.getByRole('heading', { name: 'Apertura de programas o recursos' }),
    ).toBeDefined()
    expect(screen.getAllByText('2 coincidencias').length).toBeGreaterThan(0)
    expect(screen.getByText('Severidad: Alta')).toBeDefined()
  })

  it('ofrece detalles técnicos acotados de hallazgos y adjuntos', async () => {
    dobles.analizarSeguridad.mockResolvedValue({
      ...crearInforme('elevado', [HALLAZGO_LAUNCH]),
      archivosIncrustados: [
        {
          nombre: 'instrucciones.cmd',
          extension: '.cmd',
          tipoDeclarado: 'application/octet-stream',
          aparentaEjecutable: true,
          referencia: '12 0 R',
        },
      ],
      advertenciasTecnicas: ['qpdf: objeto recuperado'],
    })
    const persona = userEvent.setup()
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()
    const detalles = await screen.findByText('Detalles técnicos')
    const bloque = detalles.closest('details')

    expect(bloque).not.toBeNull()
    expect(bloque?.hasAttribute('open')).toBe(false)
    await persona.click(detalles)

    expect(bloque?.hasAttribute('open')).toBe(true)
    expect(within(bloque as HTMLElement).getByText('/Launch')).toBeDefined()
    expect(within(bloque as HTMLElement).getByText(/instrucciones\.cmd/)).toBeDefined()
    expect(within(bloque as HTMLElement).getByText(/qpdf: objeto recuperado/)).toBeDefined()
  })

  it('restablece la interfaz y destruye el Worker', async () => {
    dobles.analizarSeguridad.mockResolvedValue(crearInforme('bajo'))
    const persona = userEvent.setup()
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()
    await screen.findByText('Características de riesgo bajo')
    const botonRestablecer = screen.getByRole('button', {
      name: 'Empezar de nuevo',
    })
    expect(document.activeElement).toBe(botonRestablecer)
    await persona.click(botonRestablecer)

    expect(dobles.destruir).toHaveBeenCalledTimes(1)
    const selector = screen.getByLabelText(
      'Seleccionar el PDF que se va a inspeccionar',
    )
    expect(selector).toBeDefined()
    expect(document.activeElement).toBe(selector)
    expect(screen.queryByText('contrato.pdf')).toBeNull()
  })

  it('cancela un análisis en curso e ignora su respuesta tardía', async () => {
    let resolver: ((informe: InformeSeguridadPdf) => void) | undefined
    dobles.analizarSeguridad.mockImplementation(
      () =>
        new Promise<InformeSeguridadPdf>((resuelta) => {
          resolver = resuelta
        }),
    )
    const persona = userEvent.setup()
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()
    await persona.click(
      screen.getByRole('button', { name: 'Cancelar y empezar de nuevo' }),
    )
    resolver?.(crearInforme('elevado', [HALLAZGO_LAUNCH]))

    await waitFor(() => {
      expect(
        screen.getByLabelText('Seleccionar el PDF que se va a inspeccionar'),
      ).toBeDefined()
    })
    expect(dobles.destruir).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Riesgo estructural elevado')).toBeNull()
  })

  it('no inicia qpdf si se cancela mientras todavía se lee el archivo', async () => {
    let resolverLectura: ((bytes: ArrayBuffer) => void) | undefined
    const archivo = crearArchivoPdf('grande.pdf')
    Object.defineProperty(archivo, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(
        () =>
          new Promise<ArrayBuffer>((resuelta) => {
            resolverLectura = resuelta
          }),
      ),
    })
    const persona = userEvent.setup()
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf(archivo)
    await persona.click(
      screen.getByRole('button', { name: 'Cancelar y empezar de nuevo' }),
    )
    resolverLectura?.(new TextEncoder().encode('%PDF-1.4').buffer)

    await waitFor(() => {
      expect(
        screen.getByLabelText('Seleccionar el PDF que se va a inspeccionar'),
      ).toBeDefined()
    })
    expect(dobles.analizarSeguridad).not.toHaveBeenCalled()
  })
})

describe('Inspector de seguridad PDF: errores y accesibilidad', () => {
  it('rechaza un archivo que no es PDF en la región de alerta', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<HerramientaInspeccionarSeguridad />)
    const zona = screen
      .getByLabelText('Seleccionar el PDF que se va a inspeccionar')
      .closest('.zona-arrastre')

    fireEvent.drop(zona as HTMLElement, {
      dataTransfer: {
        files: [new File(['texto'], 'notas.txt', { type: 'text/plain' })],
        types: ['Files'],
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'no es un archivo PDF',
      )
    })
    expect(dobles.analizarSeguridad).not.toHaveBeenCalled()
  })

  it('muestra un fallo del motor sin inventar una clasificación', async () => {
    dobles.analizarSeguridad.mockRejectedValue(
      new Error('No se pudo interpretar el JSON estructural.'),
    )
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'No se pudo interpretar el JSON estructural.',
      )
    })
    expect(screen.queryByRole('heading', { name: 'Resultado del análisis' })).toBeNull()
  })

  it('un PDF cifrado remite a Desbloquear PDF y no muestra resultado parcial', async () => {
    dobles.analizarSeguridad.mockRejectedValue(
      new ErrorQpdf('ya-esta-cifrado', 'El documento está cifrado.'),
    )
    render(<HerramientaInspeccionarSeguridad />)

    await seleccionarPdf()

    const tituloAviso = await screen.findByRole('heading', {
      name: 'El documento está cifrado',
    })
    const avisoCifrado = tituloAviso.closest('[role="note"]')

    expect(avisoCifrado).not.toBeNull()
    expect(
      within(avisoCifrado as HTMLElement).getByText(
        /No se pudo realizar una inspección completa porque el documento está cifrado/,
      ),
    ).toBeDefined()
    expect(within(avisoCifrado as HTMLElement).queryByText(/qpdf/i)).toBeNull()
    expect(
      screen.getAllByText(/Desbloquéalo primero con «Desbloquear PDF»/),
    ).toHaveLength(2)
    expect(screen.getByText(/no se muestra ningún nivel de riesgo/)).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Resultado del análisis' })).toBeNull()
    expect(screen.getByRole('alert').textContent).toBe('')
    expect(screen.getByRole('status').textContent).toContain(
      'No se pudo completar la inspección porque el documento está cifrado',
    )
  })

  it('publica progreso y errores en regiones activas accesibles', () => {
    render(<HerramientaInspeccionarSeguridad />)

    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive')
  })
})

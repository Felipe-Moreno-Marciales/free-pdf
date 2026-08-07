import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Encabezado } from '../componentes/Encabezado'

function simularPreferenciaOscura(oscura: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches: oscura })),
  })
}

describe('selector de tema', () => {
  it('parte de la preferencia del dispositivo y permite volver al tema claro', async () => {
    simularPreferenciaOscura(true)
    const persona = userEvent.setup()
    render(<Encabezado />)

    const selector = screen.getByRole('button', {
      name: 'Cambiar al tema claro',
    })

    expect(selector.getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.dataset.tema).toBe('oscuro')

    await persona.click(selector)

    expect(
      screen.getByRole('button', { name: 'Cambiar al tema oscuro' }),
    ).toBeDefined()
    expect(document.documentElement.dataset.tema).toBe('claro')
  })

  it('cambia de claro a oscuro sin guardar preferencias persistentes', async () => {
    simularPreferenciaOscura(false)
    const guardarLocal = vi.spyOn(Storage.prototype, 'setItem')
    const persona = userEvent.setup()
    render(<Encabezado />)

    await persona.click(
      screen.getByRole('button', { name: 'Cambiar al tema oscuro' }),
    )

    await waitFor(() => {
      expect(document.documentElement.dataset.tema).toBe('oscuro')
    })
    expect(guardarLocal).not.toHaveBeenCalled()
  })
})

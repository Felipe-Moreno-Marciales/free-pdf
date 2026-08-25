import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAtajosHistorial } from '../ganchos/useAtajosHistorial'

/** Activa los atajos y deja en el documento un campo donde escribir. */
function montar(activo = true) {
  const deshacer = vi.fn()
  const rehacer = vi.fn()

  renderHook(() => useAtajosHistorial({ deshacer, rehacer, activo }))
  render(<textarea aria-label="Contenido" defaultValue="" />)

  return { deshacer, rehacer }
}

describe('useAtajosHistorial', () => {
  it('deshace con Ctrl+Z', () => {
    const { deshacer, rehacer } = montar()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    expect(deshacer).toHaveBeenCalledOnce()
    expect(rehacer).not.toHaveBeenCalled()
  })

  it('deshace con Cmd+Z, que es lo que llega desde macOS', () => {
    const { deshacer } = montar()

    fireEvent.keyDown(window, { key: 'z', metaKey: true })

    expect(deshacer).toHaveBeenCalledOnce()
  })

  it('rehace tanto con Ctrl+Mayús+Z como con Ctrl+Y', () => {
    const { deshacer, rehacer } = montar()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })

    expect(rehacer).toHaveBeenCalledTimes(2)
    expect(deshacer).not.toHaveBeenCalled()
  })

  it('no interviene dentro de un campo de escritura', () => {
    // Quien está corrigiendo una palabra espera que Ctrl+Z deshaga sus letras.
    const { deshacer } = montar()

    fireEvent.keyDown(screen.getByLabelText('Contenido'), {
      key: 'z',
      ctrlKey: true,
    })

    expect(deshacer).not.toHaveBeenCalled()
  })

  it('ignora la tecla sin el modificador', () => {
    const { deshacer } = montar()

    fireEvent.keyDown(window, { key: 'z' })

    expect(deshacer).not.toHaveBeenCalled()
  })

  it('no escucha nada mientras la herramienta está ocupada', () => {
    const { deshacer } = montar(false)

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    expect(deshacer).not.toHaveBeenCalled()
  })
})

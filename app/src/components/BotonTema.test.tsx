import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { CLAVE_TEMA } from '../lib/tema'
import { BotonTema } from './BotonTema'

afterEach(() => {
  delete document.documentElement.dataset.tema
  window.localStorage.clear()
})

describe('BotonTema', () => {
  it('issue #98: es un botón de alternar que arranca según el tema ya aplicado', () => {
    document.documentElement.dataset.tema = 'oscuro'
    render(<BotonTema />)

    const boton = screen.getByRole('button', { name: 'Modo oscuro' })
    expect(boton).toHaveAttribute('aria-pressed', 'true')
  })

  it('issue #98: al pulsarlo cambia el atributo de <html> y recuerda la elección', async () => {
    const usuario = userEvent.setup()
    render(<BotonTema />)

    const boton = screen.getByRole('button', { name: 'Modo oscuro' })
    expect(boton).toHaveAttribute('aria-pressed', 'false')

    await usuario.click(boton)
    expect(document.documentElement.dataset.tema).toBe('oscuro')
    expect(window.localStorage.getItem(CLAVE_TEMA)).toBe('oscuro')
    expect(boton).toHaveAttribute('aria-pressed', 'true')

    await usuario.click(boton)
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(window.localStorage.getItem(CLAVE_TEMA)).toBe('claro')
  })
})
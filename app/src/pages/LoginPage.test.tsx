import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import * as storage from '../lib/storage'
import { AuthProvider } from '../auth/AuthContext'
import { LoginPage } from './LoginPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerPerfil).mockRejectedValue(new api.ApiError(401, 'sin sesión'))
})

function renderLogin(): void {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('pide documento y contraseña', async () => {
    renderLogin()
    await waitFor(() => expect(screen.getByLabelText('Documento')).toBeInTheDocument())
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('muestra un error si las credenciales son incorrectas', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.login).mockRejectedValue(new api.ApiError(401, 'Documento o contraseña incorrectos'))
    renderLogin()
    await waitFor(() => expect(screen.getByLabelText('Documento')).toBeInTheDocument())

    await usuario.type(screen.getByLabelText('Documento'), '123456789')
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-mala')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Documento o contraseña incorrectos')
  })

  it('inicia sesión con credenciales correctas', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.login).mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'bearer',
      pin_configurado: true,
      debe_cambiar_password: false,
    })
    vi.mocked(storage.guardarTokens).mockResolvedValue(undefined)
    renderLogin()
    await waitFor(() => expect(screen.getByLabelText('Documento')).toBeInTheDocument())

    await usuario.type(screen.getByLabelText('Documento'), '123456789')
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-buena')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))

    await waitFor(() => expect(api.login).toHaveBeenCalledWith('123456789', 'clave-buena'))
  })
})

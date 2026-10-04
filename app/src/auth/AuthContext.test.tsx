import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import * as storage from '../lib/storage'
import type { MeResponse, TokenResponse } from '../lib/types'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')

const perfilAdmin: MeResponse = {
  documento: '999999999',
  activo: true,
  empleado_id: null,
  debe_cambiar_password: false,
  pin_configurado: true,
  roles: [{ id: 1, nombre: 'administrador', descripcion: null }],
}

const tokens: TokenResponse = {
  access_token: 'access-de-prueba',
  refresh_token: 'refresh-de-prueba',
  token_type: 'bearer',
  pin_configurado: true,
  debe_cambiar_password: false,
}

function Sonda(): React.JSX.Element {
  const { perfil, roles, tieneRol, iniciarSesion, cerrarSesion } = useAuth()
  return (
    <div>
      <span data-testid="estado">
        {perfil === undefined ? 'cargando' : perfil === null ? 'sin-sesion' : 'con-sesion'}
      </span>
      <span data-testid="roles">{roles.join(',')}</span>
      <span data-testid="es-admin">{tieneRol('administrador') ? 'si' : 'no'}</span>
      <button onClick={() => void iniciarSesion('999999999', 'clave')}>entrar</button>
      <button onClick={() => void cerrarSesion()}>salir</button>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AuthProvider', () => {
  it('arranca sin sesión cuando no hay perfil restaurable', async () => {
    vi.mocked(api.obtenerPerfil).mockRejectedValue(new api.ApiError(401, 'sin sesión'))

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )

    expect(screen.getByTestId('estado')).toHaveTextContent('cargando')
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('sin-sesion'))
  })

  it('restaura la sesión guardada al arrancar', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilAdmin)

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('con-sesion'))
    expect(screen.getByTestId('roles')).toHaveTextContent('administrador')
    expect(screen.getByTestId('es-admin')).toHaveTextContent('si')
  })

  it('iniciarSesion guarda los tokens y carga el perfil', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil)
      .mockRejectedValueOnce(new api.ApiError(401, 'sin sesión'))
      .mockResolvedValueOnce(perfilAdmin)
    vi.mocked(api.login).mockResolvedValue(tokens)

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('sin-sesion'))

    await usuario.click(screen.getByText('entrar'))

    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('con-sesion'))
    expect(storage.guardarTokens).toHaveBeenCalledWith('access-de-prueba', 'refresh-de-prueba')
  })

  it('cerrarSesion borra los tokens y vuelve a sin-sesion', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilAdmin)

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('estado')).toHaveTextContent('con-sesion'))

    await act(() => usuario.click(screen.getByText('salir')))

    expect(screen.getByTestId('estado')).toHaveTextContent('sin-sesion')
    expect(storage.borrarTokens).toHaveBeenCalled()
  })
})

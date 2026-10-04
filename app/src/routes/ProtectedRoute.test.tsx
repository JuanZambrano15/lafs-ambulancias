import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import { AuthProvider } from '../auth/AuthContext'
import type { MeResponse } from '../lib/types'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')

const perfilDebeCambiar: MeResponse = {
  documento: '123456789',
  activo: true,
  empleado_id: null,
  debe_cambiar_password: true,
  pin_configurado: false,
  roles: [],
}

const perfilNormal: MeResponse = { ...perfilDebeCambiar, debe_cambiar_password: false }

beforeEach(() => {
  vi.clearAllMocks()
})

function renderConRuta(rutaInicial: string): void {
  render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>pantalla de login</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/cambiar-password" element={<div>pantalla de cambiar contraseña</div>} />
            <Route path="/" element={<div>pantalla principal</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('redirige a /login cuando no hay sesión', async () => {
    vi.mocked(api.obtenerPerfil).mockRejectedValue(new api.ApiError(401, 'sin sesión'))
    renderConRuta('/')

    expect(await screen.findByText('pantalla de login')).toBeInTheDocument()
  })

  it('redirige a /cambiar-password cuando el usuario debe cambiarla', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilDebeCambiar)
    renderConRuta('/')

    expect(await screen.findByText('pantalla de cambiar contraseña')).toBeInTheDocument()
  })

  it('deja pasar a la ruta protegida con sesión normal', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilNormal)
    renderConRuta('/')

    expect(await screen.findByText('pantalla principal')).toBeInTheDocument()
  })

  it('no redirige en bucle cuando ya está en /cambiar-password', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilDebeCambiar)
    renderConRuta('/cambiar-password')

    await waitFor(() =>
      expect(screen.getByText('pantalla de cambiar contraseña')).toBeInTheDocument(),
    )
  })
})

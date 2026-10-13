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
  empleado_tipo_vinculacion: null,
  firma_guardada: null,
}

const perfilAdmin: MeResponse = {
  ...perfilDebeCambiar,
  debe_cambiar_password: false,
  roles: [{ id: 1, nombre: 'administrador', descripcion: null }],
}

const perfilConductor: MeResponse = {
  ...perfilAdmin,
  roles: [{ id: 2, nombre: 'conductor', descripcion: null }],
}

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
            <Route path="/usuarios" element={<div>pantalla de usuarios</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('redirige a /login cuando no hay sesión', async () => {
    vi.mocked(api.obtenerPerfil).mockRejectedValue(new api.ApiError(401, 'sin sesión'))
    renderConRuta('/usuarios')

    expect(await screen.findByText('pantalla de login')).toBeInTheDocument()
  })

  it('redirige a /cambiar-password cuando el usuario debe cambiarla', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilDebeCambiar)
    renderConRuta('/usuarios')

    expect(await screen.findByText('pantalla de cambiar contraseña')).toBeInTheDocument()
  })

  it('no redirige en bucle cuando ya está en /cambiar-password', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilDebeCambiar)
    renderConRuta('/cambiar-password')

    await waitFor(() =>
      expect(screen.getByText('pantalla de cambiar contraseña')).toBeInTheDocument(),
    )
  })

  it('deja pasar a la ruta protegida con sesión de administrador', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilAdmin)
    renderConRuta('/usuarios')

    expect(await screen.findByText('pantalla de usuarios')).toBeInTheDocument()
  })

  it('muestra un aviso, sin redirigir, cuando la sesión no es de administrador', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilConductor)
    renderConRuta('/usuarios')

    expect(
      await screen.findByText(/no tiene el rol de administrador/i),
    ).toBeInTheDocument()
  })
})
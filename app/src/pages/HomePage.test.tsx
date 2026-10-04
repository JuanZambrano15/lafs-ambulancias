import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import { AuthProvider } from '../auth/AuthContext'
import type { MeResponse } from '../lib/types'
import { HomePage } from './HomePage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')

function perfilCon(roles: MeResponse['roles']): MeResponse {
  return {
    documento: '123456789',
    activo: true,
    empleado_id: null,
    debe_cambiar_password: false,
    pin_configurado: true,
    roles,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HomePage', () => {
  it('muestra solo las secciones del rol conductor', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'conductor', descripcion: null }]),
    )

    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('Chequeo de ambulancia')).toBeInTheDocument())
    expect(screen.queryByText('Usuarios y roles')).not.toBeInTheDocument()
    expect(screen.queryByText('Atención SOAT')).not.toBeInTheDocument()
  })

  it('muestra las secciones combinadas cuando el usuario tiene varios roles', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([
        { id: 1, nombre: 'medico', descripcion: null },
        { id: 2, nombre: 'conductor', descripcion: null },
      ]),
    )

    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('Atención SOAT')).toBeInTheDocument())
    // "Formato de traslado" la comparten medico y auxiliar — no debe duplicarse.
    expect(screen.getAllByText('Formato de traslado')).toHaveLength(1)
    expect(screen.getByText('Chequeo de ambulancia')).toBeInTheDocument()
  })

  it('avisa cuando el usuario no tiene secciones asignadas', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon([]))

    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    )

    expect(
      await screen.findByText('Tu usuario no tiene secciones asignadas todavía.'),
    ).toBeInTheDocument()
  })
})

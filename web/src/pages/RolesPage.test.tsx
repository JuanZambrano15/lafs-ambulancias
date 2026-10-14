import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import { RolesPage } from './RolesPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))

const rolesIniciales = [
  { id: 1, nombre: 'administrador', descripcion: null },
  { id: 2, nombre: 'conductor', descripcion: 'Conduce la ambulancia' },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listarRoles).mockResolvedValue(rolesIniciales)
})

describe('RolesPage', () => {
  it('lista los roles existentes', async () => {
    render(<RolesPage />)

    expect(await screen.findByText('administrador')).toBeInTheDocument()
    expect(screen.getByText('conductor')).toBeInTheDocument()
    expect(screen.getByText('Conduce la ambulancia')).toBeInTheDocument()
  })

  it('crea un rol nuevo', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.crearRol).mockResolvedValue({ id: 3, nombre: 'contador', descripcion: null })
    render(<RolesPage />)
    await screen.findByText('administrador')

    await usuario.type(screen.getByLabelText('Nombre'), 'contador')
    await usuario.click(screen.getByRole('button', { name: 'Crear rol' }))

    await waitFor(() =>
      expect(api.crearRol).toHaveBeenCalledWith({ nombre: 'contador', descripcion: null }),
    )
  })

  it('muestra el error del backend al eliminar un rol todavía asignado', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.eliminarRol).mockRejectedValue(
      new api.ApiError(409, 'El rol todavía tiene usuarios asignados'),
    )
    render(<RolesPage />)
    await screen.findByText('administrador')

    await usuario.click(screen.getAllByText('Eliminar')[0])

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El rol todavía tiene usuarios asignados',
    )
  })
})
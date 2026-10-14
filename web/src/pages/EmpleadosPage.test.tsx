import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import type { Empleado } from '../lib/types'
import { EmpleadosPage } from './EmpleadosPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))

const empleadosIniciales: Empleado[] = [
  {
    id: 1,
    nombres: 'Carlos',
    apellidos: 'Gómez',
    cedula: '800000001',
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: true,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listarEmpleados).mockResolvedValue(empleadosIniciales)
})

describe('EmpleadosPage', () => {
  it('lista los empleados existentes', async () => {
    render(<EmpleadosPage />)

    expect(await screen.findByText('Carlos Gómez')).toBeInTheDocument()
    expect(screen.getByText('800000001')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('crea un empleado nuevo', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.crearEmpleado).mockResolvedValue({ ...empleadosIniciales[0], id: 2 })
    render(<EmpleadosPage />)
    await screen.findByText('Carlos Gómez')

    await usuario.type(screen.getByLabelText('Nombres'), 'Ana')
    await usuario.type(screen.getByLabelText('Apellidos'), 'Pérez')
    await usuario.type(screen.getByLabelText('Cédula'), '900000002')
    await usuario.click(screen.getByRole('button', { name: 'Crear empleado' }))

    await waitFor(() =>
      expect(api.crearEmpleado).toHaveBeenCalledWith({
        nombres: 'Ana',
        apellidos: 'Pérez',
        cedula: '900000002',
        telefono: null,
        tipo_vinculacion: 'planta',
      }),
    )
  })

  it('desactiva un empleado tras confirmar', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.desactivarEmpleado).mockResolvedValue(undefined)
    render(<EmpleadosPage />)
    await screen.findByText('Carlos Gómez')

    await usuario.click(screen.getByText('Desactivar'))

    await waitFor(() => expect(api.desactivarEmpleado).toHaveBeenCalledWith(1))
  })
})
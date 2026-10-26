import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import type { Ambulancia, AtencionCerrada, Empleado } from '../lib/types'
import { ServiciosCerradosPage } from './ServiciosCerradosPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))

const EMPLEADO: Empleado = {
  id: 1,
  nombres: 'Ana',
  apellidos: 'Ruiz',
  cedula: '700000001',
  telefono: null,
  tipo_vinculacion: 'planta',
  activo: true,
}

function ambulancia(overrides: Partial<Ambulancia> = {}): Ambulancia {
  return {
    id: 1,
    movil: 'M-01',
    placa: 'ABC123',
    tipo: 'basica',
    vencimiento_soat: '2027-01-01',
    vencimiento_tecnomecanica: '2027-01-01',
    activa: true,
    ...overrides,
  }
}

function atencionCerrada(overrides: Partial<AtencionCerrada> = {}): AtencionCerrada {
  return {
    id: 1,
    tipo: 'traslado',
    nivel_servicio: 'basico',
    estado: 'cerrado',
    abierta_en: '2026-01-01T10:00:00Z',
    cerrada_en: '2026-01-01T12:00:00Z',
    ambulancia: ambulancia(),
    conductor: EMPLEADO,
    responsable: EMPLEADO,
    paciente_nombres: 'Juan',
    paciente_apellidos: 'Pérez',
    paciente_numero_documento: '123456',
    tiene_pdf: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPagina(): void {
  render(
    <MemoryRouter>
      <ServiciosCerradosPage />
    </MemoryRouter>,
  )
}

describe('ServiciosCerradosPage', () => {
  it('lista los servicios cerrados con un enlace al detalle de cada uno', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([atencionCerrada()])
    renderPagina()

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver detalle' })).toHaveAttribute(
      'href',
      '/atenciones/1/detalle',
    )
  })

  it('muestra NN cuando el paciente de un accidente SOAT sigue sin identificar', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([
      atencionCerrada({
        tipo: 'atencion_soat',
        nivel_servicio: null,
        paciente_nombres: null,
        paciente_apellidos: null,
        paciente_numero_documento: null,
      }),
    ])
    renderPagina()

    expect(await screen.findByText('NN (sin identificar)')).toBeInTheDocument()
    expect(screen.getByText('SOAT')).toBeInTheDocument()
  })

  it('muestra un error si falla la carga', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockRejectedValue(new ApiError(500, 'Error raro'))
    renderPagina()

    expect(await screen.findByRole('alert')).toHaveTextContent('Error raro')
  })

  it('busca con el texto ingresado', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([])
    renderPagina()
    await waitFor(() => expect(api.listarAtencionesCerradas).toHaveBeenCalledWith())

    await userEvent.type(
      screen.getByPlaceholderText('Nombre, apellido o documento del paciente'),
      'Pérez',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(api.listarAtencionesCerradas).toHaveBeenLastCalledWith('Pérez'))
  })
})
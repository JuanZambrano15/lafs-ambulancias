import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import type { Ambulancia, AtencionCerrada, Empleado, FormatoVersionOut } from '../lib/types'
import { ServicioCerradoDetallePage } from './ServicioCerradoDetallePage'

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
    <MemoryRouter initialEntries={['/atenciones/1/detalle']}>
      <Routes>
        <Route path="/atenciones/:atencionId/detalle" element={<ServicioCerradoDetallePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ServicioCerradoDetallePage', () => {
  it('muestra los datos del formato y permite descargar el PDF', async () => {
    vi.mocked(api.obtenerAtencionCerrada).mockResolvedValue(atencionCerrada())
    vi.mocked(api.historialFormatoTraslado).mockResolvedValue([])
    renderPagina()

    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Traslado básico')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))
    expect(api.descargarPdfFormatoTraslado).toHaveBeenCalledWith(1)
  })

  it('no ofrece la sección de fotos para un traslado asistencial', async () => {
    vi.mocked(api.obtenerAtencionCerrada).mockResolvedValue(atencionCerrada())
    vi.mocked(api.historialFormatoTraslado).mockResolvedValue([])
    renderPagina()

    await screen.findByText('Juan Pérez')
    expect(screen.queryByRole('link', { name: 'Fotos' })).not.toBeInTheDocument()
  })

  it('ofrece la sección de fotos para un accidente SOAT', async () => {
    vi.mocked(api.obtenerAtencionCerrada).mockResolvedValue(
      atencionCerrada({ tipo: 'atencion_soat', nivel_servicio: null }),
    )
    vi.mocked(api.historialFormatoAccidenteSoat).mockResolvedValue([])
    renderPagina()

    await screen.findByText('Juan Pérez')
    expect(screen.getByRole('link', { name: 'Fotos' })).toHaveAttribute(
      'href',
      '/atenciones/1/fotos-accidente-soat',
    )
  })

  it('muestra el historial de versiones con quién/cuándo/motivo, sin contenido clínico', async () => {
    const version: FormatoVersionOut = {
      id: 10,
      atencion_id: 1,
      corregido_por: { id: 2, documento: '900000001' },
      corregido_en: '2026-02-01T08:00:00Z',
      motivo: 'Se corrigió el número de documento del paciente',
    }
    vi.mocked(api.obtenerAtencionCerrada).mockResolvedValue(atencionCerrada())
    vi.mocked(api.historialFormatoTraslado).mockResolvedValue([version])
    renderPagina()

    expect(
      await screen.findByText('Se corrigió el número de documento del paciente'),
    ).toBeInTheDocument()
    expect(screen.getByText('900000001', { exact: false })).toBeInTheDocument()
  })

  it('muestra un error si falla la carga del servicio', async () => {
    vi.mocked(api.obtenerAtencionCerrada).mockRejectedValue(new ApiError(404, 'No encontrada'))
    renderPagina()

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontrada')
  })
})
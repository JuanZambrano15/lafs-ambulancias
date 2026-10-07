import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { _reiniciarParaPruebas } from '../lib/offlineStore'
import type { Ambulancia, Empleado } from '../lib/types'
import { CrearAtencionPage } from './CrearAtencionPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
 
const ambulancia: Ambulancia = {
  id: 1,
  movil: 'M-01',
  placa: 'ABC123',
  tipo: 'basica',
  vencimiento_soat: '2027-01-01',
  vencimiento_tecnomecanica: '2027-01-01',
  activa: true,
}
 
const conductor: Empleado = {
  id: 2,
  nombres: 'Carlos',
  apellidos: 'Gómez',
  cedula: '800000001',
  telefono: null,
  tipo_vinculacion: 'planta',
  activo: true,
}
 
beforeEach(async () => {
  vi.clearAllMocks()
  await _reiniciarParaPruebas()
})
 
function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/atenciones/nueva']}>
      <Routes>
        <Route path="/" element={<div>pantalla principal</div>} />
        <Route path="/atenciones/nueva" element={<CrearAtencionPage />} />
        <Route path="/atenciones/:atencionId/encabezado-traslado" element={<div>encabezado</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
 
describe('CrearAtencionPage', () => {
  it('carga y muestra los móviles y conductores disponibles', async () => {
    vi.mocked(api.listarAmbulanciasDisponibles).mockResolvedValue([ambulancia])
    vi.mocked(api.listarConductoresDisponibles).mockResolvedValue([conductor])
 
    renderPagina()
 
    expect(await screen.findByText('M-01 — ABC123')).toBeInTheDocument()
    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument()
  })
 
  it('muestra un error si no se pueden cargar las listas', async () => {
    vi.mocked(api.listarAmbulanciasDisponibles).mockRejectedValue(
      new api.ApiError(500, 'Error del servidor'),
    )
    vi.mocked(api.listarConductoresDisponibles).mockResolvedValue([conductor])
 
    renderPagina()
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
  })
 
  it('al crear una atención de traslado, va al encabezado del formato', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarAmbulanciasDisponibles).mockResolvedValue([ambulancia])
    vi.mocked(api.listarConductoresDisponibles).mockResolvedValue([conductor])
    vi.mocked(api.crearAtencion).mockResolvedValue({
      id: 1,
      tipo: 'traslado',
      estado: 'abierto',
      abierta_en: '2026-10-03T12:00:00Z',
      cerrada_en: null,
      ambulancia,
      conductor,
      responsable: conductor,
    })
 
    renderPagina()
 
    await screen.findByText('M-01 — ABC123')
    await usuario.selectOptions(screen.getByLabelText('Móvil'), '1')
    await usuario.selectOptions(screen.getByLabelText('Conductor'), '2')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar atención' }))
 
    await waitFor(() =>
      expect(api.crearAtencion).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'traslado',
          ambulancia_id: 1,
          conductor_id: 2,
          // Generado en el dispositivo (issue #10) — siempre se manda,
          // también cuando hay conexión, para que un reintento no duplique.
          client_id: expect.any(String),
        }),
      ),
    )
    expect(await screen.findByText('encabezado')).toBeInTheDocument()
  })
 
  it('al crear una atención SOAT, vuelve a la pantalla principal', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarAmbulanciasDisponibles).mockResolvedValue([ambulancia])
    vi.mocked(api.listarConductoresDisponibles).mockResolvedValue([conductor])
    vi.mocked(api.crearAtencion).mockResolvedValue({
      id: 1,
      tipo: 'atencion_soat',
      estado: 'abierto',
      abierta_en: '2026-10-03T12:00:00Z',
      cerrada_en: null,
      ambulancia,
      conductor,
      responsable: conductor,
    })
 
    renderPagina()
 
    await screen.findByText('M-01 — ABC123')
    await usuario.selectOptions(screen.getByLabelText('Tipo de atención'), 'atencion_soat')
    await usuario.selectOptions(screen.getByLabelText('Móvil'), '1')
    await usuario.selectOptions(screen.getByLabelText('Conductor'), '2')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar atención' }))
 
    expect(await screen.findByText('pantalla principal')).toBeInTheDocument()
  })
 
  it('si no hay conexión, guarda la atención localmente y entra igual al encabezado (issue #10)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarAmbulanciasDisponibles).mockResolvedValue([ambulancia])
    vi.mocked(api.listarConductoresDisponibles).mockResolvedValue([conductor])
    // fetch lanza TypeError cuando no hay red — a diferencia de un
    // ApiError, que es una respuesta real del servidor.
    vi.mocked(api.crearAtencion).mockRejectedValue(new TypeError('Failed to fetch'))
 
    renderPagina()
 
    await screen.findByText('M-01 — ABC123')
    await usuario.selectOptions(screen.getByLabelText('Móvil'), '1')
    await usuario.selectOptions(screen.getByLabelText('Conductor'), '2')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar atención' }))
 
    expect(await screen.findByText('encabezado')).toBeInTheDocument()
  })
 
  it('muestra un error si falla al crear la atención', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarAmbulanciasDisponibles).mockResolvedValue([ambulancia])
    vi.mocked(api.listarConductoresDisponibles).mockResolvedValue([conductor])
    vi.mocked(api.crearAtencion).mockRejectedValue(
      new api.ApiError(409, 'Esa ambulancia ya tiene una atención abierta'),
    )
 
    renderPagina()
 
    await screen.findByText('M-01 — ABC123')
    await usuario.selectOptions(screen.getByLabelText('Móvil'), '1')
    await usuario.selectOptions(screen.getByLabelText('Conductor'), '2')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar atención' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esa ambulancia ya tiene una atención abierta',
    )
  })
})
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import type { FormatoTraslado } from '../lib/types'
import { EncabezadoTrasladoPage } from './EncabezadoTrasladoPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
 
const ENCABEZADO: FormatoTraslado = {
  atencion_id: 1,
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '123456789',
  paciente_eps: 'Nueva EPS',
  paciente_nombres: 'Pepito',
  paciente_apellidos: 'Pérez',
  paciente_edad: 45,
  paciente_sexo: 'm',
  paciente_direccion_residencial: 'Calle 1 # 2-3',
  paciente_ciudad: 'Cúcuta',
  paciente_telefono: '3001234567',
  acompanante_nombres_apellidos: 'María Pérez',
  acompanante_parentesco: 'Hermana',
  acompanante_telefono: '3007654321',
  recepcion_fecha: '2027-01-01',
  recepcion_hora: '08:00:00',
  recepcion_ciudad: 'Cúcuta',
  recepcion_ips: 'Clínica Norte',
  recepcion_servicio: 'Urgencias',
  entrega_fecha: '2027-01-01',
  entrega_hora: '09:30:00',
  entrega_ciudad: 'Cúcuta',
  entrega_ips: 'Hospital Universitario',
  entrega_servicio: 'UCI',
  complejidad: 'alta',
  categoria_paciente: 'adulto',
  nivel_servicio: 'medicalizado',
  modalidad: 'sencillo',
  diagnostico: null,
  tratamiento: [],
  tratamiento_otro: null,
  pupila_derecha: null,
  pupila_izquierda: null,
  signos_vitales: [],
  lesiones: [],
  lesion_otro: null,
  glasgow_ocular: null,
  glasgow_verbal: null,
  glasgow_motora: null,
  insumos_entregados: [],
  nota_auxiliar: null,
  atendido_por: null,
  nota_medica: null,
  evolucionado_por: null,
  glasgow_total: null,
}
 
beforeEach(() => {
  vi.clearAllMocks()
})
 
function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/atenciones/1/encabezado-traslado']}>
      <Routes>
        <Route path="/" element={<div>pantalla principal</div>} />
        <Route
          path="/atenciones/:atencionId/encabezado-traslado"
          element={<EncabezadoTrasladoPage />}
        />
        <Route path="/atenciones/:atencionId/clinico-traslado" element={<div>clinico</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
 
describe('EncabezadoTrasladoPage', () => {
  it('arranca en blanco si la atención todavía no tiene encabezado', async () => {
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(null)
 
    renderPagina()
 
    expect(await screen.findByLabelText('Nombres')).toHaveValue('')
  })
 
  it('precarga el formulario si ya hay un encabezado guardado', async () => {
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(ENCABEZADO)
 
    renderPagina()
 
    expect(await screen.findByLabelText('Nombres')).toHaveValue('Pepito')
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Pérez')
    expect(screen.getByLabelText('Edad')).toHaveValue(45)
  })
 
  it('muestra un error si falla la carga del encabezado', async () => {
    vi.mocked(api.obtenerEncabezadoTraslado).mockRejectedValue(
      new api.ApiError(500, 'Error del servidor'),
    )
 
    renderPagina()
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
  })
 
  it('guarda el encabezado y continúa a la parte clínica', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(null)
    vi.mocked(api.guardarEncabezadoTraslado).mockResolvedValue(ENCABEZADO)
 
    renderPagina()
 
    await screen.findByLabelText('Nombres')
    await usuario.type(screen.getByLabelText('Número de documento'), '123456789')
    await usuario.type(screen.getByLabelText('EPS'), 'Nueva EPS')
    await usuario.type(screen.getByLabelText('Nombres'), 'Pepito')
    await usuario.type(screen.getByLabelText('Apellidos'), 'Pérez')
    await usuario.type(screen.getByLabelText('Edad'), '45')
    await usuario.type(screen.getByLabelText('Dirección residencial'), 'Calle 1 # 2-3')
    await usuario.type(screen.getByLabelText('Ciudad', { selector: '#ciudad-paciente' }), 'Cúcuta')
    await usuario.type(screen.getByLabelText('Fecha', { selector: '#recepcion-fecha' }), '2027-01-01')
    await usuario.type(screen.getByLabelText('Hora', { selector: '#recepcion-hora' }), '08:00')
    await usuario.type(screen.getByLabelText('Ciudad', { selector: '#recepcion-ciudad' }), 'Cúcuta')
    await usuario.type(screen.getByLabelText('IPS', { selector: '#recepcion-ips' }), 'Clínica Norte')
    await usuario.type(
      screen.getByLabelText('Servicio', { selector: '#recepcion-servicio' }),
      'Urgencias',
    )
    await usuario.type(screen.getByLabelText('Fecha', { selector: '#entrega-fecha' }), '2027-01-01')
    await usuario.type(screen.getByLabelText('Hora', { selector: '#entrega-hora' }), '09:30')
    await usuario.type(screen.getByLabelText('Ciudad', { selector: '#entrega-ciudad' }), 'Cúcuta')
    await usuario.type(
      screen.getByLabelText('IPS', { selector: '#entrega-ips' }),
      'Hospital Universitario',
    )
    await usuario.type(screen.getByLabelText('Servicio', { selector: '#entrega-servicio' }), 'UCI')
 
    await usuario.click(screen.getByRole('button', { name: 'Guardar encabezado' }))
 
    await waitFor(() => expect(api.guardarEncabezadoTraslado).toHaveBeenCalledTimes(1))
    const [atencionId, datos] = vi.mocked(api.guardarEncabezadoTraslado).mock.calls[0]
    expect(atencionId).toBe(1)
    expect(datos.paciente_nombres).toBe('Pepito')
    expect(datos.paciente_edad).toBe(45)
    expect(datos.acompanante_nombres_apellidos).toBeNull()
 
    expect(await screen.findByText('clinico')).toBeInTheDocument()
  })
 
  it('muestra un error si falla al guardar', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(ENCABEZADO)
    vi.mocked(api.guardarEncabezadoTraslado).mockRejectedValue(
      new api.ApiError(409, 'La atención ya está cerrada, el encabezado no se puede editar así'),
    )
 
    renderPagina()
 
    await screen.findByLabelText('Nombres')
    await usuario.click(screen.getByRole('button', { name: 'Guardar encabezado' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La atención ya está cerrada, el encabezado no se puede editar así',
    )
  })
})
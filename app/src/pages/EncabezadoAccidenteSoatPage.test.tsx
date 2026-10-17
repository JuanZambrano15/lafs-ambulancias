import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import type { FormatoAccidenteSoat } from '../lib/types'
import { EncabezadoAccidenteSoatPage } from './EncabezadoAccidenteSoatPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
 
// Issue #70 (QA): este fixture ya no incluye `paciente_documento_expedido_en`
// ni `vehiculo_placa`/`vehiculo_tipo`/`vehiculo_marca` -- se quitaron del
// formato (ver el fix sobre #17 que acompaña esta revisión), y
// `hora_entrega` ya no se pide ni se muestra en esta pantalla (se pide
// al cerrar, en `ClinicoAccidenteSoatPage`).
const ENCABEZADO: FormatoAccidenteSoat = {
  atencion_id: 1,
  fecha_atencion: '2027-01-01',
  hora_atencion: '08:00:00',
  hora_entrega: null,
  identificado: true,
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '123456789',
  paciente_aseguradora: 'Nueva EPS',
  paciente_nombres: 'Pepito',
  paciente_apellidos: 'Pérez',
  paciente_edad: 45,
  paciente_sexo: 'm',
  lugar_ocurrencia: 'Vía Ocaña - Cúcuta km 5',
  ciudad: 'Cúcuta',
  telefono_contacto: '3001234567',
  rol_victima: 'conductor',
  poliza_vigente_desde: '2026-01-01',
  poliza_vigente_hasta: '2027-01-01',
  numero_poliza: 'POL-001',
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
  triage: null,
  descripcion: null,
    atendido_por: null,
  firma_atendido_por: null,
  evolucionado_por: null,
  firma_evolucionado_por: null,
  profesional_recibe_nombre: null,
  profesional_recibe_cedula: null,
    firma_profesional_recibe: null,
  glasgow_total: null,
}
 
beforeEach(() => {
  vi.clearAllMocks()
})
 
function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/atenciones/1/encabezado-accidente-soat']}>
      <Routes>
        <Route path="/" element={<div>pantalla principal</div>} />
        <Route
          path="/atenciones/:atencionId/encabezado-accidente-soat"
          element={<EncabezadoAccidenteSoatPage />}
        />
        <Route path="/atenciones/:atencionId/clinico-accidente-soat" element={<div>clinico</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
 
describe('EncabezadoAccidenteSoatPage', () => {
  it('arranca en blanco, identificado por defecto, si la atención todavía no tiene encabezado', async () => {
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(null)
 
    renderPagina()
 
    expect(await screen.findByLabelText('Lugar de ocurrencia')).toHaveValue('')
    expect(screen.getByLabelText('Paciente identificado')).toBeChecked()
    expect(screen.getByLabelText('Nombres')).toBeInTheDocument()
  })
 
  it('no pide la hora de entrega ni los campos de vehículo (issue #70 -- se quitaron del formato)', async () => {
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(null)
 
    renderPagina()
 
    await screen.findByLabelText('Lugar de ocurrencia')
    expect(screen.queryByLabelText(/hora de entrega/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/documento expedido en/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/placa del vehículo/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/tipo de vehículo/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/marca del vehículo/i)).not.toBeInTheDocument()
  })
 
  it('el número de póliza no es obligatorio (issue #70 -- a veces se sabe días después)', async () => {
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(null)
 
    renderPagina()
 
    const poliza = await screen.findByLabelText('Número de póliza')
    expect(poliza).not.toBeRequired()
  })
 
  it('precarga el formulario si ya hay un encabezado guardado', async () => {
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(ENCABEZADO)
 
    renderPagina()
 
    expect(await screen.findByLabelText('Nombres')).toHaveValue('Pepito')
    expect(screen.getByLabelText('Apellidos')).toHaveValue('Pérez')
    expect(screen.getByLabelText('Número de póliza')).toHaveValue('POL-001')
  })
 
  it('oculta los campos de identidad al desmarcar "Paciente identificado" (NN, ADR-0002)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(null)
 
    renderPagina()
 
    await screen.findByLabelText('Nombres')
    await usuario.click(screen.getByLabelText('Paciente identificado'))
 
    expect(screen.queryByLabelText('Nombres')).not.toBeInTheDocument()
    expect(screen.getByText(/Se registrará como NN/)).toBeInTheDocument()
  })
 
  it('muestra un error si falla la carga del encabezado', async () => {
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockRejectedValue(
      new api.ApiError(500, 'Error del servidor'),
    )
 
    renderPagina()
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
  })
 
  it('guarda el encabezado identificado y continúa a la parte clínica', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(null)
    vi.mocked(api.guardarEncabezadoAccidenteSoat).mockResolvedValue(ENCABEZADO)
 
    renderPagina()
 
    await screen.findByLabelText('Nombres')
    await usuario.type(screen.getByLabelText('Fecha'), '2027-01-01')
    await usuario.type(screen.getByLabelText('Hora de atención'), '08:00')
    await usuario.type(screen.getByLabelText('Número de documento'), '123456789')
    await usuario.type(screen.getByLabelText('Nombres'), 'Pepito')
    await usuario.type(screen.getByLabelText('Apellidos'), 'Pérez')
    await usuario.type(screen.getByLabelText('Edad'), '45')
    await usuario.type(screen.getByLabelText('Lugar de ocurrencia'), 'Vía Ocaña - Cúcuta km 5')
    await usuario.type(screen.getByLabelText('Ciudad'), 'Cúcuta')
 
    await usuario.click(screen.getByRole('button', { name: 'Guardar encabezado' }))
 
    await waitFor(() => expect(api.guardarEncabezadoAccidenteSoat).toHaveBeenCalledTimes(1))
    const [atencionId, datos] = vi.mocked(api.guardarEncabezadoAccidenteSoat).mock.calls[0]
    expect(atencionId).toBe(1)
    expect(datos.identificado).toBe(true)
    expect(datos.paciente_nombres).toBe('Pepito')
    expect(datos.paciente_edad).toBe(45)
    // No se pide en esta pantalla -- no había encabezado previo, así
    // que se manda en blanco (issue #70, ver nota de módulo).
    expect(datos.hora_entrega).toBeNull()
    expect(datos.numero_poliza).toBeNull()
 
    expect(await screen.findByText('clinico')).toBeInTheDocument()
  })
 
  it('al guardar, preserva la hora de entrega que ya existiera (el PUT reemplaza todo el registro)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue({
      ...ENCABEZADO,
      hora_entrega: '09:30:00',
    })
    vi.mocked(api.guardarEncabezadoAccidenteSoat).mockResolvedValue(ENCABEZADO)
 
    renderPagina()
 
    await screen.findByLabelText('Nombres')
    await usuario.click(screen.getByRole('button', { name: 'Guardar encabezado' }))
 
    await waitFor(() => expect(api.guardarEncabezadoAccidenteSoat).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.guardarEncabezadoAccidenteSoat).mock.calls[0]
    expect(datos.hora_entrega).toBe('09:30:00')
  })
 
  it('guarda un NN sin datos de identidad cuando se desmarca "Paciente identificado"', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(null)
    vi.mocked(api.guardarEncabezadoAccidenteSoat).mockResolvedValue(ENCABEZADO)
 
    renderPagina()
 
    await screen.findByLabelText('Nombres')
    await usuario.click(screen.getByLabelText('Paciente identificado'))
    await usuario.type(screen.getByLabelText('Fecha'), '2027-01-01')
    await usuario.type(screen.getByLabelText('Hora de atención'), '08:00')
    await usuario.type(screen.getByLabelText('Lugar de ocurrencia'), 'Vía Ocaña - Cúcuta km 5')
    await usuario.type(screen.getByLabelText('Ciudad'), 'Cúcuta')
 
    await usuario.click(screen.getByRole('button', { name: 'Guardar encabezado' }))
 
    await waitFor(() => expect(api.guardarEncabezadoAccidenteSoat).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.guardarEncabezadoAccidenteSoat).mock.calls[0]
    expect(datos.identificado).toBe(false)
    expect(datos.paciente_nombres).toBeNull()
    expect(datos.paciente_numero_documento).toBeNull()
    expect(datos.paciente_edad).toBeNull()
  })
 
  it('muestra un error si falla al guardar', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(ENCABEZADO)
    vi.mocked(api.guardarEncabezadoAccidenteSoat).mockRejectedValue(
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
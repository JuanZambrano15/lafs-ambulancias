
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import type { Ambulancia, AtencionCerrada, Empleado } from '../lib/types'
import { FormatosCerradosPage } from './FormatosCerradosPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
 
const EMPLEADO_RESPONSABLE: Empleado = {
  id: 1,
  nombres: 'Ana',
  apellidos: 'Ruiz',
  cedula: '700000001',
  telefono: null,
  tipo_vinculacion: 'planta',
  activo: true,
}
 
const EMPLEADO_CONDUCTOR: Empleado = {
  id: 2,
  nombres: 'Carlos',
  apellidos: 'Gómez',
  cedula: '800000001',
  telefono: null,
  tipo_vinculacion: 'planta',
  activo: true,
}
 
const AMBULANCIA: Ambulancia = {
  id: 1,
  movil: 'M-01',
  placa: 'ABC123',
  tipo: 'basica',
  vencimiento_soat: '2027-01-01',
  vencimiento_tecnomecanica: '2027-01-01',
  activa: true,
}
 
function atencionCerrada(overrides: Partial<AtencionCerrada> = {}): AtencionCerrada {
  return {
    id: 1,
    tipo: 'traslado',
    nivel_servicio: 'basico',
    estado: 'cerrado',
    abierta_en: '2026-10-01T08:00:00Z',
    cerrada_en: '2026-10-01T10:00:00Z',
    ambulancia: AMBULANCIA,
    conductor: EMPLEADO_CONDUCTOR,
    responsable: EMPLEADO_RESPONSABLE,
    paciente_nombres: 'Pepito',
    paciente_apellidos: 'Pérez',
    paciente_numero_documento: '123456789',
    tiene_pdf: true,
    ...overrides,
  }
}
 
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([])
})
 
describe('FormatosCerradosPage', () => {
  it('el botón Actualizar vuelve a pedir las cerradas con la búsqueda actual', async () => {
    const usuario = userEvent.setup()
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
    await screen.findByText('No se encontraron formatos cerrados.')
 
    await usuario.type(
      screen.getByLabelText('Buscar por nombre, apellido o documento del paciente'),
      'pepito',
    )
    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }))
 
    await waitFor(() => expect(api.listarAtencionesCerradas).toHaveBeenLastCalledWith('pepito'))
  })
 
  it('lista los formatos cerrados con botón de descargar', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([atencionCerrada()])
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findByText('Pepito Pérez')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument()
  })
 
  it('muestra el tipo de servicio -- Básico, Medicalizado o SOAT', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([
      atencionCerrada({ id: 1, nivel_servicio: 'basico' }),
      atencionCerrada({ id: 2, nivel_servicio: 'medicalizado' }),
      atencionCerrada({ id: 3, tipo: 'atencion_soat', nivel_servicio: null }),
    ])
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findAllByText('Pepito Pérez')).toHaveLength(3)
    expect(screen.getByText('Básico')).toBeInTheDocument()
    expect(screen.getByText('Medicalizado')).toBeInTheDocument()
    expect(screen.getByText('SOAT')).toBeInTheDocument()
  })
 
  it('un accidente SOAT sin identificar muestra "NN" en vez del nombre', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([
      atencionCerrada({
        tipo: 'atencion_soat',
        nivel_servicio: null,
        paciente_nombres: null,
        paciente_apellidos: null,
        paciente_numero_documento: null,
      }),
    ])
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findByText('NN (sin identificar)')).toBeInTheDocument()
  })
 
  it('al descargar un accidente SOAT, llama a descargarPdfFormatoAccidenteSoat', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([
      atencionCerrada({ id: 42, tipo: 'atencion_soat', nivel_servicio: null }),
    ])
    vi.mocked(api.descargarPdfFormatoAccidenteSoat).mockResolvedValue(undefined)
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
    await screen.findByText('Pepito Pérez')
 
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
 
    await waitFor(() => expect(api.descargarPdfFormatoAccidenteSoat).toHaveBeenCalledWith(42))
    expect(api.descargarPdfFormatoTraslado).not.toHaveBeenCalled()
  })
 
  it('un accidente SOAT cerrado tiene enlace a "Fotos"', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([
      atencionCerrada({ id: 42, tipo: 'atencion_soat', nivel_servicio: null }),
    ])
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
 
    const enlace = await screen.findByRole('link', { name: 'Fotos' })
    expect(enlace).toHaveAttribute('href', '/atenciones/42/fotos-accidente-soat')
  })
 
  it('un traslado cerrado no tiene enlace a "Fotos"', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([atencionCerrada({ id: 7 })])
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
 
    await screen.findByText('Pepito Pérez')
    expect(screen.queryByRole('link', { name: 'Fotos' })).not.toBeInTheDocument()
  })
 
  it('un formato cerrado sin PDF muestra "Sin PDF" en vez del botón', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([
      atencionCerrada({ tiene_pdf: false }),
    ])
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
 
    await screen.findByText('Pepito Pérez')
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).not.toBeInTheDocument()
    expect(screen.getByText('Sin PDF')).toBeInTheDocument()
  })
 
  it('al hacer clic en Descargar PDF, llama a descargarPdfFormatoTraslado con el id correcto', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([atencionCerrada({ id: 42 })])
    vi.mocked(api.descargarPdfFormatoTraslado).mockResolvedValue(undefined)
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
    await screen.findByText('Pepito Pérez')
 
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
 
    await waitFor(() => expect(api.descargarPdfFormatoTraslado).toHaveBeenCalledWith(42))
  })
 
  it('un error al descargar el PDF se muestra en pantalla', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([atencionCerrada()])
    vi.mocked(api.descargarPdfFormatoTraslado).mockRejectedValue(
      new ApiError(404, 'Esta atención todavía no tiene un PDF generado'),
    )
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
    await screen.findByText('Pepito Pérez')
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta atención todavía no tiene un PDF generado',
    )
  })
 
  it('buscar llama a listarAtencionesCerradas con el texto escrito', async () => {
    const usuario = userEvent.setup()
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
    await screen.findByText('No se encontraron formatos cerrados.')
 
    await usuario.type(
      screen.getByLabelText('Buscar por nombre, apellido o documento del paciente'),
      'pepito',
    )
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }))
 
    await waitFor(() => expect(api.listarAtencionesCerradas).toHaveBeenLastCalledWith('pepito'))
  })
 
  it('un error al cargar cerradas se muestra sin tumbar la página', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockRejectedValue(new ApiError(500, 'Error raro'))
 
    render(
      <MemoryRouter>
        <FormatosCerradosPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Error raro')
  })
})
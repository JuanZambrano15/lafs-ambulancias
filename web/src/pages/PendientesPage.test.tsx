import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import type { Ambulancia, Atencion, AtencionCerrada, Empleado } from '../lib/types'
import { PendientesPage } from './PendientesPage'
 
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
 
function atencionPendiente(horasAbierta: number, id = 1): Atencion {
  return {
    id,
    tipo: 'traslado',
    estado: 'abierto',
    abierta_en: new Date(Date.now() - horasAbierta * 60 * 60 * 1000).toISOString(),
    cerrada_en: null,
    ambulancia: AMBULANCIA,
    conductor: EMPLEADO_CONDUCTOR,
    responsable: EMPLEADO_RESPONSABLE,
  }
}
 
function atencionCerrada(overrides: Partial<AtencionCerrada> = {}): AtencionCerrada {
  return {
    id: 1,
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
  vi.mocked(api.listarAtencionesPendientes).mockResolvedValue([])
  vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([])
})
 
describe('PendientesPage', () => {
  it('muestra las atenciones abiertas, con alerta cuando lleva más de 12 horas', async () => {
    vi.mocked(api.listarAtencionesPendientes).mockResolvedValue([
      atencionPendiente(13, 1),
      atencionPendiente(1, 2),
    ])
 
    render(<PendientesPage />)
 
    // Las dos filas muestran el mismo móvil/responsable en este test
    // (mismos fixtures) -- por eso `findAllByText`, y lo que distingue
    // la fila en alerta es el texto "lleva mucho tiempo abierta", que
    // solo debe aparecer una vez (no en la de 1 hora).
    expect(await screen.findAllByText('M-01')).toHaveLength(2)
    expect(screen.getAllByText('lleva mucho tiempo abierta', { exact: false })).toHaveLength(1)
  })
 
  it('sin pendientes, muestra el mensaje vacío', async () => {
    render(<PendientesPage />)
 
    expect(await screen.findByText('No hay atenciones abiertas en este momento.')).toBeInTheDocument()
  })
 
  it('un error al cargar pendientes se muestra sin tumbar la página', async () => {
    vi.mocked(api.listarAtencionesPendientes).mockRejectedValue(new ApiError(500, 'Error raro'))
 
    render(<PendientesPage />)
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Error raro')
  })
 
  it('el botón Actualizar vuelve a pedir las pendientes', async () => {
    const usuario = userEvent.setup()
    render(<PendientesPage />)
    await screen.findByText('No hay atenciones abiertas en este momento.')
 
    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }))
 
    await waitFor(() => expect(api.listarAtencionesPendientes).toHaveBeenCalledTimes(2))
  })
 
  it('lista los formatos cerrados con botón de descargar', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([atencionCerrada()])
 
    render(<PendientesPage />)
 
    expect(await screen.findByText('Pepito Pérez')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument()
  })
 
  it('un formato cerrado sin PDF muestra "Sin PDF" en vez del botón', async () => {
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([
      atencionCerrada({ tiene_pdf: false }),
    ])
 
    render(<PendientesPage />)
 
    await screen.findByText('Pepito Pérez')
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).not.toBeInTheDocument()
    expect(screen.getByText('Sin PDF')).toBeInTheDocument()
  })
 
  it('al hacer clic en Descargar PDF, llama a descargarPdfFormatoTraslado con el id correcto', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarAtencionesCerradas).mockResolvedValue([atencionCerrada({ id: 42 })])
    vi.mocked(api.descargarPdfFormatoTraslado).mockResolvedValue(undefined)
 
    render(<PendientesPage />)
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
 
    render(<PendientesPage />)
    await screen.findByText('Pepito Pérez')
    await usuario.click(screen.getByRole('button', { name: 'Descargar PDF' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta atención todavía no tiene un PDF generado',
    )
  })
 
  it('buscar llama a listarAtencionesCerradas con el texto escrito', async () => {
    const usuario = userEvent.setup()
    render(<PendientesPage />)
    await screen.findByText('No se encontraron formatos cerrados.')
 
    await usuario.type(
      screen.getByLabelText('Buscar por nombre, apellido o documento del paciente'),
      'pepito',
    )
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }))
 
    await waitFor(() => expect(api.listarAtencionesCerradas).toHaveBeenLastCalledWith('pepito'))
  })
})
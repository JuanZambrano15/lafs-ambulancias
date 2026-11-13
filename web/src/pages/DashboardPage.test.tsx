import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import type { Ambulancia, Atencion, Empleado } from '../lib/types'
import { DashboardPage } from './DashboardPage'
 
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
 
function atencionPendiente(overrides: Partial<Atencion> = {}): Atencion {
  return {
    id: 1,
    tipo: 'traslado',
    estado: 'abierto',
    abierta_en: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    cerrada_en: null,
    ambulancia: ambulancia(),
    conductor: EMPLEADO_CONDUCTOR,
    responsable: EMPLEADO_RESPONSABLE,
    ...overrides,
  }
}
 
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listarAtencionesPendientes).mockResolvedValue([])
  vi.mocked(api.listarAmbulancias).mockResolvedValue([])
  vi.mocked(api.listarEstadoFlota).mockResolvedValue([])
})
 
describe('DashboardPage', () => {
  it('muestra las atenciones abiertas, con alerta cuando lleva más de 12 horas, y su tipo', async () => {
    vi.mocked(api.listarAtencionesPendientes).mockResolvedValue([
      atencionPendiente({ id: 1, abierta_en: new Date(Date.now() - 13 * 3600 * 1000).toISOString() }),
      atencionPendiente({
        id: 2,
        tipo: 'atencion_soat',
        abierta_en: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      }),
    ])
 
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findAllByText('M-01')).toHaveLength(2)
    expect(screen.getByText('lleva mucho tiempo abierta', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Traslado')).toBeInTheDocument()
    expect(screen.getByText('SOAT')).toBeInTheDocument()
  })
 
  it('sin pendientes, muestra el mensaje vacío', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findByText('No hay atenciones abiertas en este momento.')).toBeInTheDocument()
  })
 
  it('un error al cargar pendientes se muestra sin tumbar la página', async () => {
    // `listarAtencionesPendientes` también la usa la sección de
    // ambulancias (para saber cuáles están en uso) -- un rechazo acá
    // aparece en las dos secciones, por eso `findAllByRole`.
    vi.mocked(api.listarAtencionesPendientes).mockRejectedValue(new ApiError(500, 'Error raro'))
 
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
 
    const alertas = await screen.findAllByRole('alert')
    expect(alertas.length).toBeGreaterThanOrEqual(1)
    alertas.forEach((alerta) => expect(alerta).toHaveTextContent('Error raro'))
  })
 
  it('issue #79: marca "En uso" la ambulancia con una atención abierta, y "Disponible" las demás', async () => {
    vi.mocked(api.listarAmbulancias).mockResolvedValue([
      ambulancia({ id: 1, movil: 'M-01' }),
      ambulancia({ id: 2, movil: 'M-02' }),
    ])
    vi.mocked(api.listarAtencionesPendientes).mockResolvedValue([
      atencionPendiente({ id: 1, ambulancia: ambulancia({ id: 1, movil: 'M-01' }) }),
    ])
 
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findByText('En uso')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(api.listarAmbulancias).toHaveBeenCalledWith(true)
  })
 
  it('issue #79: sin ambulancias activas, muestra el mensaje vacío de esa sección', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findByText('No hay ambulancias activas registradas.')).toBeInTheDocument()
  })
 
  it('un error al cargar el estado de ambulancias se muestra sin tumbar el resto', async () => {
    vi.mocked(api.listarAmbulancias).mockRejectedValue(new ApiError(500, 'Error de ambulancias'))
 
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
 
    expect(await screen.findByText('Error de ambulancias')).toBeInTheDocument()
    expect(await screen.findByText('No hay atenciones abiertas en este momento.')).toBeInTheDocument()
  })
 
  it('issue #19: sin problemas en la flota dice que no hay alertas', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Sin alertas de vigencia ni de chequeo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver estado de la flota' })).toHaveAttribute(
      'href',
      '/flota',
    )
  })

  it('issue #19: alerta por vigencias, chequeo pendiente y fallas, las rojas primero', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([
      {
        ambulancia_id: 1,
        movil: 'M-01',
        placa: 'ABC123',
        tipo: 'basica',
        vencimiento_soat: '2026-11-20',
        dias_soat: 8,
        semaforo_soat: 'rojo',
        vencimiento_tecnomecanica: '2026-12-20',
        dias_tecnomecanica: 28,
        semaforo_tecnomecanica: 'amarillo',
        ultimo_chequeo: {
          id: 5,
          realizado_en: '2026-11-10T10:00:00Z',
          conductor_nombre: 'Pedro Londoño',
          tiene_fallas: true,
          total_fallas: 2,
        },
        dias_desde_chequeo: 2,
        chequeo_al_dia: true,
      },
      {
        ambulancia_id: 2,
        movil: 'M-02',
        placa: 'XYZ987',
        tipo: 'basica',
        vencimiento_soat: '2027-06-01',
        dias_soat: 200,
        semaforo_soat: 'verde',
        vencimiento_tecnomecanica: '2027-06-01',
        dias_tecnomecanica: 200,
        semaforo_tecnomecanica: 'verde',
        ultimo_chequeo: null,
        dias_desde_chequeo: null,
        chequeo_al_dia: false,
      },
    ])

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Móvil M-01: SOAT. Vence en 8 días')).toBeInTheDocument()
    expect(screen.getByText('Móvil M-01: tecnomecánica. Vence en 28 días')).toBeInTheDocument()
    expect(screen.getByText('Móvil M-01: el último chequeo reportó 2 fallas')).toBeInTheDocument()
    expect(screen.getByText('Móvil M-02: chequeo semanal pendiente')).toBeInTheDocument()
    const niveles = Array.from(document.querySelectorAll('[data-nivel]')).map((e) =>
      e.getAttribute('data-nivel'),
    )
    expect(niveles).toEqual(['rojo', 'rojo', 'amarillo', 'amarillo'])
  })

  it('issue #19: si fallan las alertas de la flota lo dice, sin tumbar lo demás', async () => {
    vi.mocked(api.listarEstadoFlota).mockRejectedValue(new ApiError(500, 'Error de flota'))

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Error de flota')).toBeInTheDocument()
    expect(await screen.findByText('No hay atenciones abiertas en este momento.')).toBeInTheDocument()
  })

  it('no muestra ni un buscador ni "Formatos cerrados" -- eso se movió a su propia pantalla', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )
    await screen.findByText('No hay atenciones abiertas en este momento.')
 
    expect(screen.queryByText('Formatos cerrados')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument()
  })
})
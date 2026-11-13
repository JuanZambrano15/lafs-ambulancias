import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import type { EstadoFlota } from '../lib/types'
import { ChequeoVehiculoPage } from './ChequeoVehiculoPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')

const ITEMS = ['Volante', 'Sirena', 'Llantas delanteras']

function movil(parcial: Partial<EstadoFlota> = {}): EstadoFlota {
  return {
    ambulancia_id: 1,
    movil: 'M-01',
    placa: 'ABC123',
    tipo: 'basica',
    vencimiento_soat: '2027-03-05',
    dias_soat: 120,
    semaforo_soat: 'verde',
    vencimiento_tecnomecanica: '2026-11-30',
    dias_tecnomecanica: 18,
    semaforo_tecnomecanica: 'amarillo',
    ultimo_chequeo: null,
    dias_desde_chequeo: null,
    chequeo_al_dia: false,
    ...parcial,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerCatalogoChequeoVehiculo).mockResolvedValue({
    frecuencia_dias: 7,
    items: ITEMS,
  })
})

function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/chequeo-vehiculo']}>
      <Routes>
        <Route path="/" element={<div>pantalla principal</div>} />
        <Route path="/chequeo-vehiculo" element={<ChequeoVehiculoPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ChequeoVehiculoPage', () => {
  it('lista los móviles con el semáforo de SOAT y tecnomecánica', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([
      movil(),
      movil({
        ambulancia_id: 2,
        movil: 'M-02',
        placa: 'XYZ987',
        semaforo_soat: 'rojo',
        dias_soat: -3,
        vencimiento_soat: '2026-11-09',
      }),
    ])

    renderPagina()

    expect(await screen.findByText(/Móvil M-01 — ABC123/)).toBeInTheDocument()
    expect(screen.getByText(/Móvil M-02 — XYZ987/)).toBeInTheDocument()
    expect(screen.getByText('Vencido hace 3 días')).toBeInTheDocument()
    const semaforos = document.querySelectorAll('[data-semaforo]')
    expect(Array.from(semaforos).map((e) => e.getAttribute('data-semaforo'))).toEqual([
      'verde',
      'amarillo',
      'rojo',
      'amarillo',
    ])
    expect(screen.getAllByText(/Sin chequeos todavía/)).toHaveLength(2)
  })

  it('marca el chequeo de la semana como al día', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([
      movil({ chequeo_al_dia: true, dias_desde_chequeo: 2 }),
    ])

    renderPagina()

    expect(await screen.findByText(/Chequeo al día/)).toBeInTheDocument()
    expect(screen.getByText(/Último chequeo hace 2 días/)).toBeInTheDocument()
  })

  it('avisa si no se pudo cargar', async () => {
    vi.mocked(api.listarEstadoFlota).mockRejectedValue(new api.ApiError(500, 'Falló el servidor'))

    renderPagina()

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor')
  })

  it('guarda el chequeo con todo en Bien y vuelve a Home', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    vi.mocked(api.crearChequeoVehiculo).mockResolvedValue({} as never)
    renderPagina()

    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar chequeo' }))

    await waitFor(() => expect(screen.getByText('pantalla principal')).toBeInTheDocument())
    expect(api.crearChequeoVehiculo).toHaveBeenCalledWith({
      ambulancia_id: 1,
      items: ITEMS.map((item) => ({ item, estado: 'bien', observacion: null })),
      observaciones: null,
    })
  })

  it('una falla pide descripción y se manda con ella', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    vi.mocked(api.crearChequeoVehiculo).mockResolvedValue({} as never)
    renderPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))

    const sirena = screen.getByRole('group', { name: 'Sirena' })
    await userEvent.click(within(sirena).getByRole('button', { name: 'Falla' }))
    await userEvent.click(screen.getByRole('button', { name: /Guardar chequeo/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Describe la falla de: Sirena')
    expect(api.crearChequeoVehiculo).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Qué falla tiene: Sirena'), 'No suena')
    await userEvent.type(screen.getByLabelText(/Observaciones/), 'Revisar el lunes')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar chequeo (1 falla)' }))

    await waitFor(() => expect(api.crearChequeoVehiculo).toHaveBeenCalled())
    const enviado = vi.mocked(api.crearChequeoVehiculo).mock.calls[0][0]
    expect(enviado.items.find((i) => i.item === 'Sirena')).toEqual({
      item: 'Sirena',
      estado: 'falla',
      observacion: 'No suena',
    })
    expect(enviado.items.find((i) => i.item === 'Volante')?.estado).toBe('bien')
    expect(enviado.observaciones).toBe('Revisar el lunes')
  })

  it('muestra el error del servidor al guardar y se queda en el chequeo', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    vi.mocked(api.crearChequeoVehiculo).mockRejectedValue(
      new api.ApiError(409, 'Esa ambulancia no está activa'),
    )
    renderPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))

    await userEvent.click(screen.getByRole('button', { name: 'Guardar chequeo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa ambulancia no está activa')
    expect(screen.queryByText('pantalla principal')).not.toBeInTheDocument()
  })

  it('"Volver" desde el checklist regresa a la lista de móviles', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    renderPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))

    await userEvent.click(screen.getByRole('button', { name: /Volver/ }))

    expect(screen.getByRole('button', { name: 'Hacer chequeo' })).toBeInTheDocument()
  })
})
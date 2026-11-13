import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import type { ChequeoVehiculo, EstadoFlota } from '../lib/types'
import { FlotaPage } from './FlotaPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))

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

const CHEQUEO: ChequeoVehiculo = {
  id: 9,
  ambulancia_id: 1,
  movil: 'M-01',
  conductor_id: 3,
  conductor_nombre: 'Pedro Londoño',
  realizado_en: '2026-11-10T15:00:00Z',
  tiene_fallas: true,
  total_fallas: 1,
  observaciones: 'Llevar al taller',
  items: [
    { item: 'Volante', estado: 'bien', observacion: null },
    { item: 'Sirena', estado: 'falla', observacion: 'No suena' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FlotaPage', () => {
  it('muestra fechas y semáforo de SOAT y tecnomecánica por móvil', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([
      movil(),
      movil({
        ambulancia_id: 2,
        movil: 'M-02',
        placa: 'XYZ987',
        semaforo_soat: 'rojo',
        dias_soat: -2,
        vencimiento_soat: '2026-11-10',
      }),
    ])

    render(<FlotaPage />)

    expect(await screen.findByText('M-01')).toBeInTheDocument()
    expect(screen.getByText('05/03/2027')).toBeInTheDocument()
    expect(screen.getByText('Vencido hace 2 días')).toBeInTheDocument()
    const colores = Array.from(document.querySelectorAll('[data-semaforo]')).map((e) =>
      e.getAttribute('data-semaforo'),
    )
    expect(colores).toEqual(['verde', 'amarillo', 'rojo', 'amarillo'])
  })

  it('muestra si el chequeo semanal está al día o pendiente', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([
      movil({
        chequeo_al_dia: true,
        dias_desde_chequeo: 3,
        ultimo_chequeo: {
          id: 9,
          realizado_en: '2026-11-10T15:00:00Z',
          conductor_nombre: 'Pedro Londoño',
          tiene_fallas: true,
          total_fallas: 2,
        },
      }),
      movil({ ambulancia_id: 2, movil: 'M-02', placa: 'XYZ987' }),
    ])

    render(<FlotaPage />)

    expect(await screen.findByText('Al día')).toBeInTheDocument()
    expect(screen.getByText('Último chequeo hace 3 días')).toBeInTheDocument()
    expect(screen.getByText(/2 fallas/)).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Sin chequeos todavía')).toBeInTheDocument()
  })

  it('avisa si no hay ambulancias activas', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([])

    render(<FlotaPage />)

    expect(await screen.findByText('No hay ambulancias activas.')).toBeInTheDocument()
  })

  it('avisa si falla la carga', async () => {
    vi.mocked(api.listarEstadoFlota).mockRejectedValue(new api.ApiError(500, 'Falló'))

    render(<FlotaPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló')
  })

  it('abre el historial de un móvil y el detalle con las fallas', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    vi.mocked(api.listarChequeosVehiculo).mockResolvedValue([
      {
        id: 9,
        ambulancia_id: 1,
        movil: 'M-01',
        conductor_nombre: 'Pedro Londoño',
        realizado_en: '2026-11-10T15:00:00Z',
        tiene_fallas: true,
        total_fallas: 1,
      },
    ])
    vi.mocked(api.obtenerChequeoVehiculo).mockResolvedValue(CHEQUEO)
    render(<FlotaPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ver chequeos' }))
    expect(await screen.findByText(/Chequeos del móvil M-01/)).toBeInTheDocument()
    expect(api.listarChequeosVehiculo).toHaveBeenCalledWith(1)

    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))

    const detalle = await screen.findByText('Llevar al taller')
    expect(detalle).toBeInTheDocument()
    const fallas = screen.getByText(/1 falla:/).closest('div') as HTMLElement
    expect(within(fallas).getByText('Sirena')).toBeInTheDocument()
    expect(within(fallas).getByText(/No suena/)).toBeInTheDocument()
    expect(api.obtenerChequeoVehiculo).toHaveBeenCalledWith(9)
  })

  it('un móvil sin chequeos lo dice en el historial', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    vi.mocked(api.listarChequeosVehiculo).mockResolvedValue([])
    render(<FlotaPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ver chequeos' }))

    expect(await screen.findByText('Este móvil todavía no tiene chequeos.')).toBeInTheDocument()
  })

  it('registra la renovación del SOAT con la nueva fecha y recarga el semáforo', async () => {
    vi.mocked(api.listarEstadoFlota)
      .mockResolvedValueOnce([movil({ semaforo_soat: 'rojo', dias_soat: 5 })])
      .mockResolvedValueOnce([movil({ vencimiento_soat: '2027-11-20', dias_soat: 372 })])
    vi.mocked(api.actualizarVigenciasAmbulancia).mockResolvedValue({} as never)
    render(<FlotaPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cambiar vencimiento del SOAT del móvil M-01' }),
    )
    const campo = screen.getByLabelText('Nuevo vencimiento del SOAT (M-01)')
    fireEvent.change(campo, { target: { value: '2027-11-20' } })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(api.actualizarVigenciasAmbulancia).toHaveBeenCalledWith(1, {
        vencimiento_soat: '2027-11-20',
      }),
    )
    expect(await screen.findByText('20/11/2027')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nuevo vencimiento del SOAT (M-01)')).not.toBeInTheDocument()
  })

  it('la tecnomecánica manda solo su fecha', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    vi.mocked(api.actualizarVigenciasAmbulancia).mockResolvedValue({} as never)
    render(<FlotaPage />)

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Cambiar vencimiento de la tecnomecánica del móvil M-01',
      }),
    )
    fireEvent.change(screen.getByLabelText('Nuevo vencimiento de la tecnomecánica (M-01)'), {
      target: { value: '2027-12-01' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(api.actualizarVigenciasAmbulancia).toHaveBeenCalledWith(1, {
        vencimiento_tecnomecanica: '2027-12-01',
      }),
    )
  })

  it('muestra el error si no se pudo guardar y deja la fecha anterior', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    vi.mocked(api.actualizarVigenciasAmbulancia).mockRejectedValue(
      new api.ApiError(422, 'Fecha inválida'),
    )
    render(<FlotaPage />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cambiar vencimiento del SOAT del móvil M-01' }),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Fecha inválida')
    expect(screen.getByText('05/03/2027')).toBeInTheDocument()
  })

  it('cancelar cierra el editor sin guardar nada', async () => {
    vi.mocked(api.listarEstadoFlota).mockResolvedValue([movil()])
    render(<FlotaPage />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cambiar vencimiento del SOAT del móvil M-01' }),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Nuevo vencimiento del SOAT (M-01)')).not.toBeInTheDocument()
    expect(api.actualizarVigenciasAmbulancia).not.toHaveBeenCalled()
  })
})
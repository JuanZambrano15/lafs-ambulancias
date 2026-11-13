import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import type { EstadoInsumosMovil, InsumoCatalogo } from '../lib/types'
import { ChequeoInsumosPage } from './ChequeoInsumosPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')

function movil(parcial: Partial<EstadoInsumosMovil> = {}): EstadoInsumosMovil {
  return {
    ambulancia_id: 1,
    movil: 'M-01',
    placa: 'ABC123',
    total_items: 3,
    frecuencia_dias: 7,
    ultimo_chequeo: null,
    dias_desde_chequeo: null,
    chequeo_al_dia: false,
    ...parcial,
  }
}

function insumo(parcial: Partial<InsumoCatalogo>): InsumoCatalogo {
  return {
    id: 1,
    ambulancia_id: 1,
    categoria: 'Respiratorio',
    nombre: 'Ambu adulto',
    minimo: 1,
    unidad: null,
    orden: 1,
    ...parcial,
  }
}

const ITEMS: InsumoCatalogo[] = [
  insumo({ id: 10, nombre: 'Ambu adulto', minimo: 1 }),
  insumo({ id: 11, nombre: 'Jeringa de 5cc', categoria: 'Circulatorio', minimo: 10, orden: 2 }),
  insumo({
    id: 12,
    nombre: 'Adrenalina',
    categoria: 'Medicamentos',
    minimo: 5,
    unidad: 'amp',
    orden: 3,
  }),
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerFormularioInsumos).mockResolvedValue({ frecuencia_dias: 7, items: ITEMS })
})

function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/chequeo-insumos']}>
      <Routes>
        <Route path="/" element={<div>pantalla principal</div>} />
        <Route path="/chequeo-insumos" element={<ChequeoInsumosPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ChequeoInsumosPage', () => {
  it('lista los móviles y su estado semanal', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([
      movil({ chequeo_al_dia: true, dias_desde_chequeo: 2 }),
      movil({ ambulancia_id: 2, movil: 'M-02', placa: 'XYZ987' }),
    ])

    renderPagina()

    expect(await screen.findByText(/Móvil M-01 — ABC123/)).toBeInTheDocument()
    expect(screen.getByText(/Chequeo al día/)).toBeInTheDocument()
    expect(screen.getByText(/Último chequeo hace 2 días/)).toBeInTheDocument()
    expect(screen.getByText(/Chequeo pendiente/)).toBeInTheDocument()
    expect(screen.getByText(/Sin chequeos todavía/)).toBeInTheDocument()
  })

  it('un móvil sin catálogo no se puede chequear', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([movil({ total_items: 0 })])

    renderPagina()

    expect(await screen.findByText(/avísale al administrador/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hacer chequeo' })).toBeDisabled()
  })

  it('avisa si no se pudo cargar', async () => {
    vi.mocked(api.listarEstadoInsumos).mockRejectedValue(new api.ApiError(500, 'Falló el servidor'))

    renderPagina()

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor')
  })

  it('muestra los ítems por categoría, cada uno en su mínimo', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([movil()])
    renderPagina()

    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))

    expect(api.obtenerFormularioInsumos).toHaveBeenCalledWith(1)
    const medicamentos = await screen.findByRole('region', { name: 'Medicamentos' })
    expect(within(medicamentos).getByText('Mínimo: 5 amp')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Respiratorio' })).toBeInTheDocument()
    expect(screen.getByLabelText('Jeringa de 5cc')).toHaveValue('10')
    expect(screen.getByLabelText('Adrenalina')).toHaveValue('5')
  })

  it('guarda con todo en el mínimo y vuelve a Home', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([movil()])
    vi.mocked(api.crearChequeoInsumos).mockResolvedValue({} as never)
    renderPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar chequeo' }))

    await waitFor(() => expect(screen.getByText('pantalla principal')).toBeInTheDocument())
    expect(api.crearChequeoInsumos).toHaveBeenCalledWith({
      ambulancia_id: 1,
      items: [
        { insumo_id: 10, encontrado: 1 },
        { insumo_id: 11, encontrado: 10 },
        { insumo_id: 12, encontrado: 5 },
      ],
      observaciones: null,
    })
  })

  it('marca el faltante en cuanto la cantidad queda por debajo del mínimo', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([movil()])
    vi.mocked(api.crearChequeoInsumos).mockResolvedValue({} as never)
    renderPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))

    const jeringas = await screen.findByLabelText('Jeringa de 5cc')
    await userEvent.clear(jeringas)
    await userEvent.type(jeringas, '7')

    expect(screen.getByText('Faltan 3')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Observaciones/), 'Reponer el lunes')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar chequeo (1 faltante)' }))

    await waitFor(() => expect(api.crearChequeoInsumos).toHaveBeenCalled())
    const enviado = vi.mocked(api.crearChequeoInsumos).mock.calls[0][0]
    expect(enviado.items.find((i) => i.insumo_id === 11)).toEqual({ insumo_id: 11, encontrado: 7 })
    expect(enviado.observaciones).toBe('Reponer el lunes')
  })

  it('una cantidad vacía o inválida no se manda', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([movil()])
    renderPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))

    await userEvent.clear(await screen.findByLabelText('Adrenalina'))
    await userEvent.click(screen.getByRole('button', { name: /Guardar chequeo/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe la cantidad de: Adrenalina')
    expect(api.crearChequeoInsumos).not.toHaveBeenCalled()
  })

  it('muestra el error del servidor al guardar y se queda en el chequeo', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([movil()])
    vi.mocked(api.crearChequeoInsumos).mockRejectedValue(
      new api.ApiError(409, 'Esa ambulancia no está activa'),
    )
    renderPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar chequeo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa ambulancia no está activa')
    expect(screen.queryByText('pantalla principal')).not.toBeInTheDocument()
  })

  it('"Volver" desde el chequeo regresa a la lista de móviles', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([movil()])
    renderPagina()
    await userEvent.click(await screen.findByRole('button', { name: 'Hacer chequeo' }))
    await screen.findByLabelText('Adrenalina')

    await userEvent.click(screen.getByRole('button', { name: /Volver/ }))

    expect(screen.getByRole('button', { name: 'Hacer chequeo' })).toBeInTheDocument()
  })
})
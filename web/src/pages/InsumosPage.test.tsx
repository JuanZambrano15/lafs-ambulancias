import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import type { ChequeoInsumos, EstadoInsumosMovil, InsumoCatalogo } from '../lib/types'
import { InsumosPage } from './InsumosPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))

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
    id: 10,
    ambulancia_id: 1,
    categoria: 'Respiratorio',
    nombre: 'Ambu adulto',
    minimo: 1,
    unidad: null,
    orden: 1,
    ...parcial,
  }
}

const CATALOGO: InsumoCatalogo[] = [
  insumo({ id: 10, nombre: 'Ambu adulto' }),
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

const CHEQUEO: ChequeoInsumos = {
  id: 9,
  ambulancia_id: 1,
  movil: 'M-01',
  auxiliar_id: 4,
  auxiliar_nombre: 'Ana Ruiz',
  realizado_en: '2026-11-10T15:00:00Z',
  tiene_faltantes: true,
  total_faltantes: 1,
  observaciones: 'Reponer el lunes',
  items: [
    {
      insumo_id: 10,
      categoria: 'Respiratorio',
      nombre: 'Ambu adulto',
      unidad: null,
      minimo: 1,
      encontrado: 1,
      faltante: false,
    },
    {
      insumo_id: 12,
      categoria: 'Medicamentos',
      nombre: 'Adrenalina',
      unidad: 'amp',
      minimo: 5,
      encontrado: 2,
      faltante: true,
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listarEstadoInsumos).mockResolvedValue([movil()])
  vi.mocked(api.listarCatalogoInsumos).mockResolvedValue(CATALOGO)
  vi.mocked(api.listarPlantillasInsumos).mockResolvedValue([
    { clave: 'M01', nombre: 'Móvil M01', total: 106 },
    { clave: 'IVECO', nombre: 'Iveco', total: 96 },
  ])
  vi.mocked(api.listarChequeosInsumos).mockResolvedValue([])
})

describe('InsumosPage', () => {
  it('lista los móviles con el estado de su chequeo semanal', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([
      movil({
        chequeo_al_dia: true,
        dias_desde_chequeo: 2,
        ultimo_chequeo: {
          id: 9,
          realizado_en: '2026-11-11T15:00:00Z',
          auxiliar_nombre: 'Ana Ruiz',
          tiene_faltantes: true,
          total_faltantes: 3,
        },
      }),
      movil({ ambulancia_id: 2, movil: 'M-02', placa: 'XYZ987', total_items: 0 }),
    ])

    render(<InsumosPage />)

    expect(await screen.findByText('Al día · Último chequeo hace 2 días')).toBeInTheDocument()
    expect(screen.getByText('Último chequeo: 3 faltantes')).toBeInTheDocument()
    expect(screen.getByText('Pendiente · Sin chequeos todavía')).toBeInTheDocument()
    expect(screen.getByText('0 ítems en la lista')).toBeInTheDocument()
  })

  it('muestra el catálogo del primer móvil agrupado por categoría', async () => {
    render(<InsumosPage />)

    const medicamentos = await screen.findByRole('region', { name: 'Medicamentos' })
    expect(within(medicamentos).getByText('Adrenalina')).toBeInTheDocument()
    expect(within(medicamentos).getByText('Mínimo: 5 amp')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Respiratorio' })).toBeInTheDocument()
    expect(api.listarCatalogoInsumos).toHaveBeenCalledWith(1)
  })

  it('cambia de móvil y pide el catálogo del otro', async () => {
    vi.mocked(api.listarEstadoInsumos).mockResolvedValue([
      movil(),
      movil({ ambulancia_id: 2, movil: 'M-02', placa: 'XYZ987' }),
    ])
    render(<InsumosPage />)
    await screen.findByRole('region', { name: 'Medicamentos' })

    await userEvent.click(screen.getByRole('button', { name: /M-02/ }))

    await waitFor(() => expect(api.listarCatalogoInsumos).toHaveBeenCalledWith(2))
  })

  it('con el catálogo vacío ofrece cargar una plantilla', async () => {
    vi.mocked(api.listarCatalogoInsumos).mockResolvedValueOnce([])
    vi.mocked(api.cargarPlantillaInsumos).mockResolvedValue(CATALOGO)
    render(<InsumosPage />)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cargar plantilla Iveco (96 ítems)' }),
    )

    expect(api.cargarPlantillaInsumos).toHaveBeenCalledWith(1, 'IVECO')
    expect(await screen.findByRole('region', { name: 'Medicamentos' })).toBeInTheDocument()
  })

  it('cambia el mínimo de un ítem', async () => {
    vi.mocked(api.actualizarInsumo).mockResolvedValue(CATALOGO[2])
    render(<InsumosPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Adrenalina' }))

    const minimo = screen.getByLabelText('Mínimo de Adrenalina')
    await userEvent.clear(minimo)
    await userEvent.type(minimo, '8')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(api.actualizarInsumo).toHaveBeenCalledWith(12, {
        categoria: 'Medicamentos',
        nombre: 'Adrenalina',
        minimo: 8,
        unidad: 'amp',
      }),
    )
  })

  it('un mínimo que no es número no se manda', async () => {
    render(<InsumosPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Adrenalina' }))

    const minimo = screen.getByLabelText('Mínimo de Adrenalina')
    await userEvent.clear(minimo)
    await userEvent.type(minimo, 'muchos')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El mínimo debe ser un número')
    expect(api.actualizarInsumo).not.toHaveBeenCalled()
  })

  it('quitar un ítem pide confirmación', async () => {
    vi.mocked(api.eliminarInsumo).mockResolvedValue(undefined)
    render(<InsumosPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Quitar Ambu adulto' }))
    expect(api.eliminarInsumo).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar quitar Ambu adulto' }))

    await waitFor(() => expect(api.eliminarInsumo).toHaveBeenCalledWith(10))
  })

  it('agrega un ítem nuevo', async () => {
    vi.mocked(api.crearInsumo).mockResolvedValue(insumo({ id: 13, nombre: 'Collar cervical' }))
    render(<InsumosPage />)
    await screen.findByRole('region', { name: 'Medicamentos' })

    await userEvent.type(screen.getByLabelText('Categoría del nuevo ítem'), 'Trauma')
    await userEvent.type(screen.getByLabelText('Nombre del nuevo ítem'), 'Collar cervical')
    const minimo = screen.getByLabelText('Mínimo del nuevo ítem')
    await userEvent.clear(minimo)
    await userEvent.type(minimo, '2')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))

    await waitFor(() =>
      expect(api.crearInsumo).toHaveBeenCalledWith({
        ambulancia_id: 1,
        categoria: 'Trauma',
        nombre: 'Collar cervical',
        minimo: 2,
        unidad: null,
      }),
    )
  })

  it('muestra el error del servidor al agregar un ítem repetido', async () => {
    vi.mocked(api.crearInsumo).mockRejectedValue(
      new api.ApiError(409, 'Ese móvil ya tiene un ítem con ese nombre'),
    )
    render(<InsumosPage />)
    await screen.findByRole('region', { name: 'Medicamentos' })

    await userEvent.type(screen.getByLabelText('Categoría del nuevo ítem'), 'Respiratorio')
    await userEvent.type(screen.getByLabelText('Nombre del nuevo ítem'), 'Ambu adulto')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }))

    expect(await screen.findByText('Ese móvil ya tiene un ítem con ese nombre')).toBeInTheDocument()
  })

  it('el historial muestra los faltantes de un chequeo', async () => {
    vi.mocked(api.listarChequeosInsumos).mockResolvedValue([
      {
        id: 9,
        ambulancia_id: 1,
        movil: 'M-01',
        auxiliar_nombre: 'Ana Ruiz',
        realizado_en: '2026-11-10T15:00:00Z',
        tiene_faltantes: true,
        total_faltantes: 1,
      },
    ])
    vi.mocked(api.obtenerChequeoInsumos).mockResolvedValue(CHEQUEO)
    render(<InsumosPage />)

    expect(await screen.findByText(/Ana Ruiz/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver detalle' }))

    expect(await screen.findByText(/encontró 2 amp de 5 amp \(faltan 3\)/)).toBeInTheDocument()
    expect(screen.getByText(/Reponer el lunes/)).toBeInTheDocument()
  })

  it('avisa si no se pudieron cargar los móviles', async () => {
    vi.mocked(api.listarEstadoInsumos).mockRejectedValue(new api.ApiError(500, 'Falló el servidor'))

    render(<InsumosPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor')
  })
})
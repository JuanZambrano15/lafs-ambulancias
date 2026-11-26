import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import type { Ambulancia } from '../lib/types'
import { AmbulanciasPage } from './AmbulanciasPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))

function ambulancia(overrides: Partial<Ambulancia> = {}): Ambulancia {
  return {
    id: 1,
    movil: 'M01',
    placa: 'AAA111',
    tipo: 'basica',
    vencimiento_soat: '2027-01-01',
    vencimiento_tecnomecanica: '2027-02-01',
    activa: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listarAmbulancias).mockResolvedValue([
    ambulancia(),
    ambulancia({ id: 2, movil: 'IVECO', placa: 'BBB222', tipo: 'medicalizada', activa: false }),
  ])
})

describe('AmbulanciasPage', () => {
  it('lista todas las ambulancias, también las dadas de baja', async () => {
    render(<AmbulanciasPage />)

    expect(await screen.findByText('M01')).toBeInTheDocument()
    expect(screen.getByText('IVECO')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Medicalizada' })).toBeInTheDocument()
    expect(screen.getByText('De baja')).toBeInTheDocument()
    expect(api.listarAmbulancias).toHaveBeenCalledWith()
  })

  it('crea una ambulancia nueva', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.crearAmbulancia).mockResolvedValue(ambulancia({ id: 3, movil: 'M02' }))
    render(<AmbulanciasPage />)
    await screen.findByText('M01')

    await usuario.type(screen.getByLabelText('Móvil'), 'M02')
    await usuario.type(screen.getByLabelText('Placa'), 'ccc333')
    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'medicalizada')
    await usuario.type(screen.getByLabelText('Vencimiento del SOAT'), '2027-05-01')
    await usuario.type(screen.getByLabelText('Vencimiento de la tecnomecánica'), '2027-06-01')
    await usuario.click(screen.getByRole('button', { name: 'Crear ambulancia' }))

    await waitFor(() =>
      expect(api.crearAmbulancia).toHaveBeenCalledWith({
        movil: 'M02',
        placa: 'CCC333',
        tipo: 'medicalizada',
        vencimiento_soat: '2027-05-01',
        vencimiento_tecnomecanica: '2027-06-01',
      }),
    )
    // Vuelve a cargar la lista después de guardar.
    await waitFor(() => expect(api.listarAmbulancias).toHaveBeenCalledTimes(2))
  })

  it('edita una ambulancia precargando sus datos', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.actualizarAmbulancia).mockResolvedValue(ambulancia({ placa: 'ZZZ999' }))
    render(<AmbulanciasPage />)
    await screen.findByText('M01')

    await usuario.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    expect(screen.getByLabelText('Móvil')).toHaveValue('M01')
    expect(screen.getByLabelText('Placa')).toHaveValue('AAA111')

    await usuario.clear(screen.getByLabelText('Placa'))
    await usuario.type(screen.getByLabelText('Placa'), 'zzz999')
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() =>
      expect(api.actualizarAmbulancia).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ movil: 'M01', placa: 'ZZZ999' }),
      ),
    )
  })

  it('muestra el error del backend si el móvil o la placa ya existen', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.crearAmbulancia).mockRejectedValue(
      new api.ApiError(409, 'Ya existe una ambulancia con ese móvil o esa placa'),
    )
    render(<AmbulanciasPage />)
    await screen.findByText('M01')

    await usuario.type(screen.getByLabelText('Móvil'), 'M01')
    await usuario.type(screen.getByLabelText('Placa'), 'AAA111')
    await usuario.type(screen.getByLabelText('Vencimiento del SOAT'), '2027-05-01')
    await usuario.type(screen.getByLabelText('Vencimiento de la tecnomecánica'), '2027-06-01')
    await usuario.click(screen.getByRole('button', { name: 'Crear ambulancia' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una ambulancia')
  })

  it('da de baja una ambulancia activa previa confirmación', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.desactivarAmbulancia).mockResolvedValue(undefined)
    render(<AmbulanciasPage />)
    await screen.findByText('M01')

    await usuario.click(screen.getByRole('button', { name: 'Dar de baja' }))

    await waitFor(() => expect(api.desactivarAmbulancia).toHaveBeenCalledWith(1))
  })

  it('no hace nada si se cancela la confirmación', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AmbulanciasPage />)
    await screen.findByText('M01')

    await usuario.click(screen.getByRole('button', { name: 'Dar de baja' }))
    await usuario.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])

    expect(api.desactivarAmbulancia).not.toHaveBeenCalled()
    expect(api.eliminarAmbulanciaDefinitivo).not.toHaveBeenCalled()
  })

  it('reactiva una ambulancia dada de baja', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.actualizarAmbulancia).mockResolvedValue(ambulancia({ id: 2, activa: true }))
    render(<AmbulanciasPage />)
    await screen.findByText('IVECO')

    await usuario.click(screen.getByRole('button', { name: 'Reactivar' }))

    await waitFor(() => expect(api.actualizarAmbulancia).toHaveBeenCalledWith(2, { activa: true }))
  })

  it('elimina una ambulancia sin historial', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.eliminarAmbulanciaDefinitivo).mockResolvedValue(undefined)
    render(<AmbulanciasPage />)
    await screen.findByText('M01')

    await usuario.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])

    await waitFor(() => expect(api.eliminarAmbulanciaDefinitivo).toHaveBeenCalledWith(1))
  })

  it('muestra el 409 del backend al eliminar una ambulancia con historial', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.eliminarAmbulanciaDefinitivo).mockRejectedValue(
      new api.ApiError(409, 'Esta ambulancia ya tiene historial (atenciones o chequeos): dala de baja'),
    )
    render(<AmbulanciasPage />)
    await screen.findByText('M01')

    await usuario.click(screen.getAllByRole('button', { name: 'Eliminar' })[0])

    expect(await screen.findByRole('alert')).toHaveTextContent('dala de baja')
  })
})
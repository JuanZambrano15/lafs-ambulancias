import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { JSX } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import type { Ambulancia, Empleado } from '../lib/types'
import { cambiosDeTripulacion, tripulacionInicial } from '../lib/tripulacion'
import type { TripulacionActual } from '../lib/tripulacion'
import { TripulacionCorreccion } from './TripulacionCorreccion'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))

function empleado(id: number, nombres: string): Empleado {
  return {
    id,
    nombres,
    apellidos: 'Prueba',
    cedula: String(1000 + id),
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: true,
  }
}

function ambulancia(id: number, movil: string, activa = true): Ambulancia {
  return {
    id,
    movil,
    placa: `AAA${id}00`,
    tipo: 'basica',
    vencimiento_soat: '2027-01-01',
    vencimiento_tecnomecanica: '2027-01-01',
    activa,
  }
}

const ACTUAL: TripulacionActual = {
  ambulancia: ambulancia(1, 'M01'),
  conductor: empleado(10, 'Carlos'),
  responsable: empleado(20, 'Ana'),
}

function Contenedor({ actual = ACTUAL }: { actual?: TripulacionActual }): JSX.Element {
  const [valor, setValor] = useState(tripulacionInicial(actual))
  return (
    <>
      <TripulacionCorreccion actual={actual} valor={valor} onChange={setValor} />
      <output data-testid="cambios">{JSON.stringify(cambiosDeTripulacion(actual, valor))}</output>
    </>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listarAmbulancias).mockResolvedValue([ambulancia(1, 'M01'), ambulancia(2, 'M02')])
  vi.mocked(api.listarConductoresDisponibles).mockResolvedValue([
    empleado(10, 'Carlos'),
    empleado(11, 'Luis'),
  ])
  vi.mocked(api.listarResponsablesDisponibles).mockResolvedValue([
    empleado(20, 'Ana'),
    empleado(21, 'Marta'),
  ])
})

describe('cambiosDeTripulacion', () => {
  it('sin cambios no manda nada', () => {
    expect(cambiosDeTripulacion(ACTUAL, tripulacionInicial(ACTUAL))).toEqual({})
  })

  it('manda solo lo que cambió', () => {
    expect(
      cambiosDeTripulacion(ACTUAL, { ambulanciaId: '2', conductorId: '10', responsableId: '21' }),
    ).toEqual({ ambulancia_id: 2, responsable_id: 21 })
  })
})

describe('TripulacionCorreccion', () => {
  it('preselecciona la tripulación actual y ofrece las alternativas', async () => {
    render(<Contenedor />)

    await screen.findByRole('option', { name: /M02/ })
    expect(screen.getByLabelText('Ambulancia')).toHaveValue('1')
    expect(screen.getByLabelText('Conductor')).toHaveValue('10')
    expect(screen.getByLabelText('Auxiliar o médico responsable')).toHaveValue('20')
    expect(screen.getByTestId('cambios')).toHaveTextContent('{}')
  })

  it('al elegir otra ambulancia, conductor y responsable los reporta como cambios', async () => {
    const usuario = userEvent.setup()
    render(<Contenedor />)
    await screen.findByRole('option', { name: /M02/ })

    await usuario.selectOptions(screen.getByLabelText('Ambulancia'), '2')
    await usuario.selectOptions(screen.getByLabelText('Conductor'), '11')
    await usuario.selectOptions(screen.getByLabelText('Auxiliar o médico responsable'), '21')

    await waitFor(() =>
      expect(screen.getByTestId('cambios')).toHaveTextContent(
        '{"ambulancia_id":2,"conductor_id":11,"responsable_id":21}',
      ),
    )
  })

  it('conserva la ambulancia actual aunque esté dada de baja', async () => {
    const actual = { ...ACTUAL, ambulancia: ambulancia(3, 'VIEJA', false) }
    render(<Contenedor actual={actual} />)

    expect(await screen.findByRole('option', { name: /VIEJA.*de baja/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Ambulancia')).toHaveValue('3')
  })
})
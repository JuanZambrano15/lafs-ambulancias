import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { JSX } from 'react'
import { describe, expect, it } from 'vitest'

import { EDAD_VACIA } from '../lib/edad'
import type { EdadONacimientoValor } from '../lib/edad'
import { EdadONacimiento } from './EdadONacimiento'

function Contenedor({ inicial = EDAD_VACIA }: { inicial?: EdadONacimientoValor }): JSX.Element {
  const [valor, setValor] = useState(inicial)
  return (
    <>
      <EdadONacimiento valor={valor} onChange={setValor} referencia="2026-11-25" />
      <output data-testid="estado">{JSON.stringify(valor)}</output>
    </>
  )
}

describe('EdadONacimiento', () => {
  it('por defecto pide la edad', () => {
    render(<Contenedor />)
    expect(screen.getByLabelText('Edad')).toBeInTheDocument()
    expect(screen.queryByLabelText('Fecha de nacimiento')).toBeNull()
  })

  it('con fecha de nacimiento muestra la edad calculada a la fecha del servicio', () => {
    render(<Contenedor />)
    fireEvent.click(screen.getByRole('radio', { name: 'Ingresar fecha de nacimiento' }))
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), {
      target: { value: '1990-11-26' },
    })
    expect(screen.getByTestId('edad-calculada')).toHaveTextContent('Edad: 35 años')
  })

  it('avisa si el nacimiento es posterior al servicio', () => {
    render(<Contenedor inicial={{ modo: 'nacimiento', edad: '', nacimiento: '2027-01-01' }} />)
    expect(screen.getByTestId('edad-calculada')).toHaveTextContent('no puede ser posterior')
  })

  it('escribir la edad actualiza el valor', () => {
    render(<Contenedor />)
    fireEvent.change(screen.getByLabelText('Edad'), { target: { value: '52' } })
    expect(screen.getByTestId('estado')).toHaveTextContent('"edad":"52"')
  })
})
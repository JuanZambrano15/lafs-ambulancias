/**
 * Pruebas del diagrama corporal interactivo (issue #54): tocar una
 * zona + elegir un tipo debe producir una entrada con el lado REAL
 * del paciente (no el de pantalla), según la vista activa -- y cada
 * entrada se puede quitar. Es un componente controlado, así que la
 * envoltura de prueba (`Envoltura`) guarda `valor` en estado, igual
 * que lo haría la página real.
 */
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DiagramaCorporal } from './DiagramaCorporal'
import type { LesionLocalizada } from '../lib/types'

function Envoltura({
  inicial = [],
  onChange,
}: {
  inicial?: LesionLocalizada[]
  onChange?: (valor: LesionLocalizada[]) => void
}) {
  const [valor, setValor] = useState<LesionLocalizada[]>(inicial)
  return (
    <DiagramaCorporal
      valor={valor}
      onChange={(nuevoValor) => {
        setValor(nuevoValor)
        onChange?.(nuevoValor)
      }}
    />
  )
}

describe('DiagramaCorporal', () => {
  it('sin lesiones registradas, muestra el mensaje vacío', () => {
    render(<Envoltura />)

    expect(screen.getByText('Todavía no hay lesiones registradas.')).toBeInTheDocument()
  })

  it('tocar una zona lateral en vista frontal y agregar un tipo registra el lado real del paciente', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)

    // "Hombro" del lado izquierdo de la PANTALLA -- en vista frontal
    // (la que arranca por defecto) corresponde al lado DERECHO real
    // del paciente, porque está de frente a quien mira.
    await usuario.click(screen.getByRole('button', { name: 'Hombro derecho' }))
    expect(screen.getByText(/Zona seleccionada: Hombro derecho — vista frontal/)).toBeInTheDocument()

    await usuario.selectOptions(screen.getByRole('combobox'), 'hematoma')
    await usuario.click(screen.getByRole('button', { name: 'Agregar a la lista' }))

    expect(screen.getByText('Hematoma — Hombro derecho (vista frontal)')).toBeInTheDocument()
  })

  it('la misma zona en vista posterior da el lado contrario', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)

    await usuario.click(screen.getByRole('button', { name: 'Vista posterior' }))
    // El mismo rect de pantalla (lado izquierdo) ahora es el lado
    // IZQUIERDO real del paciente (de espaldas, no se invierte).
    await usuario.click(screen.getByRole('button', { name: 'Hombro izquierdo' }))
    await usuario.selectOptions(screen.getByRole('combobox'), 'hematoma')
    await usuario.click(screen.getByRole('button', { name: 'Agregar a la lista' }))

    expect(screen.getByText('Hematoma — Hombro izquierdo (vista posterior)')).toBeInTheDocument()
  })

  it('una zona sin lado (central) no lleva izquierdo/derecho', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)

    await usuario.click(screen.getByRole('button', { name: 'Cabeza' }))
    expect(screen.getByText(/Zona seleccionada: Cabeza — vista frontal/)).toBeInTheDocument()

    await usuario.selectOptions(screen.getByRole('combobox'), 'tce')
    await usuario.click(screen.getByRole('button', { name: 'Agregar a la lista' }))

    expect(screen.getByText('TCE — Cabeza (vista frontal)')).toBeInTheDocument()
  })

  it('el género del lado concuerda con la zona ("pierna derecha", no "derecho")', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)

    await usuario.click(screen.getByRole('button', { name: 'Pierna derecha' }))
    await usuario.selectOptions(screen.getByRole('combobox'), 'contusion')
    await usuario.click(screen.getByRole('button', { name: 'Agregar a la lista' }))

    expect(screen.getByText('Contusión — Pierna derecha (vista frontal)')).toBeInTheDocument()
  })

  it('tipo "otro" exige texto libre antes de poder agregar', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)

    await usuario.click(screen.getByRole('button', { name: 'Brazo izquierdo' }))
    await usuario.selectOptions(screen.getByRole('combobox'), 'otro')

    const botonAgregar = screen.getByRole('button', { name: 'Agregar a la lista' })
    expect(botonAgregar).toBeDisabled()

    await usuario.type(screen.getByPlaceholderText('Especifica el tipo de lesión'), 'Reacción alérgica')
    expect(botonAgregar).toBeEnabled()

    await usuario.click(botonAgregar)
    expect(screen.getByText('Reacción alérgica — Brazo izquierdo (vista frontal)')).toBeInTheDocument()
  })

  it('se pueden registrar varias lesiones distintas', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)

    await usuario.click(screen.getByRole('button', { name: 'Cabeza' }))
    await usuario.selectOptions(screen.getByRole('combobox'), 'tce')
    await usuario.click(screen.getByRole('button', { name: 'Agregar a la lista' }))

    await usuario.click(screen.getByRole('button', { name: 'Pierna derecha' }))
    await usuario.selectOptions(screen.getByRole('combobox'), 'amputacion')
    await usuario.click(screen.getByRole('button', { name: 'Agregar a la lista' }))

    expect(screen.getByText('TCE — Cabeza (vista frontal)')).toBeInTheDocument()
    expect(screen.getByText('Amputación — Pierna derecha (vista frontal)')).toBeInTheDocument()
  })

  it('"Quitar" elimina solo esa entrada, aunque haya más de una', async () => {
    const usuario = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Envoltura
        inicial={[
          { tipo: 'tce', tipo_otro: null, zona: 'cabeza', lado: 'central', vista: 'frontal' },
          { tipo: 'amputacion', tipo_otro: null, zona: 'pierna', lado: 'derecho', vista: 'frontal' },
        ]}
        onChange={onChange}
      />,
    )

    const quitarBotones = screen.getAllByRole('button', { name: 'Quitar' })
    await usuario.click(quitarBotones[0])

    expect(onChange).toHaveBeenCalledWith([
      { tipo: 'amputacion', tipo_otro: null, zona: 'pierna', lado: 'derecho', vista: 'frontal' },
    ])
    expect(screen.queryByText('TCE — Cabeza (vista frontal)')).not.toBeInTheDocument()
    expect(screen.getByText('Amputación — Pierna derecha (vista frontal)')).toBeInTheDocument()
  })

  it('cambiar de vista cancela la zona seleccionada (sin agregar a medias)', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)

    await usuario.click(screen.getByRole('button', { name: 'Cabeza' }))
    expect(screen.getByRole('combobox')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Vista posterior' }))

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('Toca una parte del diagrama para empezar.')).toBeInTheDocument()
  })
})
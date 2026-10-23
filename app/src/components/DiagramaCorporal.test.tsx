/**
 * Pruebas del diagrama corporal interactivo (issue #54, reordenado en
 * el issue #81): elegir el TIPO primero (un botón) y después tocar
 * una zona debe producir una entrada con el lado REAL del paciente
 * (no el de pantalla), según la vista activa -- y cada entrada se
 * puede quitar. Es un componente controlado, así que la envoltura de
 * prueba (`Envoltura`) guarda `valor` en estado, igual que lo haría
 * la página real.
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
 
  it('issue #81: sin tipo elegido, las zonas del diagrama están deshabilitadas', () => {
    render(<Envoltura />)
 
    const zona = screen.getByRole('button', { name: 'Cabeza' })
    expect(zona).toHaveAttribute('aria-disabled', 'true')
    expect(zona).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('2. Elige el tipo de lesión arriba para poder tocar una zona.')).toBeInTheDocument()
  })
 
  it('issue #81: elegir el tipo primero y tocar una zona agrega directo, sin paso de confirmación', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'Hematoma' }))
    expect(screen.queryByRole('button', { name: 'Agregar a la lista' })).not.toBeInTheDocument()
 
    // "Hombro" del lado izquierdo de la PANTALLA -- en vista frontal
    // (la que arranca por defecto) corresponde al lado DERECHO real
    // del paciente, porque está de frente a quien mira.
    await usuario.click(screen.getByRole('button', { name: 'Hombro derecho' }))
 
    expect(screen.getByText('Hematoma — Hombro derecho (vista frontal)')).toBeInTheDocument()
  })
 
  it('issue #81: el tipo elegido se mantiene seleccionado después de agregar, para marcar varias zonas seguidas', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'Hematoma' }))
    await usuario.click(screen.getByRole('button', { name: 'Hombro derecho' }))
    expect(screen.getByRole('button', { name: 'Hematoma' })).toHaveAttribute('aria-pressed', 'true')
 
    // Sin volver a elegir el tipo, tocar otra zona agrega otra
    // entrada con el mismo tipo.
    await usuario.click(screen.getByRole('button', { name: 'Pierna derecha' }))
 
    expect(screen.getByText('Hematoma — Hombro derecho (vista frontal)')).toBeInTheDocument()
    expect(screen.getByText('Hematoma — Pierna derecha (vista frontal)')).toBeInTheDocument()
  })
 
  it('issue #81: tocar el tipo ya seleccionado lo deselecciona', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    const botonHematoma = screen.getByRole('button', { name: 'Hematoma' })
    await usuario.click(botonHematoma)
    expect(botonHematoma).toHaveAttribute('aria-pressed', 'true')
 
    await usuario.click(botonHematoma)
    expect(botonHematoma).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Cabeza' })).toHaveAttribute('aria-disabled', 'true')
  })
 
  it('issue #81: elegir otro tipo distinto lo cambia sin desmarcar primero', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'Hematoma' }))
    await usuario.click(screen.getByRole('button', { name: 'TCE' }))
 
    expect(screen.getByRole('button', { name: 'Hematoma' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'TCE' })).toHaveAttribute('aria-pressed', 'true')
 
    await usuario.click(screen.getByRole('button', { name: 'Cabeza' }))
    expect(screen.getByText('TCE — Cabeza (vista frontal)')).toBeInTheDocument()
  })
 
  it('la misma zona en vista posterior da el lado contrario', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'Vista posterior' }))
    await usuario.click(screen.getByRole('button', { name: 'Hematoma' }))
    // El mismo rect de pantalla (lado izquierdo) ahora es el lado
    // IZQUIERDO real del paciente (de espaldas, no se invierte).
    await usuario.click(screen.getByRole('button', { name: 'Hombro izquierdo' }))
 
    expect(screen.getByText('Hematoma — Hombro izquierdo (vista posterior)')).toBeInTheDocument()
  })
 
  it('una zona sin lado (central) no lleva izquierdo/derecho', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'TCE' }))
    await usuario.click(screen.getByRole('button', { name: 'Cabeza' }))
 
    expect(screen.getByText('TCE — Cabeza (vista frontal)')).toBeInTheDocument()
  })
 
  it('el género del lado concuerda con la zona ("pierna derecha", no "derecho")', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'Contusión' }))
    await usuario.click(screen.getByRole('button', { name: 'Pierna derecha' }))
 
    expect(screen.getByText('Contusión — Pierna derecha (vista frontal)')).toBeInTheDocument()
  })
 
  it('tipo "otro" exige texto libre antes de poder tocar una zona', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'Otro (especificar)' }))
    const zona = screen.getByRole('button', { name: 'Brazo izquierdo' })
    expect(zona).toHaveAttribute('aria-disabled', 'true')
 
    await usuario.type(screen.getByPlaceholderText('Especifica el tipo de lesión'), 'Reacción alérgica')
    expect(zona).toHaveAttribute('aria-disabled', 'false')
 
    await usuario.click(zona)
    expect(screen.getByText('Reacción alérgica — Brazo izquierdo (vista frontal)')).toBeInTheDocument()
  })
 
  it('tipo "otro": cambiar a otro tipo limpia el texto libre escrito', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'Otro (especificar)' }))
    await usuario.type(screen.getByPlaceholderText('Especifica el tipo de lesión'), 'Reacción alérgica')
 
    await usuario.click(screen.getByRole('button', { name: 'TCE' }))
    expect(screen.queryByPlaceholderText('Especifica el tipo de lesión')).not.toBeInTheDocument()
  })
 
  it('se pueden registrar varias lesiones distintas', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'TCE' }))
    await usuario.click(screen.getByRole('button', { name: 'Cabeza' }))
 
    await usuario.click(screen.getByRole('button', { name: 'Amputación' }))
    await usuario.click(screen.getByRole('button', { name: 'Pierna derecha' }))
 
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
 
  it('cambiar de vista NO limpia el tipo elegido (issue #81)', async () => {
    const usuario = userEvent.setup()
    render(<Envoltura />)
 
    await usuario.click(screen.getByRole('button', { name: 'TCE' }))
    await usuario.click(screen.getByRole('button', { name: 'Vista posterior' }))
 
    expect(screen.getByRole('button', { name: 'TCE' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Cabeza' })).toHaveAttribute('aria-disabled', 'false')
  })
})
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import * as pinLocal from '../lib/pinLocal'
import { AuthProvider } from '../auth/AuthContext'
import type { MeResponse } from '../lib/types'
import { ConfigurarPinPage } from './ConfigurarPinPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
vi.mock('../lib/pinLocal')
 
function perfilCon(pinConfigurado: boolean): MeResponse {
  return {
    documento: '123456789',
    activo: true,
    empleado_id: 1,
    debe_cambiar_password: false,
    pin_configurado: pinConfigurado,
    roles: [],
    empleado_tipo_vinculacion: null,
    firma_guardada: null,
  }
}
 
beforeEach(() => {
  vi.clearAllMocks()
})
 
function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/configurar-pin']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<div>pantalla principal</div>} />
          <Route path="/configurar-pin" element={<ConfigurarPinPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}
 
describe('ConfigurarPinPage', () => {
  it('muestra el mensaje de primera vez cuando el usuario no tiene PIN', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon(false))
 
    renderPagina()
 
    expect(
      await screen.findByText(/Lo vas a necesitar para cerrar los formatos/),
    ).toBeInTheDocument()
  })
 
  it('valida que el PIN y su confirmación coincidan', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon(false))
 
    renderPagina()
 
    await usuario.type(await screen.findByLabelText('PIN (4 dígitos)'), '1234')
    await usuario.type(screen.getByLabelText('Confirma el PIN'), '9999')
    await usuario.click(screen.getByRole('button', { name: 'Guardar PIN' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Los PIN no coinciden')
    expect(api.establecerPin).not.toHaveBeenCalled()
  })
 
  it('guarda el PIN en el backend y el hash local, y vuelve a la pantalla principal', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon(false))
    vi.mocked(api.establecerPin).mockResolvedValue(undefined)
 
    renderPagina()
 
    await usuario.type(await screen.findByLabelText('PIN (4 dígitos)'), '1234')
    await usuario.type(screen.getByLabelText('Confirma el PIN'), '1234')
    await usuario.click(screen.getByRole('button', { name: 'Guardar PIN' }))
 
    await waitFor(() => expect(api.establecerPin).toHaveBeenCalledWith('1234'))
    expect(pinLocal.guardarPinLocal).toHaveBeenCalledWith('1234')
    expect(await screen.findByText('pantalla principal')).toBeInTheDocument()
  })
 
  it('muestra el error del backend si falla al guardar', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon(false))
    vi.mocked(api.establecerPin).mockRejectedValue(new api.ApiError(422, 'PIN inválido'))
 
    renderPagina()
 
    await usuario.type(await screen.findByLabelText('PIN (4 dígitos)'), '1234')
    await usuario.type(screen.getByLabelText('Confirma el PIN'), '1234')
    await usuario.click(screen.getByRole('button', { name: 'Guardar PIN' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN inválido')
  })
})
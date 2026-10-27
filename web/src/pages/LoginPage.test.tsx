import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { AuthProvider } from '../auth/AuthContext'
import type { MeResponse } from '../lib/types'
import { LoginPage } from './LoginPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
 
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerPerfil).mockRejectedValue(new api.ApiError(401, 'sin sesión'))
})
 
function renderLogin(): void {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}
 
describe('LoginPage', () => {
  it('pide documento y contraseña', async () => {
    renderLogin()
    await waitFor(() => expect(screen.getByLabelText('Documento')).toBeInTheDocument())
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })
 
  it('muestra un error si las credenciales son incorrectas', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.login).mockRejectedValue(
      new api.ApiError(401, 'Documento o contraseña incorrectos'),
    )
    renderLogin()
    await waitFor(() => expect(screen.getByLabelText('Documento')).toBeInTheDocument())
 
    await usuario.type(screen.getByLabelText('Documento'), '123456789')
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-mala')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Documento o contraseña incorrectos',
    )
  })
 
  it('inicia sesión con credenciales correctas', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.login).mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'bearer',
      pin_configurado: true,
      debe_cambiar_password: false,
    })
    renderLogin()
    await waitFor(() => expect(screen.getByLabelText('Documento')).toBeInTheDocument())
 
    await usuario.type(screen.getByLabelText('Documento'), '123456789')
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-buena')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))
 
    await waitFor(() => expect(api.login).toHaveBeenCalledWith('123456789', 'clave-buena'))
  })
 
  function perfilConRol(rol: string): MeResponse {
    return {
      documento: '123456789',
      activo: true,
      empleado_id: null,
      debe_cambiar_password: false,
      pin_configurado: true,
      roles: [{ id: 1, nombre: rol, descripcion: null }],
      empleado_tipo_vinculacion: null,
      firma_guardada: null,
    }
  }
 
  async function iniciarSesionYNavegar(perfilTrasLogin: MeResponse): Promise<void> {
    const usuario = userEvent.setup()
    vi.mocked(api.login).mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'bearer',
      pin_configurado: true,
      debe_cambiar_password: false,
    })
 
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>pantalla de inicio</p>} />
            <Route path="/reportes/servicios" element={<p>pantalla de reportes</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
    // El `obtenerPerfil` del montaje (sin sesión todavía) debe rechazar,
    // como ya lo deja `beforeEach` -- solo DESPUÉS de que el formulario
    // se ve se cambia el mock para el que dispara `iniciarSesion`, para
    // no pisar esa primera llamada.
    await waitFor(() => expect(screen.getByLabelText('Documento')).toBeInTheDocument())
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilTrasLogin)
 
    await usuario.type(screen.getByLabelText('Documento'), '123456789')
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-buena')
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }))
  }
 
  it('issue #24: manda al administrador a "/"', async () => {
    await iniciarSesionYNavegar(perfilConRol('administrador'))
 
    expect(await screen.findByText('pantalla de inicio')).toBeInTheDocument()
  })
 
  it('issue #24: manda al contador directo a su reporte, no a "/"', async () => {
    await iniciarSesionYNavegar(perfilConRol('contador'))
 
    expect(await screen.findByText('pantalla de reportes')).toBeInTheDocument()
  })
})
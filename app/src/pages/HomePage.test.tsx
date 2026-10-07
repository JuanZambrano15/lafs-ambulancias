import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { AuthProvider } from '../auth/AuthContext'
import type { MeResponse } from '../lib/types'
import { HomePage } from './HomePage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
 
function perfilCon(
  roles: MeResponse['roles'],
  tipoVinculacion: MeResponse['empleado_tipo_vinculacion'] = null,
): MeResponse {
  return {
    documento: '123456789',
    activo: true,
    empleado_id: null,
    debe_cambiar_password: false,
    pin_configurado: true,
    roles,
    empleado_tipo_vinculacion: tipoVinculacion,
    firma_guardada: null,
  }
}
 
function renderHome(): void {
  render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  )
}
 
beforeEach(() => {
  vi.clearAllMocks()
})
 
describe('HomePage', () => {
  it('muestra solo las secciones del rol conductor', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'conductor', descripcion: null }]),
    )
 
    renderHome()
 
    await waitFor(() => expect(screen.getByText('Chequeo de ambulancia')).toBeInTheDocument())
    expect(screen.getByText('Iniciar atención')).toBeInTheDocument()
    expect(screen.queryByText('Usuarios y roles')).not.toBeInTheDocument()
    expect(screen.queryByText('Atención SOAT')).not.toBeInTheDocument()
  })
 
  it('muestra las secciones combinadas cuando el usuario tiene varios roles', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([
        { id: 1, nombre: 'medico', descripcion: null },
        { id: 2, nombre: 'conductor', descripcion: null },
      ]),
    )
 
    renderHome()
 
    await waitFor(() => expect(screen.getByText('Atención SOAT')).toBeInTheDocument())
    // "Formato de traslado" la comparten medico y auxiliar — no debe duplicarse.
    expect(screen.getAllByText('Formato de traslado')).toHaveLength(1)
    // "Iniciar atención" la comparten medico y conductor — tampoco debe duplicarse.
    expect(screen.getAllByText('Iniciar atención')).toHaveLength(1)
    expect(screen.getByText('Chequeo de ambulancia')).toBeInTheDocument()
  })
 
  it('el enlace de "Iniciar atención" apunta a /atenciones/nueva', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
 
    renderHome()
 
    const enlace = await screen.findByRole('link', { name: 'Empezar' })
    expect(enlace).toHaveAttribute('href', '/atenciones/nueva')
  })
 
  it('avisa cuando el usuario no tiene secciones asignadas', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon([]))
 
    renderHome()
 
    expect(
      await screen.findByText('Tu usuario no tiene secciones asignadas todavía.'),
    ).toBeInTheDocument()
  })
 
  it('muestra "Mi firma" solo si el empleado es de planta (issue #11)', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }], 'planta'),
    )
 
    renderHome()
 
    expect(await screen.findByText('Mi firma')).toBeInTheDocument()
  })
 
  it('no muestra "Mi firma" para personal ocasional', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }], 'ocasional'),
    )
 
    renderHome()
 
    await screen.findByText('Formato de traslado')
    expect(screen.queryByText('Mi firma')).not.toBeInTheDocument()
  })
})
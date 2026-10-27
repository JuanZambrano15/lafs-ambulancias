import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { AuthProvider } from '../auth/AuthContext'
import type { MeResponse } from '../lib/types'
import { Layout } from './Layout'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
 
const perfilAdmin: MeResponse = {
  documento: '999999999',
  activo: true,
  empleado_id: null,
  debe_cambiar_password: false,
  pin_configurado: false,
  roles: [{ id: 1, nombre: 'administrador', descripcion: null }],
  empleado_tipo_vinculacion: null,
  firma_guardada: null,
}
 
const perfilContador: MeResponse = {
  ...perfilAdmin,
  documento: '888888880',
  roles: [{ id: 2, nombre: 'contador', descripcion: null }],
}
 
beforeEach(() => {
  vi.clearAllMocks()
})
 
function renderConPerfil(perfil: MeResponse): void {
  vi.mocked(api.obtenerPerfil).mockResolvedValue(perfil)
  render(
    <MemoryRouter>
      <AuthProvider>
        <Layout>
          <p>contenido</p>
        </Layout>
      </AuthProvider>
    </MemoryRouter>,
  )
}
 
describe('Layout', () => {
  it('issue #24: el administrador ve el menú completo', async () => {
    renderConPerfil(perfilAdmin)
 
    expect(await screen.findByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Servicios cerrados' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Servicios por persona' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Empleados' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Roles' })).toBeInTheDocument()
  })
 
  it('issue #24: el contador solo ve "Servicios por persona"', async () => {
    renderConPerfil(perfilContador)
 
    expect(await screen.findByRole('link', { name: 'Servicios por persona' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Inicio' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Servicios cerrados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Empleados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument()
  })
})
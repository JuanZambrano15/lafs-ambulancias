import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { AuthProvider } from '../auth/AuthContext'
import type { Atencion, MeResponse } from '../lib/types'
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
 
const ATENCION_EN_CURSO: Atencion = {
  id: 7,
  tipo: 'traslado',
  estado: 'abierto',
  abierta_en: '2026-10-13T23:35:51.780547+00:00',
  cerrada_en: null,
  ambulancia: {
    id: 1,
    movil: 'M-03',
    placa: 'ABC123',
    tipo: 'basica',
    vencimiento_soat: '2027-01-01',
    vencimiento_tecnomecanica: '2027-01-01',
    activa: true,
  },
  conductor: {
    id: 2,
    nombres: 'Pedro',
    apellidos: 'Londoño',
    cedula: '800000009',
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: true,
  },
  responsable: {
    id: 3,
    nombres: 'Ana',
    apellidos: 'Ruiz',
    cedula: '700000001',
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: true,
  },
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
 
  it('avisa de un servicio en curso y enlaza a continuarlo (issue #51)', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.listarAtencionesEnCurso).mockResolvedValue([ATENCION_EN_CURSO])
 
    renderHome()
 
    expect(await screen.findByText(/Servicio en curso — móvil M-03/)).toBeInTheDocument()
    const enlace = screen.getByRole('link', { name: 'Continuar' })
    expect(enlace).toHaveAttribute('href', '/atenciones/7/encabezado-traslado')
  })
 
  it('no pregunta por servicios en curso si el rol no puede ser responsable', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'conductor', descripcion: null }]),
    )
 
    renderHome()
 
    await screen.findByText('Chequeo de ambulancia')
    expect(api.listarAtencionesEnCurso).not.toHaveBeenCalled()
  })
})
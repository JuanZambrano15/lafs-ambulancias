import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import type { Empleado, Rol, Usuario } from '../lib/types'
import { UsuariosPage } from './UsuariosPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
 
const roles: Rol[] = [
  { id: 1, nombre: 'administrador', descripcion: null },
  { id: 2, nombre: 'conductor', descripcion: null },
]
 
const empleados: Empleado[] = [
  {
    id: 10,
    nombres: 'Carlos',
    apellidos: 'Gómez',
    cedula: '800000001',
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: true,
  },
  {
    id: 11,
    nombres: 'Ana',
    apellidos: 'Ruiz',
    cedula: '800000002',
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: false,
  },
]
 
const usuarios: Usuario[] = [
  {
    id: 1,
    documento: '999999999',
    activo: true,
    empleado_id: 10,
    debe_cambiar_password: false,
    roles: [roles[0]],
  },
]
 
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listarUsuarios).mockResolvedValue(usuarios)
  vi.mocked(api.listarEmpleados).mockResolvedValue(empleados)
  vi.mocked(api.listarRoles).mockResolvedValue(roles)
})
 
describe('UsuariosPage', () => {
  it('lista los usuarios existentes, con su empleado y sus roles', async () => {
    render(<UsuariosPage />)
 
    expect(await screen.findByText('999999999')).toBeInTheDocument()
    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument()
    // No `getByText`: "administrador" también aparece como la etiqueta del
    // checkbox en el formulario de creación — la celda de la tabla es inequívoca.
    expect(screen.getByRole('cell', { name: 'administrador' })).toBeInTheDocument()
  })
 
  it('crea un usuario nuevo sin pedir contraseña (la define el backend)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.crearUsuario).mockResolvedValue({
      id: 2,
      documento: '111111111',
      activo: true,
      empleado_id: null,
      debe_cambiar_password: true,
      roles: [],
    })
    render(<UsuariosPage />)
    await screen.findByText('999999999')
 
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument()
 
    await usuario.type(screen.getByLabelText('Documento'), '111111111')
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }))
 
    await waitFor(() =>
      expect(api.crearUsuario).toHaveBeenCalledWith({
        documento: '111111111',
        empleado_id: null,
        roles: [],
      }),
    )
    expect(await screen.findByText(/su contraseña inicial es el mismo documento/i)).toBeInTheDocument()
  })
 
  it('crea un usuario con empleado y roles seleccionados', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.crearUsuario).mockResolvedValue({
      id: 3,
      documento: '222222222',
      activo: true,
      empleado_id: 10,
      debe_cambiar_password: true,
      roles: [roles[1]],
    })
    render(<UsuariosPage />)
    await screen.findByText('999999999')
 
    await usuario.type(screen.getByLabelText('Documento'), '222222222')
    await usuario.selectOptions(screen.getByLabelText(/Empleado vinculado/i), '10')
    await usuario.click(screen.getByLabelText('conductor'))
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }))
 
    await waitFor(() =>
      expect(api.crearUsuario).toHaveBeenCalledWith({
        documento: '222222222',
        empleado_id: 10,
        roles: [2],
      }),
    )
  })
 
  it('resetea la contraseña de un usuario tras confirmar', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.resetearPasswordUsuario).mockResolvedValue(undefined)
    render(<UsuariosPage />)
    await screen.findByText('999999999')
 
    await usuario.click(screen.getByText('Resetear contraseña'))
 
    await waitFor(() => expect(api.resetearPasswordUsuario).toHaveBeenCalledWith(1))
    expect(await screen.findByText(/reseteada al documento/i)).toBeInTheDocument()
  })
 
  it('desactiva un usuario activo', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.actualizarUsuario).mockResolvedValue({ ...usuarios[0], activo: false })
    render(<UsuariosPage />)
    await screen.findByText('999999999')
 
    await usuario.click(screen.getByText('Desactivar'))
 
    await waitFor(() => expect(api.actualizarUsuario).toHaveBeenCalledWith(1, { activo: false }))
  })
 
  it('edita los roles de un usuario existente', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.asignarRolesUsuario).mockResolvedValue({
      ...usuarios[0],
      roles: [roles[0], roles[1]],
    })
    render(<UsuariosPage />)
    const filaUsuario = (await screen.findByText('999999999')).closest('tr')
    if (!filaUsuario) throw new Error('No se encontró la fila del usuario')
 
    await usuario.click(within(filaUsuario).getByRole('button', { name: 'Roles' }))
    // Alcance a la fila: el formulario de creación, arriba, también
    // tiene un checkbox "conductor" — sin `within` quedaría ambiguo.
    await usuario.click(within(filaUsuario).getByLabelText('conductor'))
    await usuario.click(within(filaUsuario).getByRole('button', { name: 'Guardar' }))
 
    await waitFor(() =>
      expect(api.asignarRolesUsuario).toHaveBeenCalledWith(1, { roles: [1, 2] }),
    )
  })
 
  it('no ofrece empleados inactivos en el selector de empleado vinculado', async () => {
    render(<UsuariosPage />)
    await screen.findByText('999999999')
 
    const selector = screen.getByLabelText(/Empleado vinculado/i)
    expect(within(selector).getByText(/Carlos Gómez/)).toBeInTheDocument()
    expect(within(selector).queryByText(/Ana Ruiz/)).not.toBeInTheDocument()
  })
 
  it('autocompleta el documento con la cédula del empleado seleccionado', async () => {
    const usuario = userEvent.setup()
    render(<UsuariosPage />)
    await screen.findByText('999999999')
 
    const documentoInput = screen.getByLabelText('Documento') as HTMLInputElement
    expect(documentoInput.value).toBe('')
 
    await usuario.selectOptions(screen.getByLabelText(/Empleado vinculado/i), '10')
 
    expect(documentoInput.value).toBe('800000001')
  })
 
  it('no pisa un documento ya escrito a mano al seleccionar un empleado', async () => {
    const usuario = userEvent.setup()
    render(<UsuariosPage />)
    await screen.findByText('999999999')
 
    await usuario.type(screen.getByLabelText('Documento'), '333333333')
    await usuario.selectOptions(screen.getByLabelText(/Empleado vinculado/i), '10')
 
    expect((screen.getByLabelText('Documento') as HTMLInputElement).value).toBe('333333333')
  })
})
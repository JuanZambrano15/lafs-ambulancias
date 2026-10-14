/**
 * CRUD de usuarios y asignación de roles (issue #4 backend, issue #49
 * pantalla) — el corazón de este issue: sin esto no se puede crear un
 * conductor/médico/auxiliar de prueba.
 *
 * La contraseña inicial NO la define el administrador (ver ADR-0003):
 * el backend la genera igual al documento y marca
 * `debe_cambiar_password=true`. Por eso el formulario de creación no
 * tiene ningún campo de contraseña — solo documento, empleado
 * (opcional) y roles.
 *
 * El borrado es "soft" (ver ADR-0003): "Desactivar"/"Activar"
 * alternan `activo`, nunca se elimina la fila.
 */
 
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, JSX } from 'react'
 
import {
  ApiError,
  actualizarUsuario,
  asignarRolesUsuario,
  crearUsuario,
  listarEmpleados,
  listarRoles,
  listarUsuarios,
  resetearPasswordUsuario,
} from '../lib/api'
import type { Empleado, Rol, Usuario } from '../lib/types'
 
export function UsuariosPage(): JSX.Element {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
 
  // Formulario de creación.
  const [documento, setDocumento] = useState('')
  const [empleadoId, setEmpleadoId] = useState<string>('')
  const [rolesSeleccionados, setRolesSeleccionados] = useState<Set<number>>(new Set())
  const [enviando, setEnviando] = useState(false)
 
  // Edición de roles de un usuario ya existente (uno a la vez).
  const [edicionRolesId, setEdicionRolesId] = useState<number | null>(null)
  const [rolesEdicion, setRolesEdicion] = useState<Set<number>>(new Set())
 
  // Ver el comentario equivalente en RolesPage.tsx sobre por qué el
  // efecto de montaje encadena `.then/.catch` en vez de llamar a
  // `cargar` — esta sí se reutiliza después de crear/editar un
  // usuario, desde los manejadores de evento.
  const cargar = useCallback(async () => {
    try {
      const [listaUsuarios, listaEmpleados, listaRoles] = await Promise.all([
        listarUsuarios(),
        listarEmpleados(),
        listarRoles(),
      ])
      setUsuarios(listaUsuarios)
      setEmpleados(listaEmpleados)
      setRoles(listaRoles)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los usuarios')
    }
  }, [])
 
  useEffect(() => {
    Promise.all([listarUsuarios(), listarEmpleados(), listarRoles()])
      .then(([listaUsuarios, listaEmpleados, listaRoles]) => {
        setUsuarios(listaUsuarios)
        setEmpleados(listaEmpleados)
        setRoles(listaRoles)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los usuarios')
      })
  }, [])
 
  const empleadoPorId = useMemo(
    () => new Map(empleados.map((empleado) => [empleado.id, empleado])),
    [empleados],
  )
 
  function alternarRolFormulario(rolId: number): void {
    setRolesSeleccionados((actuales) => {
      const siguientes = new Set(actuales)
      if (siguientes.has(rolId)) {
        siguientes.delete(rolId)
      } else {
        siguientes.add(rolId)
      }
      return siguientes
    })
  }
 
  async function manejarCrear(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setMensaje(null)
    setEnviando(true)
    try {
      await crearUsuario({
        documento,
        empleado_id: empleadoId ? Number(empleadoId) : null,
        roles: [...rolesSeleccionados],
      })
      setDocumento('')
      setEmpleadoId('')
      setRolesSeleccionados(new Set())
      setMensaje(
        `Usuario ${documento} creado. Su contraseña inicial es el mismo documento — se le pedirá cambiarla al ingresar.`,
      )
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario')
    } finally {
      setEnviando(false)
    }
  }
 
  function comenzarEdicionRoles(usuario: Usuario): void {
    setEdicionRolesId(usuario.id)
    setRolesEdicion(new Set(usuario.roles.map((rol) => rol.id)))
    setError(null)
    setMensaje(null)
  }
 
  function alternarRolEdicion(rolId: number): void {
    setRolesEdicion((actuales) => {
      const siguientes = new Set(actuales)
      if (siguientes.has(rolId)) {
        siguientes.delete(rolId)
      } else {
        siguientes.add(rolId)
      }
      return siguientes
    })
  }
 
  async function guardarRolesEdicion(): Promise<void> {
    if (edicionRolesId === null) return
    setError(null)
    try {
      await asignarRolesUsuario(edicionRolesId, { roles: [...rolesEdicion] })
      setEdicionRolesId(null)
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los roles')
    }
  }
 
  async function manejarResetearPassword(usuario: Usuario): Promise<void> {
    if (
      !window.confirm(
        `¿Resetear la contraseña de ${usuario.documento}? Volverá a ser igual al documento.`,
      )
    )
      return
    setError(null)
    setMensaje(null)
    try {
      await resetearPasswordUsuario(usuario.id)
      setMensaje(`Contraseña de ${usuario.documento} reseteada al documento.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo resetear la contraseña')
    }
  }
 
  async function manejarActivo(usuario: Usuario): Promise<void> {
    setError(null)
    try {
      await actualizarUsuario(usuario.id, { activo: !usuario.activo })
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado del usuario')
    }
  }
 
  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold text-slate-900">Usuarios</h2>
 
      <form
        onSubmit={manejarCrear}
        className="mb-8 max-w-md rounded-xl border border-slate-200 bg-white p-6"
      >
        <h3 className="mb-4 text-sm font-semibold text-slate-700">Nuevo usuario</h3>
 
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="usr-documento">
          Documento
        </label>
        <input
          id="usr-documento"
          type="text"
          required
          minLength={5}
          value={documento}
          onChange={(evento) => setDocumento(evento.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
 
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="usr-empleado">
          Empleado vinculado (opcional)
        </label>
        <select
          id="usr-empleado"
          value={empleadoId}
          onChange={(evento) => {
            const valor = evento.target.value
            setEmpleadoId(valor)
            // Autocompletar el documento con la cédula del empleado
            // elegido -- solo si el campo está vacío, para no pisar
            // algo que el administrador ya haya escrito a mano.
            if (valor && documento.trim() === '') {
              const empleado = empleados.find((candidato) => candidato.id === Number(valor))
              if (empleado) setDocumento(empleado.cedula)
            }
          }}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">— Sin empleado —</option>
          {/* Solo empleados activos: uno desactivado no debería poder
              vincularse a un usuario nuevo. Los ya vinculados antes de
              desactivarse se siguen mostrando en la tabla de abajo,
              porque esa usa `empleadoPorId` con la lista completa, no
              esta. */}
          {empleados
            .filter((empleado) => empleado.activo)
            .map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {empleado.nombres} {empleado.apellidos} ({empleado.cedula})
              </option>
            ))}
        </select>
 
        <p className="mb-1 block text-sm font-medium text-slate-700">Roles</p>
        <div className="mb-4 flex flex-wrap gap-3">
          {roles.map((rol) => (
            <label key={rol.id} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={rolesSeleccionados.has(rol.id)}
                onChange={() => alternarRolFormulario(rol.id)}
              />
              {rol.nombre}
            </label>
          ))}
        </div>
 
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}
        {mensaje && <p className="mb-4 text-sm text-green-700">{mensaje}</p>}
 
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {enviando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>
 
      {usuarios === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : (
        <table className="w-full max-w-4xl border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-3">Documento</th>
              <th className="px-3">Empleado</th>
              <th className="px-3">Roles</th>
              <th className="px-3">Estado</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="rounded-lg bg-white align-top shadow-sm">
                <td className="px-3 py-2 font-medium text-slate-900">{usuario.documento}</td>
                <td className="px-3 py-2 text-slate-600">
                  {usuario.empleado_id
                    ? (() => {
                        const empleado = empleadoPorId.get(usuario.empleado_id)
                        return empleado ? `${empleado.nombres} ${empleado.apellidos}` : '—'
                      })()
                    : '—'}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {edicionRolesId === usuario.id ? (
                    <div className="flex flex-col gap-1.5">
                      {roles.map((rol) => (
                        <label key={rol.id} className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={rolesEdicion.has(rol.id)}
                            onChange={() => alternarRolEdicion(rol.id)}
                          />
                          {rol.nombre}
                        </label>
                      ))}
                      <div className="mt-1 flex gap-3">
                        <button
                          type="button"
                          onClick={() => void guardarRolesEdicion()}
                          className="text-blue-600 hover:underline"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEdicionRolesId(null)}
                          className="text-slate-500 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : usuario.roles.length > 0 ? (
                    usuario.roles.map((rol) => rol.nombre).join(', ')
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  {usuario.activo ? (
                    <span className="text-green-700">Activo</span>
                  ) : (
                    <span className="text-slate-400">Inactivo</span>
                  )}
                  {usuario.debe_cambiar_password && (
                    <span className="ml-1 block text-xs text-amber-600">
                      Debe cambiar contraseña
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {edicionRolesId !== usuario.id && (
                    <button
                      type="button"
                      onClick={() => comenzarEdicionRoles(usuario)}
                      className="mr-3 text-blue-600 hover:underline"
                    >
                      Roles
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void manejarResetearPassword(usuario)}
                    className="mr-3 text-blue-600 hover:underline"
                  >
                    Resetear contraseña
                  </button>
                  <button
                    type="button"
                    onClick={() => void manejarActivo(usuario)}
                    className={usuario.activo ? 'text-red-600 hover:underline' : 'text-green-700 hover:underline'}
                  >
                    {usuario.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
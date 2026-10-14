/**
 * CRUD de roles (issue #4 backend, issue #49 pantalla).
 *
 * El backend borra roles de verdad (no es borrado suave como usuario/
 * empleado) y responde 409 si el rol todavía tiene usuarios asignados
 * (ver ADR-0003) — ese 409 se muestra tal cual llega en `ApiError`.
 */

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'

import { ApiError, actualizarRol, crearRol, eliminarRol, listarRoles } from '../lib/api'
import type { Rol } from '../lib/types'

export function RolesPage(): JSX.Element {
  const [roles, setRoles] = useState<Rol[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [edicion, setEdicion] = useState<Rol | null>(null)

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)

  // `cargar` se reutiliza después de crear/editar/eliminar (desde los
  // manejadores de evento, donde no hay restricción de la regla de
  // abajo). El efecto de montaje, en cambio, encadena `.then/.catch`
  // directo en vez de llamar a esta función con `await`/`void` — así
  // evita el aviso de react-hooks ("Avoid calling setState() directly
  // within an effect") que sí dispara al invocar ahí una función que
  // internamente hace `setState`, aunque sea después de un `await`.
  const cargar = useCallback(async () => {
    try {
      setRoles(await listarRoles())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los roles')
    }
  }, [])

  useEffect(() => {
    listarRoles()
      .then(setRoles)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los roles')
      })
  }, [])

  function comenzarEdicion(rol: Rol): void {
    setEdicion(rol)
    setNombre(rol.nombre)
    setDescripcion(rol.descripcion ?? '')
    setError(null)
  }

  function cancelarEdicion(): void {
    setEdicion(null)
    setNombre('')
    setDescripcion('')
  }

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (edicion) {
        await actualizarRol(edicion.id, { nombre, descripcion: descripcion || null })
      } else {
        await crearRol({ nombre, descripcion: descripcion || null })
      }
      cancelarEdicion()
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el rol')
    } finally {
      setEnviando(false)
    }
  }

  async function manejarEliminar(rol: Rol): Promise<void> {
    if (!window.confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return
    setError(null)
    try {
      await eliminarRol(rol.id)
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el rol')
    }
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold text-slate-900">Roles</h2>

      <form
        onSubmit={manejarEnvio}
        className="mb-8 max-w-md rounded-xl border border-slate-200 bg-white p-6"
      >
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          {edicion ? `Editar rol: ${edicion.nombre}` : 'Nuevo rol'}
        </h3>

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="rol-nombre">
          Nombre
        </label>
        <input
          id="rol-nombre"
          type="text"
          required
          minLength={2}
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="rol-descripcion">
          Descripción (opcional)
        </label>
        <input
          id="rol-descripcion"
          type="text"
          value={descripcion}
          onChange={(evento) => setDescripcion(evento.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {edicion ? 'Guardar cambios' : 'Crear rol'}
          </button>
          {edicion && (
            <button
              type="button"
              onClick={cancelarEdicion}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {roles === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : (
        <table className="w-full max-w-2xl border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-3">Nombre</th>
              <th className="px-3">Descripción</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {roles.map((rol) => (
              <tr key={rol.id} className="rounded-lg bg-white shadow-sm">
                <td className="px-3 py-2 font-medium text-slate-900">{rol.nombre}</td>
                <td className="px-3 py-2 text-slate-600">{rol.descripcion ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => comenzarEdicion(rol)}
                    className="mr-3 text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void manejarEliminar(rol)}
                    className="text-red-600 hover:underline"
                  >
                    Eliminar
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
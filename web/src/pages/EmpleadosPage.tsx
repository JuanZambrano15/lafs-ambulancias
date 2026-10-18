/**
 * CRUD de empleados (issue #4 backend, issue #49 pantalla).
 *
 * `cedula` y `tipo_vinculacion` solo se definen al crear — el backend
 * no permite cambiar la cédula después (identifica a la persona) ni
 * expone un endpoint para eso; cambiar `tipo_vinculacion` sí está
 * permitido vía `EmpleadoUpdate`, se deja editable.
 *
 * El borrado es "soft" (`activo=false`, ver ADR-0003): "Desactivar" es
 * el único botón, no hay eliminación real.
 */

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'

import {
  ApiError,
  actualizarEmpleado,
  crearEmpleado,
  desactivarEmpleado,
  listarEmpleados,
} from '../lib/api'
import type { Empleado, TipoVinculacion } from '../lib/types'

const FORMULARIO_VACIO = {
  nombres: '',
  apellidos: '',
  cedula: '',
  telefono: '',
  tipo_vinculacion: 'planta' as TipoVinculacion,
}

export function EmpleadosPage(): JSX.Element {
  const [empleados, setEmpleados] = useState<Empleado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [edicion, setEdicion] = useState<Empleado | null>(null)
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO)
  const [enviando, setEnviando] = useState(false)

  // Ver el comentario equivalente en RolesPage.tsx: el efecto de
  // montaje usa `.then/.catch` directo para no disparar el aviso de
  // react-hooks sobre llamar una función que hace `setState` desde
  // dentro de un efecto; `cargar` se reutiliza igual después de
  // crear/editar/desactivar, desde los manejadores de evento.
  const cargar = useCallback(async () => {
    try {
      setEmpleados(await listarEmpleados())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los empleados')
    }
  }, [])

  useEffect(() => {
    listarEmpleados()
      .then(setEmpleados)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los empleados')
      })
  }, [])

  function comenzarEdicion(empleado: Empleado): void {
    setEdicion(empleado)
    setFormulario({
      nombres: empleado.nombres,
      apellidos: empleado.apellidos,
      cedula: empleado.cedula,
      telefono: empleado.telefono ?? '',
      tipo_vinculacion: empleado.tipo_vinculacion,
    })
    setError(null)
  }

  function cancelarEdicion(): void {
    setEdicion(null)
    setFormulario(FORMULARIO_VACIO)
  }

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (edicion) {
        await actualizarEmpleado(edicion.id, {
          nombres: formulario.nombres,
          apellidos: formulario.apellidos,
          telefono: formulario.telefono || null,
          tipo_vinculacion: formulario.tipo_vinculacion,
        })
      } else {
        await crearEmpleado({
          nombres: formulario.nombres,
          apellidos: formulario.apellidos,
          cedula: formulario.cedula,
          telefono: formulario.telefono || null,
          tipo_vinculacion: formulario.tipo_vinculacion,
        })
      }
      cancelarEdicion()
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el empleado')
    } finally {
      setEnviando(false)
    }
  }

  async function manejarDesactivar(empleado: Empleado): Promise<void> {
    if (!window.confirm(`¿Desactivar a ${empleado.nombres} ${empleado.apellidos}?`)) return
    setError(null)
    try {
      await desactivarEmpleado(empleado.id)
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo desactivar el empleado')
    }
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold text-slate-900">Empleados</h2>

      <form
        onSubmit={manejarEnvio}
        className="mb-8 max-w-md rounded-xl border border-slate-200 bg-white p-6"
      >
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          {edicion ? `Editar: ${edicion.nombres} ${edicion.apellidos}` : 'Nuevo empleado'}
        </h3>

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="emp-nombres">
          Nombres
        </label>
        <input
          id="emp-nombres"
          type="text"
          required
          value={formulario.nombres}
          onChange={(evento) => setFormulario((f) => ({ ...f, nombres: evento.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="emp-apellidos">
          Apellidos
        </label>
        <input
          id="emp-apellidos"
          type="text"
          required
          value={formulario.apellidos}
          onChange={(evento) => setFormulario((f) => ({ ...f, apellidos: evento.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="emp-cedula">
          Cédula
        </label>
        <input
          id="emp-cedula"
          type="text"
          required
          disabled={edicion !== null}
          value={formulario.cedula}
          onChange={(evento) => setFormulario((f) => ({ ...f, cedula: evento.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="emp-telefono">
          Teléfono (opcional)
        </label>
        <input
          id="emp-telefono"
          type="text"
          value={formulario.telefono}
          onChange={(evento) => setFormulario((f) => ({ ...f, telefono: evento.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="emp-vinculacion">
          Vinculación
        </label>
        <select
          id="emp-vinculacion"
          value={formulario.tipo_vinculacion}
          onChange={(evento) =>
            setFormulario((f) => ({
              ...f,
              tipo_vinculacion: evento.target.value as TipoVinculacion,
            }))
          }
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        >
          <option value="planta">Planta</option>
          <option value="ocasional">Ocasional</option>
        </select>

        {error && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {edicion ? 'Guardar cambios' : 'Crear empleado'}
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

      {empleados === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : (
        <table className="w-full max-w-3xl border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-3">Nombre</th>
              <th className="px-3">Cédula</th>
              <th className="px-3">Vinculación</th>
              <th className="px-3">Estado</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {empleados.map((empleado) => (
              <tr key={empleado.id} className="rounded-lg bg-white shadow-sm">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {empleado.nombres} {empleado.apellidos}
                </td>
                <td className="px-3 py-2 text-slate-600">{empleado.cedula}</td>
                <td className="px-3 py-2 text-slate-600 capitalize">
                  {empleado.tipo_vinculacion}
                </td>
                <td className="px-3 py-2">
                  {empleado.activo ? (
                    <span className="text-green-700">Activo</span>
                  ) : (
                    <span className="text-slate-400">Inactivo</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => comenzarEdicion(empleado)}
                    className="mr-3 text-brand-blue hover:underline"
                  >
                    Editar
                  </button>
                  {empleado.activo && (
                    <button
                      type="button"
                      onClick={() => void manejarDesactivar(empleado)}
                      className="text-brand-orange-dark hover:underline"
                    >
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
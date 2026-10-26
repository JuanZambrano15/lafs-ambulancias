/**
 * Servicios cerrados: buscador de atenciones ya cerradas (traslado o
 * accidente SOAT) -- issue #80, reemplaza `FormatosCerradosPage`
 * (issue #79, "Formatos cerrados") con el nombre que pidió el
 * cliente ("Servicios cerrados" en vez de "Formatos") y con cada fila
 * llevando a una pantalla de detalle completa en vez de los enlaces
 * sueltos de PDF/fotos que tenía esa versión -- ver
 * `ServicioCerradoDetallePage.tsx`, que es donde viven ahora esas
 * acciones (y las nuevas: corregir formato, historial de versiones).
 */

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, listarAtencionesCerradas } from '../lib/api'
import type { AtencionCerrada } from '../lib/types'

/** Mismo criterio que ya tenía `FormatosCerradosPage` -- un accidente
 * SOAT no tiene `nivel_servicio` (es siempre "SOAT"); un traslado sí,
 * y usa las mismas palabras que ya usa `app/`. */
function etiquetaTipoServicio(atencion: AtencionCerrada): string {
  if (atencion.tipo === 'atencion_soat') return 'SOAT'
  return atencion.nivel_servicio === 'medicalizado' ? 'Medicalizado' : 'Básico'
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function ServiciosCerradosPage(): JSX.Element {
  const [cerradas, setCerradas] = useState<AtencionCerrada[] | null>(null)
  const [errorCerradas, setErrorCerradas] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const cargarCerradas = useCallback(async (q?: string) => {
    try {
      setCerradas(await listarAtencionesCerradas(q))
      setErrorCerradas(null)
    } catch (err) {
      setErrorCerradas(
        err instanceof ApiError ? err.message : 'No se pudieron cargar las atenciones cerradas',
      )
    }
  }, [])

  // Ver el comentario equivalente en EmpleadosPage.tsx/RolesPage.tsx
  // sobre por qué el efecto de montaje usa `.then/.catch` directo en
  // vez de llamar a `cargarCerradas` (evita el aviso de react-hooks
  // por una función con `setState` adentro).
  useEffect(() => {
    listarAtencionesCerradas()
      .then(setCerradas)
      .catch((err: unknown) => {
        setErrorCerradas(
          err instanceof ApiError ? err.message : 'No se pudieron cargar las atenciones cerradas',
        )
      })
  }, [])

  function manejarBuscar(evento: FormEvent): void {
    evento.preventDefault()
    void cargarCerradas(busqueda || undefined)
  }

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Servicios cerrados</h2>
        <button
          type="button"
          onClick={() => void cargarCerradas(busqueda || undefined)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Actualizar
        </button>
      </div>

      <form onSubmit={manejarBuscar} className="mb-4 flex max-w-md gap-2">
        <label className="sr-only" htmlFor="buscar-cerradas">
          Buscar por nombre, apellido o documento del paciente
        </label>
        <input
          id="buscar-cerradas"
          type="text"
          placeholder="Nombre, apellido o documento del paciente"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white"
        >
          Buscar
        </button>
      </form>

      {errorCerradas && (
        <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
          {errorCerradas}
        </p>
      )}

      {cerradas === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : cerradas.length === 0 ? (
        <p className="text-slate-500">No se encontraron servicios cerrados.</p>
      ) : (
        <table className="w-full max-w-4xl border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-3">Paciente</th>
              <th className="px-3">Documento</th>
              <th className="px-3">Tipo</th>
              <th className="px-3">Móvil</th>
              <th className="px-3">Cerrada</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {cerradas.map((atencion) => (
              <tr key={atencion.id} className="rounded-lg bg-white shadow-sm">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {atencion.paciente_nombres
                    ? `${atencion.paciente_nombres} ${atencion.paciente_apellidos ?? ''}`
                    : 'NN (sin identificar)'}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {atencion.paciente_numero_documento ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600">{etiquetaTipoServicio(atencion)}</td>
                <td className="px-3 py-2 text-slate-600">{atencion.ambulancia.movil}</td>
                <td className="px-3 py-2 text-slate-600">
                  {atencion.cerrada_en ? formatearFecha(atencion.cerrada_en) : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={`/atenciones/${atencion.id}/detalle`}
                    className="font-medium text-brand-blue hover:underline"
                  >
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
/**
 * Estado de la flota (issue #19): para cada ambulancia activa, cuándo
 * vencen el SOAT y la tecnomecánica (semáforo) y cómo va su chequeo
 * semanal. Desde cada fila se abre el historial de chequeos y el
 * detalle de uno. No hay PDF de este chequeo.
 *
 * Semáforo (lo calcula el backend): vencido o 15 días o menos, rojo;
 * hasta 30 días, amarillo; más de 30, verde.
 */

import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { SemaforoVigencia } from '../components/SemaforoVigencia'
import {
  ApiError,
  listarChequeosVehiculo,
  listarEstadoFlota,
  obtenerChequeoVehiculo,
} from '../lib/api'
import type { ChequeoVehiculo, ChequeoVehiculoResumen, EstadoFlota } from '../lib/types'
import { textoChequeo } from '../lib/vigencia'

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString()
}

function DetalleChequeo({ chequeo }: { chequeo: ChequeoVehiculo }): JSX.Element {
  const fallas = chequeo.items.filter((i) => i.estado === 'falla')
  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-4 text-sm">
      {fallas.length === 0 ? (
        <p className="font-medium text-green-700">Todo en orden: sin fallas.</p>
      ) : (
        <div className="mb-3">
          <p className="mb-1 font-medium text-red-700">
            {fallas.length} {fallas.length === 1 ? 'falla' : 'fallas'}:
          </p>
          <ul className="list-disc pl-5">
            {fallas.map((i) => (
              <li key={i.item}>
                <strong>{i.item}</strong>: {i.observacion}
              </li>
            ))}
          </ul>
        </div>
      )}
      {chequeo.observaciones && (
        <p className="mb-3">
          <strong>Observaciones:</strong> {chequeo.observaciones}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-slate-600">
          Ver los {chequeo.items.length} ítems
        </summary>
        <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {chequeo.items.map((i) => (
            <li key={i.item} className={i.estado === 'falla' ? 'text-red-700' : 'text-slate-700'}>
              {i.estado === 'falla' ? '✗' : '✓'} {i.item}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function Historial({ movil }: { movil: EstadoFlota }): JSX.Element {
  const [chequeos, setChequeos] = useState<ChequeoVehiculoResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<ChequeoVehiculo | null>(null)

  useEffect(() => {
    listarChequeosVehiculo(movil.ambulancia_id)
      .then(setChequeos)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial')
      })
  }, [movil.ambulancia_id])

  async function abrir(id: number): Promise<void> {
    if (abierto?.id === id) {
      setAbierto(null)
      return
    }
    try {
      setAbierto(await obtenerChequeoVehiculo(id))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el chequeo')
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-medium text-slate-900">Chequeos del móvil {movil.movil}</h3>
      {error && (
        <p role="alert" className="mb-3 text-sm text-brand-orange-dark">
          {error}
        </p>
      )}
      {chequeos === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : chequeos.length === 0 ? (
        <p className="text-sm text-slate-500">Este móvil todavía no tiene chequeos.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {chequeos.map((c) => (
            <li key={c.id} className="py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {formatearFechaHora(c.realizado_en)} · {c.conductor_nombre} ·{' '}
                  <span className={c.tiene_fallas ? 'font-medium text-red-700' : 'text-green-700'}>
                    {c.tiene_fallas
                      ? `${c.total_fallas} ${c.total_fallas === 1 ? 'falla' : 'fallas'}`
                      : 'Sin fallas'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void abrir(c.id)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-blue hover:bg-slate-100"
                >
                  {abierto?.id === c.id ? 'Ocultar' : 'Ver detalle'}
                </button>
              </div>
              {abierto?.id === c.id && <DetalleChequeo chequeo={abierto} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function FlotaPage(): JSX.Element {
  const [flota, setFlota] = useState<EstadoFlota[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [conHistorial, setConHistorial] = useState<EstadoFlota | null>(null)

  useEffect(() => {
    listarEstadoFlota()
      .then(setFlota)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el estado de la flota')
      })
  }, [])

  return (
    <section>
      <h2 className="mb-2 text-2xl font-semibold text-slate-900">Estado de la flota</h2>
      <p className="mb-6 text-sm text-slate-500">
        Vigencia del SOAT y la tecnomecánica de cada móvil, y su chequeo semanal. Rojo: vencido o
        a 15 días o menos; amarillo: hasta 30 días; verde: más de 30.
      </p>

      {error && (
        <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
          {error}
        </p>
      )}

      {flota === null && !error ? (
        <p className="text-slate-500">Cargando…</p>
      ) : flota !== null && flota.length === 0 ? (
        <p className="text-slate-500">No hay ambulancias activas.</p>
      ) : (
        flota !== null && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3">Móvil</th>
                  <th className="px-3">SOAT</th>
                  <th className="px-3">Tecnomecánica</th>
                  <th className="px-3">Chequeo semanal</th>
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {flota.map((m) => (
                  <tr key={m.ambulancia_id} className="bg-white align-top shadow-sm">
                    <td className="px-3 py-3 font-medium">
                      {m.movil}
                      <div className="text-xs font-normal text-slate-500">{m.placa}</div>
                    </td>
                    <td className="px-3 py-3">
                      <SemaforoVigencia
                        vencimiento={m.vencimiento_soat}
                        dias={m.dias_soat}
                        semaforo={m.semaforo_soat}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <SemaforoVigencia
                        vencimiento={m.vencimiento_tecnomecanica}
                        dias={m.dias_tecnomecanica}
                        semaforo={m.semaforo_tecnomecanica}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className={m.chequeo_al_dia ? 'text-green-700' : 'text-red-700'}>
                        {m.chequeo_al_dia ? 'Al día' : 'Pendiente'}
                      </div>
                      <div className="text-slate-600">{textoChequeo(m.dias_desde_chequeo)}</div>
                      {m.ultimo_chequeo && (
                        <div className="text-xs text-slate-500">
                          {m.ultimo_chequeo.conductor_nombre}
                          {m.ultimo_chequeo.tiene_fallas && (
                            <span className="ml-1 font-medium text-red-700">
                              · {m.ultimo_chequeo.total_fallas}{' '}
                              {m.ultimo_chequeo.total_fallas === 1 ? 'falla' : 'fallas'}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setConHistorial(conHistorial?.ambulancia_id === m.ambulancia_id ? null : m)
                        }
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-blue hover:bg-slate-100"
                      >
                        {conHistorial?.ambulancia_id === m.ambulancia_id
                          ? 'Ocultar chequeos'
                          : 'Ver chequeos'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {conHistorial && (
        <div className="mt-6">
          <Historial key={conHistorial.ambulancia_id} movil={conHistorial} />
        </div>
      )}
    </section>
  )
}
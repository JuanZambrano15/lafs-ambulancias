/**
 * Estado de la flota (issue #19): para cada ambulancia activa, cuándo
 * vencen el SOAT y la tecnomecánica (semáforo) y cómo va su chequeo
 * semanal. Desde cada fila se abre el historial de chequeos y el
 * detalle de uno. No hay PDF de este chequeo.
 *
 * Semáforo (lo calcula el backend): vencido o 15 días o menos, rojo;
 * hasta 30 días, amarillo; más de 30, verde.
 *
 * Aquí también se registra la renovación: al comprar el SOAT o la
 * tecnomecánica (normalmente una semana antes de que venza) se escribe
 * la nueva fecha de vencimiento y el semáforo se recalcula.
 */

import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'

import { SemaforoVigencia } from '../components/SemaforoVigencia'
import {
  ApiError,
  actualizarVigenciasAmbulancia,
  listarChequeosVehiculo,
  listarEstadoFlota,
  obtenerChequeoVehiculo,
} from '../lib/api'
import type { ChequeoVehiculo, ChequeoVehiculoResumen, EstadoFlota } from '../lib/types'
import { textoChequeo } from '../lib/vigencia'

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString()
}

type Documento = 'soat' | 'tecnomecanica'

const NOMBRE_DOCUMENTO: Record<Documento, string> = {
  soat: 'del SOAT',
  tecnomecanica: 'de la tecnomecánica',
}

/** Vencimiento de un documento con el botón para registrar su
 * renovación (nueva fecha de vencimiento). */
function CeldaVigencia({
  movil,
  documento,
  onGuardado,
}: {
  movil: EstadoFlota
  documento: Documento
  onGuardado: () => void
}): JSX.Element {
  const actual = documento === 'soat' ? movil.vencimiento_soat : movil.vencimiento_tecnomecanica
  const dias = documento === 'soat' ? movil.dias_soat : movil.dias_tecnomecanica
  const semaforo = documento === 'soat' ? movil.semaforo_soat : movil.semaforo_tecnomecanica
  const nombre = NOMBRE_DOCUMENTO[documento]

  const [editando, setEditando] = useState(false)
  const [fecha, setFecha] = useState(actual)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    if (!fecha) {
      setError('Escribe la nueva fecha de vencimiento')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await actualizarVigenciasAmbulancia(
        movil.ambulancia_id,
        documento === 'soat' ? { vencimiento_soat: fecha } : { vencimiento_tecnomecanica: fecha },
      )
      setEditando(false)
      onGuardado()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la fecha')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <SemaforoVigencia vencimiento={actual} dias={dias} semaforo={semaforo} />
      {editando ? (
        <form onSubmit={guardar} className="mt-2">
          <label className="mb-1 block text-xs text-slate-600" htmlFor={`${documento}-${movil.ambulancia_id}`}>
            Nuevo vencimiento {nombre} ({movil.movil})
          </label>
          <input
            id={`${documento}-${movil.ambulancia_id}`}
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none"
          />
          {error && (
            <p role="alert" className="mb-2 text-xs text-brand-orange-dark">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false)
                setFecha(actual)
                setError(null)
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFecha(actual)
            setEditando(true)
          }}
          aria-label={`Cambiar vencimiento ${nombre} del móvil ${movil.movil}`}
          className="mt-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-blue hover:bg-slate-100"
        >
          Cambiar fecha
        </button>
      )}
    </div>
  )
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

  // Tras registrar una renovación, el semáforo y los días los recalcula
  // el backend: se vuelve a pedir la lista en vez de calcularlos aquí.
  function recargar(): void {
    listarEstadoFlota()
      .then(setFlota)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la lista')
      })
  }

  return (
    <section>
      <h2 className="mb-2 text-2xl font-semibold text-slate-900">Estado de la flota</h2>
      <p className="mb-6 text-sm text-slate-500">
        Vigencia del SOAT y la tecnomecánica de cada móvil, y su chequeo semanal. Cuando compres
        uno de los dos, usa "Cambiar fecha" para escribir el nuevo vencimiento. Rojo: vencido o a
        15 días o menos; amarillo: hasta 30 días; verde: más de 30.
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
                      <CeldaVigencia movil={m} documento="soat" onGuardado={recargar} />
                    </td>
                    <td className="px-3 py-3">
                      <CeldaVigencia movil={m} documento="tecnomecanica" onGuardado={recargar} />
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
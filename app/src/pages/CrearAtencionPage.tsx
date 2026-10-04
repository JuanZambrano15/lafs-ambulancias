/**
 * Iniciar una atención nueva (issue #7): elegir tipo, móvil y
 * conductor. El responsable es quien está logueado — no se pide en el
 * formulario, lo pone el backend a partir del token (ver ADR-0005).
 *
 * Las listas de ambulancias y conductores ya vienen filtradas por
 * disponibilidad (activos y sin otra atención abierta) — la flota es
 * rotativa, así que lo que no aparece aquí no se puede elegir.
 */
 
import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate } from 'react-router-dom'
 
import {
  ApiError,
  crearAtencion,
  listarAmbulanciasDisponibles,
  listarConductoresDisponibles,
} from '../lib/api'
import type { Ambulancia, Empleado, TipoAtencion } from '../lib/types'
 
const TIPOS: { valor: TipoAtencion; etiqueta: string }[] = [
  { valor: 'traslado', etiqueta: 'Traslado asistencial' },
  { valor: 'atencion_soat', etiqueta: 'Atención de accidente (SOAT)' },
]
 
export function CrearAtencionPage(): JSX.Element {
  const navigate = useNavigate()
 
  const [ambulancias, setAmbulancias] = useState<Ambulancia[] | null>(null)
  const [conductores, setConductores] = useState<Empleado[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
 
  const [tipo, setTipo] = useState<TipoAtencion>('traslado')
  const [ambulanciaId, setAmbulanciaId] = useState('')
  const [conductorId, setConductorId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
 
  useEffect(() => {
    Promise.all([listarAmbulanciasDisponibles(), listarConductoresDisponibles()])
      .then(([listaAmbulancias, listaConductores]) => {
        setAmbulancias(listaAmbulancias)
        setConductores(listaConductores)
      })
      .catch((err: unknown) => {
        setErrorCarga(
          err instanceof ApiError ? err.message : 'No se pudieron cargar los móviles y conductores',
        )
      })
  }, [])
 
  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
 
    if (!ambulanciaId || !conductorId) {
      setError('Elige un móvil y un conductor')
      return
    }
 
    setEnviando(true)
    try {
      await crearAtencion({
        tipo,
        ambulancia_id: Number(ambulanciaId),
        conductor_id: Number(conductorId),
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar la atención')
    } finally {
      setEnviando(false)
    }
  }
 
  const cargando = ambulancias === null || conductores === null
 
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-sm">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-sm font-medium text-slate-500"
        >
          ← Volver
        </button>
 
        <form onSubmit={manejarEnvio} className="rounded-xl bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Iniciar atención</h1>
          <p className="mb-6 text-sm text-slate-500">
            Elige el tipo de atención, el móvil y el conductor con los que sales.
          </p>
 
          {errorCarga && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {errorCarga}
            </p>
          )}
 
          {cargando && !errorCarga && (
            <p className="mb-4 text-sm text-slate-500">Cargando móviles y conductores…</p>
          )}
 
          {!cargando && (
            <>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tipo">
                Tipo de atención
              </label>
              <select
                id="tipo"
                value={tipo}
                onChange={(evento) => setTipo(evento.target.value as TipoAtencion)}
                className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              >
                {TIPOS.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
 
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="ambulancia">
                Móvil
              </label>
              <select
                id="ambulancia"
                required
                value={ambulanciaId}
                onChange={(evento) => setAmbulanciaId(evento.target.value)}
                className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              >
                <option value="">
                  {ambulancias?.length === 0 ? 'No hay móviles disponibles' : 'Elige un móvil'}
                </option>
                {ambulancias?.map((ambulancia) => (
                  <option key={ambulancia.id} value={ambulancia.id}>
                    {ambulancia.movil} — {ambulancia.placa}
                  </option>
                ))}
              </select>
 
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="conductor">
                Conductor
              </label>
              <select
                id="conductor"
                required
                value={conductorId}
                onChange={(evento) => setConductorId(evento.target.value)}
                className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              >
                <option value="">
                  {conductores?.length === 0 ? 'No hay conductores disponibles' : 'Elige un conductor'}
                </option>
                {conductores?.map((conductor) => (
                  <option key={conductor.id} value={conductor.id}>
                    {conductor.nombres} {conductor.apellidos}
                  </option>
                ))}
              </select>
            </>
          )}
 
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {error}
            </p>
          )}
 
          <button
            type="submit"
            disabled={enviando || cargando}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Iniciando…' : 'Iniciar atención'}
          </button>
        </form>
      </div>
    </div>
  )
}
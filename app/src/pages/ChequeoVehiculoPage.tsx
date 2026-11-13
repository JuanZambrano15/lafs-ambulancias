/**
 * Chequeo semanal del vehículo (issue #19), a cargo del conductor.
 *
 * Paso 1: elegir el móvil. Cada móvil muestra cuándo vencen su SOAT y su
 * tecnomecánica (con semáforo) y si su chequeo de la semana ya se hizo.
 * Paso 2: el checklist (el catálogo lo da el backend, para tener una
 * sola fuente). Todo arranca en "Bien"; lo que falla se marca y se
 * describe. No genera PDF.
 */

import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import logoLafs from '../assets/logo-lafs.png'
import { BotonTema } from '../components/BotonTema'
import { SemaforoVigencia } from '../components/SemaforoVigencia'
import {
  ApiError,
  crearChequeoVehiculo,
  listarEstadoFlota,
  obtenerCatalogoChequeoVehiculo,
} from '../lib/api'
import type { CatalogoChequeo, EstadoFlota, ItemChequeo } from '../lib/types'
import { textoChequeo } from '../lib/vigencia'

type Respuesta = { estado: 'bien' | 'falla'; observacion: string }

function Vigencias({ movil }: { movil: EstadoFlota }): JSX.Element {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <SemaforoVigencia
        etiqueta="SOAT"
        vencimiento={movil.vencimiento_soat}
        dias={movil.dias_soat}
        semaforo={movil.semaforo_soat}
      />
      <SemaforoVigencia
        etiqueta="Tecnomecánica"
        vencimiento={movil.vencimiento_tecnomecanica}
        dias={movil.dias_tecnomecanica}
        semaforo={movil.semaforo_tecnomecanica}
      />
    </div>
  )
}

export function ChequeoVehiculoPage(): JSX.Element {
  const navigate = useNavigate()

  const [flota, setFlota] = useState<EstadoFlota[] | null>(null)
  const [catalogo, setCatalogo] = useState<CatalogoChequeo | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [movilElegido, setMovilElegido] = useState<EstadoFlota | null>(null)
  const [respuestas, setRespuestas] = useState<Record<string, Respuesta>>({})
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    Promise.all([listarEstadoFlota(), obtenerCatalogoChequeoVehiculo()])
      .then(([listaFlota, listaCatalogo]) => {
        setFlota(listaFlota)
        setCatalogo(listaCatalogo)
        setRespuestas(
          Object.fromEntries(
            listaCatalogo.items.map((item) => [item, { estado: 'bien', observacion: '' }]),
          ),
        )
      })
      .catch((err: unknown) => {
        setErrorCarga(
          err instanceof ApiError ? err.message : 'No se pudieron cargar los móviles y el chequeo',
        )
      })
  }, [])

  function cambiar(item: string, cambio: Partial<Respuesta>): void {
    setRespuestas((anterior) => ({ ...anterior, [item]: { ...anterior[item], ...cambio } }))
  }

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    if (movilElegido === null || catalogo === null) return
    setError(null)

    const sinDescribir = catalogo.items.find(
      (item) => respuestas[item].estado === 'falla' && respuestas[item].observacion.trim() === '',
    )
    if (sinDescribir) {
      setError(`Describe la falla de: ${sinDescribir}`)
      return
    }

    const items: ItemChequeo[] = catalogo.items.map((item) => ({
      item,
      estado: respuestas[item].estado,
      observacion: respuestas[item].estado === 'falla' ? respuestas[item].observacion.trim() : null,
    }))

    setEnviando(true)
    try {
      await crearChequeoVehiculo({
        ambulancia_id: movilElegido.ambulancia_id,
        items,
        observaciones: observaciones.trim() || null,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el chequeo')
    } finally {
      setEnviando(false)
    }
  }

  const totalFallas = Object.values(respuestas).filter((r) => r.estado === 'falla').length

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            onClick={() => (movilElegido ? setMovilElegido(null) : navigate(-1))}
            className="text-sm font-medium text-slate-500"
          >
            ← Volver
          </button>
          <BotonTema compacto />
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <img src={logoLafs} alt="L.A.F.S. Ambulancias" className="mb-3 h-10 w-auto" />
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Chequeo de vehículo</h1>

          {errorCarga && (
            <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
              {errorCarga}
            </p>
          )}
          {flota === null && !errorCarga && (
            <p className="text-sm text-slate-500">Cargando móviles…</p>
          )}

          {flota !== null && catalogo !== null && movilElegido === null && (
            <>
              <p className="mb-4 text-sm text-slate-500">
                Elige el móvil que vas a chequear. El chequeo se hace una vez cada{' '}
                {catalogo.frecuencia_dias} días.
              </p>
              {flota.length === 0 && (
                <p className="text-sm text-slate-500">No hay móviles activos.</p>
              )}
              <ul className="grid gap-4 lg:grid-cols-2">
                {flota.map((movil) => (
                  <li
                    key={movil.ambulancia_id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-medium text-slate-900">
                          Móvil {movil.movil} — {movil.placa}
                        </h2>
                        <p
                          className={`text-sm ${
                            movil.chequeo_al_dia ? 'text-green-700' : 'text-brand-orange-dark'
                          }`}
                        >
                          {movil.chequeo_al_dia ? 'Chequeo al día' : 'Chequeo pendiente'} ·{' '}
                          {textoChequeo(movil.dias_desde_chequeo)}
                        </p>
                      </div>
                      <button
                        onClick={() => setMovilElegido(movil)}
                        className="shrink-0 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white"
                      >
                        Hacer chequeo
                      </button>
                    </div>
                    <Vigencias movil={movil} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {movilElegido !== null && catalogo !== null && (
            <form onSubmit={manejarEnvio}>
              <h2 className="mb-3 text-lg font-medium text-slate-900">
                Móvil {movilElegido.movil} — {movilElegido.placa}
              </h2>
              <div className="mb-5">
                <Vigencias movil={movilElegido} />
              </div>

              <p className="mb-3 text-sm text-slate-500">
                Todo empieza en "Bien". Marca "Falla" en lo que no esté en orden y escribe qué
                pasa.
              </p>
              <ul className="mb-5 divide-y divide-slate-200 rounded-lg border border-slate-200">
                {catalogo.items.map((item) => {
                  const respuesta = respuestas[item]
                  return (
                    <li key={item} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-800">{item}</span>
                        <div className="flex shrink-0 gap-2" role="group" aria-label={item}>
                          <button
                            type="button"
                            aria-pressed={respuesta.estado === 'bien'}
                            onClick={() => cambiar(item, { estado: 'bien' })}
                            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                              respuesta.estado === 'bien'
                                ? 'border-green-700 bg-green-700 text-white'
                                : 'border-slate-300 text-slate-700'
                            }`}
                          >
                            Bien
                          </button>
                          <button
                            type="button"
                            aria-pressed={respuesta.estado === 'falla'}
                            onClick={() => cambiar(item, { estado: 'falla' })}
                            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                              respuesta.estado === 'falla'
                                ? 'border-red-700 bg-red-700 text-white'
                                : 'border-slate-300 text-slate-700'
                            }`}
                          >
                            Falla
                          </button>
                        </div>
                      </div>
                      {respuesta.estado === 'falla' && (
                        <input
                          type="text"
                          value={respuesta.observacion}
                          maxLength={300}
                          onChange={(e) => cambiar(item, { observacion: e.target.value })}
                          aria-label={`Qué falla tiene: ${item}`}
                          placeholder="¿Qué pasa?"
                          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
                        />
                      )}
                    </li>
                  )
                })}
              </ul>

              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="observaciones">
                Observaciones (opcional)
              </label>
              <textarea
                id="observaciones"
                value={observaciones}
                maxLength={2000}
                rows={3}
                onChange={(e) => setObservaciones(e.target.value)}
                className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
              />

              {error && (
                <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-lg bg-brand-blue py-3 text-base font-medium text-white disabled:opacity-60"
              >
                {enviando
                  ? 'Guardando…'
                  : totalFallas > 0
                    ? `Guardar chequeo (${totalFallas} ${totalFallas === 1 ? 'falla' : 'fallas'})`
                    : 'Guardar chequeo'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
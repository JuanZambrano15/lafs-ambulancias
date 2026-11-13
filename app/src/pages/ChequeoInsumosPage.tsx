/**
 * Chequeo semanal de insumos y medicamentos (issue #20), a cargo del
 * auxiliar de enfermería.
 *
 * Paso 1: elegir el móvil (cada uno muestra si su chequeo de la semana
 * ya se hizo). Paso 2: la lista del móvil agrupada por categoría; cada
 * ítem arranca en su mínimo y el auxiliar corrige la cantidad que
 * realmente encontró. Lo que quede por debajo del mínimo se marca como
 * faltante. La lista y los mínimos los define el administrador en el
 * panel web. No genera PDF.
 */

import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import logoLafs from '../assets/logo-lafs.png'
import { BotonTema } from '../components/BotonTema'
import {
  ApiError,
  crearChequeoInsumos,
  listarEstadoInsumos,
  obtenerFormularioInsumos,
} from '../lib/api'
import type { EstadoInsumosMovil, FormularioInsumos, InsumoCatalogo } from '../lib/types'
import { textoChequeo } from '../lib/vigencia'

/** Agrupa conservando el orden en que vienen del catálogo. */
function agruparPorCategoria(items: InsumoCatalogo[]): [string, InsumoCatalogo[]][] {
  const grupos = new Map<string, InsumoCatalogo[]>()
  for (const item of items) {
    grupos.set(item.categoria, [...(grupos.get(item.categoria) ?? []), item])
  }
  return Array.from(grupos.entries())
}

function minimoConUnidad(item: InsumoCatalogo): string {
  return item.unidad ? `${item.minimo} ${item.unidad}` : String(item.minimo)
}

/** Cantidad escrita → entero ≥ 0, o `null` si está vacía o no es válida. */
function leerCantidad(texto: string): number | null {
  if (!/^\d{1,4}$/.test(texto.trim())) return null
  return Number(texto.trim())
}

export function ChequeoInsumosPage(): JSX.Element {
  const navigate = useNavigate()

  const [moviles, setMoviles] = useState<EstadoInsumosMovil[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [movilElegido, setMovilElegido] = useState<EstadoInsumosMovil | null>(null)
  const [formulario, setFormulario] = useState<FormularioInsumos | null>(null)
  const [cargandoFormulario, setCargandoFormulario] = useState(false)
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    listarEstadoInsumos()
      .then(setMoviles)
      .catch((err: unknown) => {
        setErrorCarga(err instanceof ApiError ? err.message : 'No se pudieron cargar los móviles')
      })
  }, [])

  async function elegirMovil(movil: EstadoInsumosMovil): Promise<void> {
    setError(null)
    setCargandoFormulario(true)
    try {
      const datos = await obtenerFormularioInsumos(movil.ambulancia_id)
      setFormulario(datos)
      setCantidades(Object.fromEntries(datos.items.map((i) => [i.id, String(i.minimo)])))
      setObservaciones('')
      setMovilElegido(movil)
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el chequeo')
    } finally {
      setCargandoFormulario(false)
    }
  }

  function volver(): void {
    if (movilElegido) {
      setMovilElegido(null)
      setFormulario(null)
      setError(null)
    } else {
      navigate(-1)
    }
  }

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    if (movilElegido === null || formulario === null) return
    setError(null)

    const sinCantidad = formulario.items.find((i) => leerCantidad(cantidades[i.id] ?? '') === null)
    if (sinCantidad) {
      setError(`Escribe la cantidad de: ${sinCantidad.nombre}`)
      return
    }

    setEnviando(true)
    try {
      await crearChequeoInsumos({
        ambulancia_id: movilElegido.ambulancia_id,
        items: formulario.items.map((i) => ({
          insumo_id: i.id,
          encontrado: leerCantidad(cantidades[i.id]) as number,
        })),
        observaciones: observaciones.trim() || null,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el chequeo')
    } finally {
      setEnviando(false)
    }
  }

  const totalFaltantes =
    formulario?.items.filter((i) => {
      const cantidad = leerCantidad(cantidades[i.id] ?? '')
      return cantidad !== null && cantidad < i.minimo
    }).length ?? 0

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button onClick={volver} className="text-sm font-medium text-slate-500">
            ← Volver
          </button>
          <BotonTema compacto />
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <img src={logoLafs} alt="L.A.F.S. Ambulancias" className="mb-3 h-10 w-auto" />
          <h1 className="mb-1 text-xl font-semibold text-slate-900">
            Chequeo de insumos y medicamentos
          </h1>

          {errorCarga && (
            <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
              {errorCarga}
            </p>
          )}
          {moviles === null && !errorCarga && (
            <p className="text-sm text-slate-500">Cargando móviles…</p>
          )}

          {moviles !== null && movilElegido === null && (
            <>
              <p className="mb-4 text-sm text-slate-500">
                Elige el móvil que vas a chequear. El chequeo se hace una vez cada{' '}
                {moviles[0]?.frecuencia_dias ?? 7} días.
              </p>
              {moviles.length === 0 && (
                <p className="text-sm text-slate-500">No hay móviles activos.</p>
              )}
              <ul className="grid gap-4 lg:grid-cols-2">
                {moviles.map((movil) => (
                  <li
                    key={movil.ambulancia_id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div>
                      <h2 className="font-medium text-slate-900">
                        Móvil {movil.movil} — {movil.placa}
                      </h2>
                      {movil.total_items === 0 ? (
                        <p className="text-sm text-brand-orange-dark">
                          Sin lista de insumos: avísale al administrador
                        </p>
                      ) : (
                        <p
                          className={`text-sm ${
                            movil.chequeo_al_dia ? 'text-green-700' : 'text-brand-orange-dark'
                          }`}
                        >
                          {movil.chequeo_al_dia ? 'Chequeo al día' : 'Chequeo pendiente'} ·{' '}
                          {textoChequeo(movil.dias_desde_chequeo)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => void elegirMovil(movil)}
                      disabled={movil.total_items === 0 || cargandoFormulario}
                      className="shrink-0 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Hacer chequeo
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {movilElegido !== null && formulario !== null && (
            <form onSubmit={manejarEnvio}>
              <h2 className="mb-3 text-lg font-medium text-slate-900">
                Móvil {movilElegido.movil} — {movilElegido.placa}
              </h2>
              <p className="mb-4 text-sm text-slate-500">
                Cada ítem empieza en su mínimo. Cambia la cantidad en lo que encuentres de menos.
              </p>

              {agruparPorCategoria(formulario.items).map(([categoria, items]) => (
                <section key={categoria} className="mb-5" aria-label={categoria}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {categoria}
                  </h3>
                  <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {items.map((item) => {
                      const cantidad = leerCantidad(cantidades[item.id] ?? '')
                      const faltan = cantidad !== null && cantidad < item.minimo
                      return (
                        <li
                          key={item.id}
                          data-faltante={faltan}
                          className={`flex items-center justify-between gap-3 px-4 py-3 ${
                            faltan ? 'bg-red-50' : ''
                          }`}
                        >
                          <div>
                            <label htmlFor={`insumo-${item.id}`} className="text-sm text-slate-800">
                              {item.nombre}
                            </label>
                            <p className="text-xs text-slate-500">
                              Mínimo: {minimoConUnidad(item)}
                              {faltan && (
                                <span className="ml-2 font-medium text-red-700">
                                  Faltan {item.minimo - cantidad}
                                </span>
                              )}
                            </p>
                          </div>
                          <input
                            id={`insumo-${item.id}`}
                            type="text"
                            inputMode="numeric"
                            value={cantidades[item.id] ?? ''}
                            onChange={(e) =>
                              setCantidades((anterior) => ({
                                ...anterior,
                                [item.id]: e.target.value,
                              }))
                            }
                            onFocus={(e) => e.target.select()}
                            className="w-20 shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-center text-base focus:border-brand-blue focus:outline-none"
                          />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}

              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="observaciones"
              >
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
                  : totalFaltantes > 0
                    ? `Guardar chequeo (${totalFaltantes} ${totalFaltantes === 1 ? 'faltante' : 'faltantes'})`
                    : 'Guardar chequeo'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
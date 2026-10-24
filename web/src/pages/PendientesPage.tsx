/**
 * Pantalla de inicio del panel (issue #15): atenciones de traslado
 * todavía abiertas ("la parte 1 sin cerrar" del issue, que en el
 * modelo real es la atención entera sin cerrar -- no hay una "parte
 * 1" separada, ver `GET /atenciones/pendientes`), con una alerta
 * básica para las que lleven mucho tiempo así, más un buscador de
 * atenciones ya cerradas para descargar su PDF (issue #13).
 *
 * Dos secciones independientes, cada una con su propia carga/error —
 * un fallo buscando cerradas no debería tumbar la lista de
 * pendientes que ya se veía bien, y viceversa.
 */
 
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
 
import {
  ApiError,
  descargarPdfFormatoAccidenteSoat,
  descargarPdfFormatoTraslado,
  listarAtencionesCerradas,
  listarAtencionesPendientes,
} from '../lib/api'
import type { Atencion, AtencionCerrada } from '../lib/types'

/** Issue #80 (adelanto): etiqueta de tipo de servicio para la columna
 * nueva de "Formatos cerrados" -- un accidente SOAT no tiene
 * `nivel_servicio` (es siempre "SOAT"); un traslado sí, y usa las
 * mismas palabras que ya usa `app/` ("Básico"/"Medicalizado"). */
function etiquetaTipoServicio(atencion: AtencionCerrada): string {
  if (atencion.tipo === 'atencion_soat') return 'SOAT'
  return atencion.nivel_servicio === 'medicalizado' ? 'Medicalizado' : 'Básico'
}
 
// Issue #15: no había ninguna definición previa de qué cuenta como
// "lleva mucho tiempo abierta" -- se decidió 12 horas como primer
// corte razonable (más tolerante que las ~6-8 horas de un traslado
// normal, por si queda abierta de un turno a otro).
const HORAS_ALERTA = 12
 
function horasTranscurridas(abiertaEn: string): number {
  return (Date.now() - new Date(abiertaEn).getTime()) / (1000 * 60 * 60)
}
 
function formatearDuracion(horas: number): string {
  if (horas < 1) return `${Math.max(0, Math.round(horas * 60))} min`
  const horasEnteras = Math.floor(horas)
  const minutos = Math.round((horas - horasEnteras) * 60)
  return minutos > 0 ? `${horasEnteras} h ${minutos} min` : `${horasEnteras} h`
}
 
function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString()
}
 
export function PendientesPage(): JSX.Element {
  const [pendientes, setPendientes] = useState<Atencion[] | null>(null)
  const [errorPendientes, setErrorPendientes] = useState<string | null>(null)
 
  const [cerradas, setCerradas] = useState<AtencionCerrada[] | null>(null)
  const [errorCerradas, setErrorCerradas] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
 
  const [descargandoId, setDescargandoId] = useState<number | null>(null)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)
 
  const cargarPendientes = useCallback(async () => {
    try {
      setPendientes(await listarAtencionesPendientes())
      setErrorPendientes(null)
    } catch (err) {
      setErrorPendientes(
        err instanceof ApiError ? err.message : 'No se pudieron cargar las atenciones pendientes',
      )
    }
  }, [])
 
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
  // vez de llamar a `cargarPendientes`/`cargarCerradas` (evita el
  // aviso de react-hooks por una función con `setState` adentro).
  useEffect(() => {
    listarAtencionesPendientes()
      .then(setPendientes)
      .catch((err: unknown) => {
        setErrorPendientes(
          err instanceof ApiError
            ? err.message
            : 'No se pudieron cargar las atenciones pendientes',
        )
      })
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
 
  async function manejarDescargar(atencion: AtencionCerrada): Promise<void> {
    setErrorDescarga(null)
    setDescargandoId(atencion.id)
    try {
      if (atencion.tipo === 'atencion_soat') {
        await descargarPdfFormatoAccidenteSoat(atencion.id)
      } else {
        await descargarPdfFormatoTraslado(atencion.id)
      }
    } catch (err) {
      setErrorDescarga(err instanceof ApiError ? err.message : 'No se pudo descargar el PDF')
    } finally {
      setDescargandoId(null)
    }
  }
 
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Pendientes</h2>
          <button
            type="button"
            onClick={() => void cargarPendientes()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Actualizar
          </button>
        </div>
 
        {errorPendientes && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {errorPendientes}
          </p>
        )}
 
        {pendientes === null ? (
          <p className="text-slate-500">Cargando…</p>
        ) : pendientes.length === 0 ? (
          <p className="text-slate-500">No hay atenciones abiertas en este momento.</p>
        ) : (
          <table className="w-full max-w-4xl border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-3">Móvil</th>
                <th className="px-3">Responsable</th>
                <th className="px-3">Conductor</th>
                <th className="px-3">Abierta desde</th>
                <th className="px-3">Lleva abierta</th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((atencion) => {
                const horas = horasTranscurridas(atencion.abierta_en)
                const enAlerta = horas > HORAS_ALERTA
                return (
                  <tr
                    key={atencion.id}
                    className={`rounded-lg shadow-sm ${enAlerta ? 'bg-brand-orange-soft' : 'bg-white'}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {atencion.ambulancia.movil}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {atencion.responsable.nombres} {atencion.responsable.apellidos}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {atencion.conductor.nombres} {atencion.conductor.apellidos}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatearFecha(atencion.abierta_en)}
                    </td>
                    <td className={`px-3 py-2 ${enAlerta ? 'font-semibold text-brand-orange-dark' : 'text-slate-600'}`}>
                      {formatearDuracion(horas)}
                      {enAlerta && ' — lleva mucho tiempo abierta'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
 
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Formatos cerrados</h2>
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
        {errorDescarga && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {errorDescarga}
          </p>
        )}
 
        {cerradas === null ? (
          <p className="text-slate-500">Cargando…</p>
        ) : cerradas.length === 0 ? (
          <p className="text-slate-500">No se encontraron formatos cerrados.</p>
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
                    {atencion.tiene_pdf ? (
                      <button
                        type="button"
                        disabled={descargandoId === atencion.id}
                        onClick={() => void manejarDescargar(atencion)}
                        className="text-brand-blue hover:underline disabled:text-slate-400"
                      >
                        {descargandoId === atencion.id ? 'Descargando…' : 'Descargar PDF'}
                      </button>
                    ) : (
                      <span className="text-slate-400">Sin PDF</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
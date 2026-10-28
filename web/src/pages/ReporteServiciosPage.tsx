/**
 * Reporte del contador: totales de servicios cerrados por persona en
 * un rango de fechas, con descarga en Excel (issue #24) -- decisión
 * del cliente: todo lo que cuenta como servicio para el pago ya está
 * cerrado (uno recién abierto todavía puede cambiar o cancelarse), y
 * el rango filtra por la fecha en que se cerró, no en que se abrió
 * (ver nota de módulo de `app/api/routes/reportes.py`).
 *
 * Primera pantalla del panel que no es "solo administrador" -- el
 * contador también entra aquí (`ProtectedRoute` con `rolesPermitidos`
 * en `App.tsx`), así que el resto del panel (usuarios, empleados,
 * roles, servicios cerrados) sigue sin ser visible para ese rol: ver
 * `Layout.tsx`, que arma el menú lateral según el rol de la sesión.
 *
 * Issue #25: cada fila se puede expandir para ver el drill-down de
 * sus viajes (origen, destino, paciente, cédula, fecha -- sin el
 * formato completo ni datos clínicos). El detalle se trae solo al
 * expandir (no de una vez con el reporte) y se cachea por fila
 * mientras dure la consulta actual, para no repetir la llamada si el
 * usuario colapsa y vuelve a expandir la misma fila.
 */
 
import { Fragment, useState } from 'react'
import type { FormEvent, JSX } from 'react'
 
import {
  ApiError,
  descargarReporteServiciosPorPersonaExcel,
  obtenerDetalleServiciosPorPersona,
  obtenerReporteServiciosPorPersona,
} from '../lib/api'
import type { FuncionServicio, ServicioPorPersona, ViajeDetalle } from '../lib/types'
 
const ETIQUETA_FUNCION: Record<FuncionServicio, string> = {
  conductor: 'Conductor',
  responsable: 'Auxiliar/médico',
}
 
interface EstadoDetalle {
  estado: 'cargando' | 'listo' | 'error'
  viajes?: ViajeDetalle[]
  error?: string
}
 
function claveFila(fila: ServicioPorPersona): string {
  return `${fila.empleado_id}-${fila.funcion}`
}
 
/** Fila de totales al pie de la tabla (mockup compartido por el
 * cliente, issue #24) -- se calcula en el navegador a partir de lo
 * que ya devolvió el backend, no hace falta otro viaje al servidor. */
function totales(filas: ServicioPorPersona[]): {
  basicos: number
  medicalizados: number
  soat: number
  total: number
} {
  return filas.reduce(
    (acc, fila) => ({
      basicos: acc.basicos + fila.basicos,
      medicalizados: acc.medicalizados + fila.medicalizados,
      soat: acc.soat + fila.soat,
      total: acc.total + fila.total,
    }),
    { basicos: 0, medicalizados: 0, soat: 0, total: 0 },
  )
}
 
/** Por defecto, el mes calendario en curso -- un punto de partida
 * razonable para no arrancar con la tabla vacía, que de todas formas
 * el usuario puede cambiar antes de consultar. */
function primerDiaDelMes(): string {
  const hoy = new Date()
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
}
 
function hoyComoFecha(): string {
  return new Date().toISOString().slice(0, 10)
}
 
export function ReporteServiciosPage(): JSX.Element {
  const [desde, setDesde] = useState(primerDiaDelMes())
  const [hasta, setHasta] = useState(hoyComoFecha())
  const [filas, setFilas] = useState<ServicioPorPersona[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [filaExpandida, setFilaExpandida] = useState<string | null>(null)
  const [detalles, setDetalles] = useState<Record<string, EstadoDetalle>>({})
 
  async function manejarConsultar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setConsultando(true)
    setFilaExpandida(null)
    setDetalles({})
    try {
      setFilas(await obtenerReporteServiciosPorPersona(desde, hasta))
    } catch (err) {
      setFilas(null)
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el reporte')
    } finally {
      setConsultando(false)
    }
  }
 
  async function manejarToggleDetalle(fila: ServicioPorPersona): Promise<void> {
    const clave = claveFila(fila)
    if (filaExpandida === clave) {
      setFilaExpandida(null)
      return
    }
    setFilaExpandida(clave)
    if (detalles[clave]) {
      return
    }
    setDetalles((previo) => ({ ...previo, [clave]: { estado: 'cargando' } }))
    try {
      const viajes = await obtenerDetalleServiciosPorPersona(
        fila.empleado_id,
        fila.funcion,
        desde,
        hasta,
      )
      setDetalles((previo) => ({ ...previo, [clave]: { estado: 'listo', viajes } }))
    } catch (err) {
      setDetalles((previo) => ({
        ...previo,
        [clave]: {
          estado: 'error',
          error: err instanceof ApiError ? err.message : 'No se pudo cargar el detalle',
        },
      }))
    }
  }
 
  async function manejarDescargar(): Promise<void> {
    setError(null)
    setDescargando(true)
    try {
      await descargarReporteServiciosPorPersonaExcel(desde, hasta)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo descargar el Excel')
    } finally {
      setDescargando(false)
    }
  }
 
  return (
    <section>
      <h2 className="mb-1 text-2xl font-semibold text-slate-900">Servicios por persona</h2>
      <p className="mb-6 text-sm text-slate-500">
        Cuántos servicios ya cerrados hizo cada persona como conductor o como auxiliar de
        enfermería/médico, desglosados en básicos, medicalizados y SOAT, en el rango de fechas que
        elijas (según cuándo se cerró el servicio).
      </p>
 
      <form onSubmit={manejarConsultar} className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="rango-desde">
            Desde
          </label>
          <input
            id="rango-desde"
            type="date"
            required
            value={desde}
            max={hasta}
            onChange={(evento) => setDesde(evento.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="rango-hasta">
            Hasta
          </label>
          <input
            id="rango-hasta"
            type="date"
            required
            value={hasta}
            min={desde}
            onChange={(evento) => setHasta(evento.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={consultando}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {consultando ? 'Consultando…' : 'Consultar'}
        </button>
        <button
          type="button"
          disabled={descargando}
          onClick={() => void manejarDescargar()}
          className="rounded-lg border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue disabled:opacity-60"
        >
          {descargando ? 'Descargando…' : 'Descargar Excel'}
        </button>
      </form>
 
      {error && (
        <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
          {error}
        </p>
      )}
 
      {filas === null ? (
        !consultando && <p className="text-slate-500">Elige un rango y pulsa "Consultar".</p>
      ) : filas.length === 0 ? (
        <p className="text-slate-500">No hay servicios cerrados en ese rango.</p>
      ) : (
        <table className="w-full max-w-4xl border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-3">Empleado</th>
              <th className="px-3">Función</th>
              <th className="px-3 text-right">Básicos</th>
              <th className="px-3 text-right">Medicalizados</th>
              <th className="px-3 text-right">SOAT</th>
              <th className="px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const clave = claveFila(fila)
              const expandida = filaExpandida === clave
              const detalle = detalles[clave]
              return (
                <Fragment key={clave}>
                  <tr className="rounded-lg bg-white shadow-sm">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => void manejarToggleDetalle(fila)}
                        aria-expanded={expandida}
                        className="text-left hover:underline"
                      >
                        {expandida ? '▾' : '▸'} {fila.nombres} {fila.apellidos}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{ETIQUETA_FUNCION[fila.funcion]}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fila.basicos}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fila.medicalizados}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fila.soat}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {fila.total}
                    </td>
                  </tr>
                  {expandida && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-3 py-3">
                        {detalle?.estado === 'cargando' && (
                          <p className="text-slate-500">Cargando viajes…</p>
                        )}
                        {detalle?.estado === 'error' && (
                          <p role="alert" className="text-brand-orange-dark">
                            {detalle.error}
                          </p>
                        )}
                        {detalle?.estado === 'listo' &&
                          (detalle.viajes?.length ? (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-slate-500">
                                  <th className="px-2 py-1">Fecha</th>
                                  <th className="px-2 py-1">Origen</th>
                                  <th className="px-2 py-1">Destino</th>
                                  <th className="px-2 py-1">Paciente</th>
                                  <th className="px-2 py-1">Cédula</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalle.viajes.map((viaje) => (
                                  <tr key={viaje.atencion_id}>
                                    <td className="px-2 py-1">{viaje.fecha}</td>
                                    <td className="px-2 py-1">{viaje.origen}</td>
                                    <td className="px-2 py-1">{viaje.destino}</td>
                                    <td className="px-2 py-1">{viaje.paciente}</td>
                                    <td className="px-2 py-1">{viaje.cedula}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-slate-500">No hay viajes para mostrar.</p>
                          ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 text-left font-semibold text-slate-900">
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right">{totales(filas).basicos}</td>
              <td className="px-3 py-2 text-right">{totales(filas).medicalizados}</td>
              <td className="px-3 py-2 text-right">{totales(filas).soat}</td>
              <td className="px-3 py-2 text-right">{totales(filas).total}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}
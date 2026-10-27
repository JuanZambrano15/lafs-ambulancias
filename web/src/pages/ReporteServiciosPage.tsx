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
 */
 
import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
 
import {
  ApiError,
  descargarReporteServiciosPorPersonaExcel,
  obtenerReporteServiciosPorPersona,
} from '../lib/api'
import type { FuncionServicio, ServicioPorPersona } from '../lib/types'
 
const ETIQUETA_FUNCION: Record<FuncionServicio, string> = {
  conductor: 'Conductor',
  responsable: 'Auxiliar/médico',
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
 
  async function manejarConsultar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setConsultando(true)
    try {
      setFilas(await obtenerReporteServiciosPorPersona(desde, hasta))
    } catch (err) {
      setFilas(null)
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el reporte')
    } finally {
      setConsultando(false)
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
            {filas.map((fila) => (
              <tr key={`${fila.empleado_id}-${fila.funcion}`} className="rounded-lg bg-white shadow-sm">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {fila.nombres} {fila.apellidos}
                </td>
                <td className="px-3 py-2 text-slate-600">{ETIQUETA_FUNCION[fila.funcion]}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fila.basicos}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fila.medicalizados}</td>
                <td className="px-3 py-2 text-right text-slate-600">{fila.soat}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-900">{fila.total}</td>
              </tr>
            ))}
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
/**
 * Pantalla de inicio del panel, como dashboard (issue #79 -- separa
 * el #38 "identidad visual" en lo que toca solo a esta pantalla).
 * El cliente pidió que se viera organizada como la sección "Panel"
 * de la maqueta de pantallas (solo la organización, los colores van
 * en el #38, ya mergeado): pendientes, estado de las ambulancias en
 * uso, y un espacio para alertas.
 *
 * Tres bloques independientes, cada uno con su propia carga/error --
 * igual que en `PendientesPage` (de donde sale el de "Pendientes"
 * sin cambios de fondo, solo de lugar), un fallo en uno no debe
 * tumbar los otros dos.
 *
 * "Formatos cerrados" (buscador + descarga de PDF) se sacó de esta
 * pantalla a `FormatosCerradosPage` -- el #79 no lo pide acá, y el
 * #80 va a reemplazar esa sección por una pantalla de detalle
 * completa, así que no tenía sentido dejarla en el dashboard para
 * tener que volver a tocarla.
 *
 * Alertas de vencimiento (SOAT, tecnomecánica) y de stock/inventario
 * son fase 2 (#19, #21, #23) -- todavía no hay chequeos de vehículo
 * ni inventario implementados, así que ese bloque es un mensaje fijo,
 * no datos reales.
 */
 
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
 
import { ApiError, listarAmbulancias, listarAtencionesPendientes } from '../lib/api'
import type { Atencion } from '../lib/types'
 
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
 
export function DashboardPage(): JSX.Element {
  const [pendientes, setPendientes] = useState<Atencion[] | null>(null)
  const [errorPendientes, setErrorPendientes] = useState<string | null>(null)
 
  const [ambulancias, setAmbulancias] = useState<
    { movil: string; placa: string; enUso: boolean }[] | null
  >(null)
  const [errorAmbulancias, setErrorAmbulancias] = useState<string | null>(null)
 
  // Ver el comentario equivalente en EmpleadosPage.tsx/RolesPage.tsx
  // sobre por qué el efecto de montaje usa `.then/.catch` directo en
  // vez de una función intermedia con `setState` adentro.
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
  }, [])
 
  // El estado de cada ambulancia ("en uso" o "disponible") se calcula
  // acá a partir de dos listas (ambulancias activas + atenciones
  // abiertas) en vez de pedirle al backend un endpoint nuevo -- las
  // dos ya existían para otras pantallas, y cruzarlas por
  // `ambulancia.id` es toda la lógica que hace falta.
  useEffect(() => {
    Promise.all([listarAmbulancias(true), listarAtencionesPendientes()])
      .then(([listaAmbulancias, listaPendientes]) => {
        const idsEnUso = new Set(listaPendientes.map((atencion) => atencion.ambulancia.id))
        setAmbulancias(
          listaAmbulancias
            .map((ambulancia) => ({
              movil: ambulancia.movil,
              placa: ambulancia.placa,
              enUso: idsEnUso.has(ambulancia.id),
            }))
            .sort((a, b) => a.movil.localeCompare(b.movil)),
        )
      })
      .catch((err: unknown) => {
        setErrorAmbulancias(
          err instanceof ApiError
            ? err.message
            : 'No se pudo cargar el estado de las ambulancias',
        )
      })
  }, [])
 
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-6 text-2xl font-semibold text-slate-900">Pendientes</h2>
 
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
                <th className="px-3">Tipo</th>
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
                      {atencion.tipo === 'atencion_soat' ? 'SOAT' : 'Traslado'}
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
        <h2 className="mb-6 text-2xl font-semibold text-slate-900">Estado de las ambulancias</h2>
 
        {errorAmbulancias && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {errorAmbulancias}
          </p>
        )}
 
        {ambulancias === null ? (
          <p className="text-slate-500">Cargando…</p>
        ) : ambulancias.length === 0 ? (
          <p className="text-slate-500">No hay ambulancias activas registradas.</p>
        ) : (
          <ul className="grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {ambulancias.map((ambulancia) => (
              <li
                key={ambulancia.movil}
                className={`rounded-lg p-4 shadow-sm ${
                  ambulancia.enUso ? 'bg-brand-amber-soft' : 'bg-brand-green-soft'
                }`}
              >
                <p className="font-medium text-slate-900">{ambulancia.movil}</p>
                <p className="text-xs text-slate-500">{ambulancia.placa}</p>
                <p
                  className={`mt-2 text-sm font-semibold ${
                    ambulancia.enUso ? 'text-brand-amber-dark' : 'text-brand-green-dark'
                  }`}
                >
                  {ambulancia.enUso ? 'En uso' : 'Disponible'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
 
      <section>
        <h2 className="mb-6 text-2xl font-semibold text-slate-900">Alertas</h2>
 
        {/* Issue #79: todavía no hay chequeos de vehículo (#19/#21) ni
            inventario (#23) implementados -- este bloque es un
            mensaje fijo, no datos reales, hasta que esos issues
            lleguen. */}
        <p className="max-w-4xl rounded-lg bg-slate-100 p-4 text-sm text-slate-500">
          Las alertas de vencimiento (SOAT, tecnomecánica) y de stock estarán disponibles en la
          fase 2.
        </p>
      </section>
    </div>
  )
}

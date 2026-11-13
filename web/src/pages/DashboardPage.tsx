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
 * Alertas (issue #19): vencimientos de SOAT y tecnomecánica (semáforo),
 * chequeo semanal pendiente y último chequeo con fallas. Las de stock
 * e inventario siguen pendientes de la fase 2 (#23).
 */
 
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
 
import {
  ApiError,
  listarAmbulancias,
  listarAtencionesPendientes,
  listarEstadoFlota,
} from '../lib/api'
import type { Atencion, EstadoFlota, Semaforo } from '../lib/types'
import { textoVencimiento } from '../lib/vigencia'

interface AlertaFlota {
  clave: string
  nivel: Semaforo
  texto: string
}

/** Lo que merece atención de una ambulancia: vigencias en amarillo o
 * rojo, chequeo semanal pendiente y fallas en el último chequeo. */
function alertasDeFlota(flota: EstadoFlota[]): AlertaFlota[] {
  const alertas: AlertaFlota[] = []
  for (const m of flota) {
    if (m.semaforo_soat !== 'verde') {
      alertas.push({
        clave: `${m.ambulancia_id}-soat`,
        nivel: m.semaforo_soat,
        texto: `Móvil ${m.movil}: SOAT. ${textoVencimiento(m.dias_soat)}`,
      })
    }
    if (m.semaforo_tecnomecanica !== 'verde') {
      alertas.push({
        clave: `${m.ambulancia_id}-tecno`,
        nivel: m.semaforo_tecnomecanica,
        texto: `Móvil ${m.movil}: tecnomecánica. ${textoVencimiento(m.dias_tecnomecanica)}`,
      })
    }
    if (!m.chequeo_al_dia) {
      alertas.push({
        clave: `${m.ambulancia_id}-chequeo`,
        nivel: 'amarillo',
        texto: `Móvil ${m.movil}: chequeo semanal pendiente`,
      })
    }
    if (m.ultimo_chequeo?.tiene_fallas) {
      alertas.push({
        clave: `${m.ambulancia_id}-fallas`,
        nivel: 'rojo',
        texto: `Móvil ${m.movil}: el último chequeo reportó ${m.ultimo_chequeo.total_fallas} ${m.ultimo_chequeo.total_fallas === 1 ? 'falla' : 'fallas'}`,
      })
    }
  }
  const orden: Record<Semaforo, number> = { rojo: 0, amarillo: 1, verde: 2 }
  return alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel])
}

const COLOR_ALERTA: Record<Semaforo, string> = {
  verde: 'bg-green-100 text-green-800',
  amarillo: 'bg-amber-100 text-amber-800',
  rojo: 'bg-red-100 text-red-800',
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
 
export function DashboardPage(): JSX.Element {
  const [pendientes, setPendientes] = useState<Atencion[] | null>(null)
  const [errorPendientes, setErrorPendientes] = useState<string | null>(null)
 
  const [ambulancias, setAmbulancias] = useState<
    { movil: string; placa: string; enUso: boolean }[] | null
  >(null)
  const [errorAmbulancias, setErrorAmbulancias] = useState<string | null>(null)

  const [flota, setFlota] = useState<EstadoFlota[] | null>(null)
  const [errorFlota, setErrorFlota] = useState<string | null>(null)
 
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
 
  useEffect(() => {
    listarEstadoFlota()
      .then(setFlota)
      .catch((err: unknown) => {
        setErrorFlota(
          err instanceof ApiError ? err.message : 'No se pudieron cargar las alertas de la flota',
        )
      })
  }, [])

  return (
    // Issue #98: en escritorio, pendientes a la izquierda (la tabla
    // necesita el ancho) y ambulancias + alertas en una columna a la
    // derecha, como en la maqueta; en pantallas angostas se apilan.
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start xl:gap-8">
      <section className="min-w-0">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-separate border-spacing-y-1 text-sm">
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
          </div>
        )}
      </section>
 
      <div className="space-y-10">
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
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
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
 
          {errorFlota && (
            <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
              {errorFlota}
            </p>
          )}

          {flota === null ? (
            !errorFlota && <p className="text-slate-500">Cargando…</p>
          ) : alertasDeFlota(flota).length === 0 ? (
            <p className="rounded-lg bg-green-100 p-4 text-sm text-green-800">
              Sin alertas de vigencia ni de chequeo.
            </p>
          ) : (
            <ul className="space-y-2">
              {alertasDeFlota(flota).map((alerta) => (
                <li
                  key={alerta.clave}
                  data-nivel={alerta.nivel}
                  className={`rounded-lg px-4 py-2 text-sm ${COLOR_ALERTA[alerta.nivel]}`}
                >
                  {alerta.texto}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-sm">
            <Link to="/flota" className="font-medium text-brand-blue">
              Ver estado de la flota
            </Link>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Las alertas de stock e inventario estarán disponibles en la fase 2.
          </p>
        </section>
      </div>
    </div>
  )
}
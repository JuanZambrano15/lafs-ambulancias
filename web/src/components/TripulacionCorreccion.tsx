/** Selectores de ambulancia, conductor y responsable (auxiliar o
 * médico) al corregir un formato ya cerrado.
 *
 * Quedan preseleccionados los actuales; al guardar, la página manda
 * solo los que cambiaron. Estos cambios no pasan por el historial de
 * versiones (igual que las notas médicas y de enfermería). */

import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import {
  listarAmbulancias,
  listarConductoresDisponibles,
  listarResponsablesDisponibles,
} from '../lib/api'
import type { TripulacionActual, TripulacionElegida } from '../lib/tripulacion'
import type { Ambulancia, Empleado } from '../lib/types'

interface TripulacionCorreccionProps {
  actual: TripulacionActual
  valor: TripulacionElegida
  onChange: (valor: TripulacionElegida) => void
}

const CLASE_SELECT =
  'mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none'

/** La lista, más el valor actual por si ya no figura (p. ej. una
 * ambulancia dada de baja o un empleado inactivo). */
function conActual<T extends { id: number }>(lista: T[], actual: T): T[] {
  return lista.some((item) => item.id === actual.id) ? lista : [actual, ...lista]
}

function nombreEmpleado(empleado: Empleado): string {
  return `${empleado.nombres} ${empleado.apellidos}`
}

export function TripulacionCorreccion({
  actual,
  valor,
  onChange,
}: TripulacionCorreccionProps): JSX.Element {
  const [ambulancias, setAmbulancias] = useState<Ambulancia[]>([actual.ambulancia])
  const [conductores, setConductores] = useState<Empleado[]>([actual.conductor])
  const [responsables, setResponsables] = useState<Empleado[]>([actual.responsable])

  useEffect(() => {
    listarAmbulancias(true)
      .then((lista) => setAmbulancias(conActual(lista, actual.ambulancia)))
      .catch(() => undefined)
    listarConductoresDisponibles()
      .then((lista) => setConductores(conActual(lista, actual.conductor)))
      .catch(() => undefined)
    listarResponsablesDisponibles()
      .then((lista) => setResponsables(conActual(lista, actual.responsable)))
      .catch(() => undefined)
  }, [actual])

  return (
    <div className="mb-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Ambulancia y tripulación</h2>
      <p className="mb-3 text-xs text-slate-500">
        Estos cambios no aparecen en el historial de versiones.
      </p>
      <div className="grid gap-x-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="trip-ambulancia">
            Ambulancia
          </label>
          <select
            id="trip-ambulancia"
            value={valor.ambulanciaId}
            onChange={(e) => onChange({ ...valor, ambulanciaId: e.target.value })}
            className={CLASE_SELECT}
          >
            {ambulancias.map((ambulancia) => (
              <option key={ambulancia.id} value={ambulancia.id}>
                {ambulancia.movil} · {ambulancia.placa}
                {ambulancia.activa ? '' : ' (de baja)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="trip-conductor">
            Conductor
          </label>
          <select
            id="trip-conductor"
            value={valor.conductorId}
            onChange={(e) => onChange({ ...valor, conductorId: e.target.value })}
            className={CLASE_SELECT}
          >
            {conductores.map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {nombreEmpleado(empleado)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="trip-responsable">
            Auxiliar o médico responsable
          </label>
          <select
            id="trip-responsable"
            value={valor.responsableId}
            onChange={(e) => onChange({ ...valor, responsableId: e.target.value })}
            className={CLASE_SELECT}
          >
            {responsables.map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {nombreEmpleado(empleado)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
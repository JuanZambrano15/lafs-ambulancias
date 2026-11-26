/** Ambulancia, conductor y responsable de un servicio al corregir su
 * formato cerrado. Estos cambios no pasan por el historial de versiones
 * (igual que las notas médicas y de enfermería). */

import type { Ambulancia, CambiosTripulacion, Empleado } from './types'

export interface TripulacionActual {
  ambulancia: Ambulancia
  conductor: Empleado
  responsable: Empleado
}

/** Ids elegidos en los selectores, como texto de formulario. */
export interface TripulacionElegida {
  ambulanciaId: string
  conductorId: string
  responsableId: string
}

export function tripulacionInicial(actual: TripulacionActual): TripulacionElegida {
  return {
    ambulanciaId: String(actual.ambulancia.id),
    conductorId: String(actual.conductor.id),
    responsableId: String(actual.responsable.id),
  }
}

/** Solo lo que cambió respecto de lo actual. */
export function cambiosDeTripulacion(
  actual: TripulacionActual,
  elegida: TripulacionElegida,
): CambiosTripulacion {
  const cambios: CambiosTripulacion = {}
  if (Number(elegida.ambulanciaId) !== actual.ambulancia.id) {
    cambios.ambulancia_id = Number(elegida.ambulanciaId)
  }
  if (Number(elegida.conductorId) !== actual.conductor.id) {
    cambios.conductor_id = Number(elegida.conductorId)
  }
  if (Number(elegida.responsableId) !== actual.responsable.id) {
    cambios.responsable_id = Number(elegida.responsableId)
  }
  return cambios
}
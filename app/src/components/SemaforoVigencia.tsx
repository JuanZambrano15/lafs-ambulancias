/** Fecha de vencimiento con semáforo: color + texto (el color solo no
 * basta). Los días y el color vienen del backend. */

import type { JSX } from 'react'

import { formatearFecha, textoVencimiento } from '../lib/vigencia'
import type { Semaforo } from '../lib/types'

const COLORES: Record<Semaforo, string> = {
  verde: 'bg-green-100 text-green-800',
  amarillo: 'bg-amber-100 text-amber-800',
  rojo: 'bg-red-100 text-red-800',
}

const PUNTO: Record<Semaforo, string> = {
  verde: 'bg-green-600',
  amarillo: 'bg-amber-500',
  rojo: 'bg-red-600',
}

interface SemaforoVigenciaProps {
  etiqueta: string
  vencimiento: string
  dias: number
  semaforo: Semaforo
}

export function SemaforoVigencia({
  etiqueta,
  vencimiento,
  dias,
  semaforo,
}: SemaforoVigenciaProps): JSX.Element {
  return (
    <div
      data-semaforo={semaforo}
      className={`rounded-lg px-3 py-2 text-sm ${COLORES[semaforo]}`}
    >
      <div className="flex items-center gap-2 font-medium">
        <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${PUNTO[semaforo]}`} />
        {etiqueta}: {formatearFecha(vencimiento)}
      </div>
      <div className="ml-4.5">{textoVencimiento(dias)}</div>
    </div>
  )
}
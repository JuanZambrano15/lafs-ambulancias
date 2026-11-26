/** Selector "Edad o fecha de nacimiento" del paciente (una u otra).
 *
 * Con la fecha de nacimiento se muestra la edad calculada en años
 * cumplidos a la fecha del servicio (`referencia`). La fecha no se
 * guarda ni sale en el PDF: el backend solo conserva la edad. */

import type { JSX } from 'react'

import { calcularEdad, hoyISO } from '../lib/edad'
import type { EdadONacimientoValor, ModoEdad } from '../lib/edad'

interface EdadONacimientoProps {
  valor: EdadONacimientoValor
  onChange: (valor: EdadONacimientoValor) => void
  /** Fecha del servicio `YYYY-MM-DD` contra la que se calcula la edad;
   * si falta o es inválida, se usa hoy. */
  referencia?: string
  /** `false` en un paciente NN de SOAT, donde puede no haber ninguna. */
  requerido?: boolean
}

const CLASE_CAMPO =
  'w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none'

export function EdadONacimiento({
  valor,
  onChange,
  referencia,
  requerido = true,
}: EdadONacimientoProps): JSX.Element {
  const fechaReferencia =
    referencia !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(referencia) ? referencia : hoyISO()
  const calculada =
    valor.modo === 'nacimiento' && valor.nacimiento !== ''
      ? calcularEdad(valor.nacimiento, fechaReferencia)
      : null

  function cambiarModo(modo: ModoEdad): void {
    onChange({ ...valor, modo })
  }

  return (
    <div className="mb-4">
      <span className="mb-1 block text-sm font-medium text-slate-700" id="edad-o-nacimiento">
        Edad del paciente
      </span>
      <div role="radiogroup" aria-labelledby="edad-o-nacimiento" className="mb-2 flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="modo-edad"
            checked={valor.modo === 'edad'}
            onChange={() => cambiarModo('edad')}
          />
          Ingresar edad
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="modo-edad"
            checked={valor.modo === 'nacimiento'}
            onChange={() => cambiarModo('nacimiento')}
          />
          Ingresar fecha de nacimiento
        </label>
      </div>
      {valor.modo === 'edad' ? (
        <input
          id="edad"
          aria-label="Edad"
          type="number"
          min={0}
          max={130}
          required={requerido}
          className={CLASE_CAMPO}
          value={valor.edad}
          onChange={(e) => onChange({ ...valor, edad: e.target.value })}
        />
      ) : (
        <>
          <input
            id="fecha-nacimiento"
            aria-label="Fecha de nacimiento"
            type="date"
            max={fechaReferencia}
            required={requerido}
            className={CLASE_CAMPO}
            value={valor.nacimiento}
            onChange={(e) => onChange({ ...valor, nacimiento: e.target.value })}
          />
          {valor.nacimiento !== '' && (
            <p className="mt-1 text-sm text-slate-600" data-testid="edad-calculada">
              {calculada === null
                ? 'La fecha de nacimiento no puede ser posterior a la del servicio.'
                : `Edad: ${calculada} ${calculada === 1 ? 'año' : 'años'}`}
            </p>
          )}
        </>
      )}
    </div>
  )
}
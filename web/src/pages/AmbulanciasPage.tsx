/**
 * Administración de ambulancias (móviles): crear, editar, dar de baja,
 * reactivar y eliminar.
 *
 * Dar de baja deja la ambulancia inactiva pero conserva su historial
 * (atenciones, chequeos); es lo que se hace con un móvil que sale de
 * servicio. Eliminar la borra de verdad y solo se puede si nunca se
 * usó -- si ya tiene historial el backend responde 409 y ese mensaje
 * se muestra tal cual (mismo criterio que `RolesPage`).
 */

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'

import {
  ApiError,
  actualizarAmbulancia,
  crearAmbulancia,
  desactivarAmbulancia,
  eliminarAmbulanciaDefinitivo,
  listarAmbulancias,
} from '../lib/api'
import type { Ambulancia } from '../lib/types'

const CLASE_CAMPO =
  'mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none'

const ETIQUETA_TIPO: Record<Ambulancia['tipo'], string> = {
  basica: 'Básica',
  medicalizada: 'Medicalizada',
}

export function AmbulanciasPage(): JSX.Element {
  const [ambulancias, setAmbulancias] = useState<Ambulancia[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [edicion, setEdicion] = useState<Ambulancia | null>(null)

  const [movil, setMovil] = useState('')
  const [placa, setPlaca] = useState('')
  const [tipo, setTipo] = useState<Ambulancia['tipo']>('basica')
  const [vencimientoSoat, setVencimientoSoat] = useState('')
  const [vencimientoTecno, setVencimientoTecno] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Ver `RolesPage`: el efecto de montaje encadena `.then/.catch` en
  // vez de llamar a `cargar` para evitar el aviso de react-hooks por
  // `setState` dentro de un efecto.
  const cargar = useCallback(async () => {
    try {
      setAmbulancias(await listarAmbulancias())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ambulancias')
    }
  }, [])

  useEffect(() => {
    listarAmbulancias()
      .then(setAmbulancias)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las ambulancias')
      })
  }, [])

  function limpiarFormulario(): void {
    setEdicion(null)
    setMovil('')
    setPlaca('')
    setTipo('basica')
    setVencimientoSoat('')
    setVencimientoTecno('')
  }

  function comenzarEdicion(ambulancia: Ambulancia): void {
    setEdicion(ambulancia)
    setMovil(ambulancia.movil)
    setPlaca(ambulancia.placa)
    setTipo(ambulancia.tipo)
    setVencimientoSoat(ambulancia.vencimiento_soat)
    setVencimientoTecno(ambulancia.vencimiento_tecnomecanica)
    setError(null)
  }

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    const datos = {
      movil: movil.trim(),
      placa: placa.trim().toUpperCase(),
      tipo,
      vencimiento_soat: vencimientoSoat,
      vencimiento_tecnomecanica: vencimientoTecno,
    }
    try {
      if (edicion) {
        await actualizarAmbulancia(edicion.id, datos)
      } else {
        await crearAmbulancia(datos)
      }
      limpiarFormulario()
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la ambulancia')
    } finally {
      setEnviando(false)
    }
  }

  async function manejarBaja(ambulancia: Ambulancia): Promise<void> {
    if (
      !window.confirm(
        `¿Dar de baja el móvil ${ambulancia.movil}? Conserva su historial y se puede reactivar.`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await desactivarAmbulancia(ambulancia.id)
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo dar de baja la ambulancia')
    }
  }

  async function manejarReactivar(ambulancia: Ambulancia): Promise<void> {
    setError(null)
    try {
      await actualizarAmbulancia(ambulancia.id, { activa: true })
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reactivar la ambulancia')
    }
  }

  async function manejarEliminar(ambulancia: Ambulancia): Promise<void> {
    if (
      !window.confirm(
        `¿Eliminar definitivamente el móvil ${ambulancia.movil}? Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    setError(null)
    try {
      await eliminarAmbulanciaDefinitivo(ambulancia.id)
      if (edicion?.id === ambulancia.id) limpiarFormulario()
      await cargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la ambulancia')
    }
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold text-slate-900">Ambulancias</h2>

      <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <form
          onSubmit={manejarEnvio}
          className="rounded-xl border border-slate-200 bg-white p-6 xl:sticky xl:top-8"
        >
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            {edicion ? `Editar móvil: ${edicion.movil}` : 'Nueva ambulancia'}
          </h3>

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="amb-movil">
            Móvil
          </label>
          <input
            id="amb-movil"
            type="text"
            required
            maxLength={20}
            value={movil}
            onChange={(e) => setMovil(e.target.value)}
            className={CLASE_CAMPO}
          />

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="amb-placa">
            Placa
          </label>
          <input
            id="amb-placa"
            type="text"
            required
            maxLength={10}
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
            className={CLASE_CAMPO}
          />

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="amb-tipo">
            Tipo
          </label>
          <select
            id="amb-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Ambulancia['tipo'])}
            className={CLASE_CAMPO}
          >
            <option value="basica">Básica</option>
            <option value="medicalizada">Medicalizada</option>
          </select>

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="amb-soat">
            Vencimiento del SOAT
          </label>
          <input
            id="amb-soat"
            type="date"
            required
            value={vencimientoSoat}
            onChange={(e) => setVencimientoSoat(e.target.value)}
            className={CLASE_CAMPO}
          />

          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="amb-tecno">
            Vencimiento de la tecnomecánica
          </label>
          <input
            id="amb-tecno"
            type="date"
            required
            value={vencimientoTecno}
            onChange={(e) => setVencimientoTecno(e.target.value)}
            className={CLASE_CAMPO}
          />

          {error && (
            <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {edicion ? 'Guardar cambios' : 'Crear ambulancia'}
            </button>
            {edicion && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        {ambulancias === null ? (
          <p className="text-slate-500">Cargando…</p>
        ) : ambulancias.length === 0 ? (
          <p className="text-slate-500">Todavía no hay ambulancias registradas.</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[44rem] border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3">Móvil</th>
                  <th className="px-3">Placa</th>
                  <th className="px-3">Tipo</th>
                  <th className="px-3">SOAT</th>
                  <th className="px-3">Tecnomecánica</th>
                  <th className="px-3">Estado</th>
                  <th className="px-3" />
                </tr>
              </thead>
              <tbody>
                {ambulancias.map((ambulancia) => (
                  <tr key={ambulancia.id} className="rounded-lg bg-white shadow-sm">
                    <td className="px-3 py-2 font-medium text-slate-900">{ambulancia.movil}</td>
                    <td className="px-3 py-2 text-slate-600">{ambulancia.placa}</td>
                    <td className="px-3 py-2 text-slate-600">{ETIQUETA_TIPO[ambulancia.tipo]}</td>
                    <td className="px-3 py-2 text-slate-600">{ambulancia.vencimiento_soat}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {ambulancia.vencimiento_tecnomecanica}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {ambulancia.activa ? 'Activa' : 'De baja'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => comenzarEdicion(ambulancia)}
                        className="mr-3 text-brand-blue hover:underline"
                      >
                        Editar
                      </button>
                      {ambulancia.activa ? (
                        <button
                          type="button"
                          onClick={() => void manejarBaja(ambulancia)}
                          className="mr-3 text-slate-600 hover:underline"
                        >
                          Dar de baja
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void manejarReactivar(ambulancia)}
                          className="mr-3 text-slate-600 hover:underline"
                        >
                          Reactivar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void manejarEliminar(ambulancia)}
                        className="text-brand-orange-dark hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
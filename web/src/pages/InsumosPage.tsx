/**
 * Insumos y medicamentos por móvil (issue #20), solo administrador.
 *
 * Dos cosas por móvil:
 *  - El catálogo: qué ítems debe llevar y cuántos como mínimo. Se puede
 *    llenar de una vez con la plantilla del Excel de la empresa y luego
 *    agregar, cambiar o quitar ítems.
 *  - El historial del chequeo semanal que hace el auxiliar, con lo que
 *    encontró frente al mínimo (faltantes en rojo).
 *
 * Quedan fuera: las alertas por faltantes (#21), los lotes y
 * vencimientos (#22) y las existencias (#23).
 */

import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'

import {
  ApiError,
  actualizarInsumo,
  cargarPlantillaInsumos,
  crearInsumo,
  eliminarInsumo,
  listarCatalogoInsumos,
  listarChequeosInsumos,
  listarEstadoInsumos,
  listarPlantillasInsumos,
  obtenerChequeoInsumos,
} from '../lib/api'
import type {
  ChequeoInsumos,
  ChequeoInsumosResumen,
  EstadoInsumosMovil,
  InsumoCatalogo,
  PlantillaInsumos,
} from '../lib/types'
import { textoChequeo } from '../lib/vigencia'

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString()
}

function conUnidad(cantidad: number, unidad: string | null): string {
  return unidad ? `${cantidad} ${unidad}` : String(cantidad)
}

function textoFaltantes(total: number): string {
  return `${total} ${total === 1 ? 'faltante' : 'faltantes'}`
}

function agruparPorCategoria(items: InsumoCatalogo[]): [string, InsumoCatalogo[]][] {
  const grupos = new Map<string, InsumoCatalogo[]>()
  for (const item of items) {
    grupos.set(item.categoria, [...(grupos.get(item.categoria) ?? []), item])
  }
  return Array.from(grupos.entries())
}

const CLASE_CAMPO =
  'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-blue focus:outline-none'

function FilaInsumo({
  insumo,
  onCambio,
  onError,
}: {
  insumo: InsumoCatalogo
  onCambio: () => void
  onError: (mensaje: string | null) => void
}): JSX.Element {
  const [editando, setEditando] = useState(false)
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)
  const [categoria, setCategoria] = useState(insumo.categoria)
  const [nombre, setNombre] = useState(insumo.nombre)
  const [minimo, setMinimo] = useState(String(insumo.minimo))
  const [unidad, setUnidad] = useState(insumo.unidad ?? '')
  const [ocupado, setOcupado] = useState(false)

  async function guardar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    if (!/^\d{1,4}$/.test(minimo.trim())) {
      onError('El mínimo debe ser un número entero, 0 o más')
      return
    }
    setOcupado(true)
    onError(null)
    try {
      await actualizarInsumo(insumo.id, {
        categoria,
        nombre,
        minimo: Number(minimo),
        unidad: unidad.trim() || null,
      })
      setEditando(false)
      onCambio()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudo guardar el ítem')
    } finally {
      setOcupado(false)
    }
  }

  async function quitar(): Promise<void> {
    setOcupado(true)
    onError(null)
    try {
      await eliminarInsumo(insumo.id)
      onCambio()
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'No se pudo quitar el ítem')
      setOcupado(false)
    }
  }

  if (editando) {
    return (
      <li className="px-4 py-3">
        <form onSubmit={guardar} className="grid gap-2 sm:grid-cols-[1fr_2fr_6rem_7rem_auto]">
          <input
            aria-label={`Categoría de ${insumo.nombre}`}
            value={categoria}
            maxLength={60}
            onChange={(e) => setCategoria(e.target.value)}
            className={CLASE_CAMPO}
          />
          <input
            aria-label={`Nombre de ${insumo.nombre}`}
            value={nombre}
            maxLength={150}
            onChange={(e) => setNombre(e.target.value)}
            className={CLASE_CAMPO}
          />
          <input
            aria-label={`Mínimo de ${insumo.nombre}`}
            value={minimo}
            inputMode="numeric"
            onChange={(e) => setMinimo(e.target.value)}
            className={CLASE_CAMPO}
          />
          <input
            aria-label={`Unidad de ${insumo.nombre}`}
            value={unidad}
            maxLength={30}
            placeholder="amp, blíster…"
            onChange={(e) => setUnidad(e.target.value)}
            className={CLASE_CAMPO}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={ocupado}
              className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false)
                setCategoria(insumo.categoria)
                setNombre(insumo.nombre)
                setMinimo(String(insumo.minimo))
                setUnidad(insumo.unidad ?? '')
                onError(null)
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <span className="text-slate-800">{insumo.nombre}</span>
      <span className="flex shrink-0 items-center gap-3">
        <span className="text-slate-600">Mínimo: {conUnidad(insumo.minimo, insumo.unidad)}</span>
        {confirmandoQuitar ? (
          <>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void quitar()}
              aria-label={`Confirmar quitar ${insumo.nombre}`}
              className="rounded-lg bg-red-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              Sí, quitar
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoQuitar(false)}
              className="rounded-lg px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditando(true)}
              aria-label={`Editar ${insumo.nombre}`}
              className="rounded-lg px-3 py-1 text-xs font-medium text-brand-blue hover:bg-slate-100"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoQuitar(true)}
              aria-label={`Quitar ${insumo.nombre}`}
              className="rounded-lg px-3 py-1 text-xs font-medium text-red-700 hover:bg-slate-100"
            >
              Quitar
            </button>
          </>
        )}
      </span>
    </li>
  )
}

function FormularioNuevoInsumo({
  ambulanciaId,
  categorias,
  onCreado,
}: {
  ambulanciaId: number
  categorias: string[]
  onCreado: () => void
}): JSX.Element {
  const [categoria, setCategoria] = useState('')
  const [nombre, setNombre] = useState('')
  const [minimo, setMinimo] = useState('1')
  const [unidad, setUnidad] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function agregar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    if (!categoria.trim() || !nombre.trim()) {
      setError('Escribe la categoría y el nombre del ítem')
      return
    }
    if (!/^\d{1,4}$/.test(minimo.trim())) {
      setError('El mínimo debe ser un número entero, 0 o más')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await crearInsumo({
        ambulancia_id: ambulanciaId,
        categoria,
        nombre,
        minimo: Number(minimo),
        unidad: unidad.trim() || null,
      })
      setNombre('')
      setMinimo('1')
      setUnidad('')
      onCreado()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar el ítem')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={agregar} className="mt-4 rounded-lg bg-slate-50 p-4">
      <h4 className="mb-2 text-sm font-medium text-slate-800">Agregar un ítem</h4>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_6rem_7rem_auto]">
        <input
          aria-label="Categoría del nuevo ítem"
          list="categorias-insumos"
          value={categoria}
          maxLength={60}
          placeholder="Categoría"
          onChange={(e) => setCategoria(e.target.value)}
          className={CLASE_CAMPO}
        />
        <datalist id="categorias-insumos">
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input
          aria-label="Nombre del nuevo ítem"
          value={nombre}
          maxLength={150}
          placeholder="Nombre"
          onChange={(e) => setNombre(e.target.value)}
          className={CLASE_CAMPO}
        />
        <input
          aria-label="Mínimo del nuevo ítem"
          value={minimo}
          inputMode="numeric"
          onChange={(e) => setMinimo(e.target.value)}
          className={CLASE_CAMPO}
        />
        <input
          aria-label="Unidad del nuevo ítem"
          value={unidad}
          maxLength={30}
          placeholder="amp, blíster…"
          onChange={(e) => setUnidad(e.target.value)}
          className={CLASE_CAMPO}
        />
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-brand-blue px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          Agregar
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-brand-orange-dark">
          {error}
        </p>
      )}
    </form>
  )
}

function Catalogo({
  movil,
  onCambio,
}: {
  movil: EstadoInsumosMovil
  onCambio: () => void
}): JSX.Element {
  const [items, setItems] = useState<InsumoCatalogo[] | null>(null)
  const [plantillas, setPlantillas] = useState<PlantillaInsumos[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargandoPlantilla, setCargandoPlantilla] = useState(false)

  function recargar(): void {
    listarCatalogoInsumos(movil.ambulancia_id)
      .then((lista) => {
        setItems(lista)
        onCambio()
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo')
      })
  }

  useEffect(() => {
    listarCatalogoInsumos(movil.ambulancia_id)
      .then(setItems)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo')
      })
    listarPlantillasInsumos()
      .then(setPlantillas)
      .catch(() => setPlantillas([]))
  }, [movil.ambulancia_id])

  async function cargar(plantilla: PlantillaInsumos): Promise<void> {
    setCargandoPlantilla(true)
    setError(null)
    try {
      await cargarPlantillaInsumos(movil.ambulancia_id, plantilla.clave)
      recargar()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la plantilla')
    } finally {
      setCargandoPlantilla(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-1 font-medium text-slate-900">Catálogo y mínimos del móvil {movil.movil}</h3>
      <p className="mb-3 text-sm text-slate-500">
        Lo que el auxiliar debe encontrar en el móvil. Cada ítem tiene un mínimo: si en el chequeo
        encuentra menos, queda como faltante.
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-brand-orange-dark">
          {error}
        </p>
      )}
      {items === null && !error ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : items !== null && items.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <p className="mb-3 text-slate-700">
            Este móvil todavía no tiene lista. Empieza con una plantilla del Excel de inventarios y
            luego ajústala, o agrega los ítems uno por uno.
          </p>
          <div className="flex flex-wrap gap-2">
            {plantillas.map((p) => (
              <button
                key={p.clave}
                type="button"
                disabled={cargandoPlantilla}
                onClick={() => void cargar(p)}
                className="rounded-lg border border-brand-blue px-3 py-1.5 text-sm font-medium text-brand-blue disabled:opacity-60"
              >
                Cargar plantilla {p.nombre} ({p.total} ítems)
              </button>
            ))}
          </div>
        </div>
      ) : (
        items !== null &&
        agruparPorCategoria(items).map(([categoria, grupo]) => (
          <section key={categoria} className="mb-4" aria-label={categoria}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {categoria} ({grupo.length})
            </h4>
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {grupo.map((i) => (
                <FilaInsumo key={i.id} insumo={i} onCambio={recargar} onError={setError} />
              ))}
            </ul>
          </section>
        ))
      )}
      {items !== null && (
        <FormularioNuevoInsumo
          ambulanciaId={movil.ambulancia_id}
          categorias={Array.from(new Set(items.map((i) => i.categoria)))}
          onCreado={recargar}
        />
      )}
    </div>
  )
}

function DetalleChequeo({ chequeo }: { chequeo: ChequeoInsumos }): JSX.Element {
  const faltantes = chequeo.items.filter((i) => i.faltante)
  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-4 text-sm">
      {faltantes.length === 0 ? (
        <p className="font-medium text-green-700">Todo completo: sin faltantes.</p>
      ) : (
        <div className="mb-3">
          <p className="mb-1 font-medium text-red-700">{textoFaltantes(faltantes.length)}:</p>
          <ul className="list-disc pl-5">
            {faltantes.map((i) => (
              <li key={i.insumo_id}>
                <strong>{i.nombre}</strong>: encontró {conUnidad(i.encontrado, i.unidad)} de{' '}
                {conUnidad(i.minimo, i.unidad)} (faltan {i.minimo - i.encontrado})
              </li>
            ))}
          </ul>
        </div>
      )}
      {chequeo.observaciones && (
        <p className="mb-3">
          <strong>Observaciones:</strong> {chequeo.observaciones}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-slate-600">
          Ver los {chequeo.items.length} ítems
        </summary>
        <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {chequeo.items.map((i) => (
            <li key={i.insumo_id} className={i.faltante ? 'text-red-700' : 'text-slate-700'}>
              {i.faltante ? '✗' : '✓'} {i.nombre}: {i.encontrado}/{i.minimo}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function Historial({ movil }: { movil: EstadoInsumosMovil }): JSX.Element {
  const [chequeos, setChequeos] = useState<ChequeoInsumosResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<ChequeoInsumos | null>(null)

  useEffect(() => {
    listarChequeosInsumos(movil.ambulancia_id)
      .then(setChequeos)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial')
      })
  }, [movil.ambulancia_id, movil.ultimo_chequeo?.id])

  async function abrir(id: number): Promise<void> {
    if (abierto?.id === id) {
      setAbierto(null)
      return
    }
    try {
      setAbierto(await obtenerChequeoInsumos(id))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el chequeo')
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-medium text-slate-900">Chequeos del móvil {movil.movil}</h3>
      {error && (
        <p role="alert" className="mb-3 text-sm text-brand-orange-dark">
          {error}
        </p>
      )}
      {chequeos === null ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : chequeos.length === 0 ? (
        <p className="text-sm text-slate-500">Este móvil todavía no tiene chequeos de insumos.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {chequeos.map((c) => (
            <li key={c.id} className="py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {formatearFechaHora(c.realizado_en)} · {c.auxiliar_nombre} ·{' '}
                  <span
                    className={c.tiene_faltantes ? 'font-medium text-red-700' : 'text-green-700'}
                  >
                    {c.tiene_faltantes ? textoFaltantes(c.total_faltantes) : 'Sin faltantes'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void abrir(c.id)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-blue hover:bg-slate-100"
                >
                  {abierto?.id === c.id ? 'Ocultar' : 'Ver detalle'}
                </button>
              </div>
              {abierto?.id === c.id && <DetalleChequeo chequeo={abierto} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function InsumosPage(): JSX.Element {
  const [moviles, setMoviles] = useState<EstadoInsumosMovil[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegidoId, setElegidoId] = useState<number | null>(null)

  function cargar(): void {
    listarEstadoInsumos()
      .then((lista) => {
        setMoviles(lista)
        setElegidoId((actual) => actual ?? lista[0]?.ambulancia_id ?? null)
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar los móviles')
      })
  }

  useEffect(cargar, [])

  const elegido = moviles?.find((m) => m.ambulancia_id === elegidoId) ?? null

  return (
    <section>
      <h2 className="mb-2 text-2xl font-semibold text-slate-900">Insumos por móvil</h2>
      <p className="mb-6 text-sm text-slate-500">
        Define qué insumos y medicamentos debe llevar cada móvil y cuántos como mínimo, y revisa el
        chequeo semanal del auxiliar de enfermería.
      </p>

      {error && (
        <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
          {error}
        </p>
      )}

      {moviles === null && !error ? (
        <p className="text-slate-500">Cargando…</p>
      ) : moviles !== null && moviles.length === 0 ? (
        <p className="text-slate-500">No hay ambulancias activas.</p>
      ) : (
        moviles !== null && (
          <>
            <ul className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {moviles.map((m) => (
                <li key={m.ambulancia_id}>
                  <button
                    type="button"
                    onClick={() => setElegidoId(m.ambulancia_id)}
                    aria-pressed={m.ambulancia_id === elegidoId}
                    className={`w-full rounded-xl border p-4 text-left shadow-sm ${
                      m.ambulancia_id === elegidoId
                        ? 'border-brand-blue bg-white ring-2 ring-brand-blue'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="font-medium text-slate-900">
                      {m.movil}
                      <span className="ml-2 text-xs font-normal text-slate-500">{m.placa}</span>
                    </div>
                    <div className="text-xs text-slate-500">{m.total_items} ítems en la lista</div>
                    <div
                      className={`mt-1 text-sm ${m.chequeo_al_dia ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {m.chequeo_al_dia ? 'Al día' : 'Pendiente'} ·{' '}
                      {textoChequeo(m.dias_desde_chequeo)}
                    </div>
                    {m.ultimo_chequeo?.tiene_faltantes && (
                      <div className="text-xs font-medium text-red-700">
                        Último chequeo: {textoFaltantes(m.ultimo_chequeo.total_faltantes)}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {elegido && (
              <div className="grid gap-6">
                {/* `key`: al cambiar de móvil cada bloque arranca de cero. */}
                <Catalogo key={`catalogo-${elegido.ambulancia_id}`} movil={elegido} onCambio={cargar} />
                <Historial key={`historial-${elegido.ambulancia_id}`} movil={elegido} />
              </div>
            )}
          </>
        )
      )}
    </section>
  )
}
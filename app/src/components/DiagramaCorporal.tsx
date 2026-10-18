/**
 * Diagrama corporal interactivo para localizar lesiones (issue #54):
 * se toca una zona del cuerpo (frontal o posterior), se elige el tipo
 * de lesión y se agrega a la lista. Se pueden registrar varias
 * lesiones -- distintas o repetidas en zonas distintas -- y cada una
 * se puede quitar si se marcó por error.
 *
 * Es un componente "controlado" (como el resto del formulario): el
 * padre guarda `valor` y recibe los cambios por `onChange`, igual que
 * cualquier otro campo de `ClinicoTrasladoPage`/`ClinicoAccidenteSoatPage`.
 * Reemplaza al checklist plano de tipos (sin ubicación) que tenía el
 * formulario antes de este issue.
 *
 * Convención clínica de lado (ver también `LesionLado` en
 * `app/src/lib/types.ts` y `LesionLado`/`LesionZona`/`LesionVista` en
 * `api/app/models/formato_traslado.py`): en la vista frontal el
 * paciente da la cara a quien mira, así que su lado derecho queda a
 * la izquierda de la pantalla; en la vista posterior (de espaldas) es
 * al revés. `ladoReal` hace esa conversión -- el lado de pantalla
 * (`'izq' | 'der'`) nunca se confunde con el lado real del paciente.
 */

import { useId, useState } from 'react'

import type { LesionLado, LesionLocalizada, LesionTipo, LesionVista, LesionZona } from '../lib/types'

/** Mismas etiquetas que ya usaba el checklist plano (antes
 * `LESION_OPCIONES` en cada página) -- se centralizan aquí porque
 * ahora las usa este único componente, compartido entre traslado y
 * SOAT. */
export const LESION_ETIQUETAS: { valor: LesionTipo; etiqueta: string }[] = [
  { valor: 'tce', etiqueta: 'TCE' },
  { valor: 'amputacion', etiqueta: 'Amputación' },
  { valor: 'escalpe', etiqueta: 'Escalpe' },
  { valor: 'eritema', etiqueta: 'Eritema' },
  { valor: 'fractura_abierta', etiqueta: 'Fractura abierta' },
  { valor: 'puncion', etiqueta: 'Punción' },
  { valor: 'laceracion', etiqueta: 'Laceración' },
  { valor: 'edema', etiqueta: 'Edema' },
  { valor: 'luxacion', etiqueta: 'Luxación' },
  { valor: 'mordedura', etiqueta: 'Mordedura' },
  { valor: 'abrasion', etiqueta: 'Abrasión' },
  { valor: 'hematoma', etiqueta: 'Hematoma' },
  { valor: 'esguince', etiqueta: 'Esguince' },
  { valor: 'picadura', etiqueta: 'Picadura' },
  { valor: 'trauma', etiqueta: 'Trauma' },
  { valor: 'torax_inestable', etiqueta: 'Tórax inestable' },
  { valor: 'contusion', etiqueta: 'Contusión' },
  { valor: 'cuerpo_extrano', etiqueta: 'Cuerpo extraño' },
  { valor: 'hemotorax_masivo', etiqueta: 'Hemotórax masivo' },
  { valor: 'abdomen_cerrado', etiqueta: 'Abdomen cerrado' },
  { valor: 'hemorragia', etiqueta: 'Hemorragia' },
  { valor: 'quemadura', etiqueta: 'Quemadura' },
  { valor: 'aplastamiento', etiqueta: 'Aplastamiento' },
  { valor: 'avulsion', etiqueta: 'Avulsión' },
  { valor: 'dolor', etiqueta: 'Dolor' },
  { valor: 'otro', etiqueta: 'Otro (especificar)' },
]

const ETIQUETAS_LESION_POR_VALOR = new Map(LESION_ETIQUETAS.map((o) => [o.valor, o.etiqueta]))

/** Zonas femeninas en español -- afecta solo "derecha"/"izquierda" vs.
 * "derecho"/"izquierdo"; el nombre de la zona siempre sale de
 * `ETIQUETAS_ZONA`. */
const ZONAS_FEMENINAS = new Set<LesionZona>(['mano', 'pierna'])

const ETIQUETAS_ZONA: Record<LesionZona, string> = {
  cabeza: 'Cabeza',
  cuello: 'Cuello',
  torax: 'Tórax',
  abdomen: 'Abdomen',
  hombro: 'Hombro',
  brazo: 'Brazo',
  antebrazo: 'Antebrazo',
  mano: 'Mano',
  muslo: 'Muslo',
  pierna: 'Pierna',
  pie: 'Pie',
}

type LadoPantalla = 'izq' | 'der' | null

interface ZonaBase {
  zona: LesionZona
  lado: LadoPantalla
  x: number
  y: number
  w: number
  h: number
  rx: number
}

/** Las 18 regiones clickeables del diagrama (11 zonas, 7 de ellas con
 * lado izquierdo y derecho) -- mismas coordenadas ya validadas en la
 * maqueta aprobada. `viewBox` del SVG es 0 0 200 310. */
const ZONAS_BASE: ZonaBase[] = [
  { zona: 'cabeza', lado: null, x: 80, y: 8, w: 40, h: 40, rx: 20 },
  { zona: 'cuello', lado: null, x: 90, y: 48, w: 20, h: 10, rx: 4 },
  { zona: 'torax', lado: null, x: 62, y: 58, w: 76, h: 52, rx: 14 },
  { zona: 'abdomen', lado: null, x: 66, y: 110, w: 68, h: 38, rx: 10 },
  { zona: 'hombro', lado: 'izq', x: 40, y: 60, w: 24, h: 24, rx: 12 },
  { zona: 'hombro', lado: 'der', x: 136, y: 60, w: 24, h: 24, rx: 12 },
  { zona: 'brazo', lado: 'izq', x: 36, y: 84, w: 22, h: 58, rx: 11 },
  { zona: 'brazo', lado: 'der', x: 142, y: 84, w: 22, h: 58, rx: 11 },
  { zona: 'antebrazo', lado: 'izq', x: 32, y: 142, w: 20, h: 52, rx: 10 },
  { zona: 'antebrazo', lado: 'der', x: 148, y: 142, w: 20, h: 52, rx: 10 },
  { zona: 'mano', lado: 'izq', x: 30, y: 194, w: 24, h: 26, rx: 10 },
  { zona: 'mano', lado: 'der', x: 146, y: 194, w: 24, h: 26, rx: 10 },
  { zona: 'muslo', lado: 'izq', x: 64, y: 148, w: 30, h: 68, rx: 14 },
  { zona: 'muslo', lado: 'der', x: 106, y: 148, w: 30, h: 68, rx: 14 },
  { zona: 'pierna', lado: 'izq', x: 66, y: 216, w: 26, h: 62, rx: 12 },
  { zona: 'pierna', lado: 'der', x: 108, y: 216, w: 26, h: 62, rx: 12 },
  { zona: 'pie', lado: 'izq', x: 62, y: 278, w: 32, h: 18, rx: 8 },
  { zona: 'pie', lado: 'der', x: 106, y: 278, w: 32, h: 18, rx: 8 },
]

/** Convierte el lado de PANTALLA (`izq`/`der`, o `null` para zonas sin
 * lado) en el lado REAL del paciente, según la vista activa. */
function ladoReal(lado: LadoPantalla, vista: LesionVista): LesionLado {
  if (lado === null) return 'central'
  if (vista === 'frontal') return lado === 'izq' ? 'derecho' : 'izquierdo'
  return lado === 'izq' ? 'izquierdo' : 'derecho'
}

function textoLado(zona: LesionZona, lado: LesionLado): string {
  if (lado === 'central') return ''
  const femenino = ZONAS_FEMENINAS.has(zona)
  if (lado === 'derecho') return femenino ? ' derecha' : ' derecho'
  return femenino ? ' izquierda' : ' izquierdo'
}

function textoEntrada(entrada: LesionLocalizada): string {
  const etiquetaTipo =
    entrada.tipo === 'otro'
      ? entrada.tipo_otro || 'Otro'
      : ETIQUETAS_LESION_POR_VALOR.get(entrada.tipo) ?? entrada.tipo
  const zonaTexto = ETIQUETAS_ZONA[entrada.zona] + textoLado(entrada.zona, entrada.lado)
  const vistaTexto = entrada.vista === 'frontal' ? 'vista frontal' : 'vista posterior'
  return `${etiquetaTipo} — ${zonaTexto} (${vistaTexto})`
}

interface DiagramaCorporalProps {
  valor: LesionLocalizada[]
  onChange: (valor: LesionLocalizada[]) => void
}

interface ZonaSeleccionada {
  zona: LesionZona
  lado: LesionLado
}

export function DiagramaCorporal({ valor, onChange }: DiagramaCorporalProps) {
  const [vista, setVista] = useState<LesionVista>('frontal')
  const [zonaActual, setZonaActual] = useState<ZonaSeleccionada | null>(null)
  const [tipo, setTipo] = useState<LesionTipo | ''>('')
  const [otro, setOtro] = useState('')
  const idOtro = useId()
  const idTipo = useId()

  function seleccionarZona(zona: LesionZona, lado: LadoPantalla): void {
    setZonaActual({ zona, lado: ladoReal(lado, vista) })
    setTipo('')
    setOtro('')
  }

  function cancelarSeleccion(): void {
    setZonaActual(null)
    setTipo('')
    setOtro('')
  }

  function cambiarVista(nuevaVista: LesionVista): void {
    setVista(nuevaVista)
    setZonaActual(null)
    setTipo('')
    setOtro('')
  }

  const puedeAgregar = zonaActual !== null && tipo !== '' && (tipo !== 'otro' || otro.trim().length > 0)

  function agregarEntrada(): void {
    if (!zonaActual || tipo === '') return
    if (tipo === 'otro' && !otro.trim()) return
    const nueva: LesionLocalizada = {
      tipo,
      tipo_otro: tipo === 'otro' ? otro.trim() : null,
      zona: zonaActual.zona,
      lado: zonaActual.lado,
      vista,
    }
    onChange([...valor, nueva])
    cancelarSeleccion()
  }

  function quitarEntrada(indice: number): void {
    onChange(valor.filter((_, i) => i !== indice))
  }

  const zonasConEstado = ZONAS_BASE.map((z) => {
    const lado = ladoReal(z.lado, vista)
    const seleccionada = zonaActual !== null && zonaActual.zona === z.zona && zonaActual.lado === lado
    const tieneEntradas = valor.some((e) => e.zona === z.zona && e.lado === lado && e.vista === vista)
    const etiquetaAria = `${ETIQUETAS_ZONA[z.zona]}${textoLado(z.zona, lado)}`
    return { ...z, ladoReal: lado, seleccionada, tieneEntradas, etiquetaAria }
  })

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex gap-1 rounded-lg bg-slate-200 p-1">
          <button
            type="button"
            onClick={() => cambiarVista('frontal')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              vista === 'frontal' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Vista frontal
          </button>
          <button
            type="button"
            onClick={() => cambiarVista('posterior')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              vista === 'posterior' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
            }`}
          >
            Vista posterior
          </button>
        </div>

        <svg
          viewBox="0 0 200 310"
          width={200}
          height={310}
          className="rounded-xl border border-slate-200 bg-white"
        >
          {zonasConEstado.map((z) => (
            <rect
              key={`${z.zona}-${z.lado ?? 'c'}`}
              role="button"
              tabIndex={0}
              aria-label={z.etiquetaAria}
              aria-pressed={z.seleccionada}
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              rx={z.rx}
              stroke="#64748b"
              strokeWidth={1}
              fill={z.seleccionada ? '#2563eb' : z.tieneEntradas ? '#fbbf24' : '#e2e8f0'}
              className="cursor-pointer"
              onClick={() => seleccionarZona(z.zona, z.lado)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' || evento.key === ' ') {
                  evento.preventDefault()
                  seleccionarZona(z.zona, z.lado)
                }
              }}
            />
          ))}
        </svg>

        <div className="flex gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border border-slate-400 bg-slate-200" /> Sin
            marcar
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> Ya tiene lesión
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-600" /> Seleccionada
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-slate-800">
            {zonaActual
              ? `Zona seleccionada: ${ETIQUETAS_ZONA[zonaActual.zona]}${textoLado(zonaActual.zona, zonaActual.lado)} — vista ${vista}`
              : 'Toca una parte del diagrama para empezar.'}
          </p>

          {zonaActual && (
            <div className="flex flex-col gap-2">
              <label htmlFor={idTipo} className="sr-only">
                Tipo de lesión
              </label>
              <select
                id={idTipo}
                value={tipo}
                onChange={(evento) => {
                  const nuevoTipo = evento.target.value as LesionTipo | ''
                  setTipo(nuevoTipo)
                  if (nuevoTipo !== 'otro') setOtro('')
                }}
                className="rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-800"
              >
                <option value="">Elige el tipo de lesión…</option>
                {LESION_ETIQUETAS.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>

              {tipo === 'otro' && (
                <>
                  <label htmlFor={idOtro} className="sr-only">
                    Especifica el tipo de lesión
                  </label>
                  <input
                    id={idOtro}
                    type="text"
                    value={otro}
                    onChange={(evento) => setOtro(evento.target.value)}
                    placeholder="Especifica el tipo de lesión"
                    className="rounded-md border border-slate-300 px-2.5 py-2 text-sm text-slate-800"
                  />
                </>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={agregarEntrada}
                  disabled={!puedeAgregar}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold text-white ${
                    puedeAgregar ? 'bg-blue-600' : 'bg-slate-400'
                  }`}
                >
                  Agregar a la lista
                </button>
                <button
                  type="button"
                  onClick={cancelarSeleccion}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {valor.length === 0 && (
            <p className="py-2 text-center text-sm text-slate-400">Todavía no hay lesiones registradas.</p>
          )}
          {valor.map((entrada, indice) => (
            <div
              key={`${entrada.tipo}-${entrada.zona}-${entrada.lado}-${entrada.vista}-${indice}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span className="text-sm text-slate-800">{textoEntrada(entrada)}</span>
              <button
                type="button"
                onClick={() => quitarEntrada(indice)}
                className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
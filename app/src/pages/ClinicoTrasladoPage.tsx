/**
 * Parte clínica del formato de traslado asistencial (issue #9,
 * TAP-LAFS-002): estado del paciente, pupilas, signos vitales,
 * lesiones, escala de Glasgow, insumos entregados, nota de auxiliar y
 * nota médica.
 *
 * A diferencia del encabezado (se llena una sola vez, al recibir al
 * paciente), esta parte se llena progresivamente durante el traslado
 * — por eso no hay ningún campo obligatorio y se puede guardar el
 * avance las veces que haga falta mientras la atención sigue abierta
 * (ver ADR-0007). Las firmas de "ATENDIDO POR"/"EVOLUCIONADO POR" son
 * del issue #11 — aquí solo se guarda el nombre.
 */
 
import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
 
import { ApiError, guardarClinicoTraslado, obtenerEncabezadoTraslado } from '../lib/api'
import type {
  FormatoTrasladoClinico,
  LesionTipo,
  ReflejoPupilar,
  TratamientoAplicado,
} from '../lib/types'
 
interface SignoVitalForm {
  hora: string
  ta: string
  fc: string
  fr: string
  spo2: string
}
 
interface EstadoClinico {
  diagnostico: string
  tratamiento: TratamientoAplicado[]
  tratamientoOtro: string
  pupilaDerecha: ReflejoPupilar | ''
  pupilaIzquierda: ReflejoPupilar | ''
  signosVitales: SignoVitalForm[]
  lesiones: LesionTipo[]
  lesionOtro: string
  glasgowOcular: string
  glasgowVerbal: string
  glasgowMotora: string
  insumos: string[]
  notaAuxiliar: string
  atendidoPor: string
  notaMedica: string
  evolucionadoPor: string
}
 
const ESTADO_VACIO: EstadoClinico = {
  diagnostico: '',
  tratamiento: [],
  tratamientoOtro: '',
  pupilaDerecha: '',
  pupilaIzquierda: '',
  signosVitales: [],
  lesiones: [],
  lesionOtro: '',
  glasgowOcular: '',
  glasgowVerbal: '',
  glasgowMotora: '',
  insumos: [],
  notaAuxiliar: '',
  atendidoPor: '',
  notaMedica: '',
  evolucionadoPor: '',
}
 
const TRATAMIENTO_OPCIONES: { valor: TratamientoAplicado; etiqueta: string }[] = [
  { valor: 'collar_cervical', etiqueta: 'Collar cervical' },
  { valor: 'inmovilizacion', etiqueta: 'Inmovilización' },
  { valor: 'succion_secrecion', etiqueta: 'Succión secreción' },
  { valor: 'oxigeno', etiqueta: 'Oxígeno' },
  { valor: 'hemostasia', etiqueta: 'Hemostasia' },
  { valor: 'linea_iv', etiqueta: 'Línea IV' },
  { valor: 'canula_orofaringea', etiqueta: 'Cánula orofaríngea' },
  { valor: 'rcp', etiqueta: 'R.C.P.' },
  { valor: 'canula_nasal', etiqueta: 'Cánula nasal' },
  { valor: 'monitoreo', etiqueta: 'Monitoreo' },
  { valor: 'parto', etiqueta: 'Parto' },
  { valor: 'vendaje', etiqueta: 'Vendaje' },
  { valor: 'asepsia', etiqueta: 'Asepsia' },
  { valor: 'otros', etiqueta: 'Otros' },
]
 
const REFLEJO_OPCIONES: { valor: ReflejoPupilar; etiqueta: string }[] = [
  { valor: 'midriatica', etiqueta: 'Midriática' },
  { valor: 'miotica', etiqueta: 'Miótica' },
  { valor: 'isocorica', etiqueta: 'Isocórica' },
  { valor: 'anisocorica', etiqueta: 'Anisocórica' },
  { valor: 'no_reactiva', etiqueta: 'No reactiva' },
]
 
const LESION_OPCIONES: { valor: LesionTipo; etiqueta: string }[] = [
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
]
 
const MAX_INSUMOS = 8
 
function alternarEnLista<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
}
 
function aNumeroONulo(valor: string): number | null {
  return valor === '' ? null : Number(valor)
}
 
export function ClinicoTrasladoPage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = Number(atencionId)
 
  const [campos, setCampos] = useState<EstadoClinico>(ESTADO_VACIO)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
 
  useEffect(() => {
    obtenerEncabezadoTraslado(id)
      .then((existente) => {
        if (existente === null) return
        setCampos({
          diagnostico: existente.diagnostico ?? '',
          tratamiento: existente.tratamiento,
          tratamientoOtro: existente.tratamiento_otro ?? '',
          pupilaDerecha: existente.pupila_derecha ?? '',
          pupilaIzquierda: existente.pupila_izquierda ?? '',
          signosVitales: existente.signos_vitales.map((signo) => ({
            hora: signo.hora,
            ta: signo.ta ?? '',
            fc: signo.fc === null ? '' : String(signo.fc),
            fr: signo.fr === null ? '' : String(signo.fr),
            spo2: signo.spo2 === null ? '' : String(signo.spo2),
          })),
          lesiones: existente.lesiones,
          lesionOtro: existente.lesion_otro ?? '',
          glasgowOcular: existente.glasgow_ocular === null ? '' : String(existente.glasgow_ocular),
          glasgowVerbal: existente.glasgow_verbal === null ? '' : String(existente.glasgow_verbal),
          glasgowMotora: existente.glasgow_motora === null ? '' : String(existente.glasgow_motora),
          insumos: existente.insumos_entregados,
          notaAuxiliar: existente.nota_auxiliar ?? '',
          atendidoPor: existente.atendido_por ?? '',
          notaMedica: existente.nota_medica ?? '',
          evolucionadoPor: existente.evolucionado_por ?? '',
        })
      })
      .catch((err: unknown) => {
        setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar lo clínico')
      })
      .finally(() => setCargando(false))
  }, [id])
 
  function agregarSignoVital(): void {
    setCampos((anterior) => ({
      ...anterior,
      signosVitales: [...anterior.signosVitales, { hora: '', ta: '', fc: '', fr: '', spo2: '' }],
    }))
  }
 
  function quitarSignoVital(indice: number): void {
    setCampos((anterior) => ({
      ...anterior,
      signosVitales: anterior.signosVitales.filter((_, i) => i !== indice),
    }))
  }
 
  function actualizarSignoVital(indice: number, campo: keyof SignoVitalForm, valor: string): void {
    setCampos((anterior) => ({
      ...anterior,
      signosVitales: anterior.signosVitales.map((signo, i) =>
        i === indice ? { ...signo, [campo]: valor } : signo,
      ),
    }))
  }
 
  function agregarInsumo(): void {
    setCampos((anterior) =>
      anterior.insumos.length >= MAX_INSUMOS
        ? anterior
        : { ...anterior, insumos: [...anterior.insumos, ''] },
    )
  }
 
  function quitarInsumo(indice: number): void {
    setCampos((anterior) => ({
      ...anterior,
      insumos: anterior.insumos.filter((_, i) => i !== indice),
    }))
  }
 
  function actualizarInsumo(indice: number, valor: string): void {
    setCampos((anterior) => ({
      ...anterior,
      insumos: anterior.insumos.map((insumo, i) => (i === indice ? valor : insumo)),
    }))
  }
 
  const glasgowTotal =
    campos.glasgowOcular !== '' && campos.glasgowVerbal !== '' && campos.glasgowMotora !== ''
      ? Number(campos.glasgowOcular) + Number(campos.glasgowVerbal) + Number(campos.glasgowMotora)
      : null
 
  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const datos: FormatoTrasladoClinico = {
        diagnostico: campos.diagnostico || null,
        tratamiento: campos.tratamiento,
        tratamiento_otro: campos.tratamientoOtro || null,
        pupila_derecha: campos.pupilaDerecha || null,
        pupila_izquierda: campos.pupilaIzquierda || null,
        signos_vitales: campos.signosVitales
          .filter((signo) => signo.hora.trim() !== '')
          .map((signo) => ({
            hora: signo.hora,
            ta: signo.ta || null,
            fc: aNumeroONulo(signo.fc),
            fr: aNumeroONulo(signo.fr),
            spo2: aNumeroONulo(signo.spo2),
          })),
        lesiones: campos.lesiones,
        lesion_otro: campos.lesionOtro || null,
        glasgow_ocular: aNumeroONulo(campos.glasgowOcular),
        glasgow_verbal: aNumeroONulo(campos.glasgowVerbal),
        glasgow_motora: aNumeroONulo(campos.glasgowMotora),
        insumos_entregados: campos.insumos.filter((insumo) => insumo.trim() !== ''),
        nota_auxiliar: campos.notaAuxiliar || null,
        atendido_por: campos.atendidoPor || null,
        nota_medica: campos.notaMedica || null,
        evolucionado_por: campos.evolucionadoPor || null,
      }
      await guardarClinicoTraslado(id, datos)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar lo clínico')
    } finally {
      setGuardando(false)
    }
  }
 
  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    )
  }
 
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-sm">
        <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
          ← Volver
        </button>
 
        <form onSubmit={manejarEnvio} className="rounded-xl bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Estado del paciente</h1>
          <p className="mb-6 text-sm text-slate-500">
            Se puede guardar el avance las veces que haga falta durante el traslado.
          </p>
 
          {errorCarga && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {errorCarga}
            </p>
          )}
 
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="diagnostico">
            Diagnóstico
          </label>
          <textarea
            id="diagnostico"
            value={campos.diagnostico}
            onChange={(e) => setCampos((anterior) => ({ ...anterior, diagnostico: e.target.value }))}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
            rows={2}
          />
 
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Tratamiento</h2>
          <div className="mb-2 grid grid-cols-2 gap-1">
            {TRATAMIENTO_OPCIONES.map((opcion) => (
              <label key={opcion.valor} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={campos.tratamiento.includes(opcion.valor)}
                  onChange={() =>
                    setCampos((anterior) => ({
                      ...anterior,
                      tratamiento: alternarEnLista(anterior.tratamiento, opcion.valor),
                    }))
                  }
                />
                {opcion.etiqueta}
              </label>
            ))}
          </div>
          <input
            type="text"
            placeholder='Detalle de "Otros"'
            value={campos.tratamientoOtro}
            onChange={(e) =>
              setCampos((anterior) => ({ ...anterior, tratamientoOtro: e.target.value }))
            }
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          />
 
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Reflejo pupilar</h2>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="pupila-derecha">
            Derecha
          </label>
          <select
            id="pupila-derecha"
            value={campos.pupilaDerecha}
            onChange={(e) =>
              setCampos((anterior) => ({
                ...anterior,
                pupilaDerecha: e.target.value as ReflejoPupilar | '',
              }))
            }
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="">Sin registrar</option>
            {REFLEJO_OPCIONES.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="pupila-izquierda">
            Izquierda
          </label>
          <select
            id="pupila-izquierda"
            value={campos.pupilaIzquierda}
            onChange={(e) =>
              setCampos((anterior) => ({
                ...anterior,
                pupilaIzquierda: e.target.value as ReflejoPupilar | '',
              }))
            }
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="">Sin registrar</option>
            {REFLEJO_OPCIONES.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
 
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Signos vitales</h2>
            <button
              type="button"
              onClick={agregarSignoVital}
              className="text-sm font-medium text-blue-600"
            >
              + Agregar medición
            </button>
          </div>
          {campos.signosVitales.map((signo, indice) => (
            <div key={indice} className="mb-3 rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Medición {indice + 1}</span>
                <button
                  type="button"
                  onClick={() => quitarSignoVital(indice)}
                  className="text-xs font-medium text-red-600"
                >
                  Quitar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  aria-label={`Hora medición ${indice + 1}`}
                  value={signo.hora}
                  onChange={(e) => actualizarSignoVital(indice, 'hora', e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="TA (ej. 120/80)"
                  aria-label={`TA medición ${indice + 1}`}
                  value={signo.ta}
                  onChange={(e) => actualizarSignoVital(indice, 'ta', e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="FC"
                  aria-label={`FC medición ${indice + 1}`}
                  min={0}
                  max={300}
                  value={signo.fc}
                  onChange={(e) => actualizarSignoVital(indice, 'fc', e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="FR"
                  aria-label={`FR medición ${indice + 1}`}
                  min={0}
                  max={120}
                  value={signo.fr}
                  onChange={(e) => actualizarSignoVital(indice, 'fr', e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="SPO2"
                  aria-label={`SPO2 medición ${indice + 1}`}
                  min={0}
                  max={100}
                  value={signo.spo2}
                  onChange={(e) => actualizarSignoVital(indice, 'spo2', e.target.value)}
                  className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
 
          <h2 className="mb-3 mt-2 text-sm font-semibold text-slate-900">Localización de lesiones</h2>
          <div className="mb-2 grid grid-cols-2 gap-1">
            {LESION_OPCIONES.map((opcion) => (
              <label key={opcion.valor} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={campos.lesiones.includes(opcion.valor)}
                  onChange={() =>
                    setCampos((anterior) => ({
                      ...anterior,
                      lesiones: alternarEnLista(anterior.lesiones, opcion.valor),
                    }))
                  }
                />
                {opcion.etiqueta}
              </label>
            ))}
          </div>
          <input
            type="text"
            placeholder="Otra lesión no listada"
            value={campos.lesionOtro}
            onChange={(e) => setCampos((anterior) => ({ ...anterior, lesionOtro: e.target.value }))}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          />
 
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Escala de Glasgow</h2>
          <div className="mb-1 grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="glasgow-ocular">
                Ocular (1-4)
              </label>
              <input
                id="glasgow-ocular"
                type="number"
                min={1}
                max={4}
                value={campos.glasgowOcular}
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowOcular: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="glasgow-verbal">
                Verbal (1-5)
              </label>
              <input
                id="glasgow-verbal"
                type="number"
                min={1}
                max={5}
                value={campos.glasgowVerbal}
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowVerbal: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="glasgow-motora">
                Motora (1-6)
              </label>
              <input
                id="glasgow-motora"
                type="number"
                min={1}
                max={6}
                value={campos.glasgowMotora}
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowMotora: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Total: {glasgowTotal === null ? '— ' : glasgowTotal}/15
          </p>
 
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Insumos entregados</h2>
            <button
              type="button"
              onClick={agregarInsumo}
              disabled={campos.insumos.length >= MAX_INSUMOS}
              className="text-sm font-medium text-blue-600 disabled:text-slate-400"
            >
              + Agregar insumo
            </button>
          </div>
          {campos.insumos.map((insumo, indice) => (
            <div key={indice} className="mb-2 flex gap-2">
              <input
                type="text"
                aria-label={`Insumo ${indice + 1}`}
                value={insumo}
                onChange={(e) => actualizarInsumo(indice, e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => quitarInsumo(indice)}
                className="text-xs font-medium text-red-600"
              >
                Quitar
              </button>
            </div>
          ))}
 
          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
            Notas de enfermería durante el traslado
          </h2>
          <textarea
            value={campos.notaAuxiliar}
            onChange={(e) => setCampos((anterior) => ({ ...anterior, notaAuxiliar: e.target.value }))}
            maxLength={2000}
            rows={4}
            className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          />
          {campoTexto('Atendido por', 'atendido-por', campos.atendidoPor, (valor) =>
            setCampos((anterior) => ({ ...anterior, atendidoPor: valor })),
          )}
 
          <h2 className="mb-3 mt-4 text-sm font-semibold text-slate-900">Evolución médica</h2>
          <textarea
            value={campos.notaMedica}
            onChange={(e) => setCampos((anterior) => ({ ...anterior, notaMedica: e.target.value }))}
            maxLength={2000}
            rows={4}
            className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          />
          {campoTexto('Evolucionado por', 'evolucionado-por', campos.evolucionadoPor, (valor) =>
            setCampos((anterior) => ({ ...anterior, evolucionadoPor: valor })),
          )}
 
          {error && (
            <p role="alert" className="mb-4 mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
 
          <button
            type="submit"
            disabled={guardando}
            className="mt-2 w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </div>
    </div>
  )
}
 
function campoTexto(
  etiqueta: string,
  id: string,
  valor: string,
  onChange: (valor: string) => void,
): JSX.Element {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
      />
    </div>
  )
}
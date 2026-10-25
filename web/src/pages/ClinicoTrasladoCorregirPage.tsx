/**
 * "Corregir formato" > parte clínica de un traslado asistencial ya
 * cerrado (issue #80): segunda pantalla del flujo de corrección (ver
 * `EncabezadoTrasladoCorregirPage`), puerto de
 * `app/src/pages/ClinicoTrasladoPage.tsx` (issue #9) para el panel
 * web -- mismos campos clínicos, sin lo que solo tiene sentido
 * mientras el traslado está EN CURSO:
 *
 * - Nada de "Cerrar atención"/PIN de firma -- esta atención ya está
 *   cerrada; esta pantalla es puramente una corrección del contenido,
 *   no un segundo cierre. "Entrega del paciente" (que `app/` pedía
 *   justo antes de cerrar) ya quedó movida al encabezado -- ver la
 *   nota de módulo de `EncabezadoTrasladoCorregirPage`.
 * - Nada de roles clínicos (auxiliar/médico) ni de autocompletar con
 *   la firma guardada del perfil -- quien usa el panel es siempre un
 *   administrador, nunca el auxiliar/médico que atendió; los tres
 *   campos de firma (atendido por, evolucionó, profesional que
 *   recibe) se muestran siempre como lienzo editable, precargado con
 *   lo que ya hubiera, en vez de depender de qué rol tenga quien está
 *   logueado (mismo patrón ya usado en los tres para "profesional que
 *   recibe" en `app/`, que siempre es un tercero ajeno a la app).
 * - Nada de "qué falta para poder cerrar" -- esa validación no aplica
 *   a algo que ya está cerrado.
 * - `motivo` (issue #80): campo nuevo, obligatorio, propio de esta
 *   corrección -- no tiene que ser el mismo texto que el del
 *   encabezado, cada PUT es su propia corrección con su propio "por
 *   qué" (ver `_guardar_version` en el backend, que crea una fila de
 *   historial por cada PUT, no una por pantalla).
 *
 * Al guardar, vuelve al detalle del servicio.
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, JSX, RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DiagramaCorporal } from '../components/DiagramaCorporal'
import { FirmaCanvas, type FirmaCanvasHandle } from '../components/FirmaCanvas'
import { ApiError, guardarClinicoTraslado, listarMedicosDisponibles, obtenerFormatoTraslado } from '../lib/api'
import type {
  Empleado,
  FormatoTrasladoClinico,
  LesionLocalizada,
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
  lesionesLocalizadas: LesionLocalizada[]
  glasgowOcular: string
  glasgowVerbal: string
  glasgowMotora: string
  insumos: string[]
  notaAuxiliar: string
  atendidoPor: string
  firmaAtendidoExistente: string | null
  notaMedica: string
  evolucionadoPor: string
  firmaEvolucionadoExistente: string | null
  profesionalRecibeNombre: string
  profesionalRecibeCedula: string
  firmaProfesionalRecibeExistente: string | null
  observaciones: string
}

const ESTADO_VACIO: EstadoClinico = {
  diagnostico: '',
  tratamiento: [],
  tratamientoOtro: '',
  pupilaDerecha: 'no_reactiva',
  pupilaIzquierda: 'no_reactiva',
  signosVitales: [],
  lesionesLocalizadas: [],
  glasgowOcular: '',
  glasgowVerbal: '',
  glasgowMotora: '',
  insumos: [],
  notaAuxiliar: '',
  atendidoPor: '',
  firmaAtendidoExistente: null,
  notaMedica: '',
  evolucionadoPor: '',
  firmaEvolucionadoExistente: null,
  profesionalRecibeNombre: '',
  profesionalRecibeCedula: '',
  firmaProfesionalRecibeExistente: null,
  observaciones: '',
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

const GLASGOW_OCULAR_OPCIONES: { valor: number; etiqueta: string }[] = [
  { valor: 4, etiqueta: '4 - Espontánea' },
  { valor: 3, etiqueta: '3 - Al estímulo verbal' },
  { valor: 2, etiqueta: '2 - Al dolor' },
  { valor: 1, etiqueta: '1 - Ninguna' },
]

const GLASGOW_VERBAL_OPCIONES: { valor: number; etiqueta: string }[] = [
  { valor: 5, etiqueta: '5 - Orientado' },
  { valor: 4, etiqueta: '4 - Confuso' },
  { valor: 3, etiqueta: '3 - Palabras inapropiadas' },
  { valor: 2, etiqueta: '2 - Sonidos incomprensibles' },
  { valor: 1, etiqueta: '1 - Ninguna' },
]

const GLASGOW_MOTORA_OPCIONES: { valor: number; etiqueta: string }[] = [
  { valor: 6, etiqueta: '6 - Obedece órdenes' },
  { valor: 5, etiqueta: '5 - Localiza el dolor' },
  { valor: 4, etiqueta: '4 - Retirada al dolor' },
  { valor: 3, etiqueta: '3 - Flexión anormal' },
  { valor: 2, etiqueta: '2 - Extensión anormal' },
  { valor: 1, etiqueta: '1 - Ninguna' },
]

const MAX_INSUMOS = 8

function alternarEnLista<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]
}

function aNumeroONulo(valor: string): number | null {
  return valor === '' ? null : Number(valor)
}

function horaActual(): string {
  const ahora = new Date()
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
}

export function ClinicoTrasladoCorregirPage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = Number(atencionId)
  const firmaAtendidoRef = useRef<FirmaCanvasHandle>(null)
  const firmaEvolucionadoRef = useRef<FirmaCanvasHandle>(null)
  const firmaProfesionalRecibeRef = useRef<FirmaCanvasHandle>(null)

  const [campos, setCampos] = useState<EstadoClinico>(ESTADO_VACIO)
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [medicos, setMedicos] = useState<Empleado[] | null>(null)
  const [medicoId, setMedicoId] = useState('')

  useEffect(() => {
    listarMedicosDisponibles()
      .then(setMedicos)
      .catch(() => setMedicos([]))
  }, [])

  useEffect(() => {
    obtenerFormatoTraslado(id)
      .then((existente) => {
        setCampos({
          diagnostico: existente.diagnostico ?? '',
          tratamiento: existente.tratamiento,
          tratamientoOtro: existente.tratamiento_otro ?? '',
          pupilaDerecha: existente.pupila_derecha ?? 'no_reactiva',
          pupilaIzquierda: existente.pupila_izquierda ?? 'no_reactiva',
          signosVitales: existente.signos_vitales.map((signo) => ({
            hora: signo.hora,
            ta: signo.ta ?? '',
            fc: signo.fc === null ? '' : String(signo.fc),
            fr: signo.fr === null ? '' : String(signo.fr),
            spo2: signo.spo2 === null ? '' : String(signo.spo2),
          })),
          lesionesLocalizadas: existente.lesiones_localizadas,
          glasgowOcular: existente.glasgow_ocular === null ? '' : String(existente.glasgow_ocular),
          glasgowVerbal: existente.glasgow_verbal === null ? '' : String(existente.glasgow_verbal),
          glasgowMotora: existente.glasgow_motora === null ? '' : String(existente.glasgow_motora),
          insumos: existente.insumos_entregados,
          notaAuxiliar: existente.nota_auxiliar ?? '',
          atendidoPor: existente.atendido_por ?? '',
          firmaAtendidoExistente: existente.firma_atendido_por,
          notaMedica: existente.nota_medica ?? '',
          evolucionadoPor: existente.evolucionado_por ?? '',
          firmaEvolucionadoExistente: existente.firma_evolucionado_por,
          profesionalRecibeNombre: existente.profesional_recibe_nombre ?? '',
          profesionalRecibeCedula: existente.profesional_recibe_cedula ?? '',
          firmaProfesionalRecibeExistente: existente.firma_profesional_recibe,
          observaciones: existente.observaciones ?? '',
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
      signosVitales: [...anterior.signosVitales, { hora: horaActual(), ta: '', fc: '', fr: '', spo2: '' }],
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

  const modoOtroMedico = medicoId === 'otro' || (medicoId === '' && campos.evolucionadoPor !== '')

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    if (motivo.trim() === '') {
      setError('Indica el motivo de la corrección')
      return
    }
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
        lesiones_localizadas: campos.lesionesLocalizadas,
        glasgow_ocular: aNumeroONulo(campos.glasgowOcular),
        glasgow_verbal: aNumeroONulo(campos.glasgowVerbal),
        glasgow_motora: aNumeroONulo(campos.glasgowMotora),
        insumos_entregados: campos.insumos.filter((insumo) => insumo.trim() !== ''),
        nota_auxiliar: campos.notaAuxiliar || null,
        atendido_por: campos.atendidoPor || null,
        firma_atendido_por: firmaAtendidoRef.current?.exportar() ?? campos.firmaAtendidoExistente,
        nota_medica: campos.notaMedica || null,
        evolucionado_por: campos.evolucionadoPor || null,
        firma_evolucionado_por:
          firmaEvolucionadoRef.current?.exportar() ?? campos.firmaEvolucionadoExistente,
        profesional_recibe_nombre: campos.profesionalRecibeNombre || null,
        profesional_recibe_cedula: campos.profesionalRecibeCedula || null,
        firma_profesional_recibe:
          firmaProfesionalRecibeRef.current?.exportar() ?? campos.firmaProfesionalRecibeExistente,
        observaciones: campos.observaciones || null,
      }
      await guardarClinicoTraslado(id, datos, motivo.trim())
      navigate(`/atenciones/${id}/detalle`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la corrección')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <p className="text-slate-500">Cargando…</p>
  }

  return (
    <section>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
        ← Volver
      </button>

      <form onSubmit={manejarEnvio} className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Corregir lo clínico</h1>
        <p className="mb-6 text-sm text-slate-500">
          Esta atención ya está cerrada -- la corrección queda en el historial de versiones con el
          motivo que se indique abajo.
        </p>

        {errorCarga && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
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
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
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
          onChange={(e) => setCampos((anterior) => ({ ...anterior, tratamientoOtro: e.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />

        <h2 className="mb-3 text-sm font-semibold text-slate-900">Reflejo pupilar</h2>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="pupila-derecha">
          Derecha
        </label>
        <select
          id="pupila-derecha"
          value={campos.pupilaDerecha}
          onChange={(e) =>
            setCampos((anterior) => ({ ...anterior, pupilaDerecha: e.target.value as ReflejoPupilar | '' }))
          }
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        >
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
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        >
          {REFLEJO_OPCIONES.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Signos vitales</h2>
          <button type="button" onClick={agregarSignoVital} className="text-sm font-medium text-brand-blue">
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
                className="text-xs font-medium text-brand-orange-dark"
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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              />
              <input
                type="text"
                placeholder="TA (ej. 120/80)"
                aria-label={`TA medición ${indice + 1}`}
                value={signo.ta}
                onChange={(e) => actualizarSignoVital(indice, 'ta', e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              />
              <input
                type="number"
                placeholder="FC"
                aria-label={`FC medición ${indice + 1}`}
                min={0}
                max={300}
                value={signo.fc}
                onChange={(e) => actualizarSignoVital(indice, 'fc', e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              />
              <input
                type="number"
                placeholder="FR"
                aria-label={`FR medición ${indice + 1}`}
                min={0}
                max={120}
                value={signo.fr}
                onChange={(e) => actualizarSignoVital(indice, 'fr', e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              />
              <input
                type="number"
                placeholder="SPO2"
                aria-label={`SPO2 medición ${indice + 1}`}
                min={0}
                max={100}
                value={signo.spo2}
                onChange={(e) => actualizarSignoVital(indice, 'spo2', e.target.value)}
                className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
              />
            </div>
          </div>
        ))}

        <h2 className="mb-3 mt-2 text-sm font-semibold text-slate-900">Localización de lesiones</h2>
        <div className="mb-4">
          <DiagramaCorporal
            valor={campos.lesionesLocalizadas}
            onChange={(nuevoValor) =>
              setCampos((anterior) => ({ ...anterior, lesionesLocalizadas: nuevoValor }))
            }
          />
        </div>

        <h2 className="mb-3 text-sm font-semibold text-slate-900">Escala de Glasgow</h2>
        <div className="mb-1 grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="glasgow-ocular">
              Ocular (1-4)
            </label>
            <select
              id="glasgow-ocular"
              value={campos.glasgowOcular}
              onChange={(e) => setCampos((anterior) => ({ ...anterior, glasgowOcular: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            >
              <option value="">Sin registrar</option>
              {GLASGOW_OCULAR_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="glasgow-verbal">
              Verbal (1-5)
            </label>
            <select
              id="glasgow-verbal"
              value={campos.glasgowVerbal}
              onChange={(e) => setCampos((anterior) => ({ ...anterior, glasgowVerbal: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            >
              <option value="">Sin registrar</option>
              {GLASGOW_VERBAL_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="glasgow-motora">
              Motora (1-6)
            </label>
            <select
              id="glasgow-motora"
              value={campos.glasgowMotora}
              onChange={(e) => setCampos((anterior) => ({ ...anterior, glasgowMotora: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            >
              <option value="">Sin registrar</option>
              {GLASGOW_MOTORA_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-500">Total: {glasgowTotal === null ? '— ' : glasgowTotal}/15</p>

        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Insumos entregados</h2>
          <button
            type="button"
            onClick={agregarInsumo}
            disabled={campos.insumos.length >= MAX_INSUMOS}
            className="text-sm font-medium text-brand-blue disabled:text-slate-400"
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
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
            <button
              type="button"
              onClick={() => quitarInsumo(indice)}
              className="text-xs font-medium text-brand-orange-dark"
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
          className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />
        {campoTexto('Atendido por', 'atendido-por', campos.atendidoPor, (valor) =>
          setCampos((anterior) => ({ ...anterior, atendidoPor: valor })),
        )}
        <FirmaField
          etiqueta="Firma de quien atendió"
          imagenInicial={campos.firmaAtendidoExistente}
          canvasRef={firmaAtendidoRef}
        />

        <label htmlFor="nota-medica" className="mb-3 mt-4 block text-sm font-semibold text-slate-900">
          Evolución médica
        </label>
        <textarea
          id="nota-medica"
          value={campos.notaMedica}
          onChange={(e) => setCampos((anterior) => ({ ...anterior, notaMedica: e.target.value }))}
          maxLength={2000}
          rows={4}
          disabled={campos.evolucionadoPor.trim() === ''}
          className="mb-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
        />
        {campos.evolucionadoPor.trim() === '' && (
          <p className="mb-2 text-xs text-slate-500">
            Elige un médico o escribe su nombre para habilitar la nota médica.
          </p>
        )}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="medico-evoluciono">
            Médico que evolucionó
          </label>
          <select
            id="medico-evoluciono"
            value={medicoId}
            onChange={(e) => {
              const valor = e.target.value
              setMedicoId(valor)
              if (valor === '' || valor === 'otro') return
              const medico = medicos?.find((m) => String(m.id) === valor)
              if (medico) {
                setCampos((anterior) => ({
                  ...anterior,
                  evolucionadoPor: `${medico.nombres} ${medico.apellidos}`,
                }))
              }
            }}
            className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
          >
            <option value="">
              {medicos === null
                ? 'Cargando médicos…'
                : medicos.length === 0
                  ? 'No hay médicos de planta registrados'
                  : 'Elige un médico de planta'}
            </option>
            {medicos?.map((medico) => (
              <option key={medico.id} value={medico.id}>
                {medico.nombres} {medico.apellidos}
              </option>
            ))}
            <option value="otro">Otro (escribir el nombre)</option>
          </select>
        </div>
        {modoOtroMedico &&
          campoTexto('Nombre del médico', 'evolucionado-por', campos.evolucionadoPor, (valor) =>
            setCampos((anterior) => ({ ...anterior, evolucionadoPor: valor })),
          )}
        <FirmaField
          etiqueta="Firma de quien evolucionó"
          imagenInicial={campos.firmaEvolucionadoExistente}
          canvasRef={firmaEvolucionadoRef}
          disabled={campos.evolucionadoPor.trim() === ''}
        />

        <h2 className="mb-3 mt-4 text-sm font-semibold text-slate-900">
          Profesional que recibe en la IPS/ESE
        </h2>
        {campoTexto(
          'Nombre de quien recibe',
          'profesional-recibe-nombre',
          campos.profesionalRecibeNombre,
          (valor) => setCampos((anterior) => ({ ...anterior, profesionalRecibeNombre: valor })),
        )}
        {campoTexto(
          'Cédula de quien recibe',
          'profesional-recibe-cedula',
          campos.profesionalRecibeCedula,
          (valor) => setCampos((anterior) => ({ ...anterior, profesionalRecibeCedula: valor })),
        )}
        <FirmaField
          etiqueta="Firma de quien recibe"
          imagenInicial={campos.firmaProfesionalRecibeExistente}
          canvasRef={firmaProfesionalRecibeRef}
        />

        <h2 className="mb-3 mt-4 text-sm font-semibold text-slate-900">Observaciones</h2>
        <textarea
          value={campos.observaciones}
          onChange={(e) => setCampos((anterior) => ({ ...anterior, observaciones: e.target.value }))}
          maxLength={2000}
          rows={3}
          className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Motivo de la corrección</h2>
        <label className="sr-only" htmlFor="motivo">
          Motivo de la corrección
        </label>
        <textarea
          id="motivo"
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Por qué se está corrigiendo esta parte clínica"
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />

        {error && (
          <p role="alert" className="mb-4 mt-4 text-sm text-brand-orange-dark">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="mt-2 w-full rounded-lg bg-brand-blue py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar corrección'}
        </button>
      </form>
    </section>
  )
}

function FirmaField({
  etiqueta,
  imagenInicial,
  canvasRef,
  disabled,
}: {
  etiqueta: string
  imagenInicial: string | null
  canvasRef: RefObject<FirmaCanvasHandle | null>
  disabled?: boolean
}): JSX.Element {
  return (
    <div className="mb-4">
      <h3 className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</h3>
      <FirmaCanvas ref={canvasRef} imagenInicial={imagenInicial} alto={120} disabled={disabled} />
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
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
      />
    </div>
  )
}
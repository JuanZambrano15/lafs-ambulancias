/**
 * "Corregir formato" de un accidente SOAT ya cerrado (issue #80,
 * ajuste) -- una sola pantalla con encabezado + parte clínica, igual
 * criterio que `CorregirFormatoTrasladoPage` (ver su nota de módulo
 * para el porqué): reemplaza las dos pantallas separadas que había
 * antes (`EncabezadoAccidenteSoatCorregirPage` +
 * `ClinicoAccidenteSoatCorregirPage`, ambas eliminadas), que pedían
 * el motivo dos veces y dejaban dos filas de historial por una sola
 * corrección lógica.
 *
 * Al guardar, vuelve al detalle del servicio.
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, JSX, RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DiagramaCorporal } from '../components/DiagramaCorporal'
import { FirmaCanvas, type FirmaCanvasHandle } from '../components/FirmaCanvas'
import {
  ApiError,
  corregirFormatoAccidenteSoat,
  listarMedicosDisponibles,
  obtenerFormatoAccidenteSoat,
} from '../lib/api'
import type {
  Empleado,
  FormatoAccidenteSoatClinico,
  FormatoAccidenteSoatEncabezado,
  LesionLocalizada,
  ReflejoPupilar,
  RolVictima,
  SexoPaciente,
  TipoDocumentoPaciente,
  TratamientoAplicado,
  TriageNivel,
} from '../lib/types'

interface CamposEncabezado {
  fecha_atencion: string
  hora_atencion: string
  hora_entrega: string
  identificado: boolean
  paciente_tipo_documento: TipoDocumentoPaciente
  paciente_numero_documento: string
  paciente_aseguradora: string
  paciente_nombres: string
  paciente_apellidos: string
  paciente_edad: string
  paciente_sexo: SexoPaciente
  lugar_ocurrencia: string
  ciudad: string
  telefono_contacto: string
  rol_victima: RolVictima
  poliza_vigente_desde: string
  poliza_vigente_hasta: string
  numero_poliza: string
  vehiculo_placa: string
  vehiculo_tipo: string
  vehiculo_marca: string
}

const ENCABEZADO_VACIO: CamposEncabezado = {
  fecha_atencion: '',
  hora_atencion: '',
  hora_entrega: '',
  identificado: true,
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '',
  paciente_aseguradora: '',
  paciente_nombres: '',
  paciente_apellidos: '',
  paciente_edad: '',
  paciente_sexo: 'm',
  lugar_ocurrencia: '',
  ciudad: '',
  telefono_contacto: '',
  rol_victima: 'conductor',
  poliza_vigente_desde: '',
  poliza_vigente_hasta: '',
  numero_poliza: '',
  vehiculo_placa: '',
  vehiculo_tipo: '',
  vehiculo_marca: '',
}

interface SignoVitalForm {
  hora: string
  ta: string
  fc: string
  fr: string
  spo2: string
}

interface CamposClinico {
  tratamiento: TratamientoAplicado[]
  tratamientoOtro: string
  pupilaDerecha: ReflejoPupilar | ''
  pupilaIzquierda: ReflejoPupilar | ''
  signosVitales: SignoVitalForm[]
  lesionesLocalizadas: LesionLocalizada[]
  glasgowOcular: string
  glasgowVerbal: string
  glasgowMotora: string
  triage: TriageNivel | ''
  descripcion: string
  notaAuxiliar: string
  atendidoPor: string
  firmaAtendidoExistente: string | null
  notaMedica: string
  evolucionadoPor: string
  firmaEvolucionadoExistente: string | null
  profesionalRecibeNombre: string
  profesionalRecibeCedula: string
  firmaProfesionalRecibeExistente: string | null
}

const CLINICO_VACIO: CamposClinico = {
  tratamiento: [],
  tratamientoOtro: '',
  pupilaDerecha: '',
  pupilaIzquierda: '',
  signosVitales: [],
  lesionesLocalizadas: [],
  glasgowOcular: '',
  glasgowVerbal: '',
  glasgowMotora: '',
  triage: '',
  descripcion: '',
  notaAuxiliar: '',
  atendidoPor: '',
  firmaAtendidoExistente: null,
  notaMedica: '',
  evolucionadoPor: '',
  firmaEvolucionadoExistente: null,
  profesionalRecibeNombre: '',
  profesionalRecibeCedula: '',
  firmaProfesionalRecibeExistente: null,
}

const TIPOS_DOCUMENTO: { valor: TipoDocumentoPaciente; etiqueta: string }[] = [
  { valor: 'rc', etiqueta: 'Registro Civil' },
  { valor: 'ti', etiqueta: 'Tarjeta de Identidad' },
  { valor: 'cc', etiqueta: 'Cédula de Ciudadanía' },
  { valor: 'ce', etiqueta: 'Cédula de Extranjería' },
  { valor: 'ppt', etiqueta: 'Permiso de Protección Temporal' },
]

const ROLES_VICTIMA: { valor: RolVictima; etiqueta: string }[] = [
  { valor: 'conductor', etiqueta: 'Conductor' },
  { valor: 'pasajero', etiqueta: 'Pasajero' },
  { valor: 'parrillero', etiqueta: 'Parrillero' },
  { valor: 'peaton', etiqueta: 'Peatón' },
  { valor: 'otro', etiqueta: 'Otro' },
]

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

const TRIAGE_OPCIONES: { valor: TriageNivel; etiqueta: string }[] = [
  { valor: 'i', etiqueta: 'I - Prioridad inmediata' },
  { valor: 'ii', etiqueta: 'II - Prioridad urgente' },
  { valor: 'iii', etiqueta: 'III - Prioridad no urgente' },
]

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

function campoRequerido(
  label: string,
  id: string,
  props: JSX.IntrinsicElements['input'],
): JSX.Element {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
        {...props}
      />
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

export function CorregirFormatoAccidenteSoatPage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = Number(atencionId)
  const firmaAtendidoRef = useRef<FirmaCanvasHandle>(null)
  const firmaEvolucionadoRef = useRef<FirmaCanvasHandle>(null)
  const firmaProfesionalRecibeRef = useRef<FirmaCanvasHandle>(null)

  const [encabezado, setEncabezado] = useState<CamposEncabezado>(ENCABEZADO_VACIO)
  const [clinico, setClinico] = useState<CamposClinico>(CLINICO_VACIO)
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
    obtenerFormatoAccidenteSoat(id)
      .then((existente) => {
        setEncabezado({
          fecha_atencion: existente.fecha_atencion,
          hora_atencion: existente.hora_atencion,
          hora_entrega: existente.hora_entrega ?? '',
          identificado: existente.identificado,
          paciente_tipo_documento: existente.paciente_tipo_documento ?? 'cc',
          paciente_numero_documento: existente.paciente_numero_documento ?? '',
          paciente_aseguradora: existente.paciente_aseguradora ?? '',
          paciente_nombres: existente.paciente_nombres ?? '',
          paciente_apellidos: existente.paciente_apellidos ?? '',
          paciente_edad: existente.paciente_edad === null ? '' : String(existente.paciente_edad),
          paciente_sexo: existente.paciente_sexo ?? 'm',
          lugar_ocurrencia: existente.lugar_ocurrencia,
          ciudad: existente.ciudad,
          telefono_contacto: existente.telefono_contacto ?? '',
          rol_victima: existente.rol_victima,
          poliza_vigente_desde: existente.poliza_vigente_desde ?? '',
          poliza_vigente_hasta: existente.poliza_vigente_hasta ?? '',
          numero_poliza: existente.numero_poliza ?? '',
          vehiculo_placa: existente.vehiculo_placa ?? '',
          vehiculo_tipo: existente.vehiculo_tipo ?? '',
          vehiculo_marca: existente.vehiculo_marca ?? '',
        })
        setClinico({
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
          lesionesLocalizadas: existente.lesiones_localizadas,
          glasgowOcular: existente.glasgow_ocular === null ? '' : String(existente.glasgow_ocular),
          glasgowVerbal: existente.glasgow_verbal === null ? '' : String(existente.glasgow_verbal),
          glasgowMotora: existente.glasgow_motora === null ? '' : String(existente.glasgow_motora),
          triage: existente.triage ?? '',
          descripcion: existente.descripcion ?? '',
          notaAuxiliar: existente.nota_auxiliar ?? '',
          atendidoPor: existente.atendido_por ?? '',
          firmaAtendidoExistente: existente.firma_atendido_por,
          notaMedica: existente.nota_medica ?? '',
          evolucionadoPor: existente.evolucionado_por ?? '',
          firmaEvolucionadoExistente: existente.firma_evolucionado_por,
          profesionalRecibeNombre: existente.profesional_recibe_nombre ?? '',
          profesionalRecibeCedula: existente.profesional_recibe_cedula ?? '',
          firmaProfesionalRecibeExistente: existente.firma_profesional_recibe,
        })
      })
      .catch((err: unknown) => {
        setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el formato')
      })
      .finally(() => setCargando(false))
  }, [id])

  function actualizarEncabezado<K extends keyof CamposEncabezado>(
    campo: K,
    valor: CamposEncabezado[K],
  ): void {
    setEncabezado((anterior) => ({ ...anterior, [campo]: valor }))
  }

  function agregarSignoVital(): void {
    setClinico((anterior) => ({
      ...anterior,
      signosVitales: [...anterior.signosVitales, { hora: horaActual(), ta: '', fc: '', fr: '', spo2: '' }],
    }))
  }

  function quitarSignoVital(indice: number): void {
    setClinico((anterior) => ({
      ...anterior,
      signosVitales: anterior.signosVitales.filter((_, i) => i !== indice),
    }))
  }

  function actualizarSignoVital(indice: number, campo: keyof SignoVitalForm, valor: string): void {
    setClinico((anterior) => ({
      ...anterior,
      signosVitales: anterior.signosVitales.map((signo, i) =>
        i === indice ? { ...signo, [campo]: valor } : signo,
      ),
    }))
  }

  const glasgowTotal =
    clinico.glasgowOcular !== '' && clinico.glasgowVerbal !== '' && clinico.glasgowMotora !== ''
      ? Number(clinico.glasgowOcular) + Number(clinico.glasgowVerbal) + Number(clinico.glasgowMotora)
      : null

  const modoOtroMedico = medicoId === 'otro' || (medicoId === '' && clinico.evolucionadoPor !== '')

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    if (motivo.trim() === '') {
      setError('Indica el motivo de la corrección')
      return
    }
    setGuardando(true)
    try {
      const datosEncabezado: FormatoAccidenteSoatEncabezado = {
        fecha_atencion: encabezado.fecha_atencion,
        hora_atencion: encabezado.hora_atencion,
        hora_entrega: encabezado.hora_entrega || null,
        identificado: encabezado.identificado,
        paciente_tipo_documento: encabezado.identificado ? encabezado.paciente_tipo_documento : null,
        paciente_numero_documento: encabezado.identificado
          ? encabezado.paciente_numero_documento || null
          : null,
        paciente_aseguradora: encabezado.identificado ? encabezado.paciente_aseguradora || null : null,
        paciente_nombres: encabezado.identificado ? encabezado.paciente_nombres || null : null,
        paciente_apellidos: encabezado.identificado ? encabezado.paciente_apellidos || null : null,
        paciente_edad: encabezado.identificado ? aNumeroONulo(encabezado.paciente_edad) : null,
        paciente_sexo: encabezado.identificado ? encabezado.paciente_sexo : null,
        lugar_ocurrencia: encabezado.lugar_ocurrencia,
        ciudad: encabezado.ciudad,
        telefono_contacto: encabezado.telefono_contacto || null,
        rol_victima: encabezado.rol_victima,
        poliza_vigente_desde: encabezado.poliza_vigente_desde || null,
        poliza_vigente_hasta: encabezado.poliza_vigente_hasta || null,
        numero_poliza: encabezado.numero_poliza || null,
        vehiculo_placa: encabezado.vehiculo_placa || null,
        vehiculo_tipo: encabezado.vehiculo_tipo || null,
        vehiculo_marca: encabezado.vehiculo_marca || null,
      }
      const datosClinico: FormatoAccidenteSoatClinico = {
        tratamiento: clinico.tratamiento,
        tratamiento_otro: clinico.tratamientoOtro || null,
        pupila_derecha: clinico.pupilaDerecha || null,
        pupila_izquierda: clinico.pupilaIzquierda || null,
        signos_vitales: clinico.signosVitales
          .filter((signo) => signo.hora.trim() !== '')
          .map((signo) => ({
            hora: signo.hora,
            ta: signo.ta || null,
            fc: aNumeroONulo(signo.fc),
            fr: aNumeroONulo(signo.fr),
            spo2: aNumeroONulo(signo.spo2),
          })),
        lesiones_localizadas: clinico.lesionesLocalizadas,
        glasgow_ocular: aNumeroONulo(clinico.glasgowOcular),
        glasgow_verbal: aNumeroONulo(clinico.glasgowVerbal),
        glasgow_motora: aNumeroONulo(clinico.glasgowMotora),
        triage: clinico.triage || null,
        descripcion: clinico.descripcion || null,
        nota_auxiliar: clinico.notaAuxiliar || null,
        atendido_por: clinico.atendidoPor || null,
        firma_atendido_por: firmaAtendidoRef.current?.exportar() ?? clinico.firmaAtendidoExistente,
        nota_medica: clinico.notaMedica || null,
        evolucionado_por: clinico.evolucionadoPor || null,
        firma_evolucionado_por:
          firmaEvolucionadoRef.current?.exportar() ?? clinico.firmaEvolucionadoExistente,
        profesional_recibe_nombre: clinico.profesionalRecibeNombre || null,
        profesional_recibe_cedula: clinico.profesionalRecibeCedula || null,
        firma_profesional_recibe:
          firmaProfesionalRecibeRef.current?.exportar() ?? clinico.firmaProfesionalRecibeExistente,
      }
      await corregirFormatoAccidenteSoat(id, { ...datosEncabezado, ...datosClinico }, motivo.trim())
      navigate(`/atenciones/${id}/detalle`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la corrección')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <p className="text-slate-500">Cargando formato…</p>
  }

  return (
    <section>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
        ← Volver
      </button>

      <form onSubmit={manejarEnvio} className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Corregir formato</h1>
        <p className="mb-6 text-sm text-slate-500">
          Esta atención ya está cerrada -- la corrección queda en el historial de versiones con el
          motivo que se indique abajo. Las notas, la descripción y quién las firma nunca aparecen
          en el historial.
        </p>

        {errorCarga && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {errorCarga}
          </p>
        )}

        <h2 className="mb-3 text-sm font-semibold text-slate-900">Datos de la atención</h2>
        {campoRequerido('Fecha', 'fecha-atencion', {
          required: true,
          type: 'date',
          value: encabezado.fecha_atencion,
          onChange: (e) => actualizarEncabezado('fecha_atencion', e.target.value),
        })}
        {campoRequerido('Hora de atención', 'hora-atencion', {
          required: true,
          type: 'time',
          value: encabezado.hora_atencion,
          onChange: (e) => actualizarEncabezado('hora_atencion', e.target.value),
        })}
        {campoRequerido('Hora de entrega (opcional)', 'hora-entrega', {
          type: 'time',
          value: encabezado.hora_entrega,
          onChange: (e) => actualizarEncabezado('hora_entrega', e.target.value),
        })}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Paciente</h2>
        <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={encabezado.identificado}
            onChange={(e) => actualizarEncabezado('identificado', e.target.checked)}
          />
          Paciente identificado
        </label>
        {!encabezado.identificado && (
          <p className="mb-4 text-sm text-brand-amber-dark">
            Se registrará como NN. Los datos de identidad se pueden completar después.
          </p>
        )}
        {encabezado.identificado && (
          <>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tipo-documento">
              Tipo de documento
            </label>
            <select
              id="tipo-documento"
              value={encabezado.paciente_tipo_documento}
              onChange={(e) =>
                actualizarEncabezado('paciente_tipo_documento', e.target.value as TipoDocumentoPaciente)
              }
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
            >
              {TIPOS_DOCUMENTO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
            {campoRequerido('Número de documento', 'numero-documento', {
              value: encabezado.paciente_numero_documento,
              onChange: (e) => actualizarEncabezado('paciente_numero_documento', e.target.value),
            })}
            {campoRequerido('Aseguradora (EPS/ARL)', 'aseguradora', {
              value: encabezado.paciente_aseguradora,
              onChange: (e) => actualizarEncabezado('paciente_aseguradora', e.target.value),
            })}
            {campoRequerido('Nombres', 'nombres', {
              value: encabezado.paciente_nombres,
              onChange: (e) => actualizarEncabezado('paciente_nombres', e.target.value),
            })}
            {campoRequerido('Apellidos', 'apellidos', {
              value: encabezado.paciente_apellidos,
              onChange: (e) => actualizarEncabezado('paciente_apellidos', e.target.value),
            })}
            {campoRequerido('Edad', 'edad', {
              type: 'number',
              min: 0,
              value: encabezado.paciente_edad,
              onChange: (e) => actualizarEncabezado('paciente_edad', e.target.value),
            })}
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="sexo">
              Sexo
            </label>
            <select
              id="sexo"
              value={encabezado.paciente_sexo}
              onChange={(e) => actualizarEncabezado('paciente_sexo', e.target.value as SexoPaciente)}
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
            >
              <option value="m">Masculino</option>
              <option value="f">Femenino</option>
            </select>
          </>
        )}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Datos de recogida</h2>
        {campoRequerido('Lugar de ocurrencia', 'lugar-ocurrencia', {
          required: true,
          value: encabezado.lugar_ocurrencia,
          onChange: (e) => actualizarEncabezado('lugar_ocurrencia', e.target.value),
        })}
        {campoRequerido('Ciudad', 'ciudad', {
          required: true,
          value: encabezado.ciudad,
          onChange: (e) => actualizarEncabezado('ciudad', e.target.value),
        })}
        {campoRequerido('Teléfono de contacto (opcional)', 'telefono-contacto', {
          value: encabezado.telefono_contacto,
          onChange: (e) => actualizarEncabezado('telefono_contacto', e.target.value),
        })}
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="rol-victima">
          Rol de la víctima
        </label>
        <select
          id="rol-victima"
          value={encabezado.rol_victima}
          onChange={(e) => actualizarEncabezado('rol_victima', e.target.value as RolVictima)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        >
          {ROLES_VICTIMA.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
          Vehículo accidentado (opcional)
        </h2>
        {campoRequerido('Placa del vehículo', 'vehiculo-placa', {
          value: encabezado.vehiculo_placa,
          onChange: (e) => actualizarEncabezado('vehiculo_placa', e.target.value),
        })}
        {campoRequerido('Tipo de vehículo', 'vehiculo-tipo', {
          value: encabezado.vehiculo_tipo,
          onChange: (e) => actualizarEncabezado('vehiculo_tipo', e.target.value),
        })}
        {campoRequerido('Marca del vehículo', 'vehiculo-marca', {
          value: encabezado.vehiculo_marca,
          onChange: (e) => actualizarEncabezado('vehiculo_marca', e.target.value),
        })}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Póliza (opcional)</h2>
        {campoRequerido('Número de póliza', 'numero-poliza', {
          value: encabezado.numero_poliza,
          onChange: (e) => actualizarEncabezado('numero_poliza', e.target.value),
        })}
        {campoRequerido('Vigente desde', 'poliza-desde', {
          type: 'date',
          value: encabezado.poliza_vigente_desde,
          onChange: (e) => actualizarEncabezado('poliza_vigente_desde', e.target.value),
        })}
        {campoRequerido('Vigente hasta', 'poliza-hasta', {
          type: 'date',
          value: encabezado.poliza_vigente_hasta,
          onChange: (e) => actualizarEncabezado('poliza_vigente_hasta', e.target.value),
        })}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Tratamiento</h2>
        <div className="mb-2 grid grid-cols-2 gap-1">
          {TRATAMIENTO_OPCIONES.map((opcion) => (
            <label key={opcion.valor} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={clinico.tratamiento.includes(opcion.valor)}
                onChange={() =>
                  setClinico((anterior) => ({
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
          value={clinico.tratamientoOtro}
          onChange={(e) => setClinico((anterior) => ({ ...anterior, tratamientoOtro: e.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />

        <h2 className="mb-3 text-sm font-semibold text-slate-900">Reflejo pupilar</h2>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="pupila-derecha">
          Derecha
        </label>
        <select
          id="pupila-derecha"
          value={clinico.pupilaDerecha}
          onChange={(e) =>
            setClinico((anterior) => ({ ...anterior, pupilaDerecha: e.target.value as ReflejoPupilar | '' }))
          }
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
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
          value={clinico.pupilaIzquierda}
          onChange={(e) =>
            setClinico((anterior) => ({
              ...anterior,
              pupilaIzquierda: e.target.value as ReflejoPupilar | '',
            }))
          }
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
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
          <button type="button" onClick={agregarSignoVital} className="text-sm font-medium text-brand-blue">
            + Agregar medición
          </button>
        </div>
        {clinico.signosVitales.map((signo, indice) => (
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
            valor={clinico.lesionesLocalizadas}
            onChange={(nuevoValor) =>
              setClinico((anterior) => ({ ...anterior, lesionesLocalizadas: nuevoValor }))
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
              value={clinico.glasgowOcular}
              onChange={(e) => setClinico((anterior) => ({ ...anterior, glasgowOcular: e.target.value }))}
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
              value={clinico.glasgowVerbal}
              onChange={(e) => setClinico((anterior) => ({ ...anterior, glasgowVerbal: e.target.value }))}
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
              value={clinico.glasgowMotora}
              onChange={(e) => setClinico((anterior) => ({ ...anterior, glasgowMotora: e.target.value }))}
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

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="triage">
          Triage
        </label>
        <select
          id="triage"
          value={clinico.triage}
          onChange={(e) => setClinico((anterior) => ({ ...anterior, triage: e.target.value as TriageNivel | '' }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        >
          <option value="">Sin registrar</option>
          {TRIAGE_OPCIONES.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>

        <label className="mb-1 mt-6 block text-sm font-semibold text-slate-900" htmlFor="descripcion">
          Descripción de la atención
        </label>
        <textarea
          id="descripcion"
          value={clinico.descripcion}
          onChange={(e) => setClinico((anterior) => ({ ...anterior, descripcion: e.target.value }))}
          maxLength={2000}
          rows={4}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />

        <label className="mb-1 mt-6 block text-sm font-semibold text-slate-900" htmlFor="nota-auxiliar">
          Notas de enfermería
        </label>
        <textarea
          id="nota-auxiliar"
          value={clinico.notaAuxiliar}
          onChange={(e) => setClinico((anterior) => ({ ...anterior, notaAuxiliar: e.target.value }))}
          maxLength={2000}
          rows={4}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />

        <h2 className="mb-3 text-sm font-semibold text-slate-900">Atendido por</h2>
        {campoTexto('Nombre del auxiliar', 'atendido-por', clinico.atendidoPor, (valor) =>
          setClinico((anterior) => ({ ...anterior, atendidoPor: valor })),
        )}
        <FirmaField
          etiqueta="Firma de quien atendió"
          imagenInicial={clinico.firmaAtendidoExistente}
          canvasRef={firmaAtendidoRef}
        />

        <label htmlFor="nota-medica" className="mb-1 mt-4 block text-sm font-semibold text-slate-900">
          Notas del médico
        </label>
        <textarea
          id="nota-medica"
          value={clinico.notaMedica}
          onChange={(e) => setClinico((anterior) => ({ ...anterior, notaMedica: e.target.value }))}
          maxLength={2000}
          rows={4}
          disabled={clinico.evolucionadoPor.trim() === ''}
          className="mb-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
        />
        {clinico.evolucionadoPor.trim() === '' && (
          <p className="mb-2 text-xs text-slate-500">
            Elige un médico o escribe su nombre para habilitar la nota médica.
          </p>
        )}

        <h2 className="mb-3 mt-4 text-sm font-semibold text-slate-900">Médico que participó (opcional)</h2>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="medico-evoluciono">
            Médico
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
                setClinico((anterior) => ({
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
                  : 'Ninguno participó / elige un médico de planta'}
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
          campoTexto('Nombre del médico', 'evolucionado-por', clinico.evolucionadoPor, (valor) =>
            setClinico((anterior) => ({ ...anterior, evolucionadoPor: valor })),
          )}
        <FirmaField
          etiqueta="Firma de quien evolucionó"
          imagenInicial={clinico.firmaEvolucionadoExistente}
          canvasRef={firmaEvolucionadoRef}
          disabled={clinico.evolucionadoPor.trim() === ''}
        />

        <h2 className="mb-3 mt-4 text-sm font-semibold text-slate-900">
          Profesional que recibe en la IPS/ESE
        </h2>
        {campoTexto(
          'Nombre de quien recibe',
          'profesional-recibe-nombre',
          clinico.profesionalRecibeNombre,
          (valor) => setClinico((anterior) => ({ ...anterior, profesionalRecibeNombre: valor })),
        )}
        {campoTexto(
          'Cédula de quien recibe',
          'profesional-recibe-cedula',
          clinico.profesionalRecibeCedula,
          (valor) => setClinico((anterior) => ({ ...anterior, profesionalRecibeCedula: valor })),
        )}
        <FirmaField
          etiqueta="Firma de quien recibe"
          imagenInicial={clinico.firmaProfesionalRecibeExistente}
          canvasRef={firmaProfesionalRecibeRef}
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
          placeholder="Por qué se está corrigiendo este formato"
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
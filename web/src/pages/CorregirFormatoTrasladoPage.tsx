/**
 * "Corregir formato" de un traslado asistencial ya cerrado (issue
 * #80, ajuste): una sola pantalla con encabezado + parte clínica,
 * reemplaza las dos pantallas separadas que había antes
 * (`EncabezadoTrasladoCorregirPage` + `ClinicoTrasladoCorregirPage`,
 * ambas eliminadas) -- el backend ya solo acepta una corrección de
 * administrador combinada, `PUT .../formato-traslado/corregir`, con
 * un único `motivo` (ver esa función en `atenciones.py` para el
 * porqué: dos PUT independientes para una sola corrección lógica
 * producían dos filas de historial y pedían el motivo dos veces).
 *
 * Los campos y su adaptación al panel web (sin cola sin conexión, sin
 * roles clínicos, "entrega del paciente" como sección más del
 * encabezado) son los mismos que tenían esas dos pantallas -- ver sus
 * notas de módulo originales, ahora fusionadas acá.
 *
 * Al guardar, vuelve al detalle del servicio.
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, JSX, RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DiagramaCorporal } from '../components/DiagramaCorporal'
import { FirmaCanvas, type FirmaCanvasHandle } from '../components/FirmaCanvas'
import { ApiError, corregirFormatoTraslado, listarMedicosDisponibles, obtenerFormatoTraslado } from '../lib/api'
import type {
  CategoriaPaciente,
  ComplejidadTraslado,
  Empleado,
  FormatoTrasladoClinico,
  FormatoTrasladoEncabezado,
  LesionLocalizada,
  ModalidadTraslado,
  NivelServicioTraslado,
  ReflejoPupilar,
  SexoPaciente,
  TipoDocumentoPaciente,
  TratamientoAplicado,
} from '../lib/types'

interface CamposEncabezado {
  paciente_tipo_documento: TipoDocumentoPaciente
  paciente_numero_documento: string
  paciente_eps: string
  paciente_nombres: string
  paciente_apellidos: string
  paciente_edad: string
  paciente_sexo: SexoPaciente
  paciente_direccion_residencial: string
  paciente_ciudad: string
  paciente_telefono: string
  acompanante_nombres_apellidos: string
  acompanante_parentesco: string
  acompanante_telefono: string
  recepcion_fecha: string
  recepcion_hora: string
  recepcion_ciudad: string
  recepcion_ips: string
  recepcion_servicio: string
  entrega_fecha: string
  entrega_hora: string
  entrega_ciudad: string
  entrega_ips: string
  entrega_servicio: string
  complejidad: ComplejidadTraslado
  categoria_paciente: CategoriaPaciente
  nivel_servicio: NivelServicioTraslado
  modalidad: ModalidadTraslado
}

const ENCABEZADO_VACIO: CamposEncabezado = {
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '',
  paciente_eps: '',
  paciente_nombres: '',
  paciente_apellidos: '',
  paciente_edad: '',
  paciente_sexo: 'm',
  paciente_direccion_residencial: '',
  paciente_ciudad: '',
  paciente_telefono: '',
  acompanante_nombres_apellidos: '',
  acompanante_parentesco: '',
  acompanante_telefono: '',
  recepcion_fecha: '',
  recepcion_hora: '',
  recepcion_ciudad: '',
  recepcion_ips: '',
  recepcion_servicio: '',
  entrega_fecha: '',
  entrega_hora: '',
  entrega_ciudad: '',
  entrega_ips: '',
  entrega_servicio: '',
  complejidad: 'baja',
  categoria_paciente: 'adulto',
  nivel_servicio: 'basico',
  modalidad: 'sencillo',
}

interface SignoVitalForm {
  hora: string
  ta: string
  fc: string
  fr: string
  spo2: string
}

interface CamposClinico {
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

const CLINICO_VACIO: CamposClinico = {
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

const TIPOS_DOCUMENTO: { valor: TipoDocumentoPaciente; etiqueta: string }[] = [
  { valor: 'rc', etiqueta: 'Registro Civil' },
  { valor: 'ti', etiqueta: 'Tarjeta de Identidad' },
  { valor: 'cc', etiqueta: 'Cédula de Ciudadanía' },
  { valor: 'ce', etiqueta: 'Cédula de Extranjería' },
  { valor: 'ppt', etiqueta: 'Permiso de Protección Temporal' },
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
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
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

export function CorregirFormatoTrasladoPage(): JSX.Element {
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
    obtenerFormatoTraslado(id)
      .then((existente) => {
        setEncabezado({
          paciente_tipo_documento: existente.paciente_tipo_documento,
          paciente_numero_documento: existente.paciente_numero_documento,
          paciente_eps: existente.paciente_eps,
          paciente_nombres: existente.paciente_nombres,
          paciente_apellidos: existente.paciente_apellidos,
          paciente_edad: String(existente.paciente_edad),
          paciente_sexo: existente.paciente_sexo,
          paciente_direccion_residencial: existente.paciente_direccion_residencial,
          paciente_ciudad: existente.paciente_ciudad,
          paciente_telefono: existente.paciente_telefono ?? '',
          acompanante_nombres_apellidos: existente.acompanante_nombres_apellidos ?? '',
          acompanante_parentesco: existente.acompanante_parentesco ?? '',
          acompanante_telefono: existente.acompanante_telefono ?? '',
          recepcion_fecha: existente.recepcion_fecha,
          recepcion_hora: existente.recepcion_hora,
          recepcion_ciudad: existente.recepcion_ciudad,
          recepcion_ips: existente.recepcion_ips,
          recepcion_servicio: existente.recepcion_servicio,
          entrega_fecha: existente.entrega_fecha ?? '',
          entrega_hora: existente.entrega_hora ?? '',
          entrega_ciudad: existente.entrega_ciudad ?? '',
          entrega_ips: existente.entrega_ips ?? '',
          entrega_servicio: existente.entrega_servicio ?? '',
          complejidad: existente.complejidad,
          categoria_paciente: existente.categoria_paciente,
          nivel_servicio: existente.nivel_servicio,
          modalidad: existente.modalidad,
        })
        setClinico({
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

  function agregarInsumo(): void {
    setClinico((anterior) =>
      anterior.insumos.length >= MAX_INSUMOS
        ? anterior
        : { ...anterior, insumos: [...anterior.insumos, ''] },
    )
  }

  function quitarInsumo(indice: number): void {
    setClinico((anterior) => ({
      ...anterior,
      insumos: anterior.insumos.filter((_, i) => i !== indice),
    }))
  }

  function actualizarInsumo(indice: number, valor: string): void {
    setClinico((anterior) => ({
      ...anterior,
      insumos: anterior.insumos.map((insumo, i) => (i === indice ? valor : insumo)),
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
      const datosEncabezado: FormatoTrasladoEncabezado = {
        paciente_tipo_documento: encabezado.paciente_tipo_documento,
        paciente_numero_documento: encabezado.paciente_numero_documento,
        paciente_eps: encabezado.paciente_eps,
        paciente_nombres: encabezado.paciente_nombres,
        paciente_apellidos: encabezado.paciente_apellidos,
        paciente_edad: Number(encabezado.paciente_edad),
        paciente_sexo: encabezado.paciente_sexo,
        paciente_direccion_residencial: encabezado.paciente_direccion_residencial,
        paciente_ciudad: encabezado.paciente_ciudad,
        paciente_telefono: encabezado.paciente_telefono || null,
        acompanante_nombres_apellidos: encabezado.acompanante_nombres_apellidos || null,
        acompanante_parentesco: encabezado.acompanante_parentesco || null,
        acompanante_telefono: encabezado.acompanante_telefono || null,
        recepcion_fecha: encabezado.recepcion_fecha,
        recepcion_hora: encabezado.recepcion_hora,
        recepcion_ciudad: encabezado.recepcion_ciudad,
        recepcion_ips: encabezado.recepcion_ips,
        recepcion_servicio: encabezado.recepcion_servicio,
        entrega_fecha: encabezado.entrega_fecha || null,
        entrega_hora: encabezado.entrega_hora || null,
        entrega_ciudad: encabezado.entrega_ciudad || null,
        entrega_ips: encabezado.entrega_ips || null,
        entrega_servicio: encabezado.entrega_servicio || null,
        complejidad: encabezado.complejidad,
        categoria_paciente: encabezado.categoria_paciente,
        nivel_servicio: encabezado.nivel_servicio,
        modalidad: encabezado.modalidad,
      }
      const datosClinico: FormatoTrasladoClinico = {
        diagnostico: clinico.diagnostico || null,
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
        insumos_entregados: clinico.insumos.filter((insumo) => insumo.trim() !== ''),
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
        observaciones: clinico.observaciones || null,
      }
      await corregirFormatoTraslado(id, { ...datosEncabezado, ...datosClinico }, motivo.trim())
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
          motivo que se indique abajo. Las notas, el diagnóstico y quién las firma nunca aparecen
          en el historial.
        </p>

        {errorCarga && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {errorCarga}
          </p>
        )}

        <h2 className="mb-3 text-sm font-semibold text-slate-900">Datos del paciente</h2>
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
          required: true,
          value: encabezado.paciente_numero_documento,
          onChange: (e) => actualizarEncabezado('paciente_numero_documento', e.target.value),
        })}
        {campoRequerido('EPS', 'eps', {
          required: true,
          value: encabezado.paciente_eps,
          onChange: (e) => actualizarEncabezado('paciente_eps', e.target.value),
        })}
        {campoRequerido('Nombres', 'nombres', {
          required: true,
          value: encabezado.paciente_nombres,
          onChange: (e) => actualizarEncabezado('paciente_nombres', e.target.value),
        })}
        {campoRequerido('Apellidos', 'apellidos', {
          required: true,
          value: encabezado.paciente_apellidos,
          onChange: (e) => actualizarEncabezado('paciente_apellidos', e.target.value),
        })}
        {campoRequerido('Edad', 'edad', {
          required: true,
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
        {campoRequerido('Dirección residencial', 'direccion', {
          required: true,
          value: encabezado.paciente_direccion_residencial,
          onChange: (e) => actualizarEncabezado('paciente_direccion_residencial', e.target.value),
        })}
        {campoRequerido('Ciudad', 'ciudad-paciente', {
          required: true,
          value: encabezado.paciente_ciudad,
          onChange: (e) => actualizarEncabezado('paciente_ciudad', e.target.value),
        })}
        {campoRequerido('Teléfono (opcional)', 'telefono-paciente', {
          value: encabezado.paciente_telefono,
          onChange: (e) => actualizarEncabezado('paciente_telefono', e.target.value),
        })}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
          Datos del acompañante (opcional)
        </h2>
        {campoRequerido('Nombres y apellidos', 'acompanante-nombres', {
          value: encabezado.acompanante_nombres_apellidos,
          onChange: (e) => actualizarEncabezado('acompanante_nombres_apellidos', e.target.value),
        })}
        {campoRequerido('Parentesco', 'acompanante-parentesco', {
          value: encabezado.acompanante_parentesco,
          onChange: (e) => actualizarEncabezado('acompanante_parentesco', e.target.value),
        })}
        {campoRequerido('Teléfono', 'acompanante-telefono', {
          value: encabezado.acompanante_telefono,
          onChange: (e) => actualizarEncabezado('acompanante_telefono', e.target.value),
        })}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Recepción del paciente</h2>
        {campoRequerido('Fecha', 'recepcion-fecha', {
          required: true,
          type: 'date',
          value: encabezado.recepcion_fecha,
          onChange: (e) => actualizarEncabezado('recepcion_fecha', e.target.value),
        })}
        {campoRequerido('Hora', 'recepcion-hora', {
          required: true,
          type: 'time',
          value: encabezado.recepcion_hora,
          onChange: (e) => actualizarEncabezado('recepcion_hora', e.target.value),
        })}
        {campoRequerido('Ciudad', 'recepcion-ciudad', {
          required: true,
          value: encabezado.recepcion_ciudad,
          onChange: (e) => actualizarEncabezado('recepcion_ciudad', e.target.value),
        })}
        {campoRequerido('IPS', 'recepcion-ips', {
          required: true,
          value: encabezado.recepcion_ips,
          onChange: (e) => actualizarEncabezado('recepcion_ips', e.target.value),
        })}
        {campoRequerido('Servicio', 'recepcion-servicio', {
          required: true,
          value: encabezado.recepcion_servicio,
          onChange: (e) => actualizarEncabezado('recepcion_servicio', e.target.value),
        })}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
          Entrega del paciente (opcional)
        </h2>
        {campoRequerido('Fecha', 'entrega-fecha', {
          type: 'date',
          value: encabezado.entrega_fecha,
          onChange: (e) => actualizarEncabezado('entrega_fecha', e.target.value),
        })}
        {campoRequerido('Hora', 'entrega-hora', {
          type: 'time',
          value: encabezado.entrega_hora,
          onChange: (e) => actualizarEncabezado('entrega_hora', e.target.value),
        })}
        {campoRequerido('Ciudad', 'entrega-ciudad', {
          value: encabezado.entrega_ciudad,
          onChange: (e) => actualizarEncabezado('entrega_ciudad', e.target.value),
        })}
        {campoRequerido('IPS', 'entrega-ips', {
          value: encabezado.entrega_ips,
          onChange: (e) => actualizarEncabezado('entrega_ips', e.target.value),
        })}
        {campoRequerido('Servicio', 'entrega-servicio', {
          value: encabezado.entrega_servicio,
          onChange: (e) => actualizarEncabezado('entrega_servicio', e.target.value),
        })}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Clasificación del traslado</h2>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="complejidad">
          Complejidad
        </label>
        <select
          id="complejidad"
          value={encabezado.complejidad}
          onChange={(e) => actualizarEncabezado('complejidad', e.target.value as ComplejidadTraslado)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        >
          <option value="alta">Alta</option>
          <option value="baja">Baja</option>
        </select>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="categoria-paciente">
          Categoría del paciente
        </label>
        <select
          id="categoria-paciente"
          value={encabezado.categoria_paciente}
          onChange={(e) =>
            actualizarEncabezado('categoria_paciente', e.target.value as CategoriaPaciente)
          }
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        >
          <option value="neonato">Neonato</option>
          <option value="pediatrico">Pediátrico</option>
          <option value="adulto">Adulto</option>
        </select>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nivel-servicio">
          Nivel de servicio
        </label>
        <select
          id="nivel-servicio"
          value={encabezado.nivel_servicio}
          onChange={(e) =>
            actualizarEncabezado('nivel_servicio', e.target.value as NivelServicioTraslado)
          }
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        >
          <option value="basico">Básico</option>
          <option value="medicalizado">Medicalizado</option>
        </select>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="modalidad">
          Modalidad
        </label>
        <select
          id="modalidad"
          value={encabezado.modalidad}
          onChange={(e) => actualizarEncabezado('modalidad', e.target.value as ModalidadTraslado)}
          className="mb-6 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        >
          <option value="sencillo">Sencillo</option>
          <option value="redondo">Redondo</option>
        </select>

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Diagnóstico</h2>
        <textarea
          value={clinico.diagnostico}
          onChange={(e) => setClinico((anterior) => ({ ...anterior, diagnostico: e.target.value }))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
          rows={2}
        />

        <h2 className="mb-3 text-sm font-semibold text-slate-900">Tratamiento</h2>
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

        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Insumos entregados</h2>
          <button
            type="button"
            onClick={agregarInsumo}
            disabled={clinico.insumos.length >= MAX_INSUMOS}
            className="text-sm font-medium text-brand-blue disabled:text-slate-400"
          >
            + Agregar insumo
          </button>
        </div>
        {clinico.insumos.map((insumo, indice) => (
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
          value={clinico.notaAuxiliar}
          onChange={(e) => setClinico((anterior) => ({ ...anterior, notaAuxiliar: e.target.value }))}
          maxLength={2000}
          rows={4}
          className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />
        {campoTexto('Atendido por', 'atendido-por', clinico.atendidoPor, (valor) =>
          setClinico((anterior) => ({ ...anterior, atendidoPor: valor })),
        )}
        <FirmaField
          etiqueta="Firma de quien atendió"
          imagenInicial={clinico.firmaAtendidoExistente}
          canvasRef={firmaAtendidoRef}
        />

        <label htmlFor="nota-medica" className="mb-3 mt-4 block text-sm font-semibold text-slate-900">
          Evolución médica
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

        <h2 className="mb-3 mt-4 text-sm font-semibold text-slate-900">Observaciones</h2>
        <textarea
          value={clinico.observaciones}
          onChange={(e) => setClinico((anterior) => ({ ...anterior, observaciones: e.target.value }))}
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
          placeholder="Por qué se está corrigiendo este formato"
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />

        {error && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-lg bg-brand-blue py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar corrección'}
        </button>
      </form>
    </section>
  )
}
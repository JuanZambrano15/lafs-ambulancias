/**
 * Encabezado del formato de traslado asistencial (issue #8, TAP-LAFS-002):
 * datos del paciente, del acompañante, recepción y entrega del
 * paciente, y la clasificación del traslado.
 *
 * Mientras la atención sigue abierta se puede reescribir libremente
 * (ver ADR-0002 y ADR-0006) — por eso al entrar se intenta cargar un
 * encabezado ya guardado (si existe) para seguir editándolo, en vez de
 * siempre arrancar en blanco.
 */
 
import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
 
import { ApiError, guardarEncabezadoTraslado, obtenerEncabezadoTraslado } from '../lib/api'
import type {
  CategoriaPaciente,
  ComplejidadTraslado,
  FormatoTrasladoEncabezado,
  ModalidadTraslado,
  NivelServicioTraslado,
  SexoPaciente,
  TipoDocumentoPaciente,
} from '../lib/types'
 
/** Mismos campos que `FormatoTrasladoEncabezado`, pero los que son
 * número o texto opcional se manejan como string de formulario (los
 * `<select>` de enums conservan su tipo real). */
interface CamposTexto {
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
 
const CAMPOS_VACIOS: CamposTexto = {
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
 
const TIPOS_DOCUMENTO: { valor: TipoDocumentoPaciente; etiqueta: string }[] = [
  { valor: 'rc', etiqueta: 'Registro Civil' },
  { valor: 'ti', etiqueta: 'Tarjeta de Identidad' },
  { valor: 'cc', etiqueta: 'Cédula de Ciudadanía' },
  { valor: 'ce', etiqueta: 'Cédula de Extranjería' },
  { valor: 'ppt', etiqueta: 'Permiso de Protección Temporal' },
]
 
function campoRequerido(label: string, id: string, props: JSX.IntrinsicElements['input']) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
        {...props}
      />
    </div>
  )
}
 
export function EncabezadoTrasladoPage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = Number(atencionId)
 
  const [campos, setCampos] = useState<CamposTexto>(CAMPOS_VACIOS)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
 
  useEffect(() => {
    obtenerEncabezadoTraslado(id)
      .then((existente) => {
        if (existente === null) return
        setCampos({
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
          entrega_fecha: existente.entrega_fecha,
          entrega_hora: existente.entrega_hora,
          entrega_ciudad: existente.entrega_ciudad,
          entrega_ips: existente.entrega_ips,
          entrega_servicio: existente.entrega_servicio,
          complejidad: existente.complejidad,
          categoria_paciente: existente.categoria_paciente,
          nivel_servicio: existente.nivel_servicio,
          modalidad: existente.modalidad,
        })
      })
      .catch((err: unknown) => {
        setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el encabezado')
      })
      .finally(() => setCargando(false))
  }, [id])
 
  function actualizar<K extends keyof CamposTexto>(campo: K, valor: CamposTexto[K]): void {
    setCampos((anterior) => ({ ...anterior, [campo]: valor }))
  }
 
  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const datos: FormatoTrasladoEncabezado = {
        ...campos,
        paciente_edad: Number(campos.paciente_edad),
        paciente_telefono: campos.paciente_telefono || null,
        acompanante_nombres_apellidos: campos.acompanante_nombres_apellidos || null,
        acompanante_parentesco: campos.acompanante_parentesco || null,
        acompanante_telefono: campos.acompanante_telefono || null,
      }
      await guardarEncabezadoTraslado(id, datos)
      // La parte clínica (issue #9) se llena después, durante el
      // traslado — no en esta misma pantalla, que es solo la
      // recepción del paciente.
      navigate(`/atenciones/${id}/clinico-traslado`, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el encabezado')
    } finally {
      setGuardando(false)
    }
  }
 
  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6">
        <p className="text-sm text-slate-500">Cargando encabezado…</p>
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
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Encabezado de traslado</h1>
          <p className="mb-6 text-sm text-slate-500">
            Datos del paciente, acompañante, recepción y entrega.
          </p>
 
          {errorCarga && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {errorCarga}
            </p>
          )}
 
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Datos del paciente</h2>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="tipo-documento">
            Tipo de documento
          </label>
          <select
            id="tipo-documento"
            value={campos.paciente_tipo_documento}
            onChange={(e) =>
              actualizar('paciente_tipo_documento', e.target.value as TipoDocumentoPaciente)
            }
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            {TIPOS_DOCUMENTO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          {campoRequerido('Número de documento', 'numero-documento', {
            required: true,
            value: campos.paciente_numero_documento,
            onChange: (e) => actualizar('paciente_numero_documento', e.target.value),
          })}
          {campoRequerido('EPS', 'eps', {
            required: true,
            value: campos.paciente_eps,
            onChange: (e) => actualizar('paciente_eps', e.target.value),
          })}
          {campoRequerido('Nombres', 'nombres', {
            required: true,
            value: campos.paciente_nombres,
            onChange: (e) => actualizar('paciente_nombres', e.target.value),
          })}
          {campoRequerido('Apellidos', 'apellidos', {
            required: true,
            value: campos.paciente_apellidos,
            onChange: (e) => actualizar('paciente_apellidos', e.target.value),
          })}
          {campoRequerido('Edad', 'edad', {
            required: true,
            type: 'number',
            min: 0,
            value: campos.paciente_edad,
            onChange: (e) => actualizar('paciente_edad', e.target.value),
          })}
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="sexo">
            Sexo
          </label>
          <select
            id="sexo"
            value={campos.paciente_sexo}
            onChange={(e) => actualizar('paciente_sexo', e.target.value as SexoPaciente)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="m">Masculino</option>
            <option value="f">Femenino</option>
          </select>
          {campoRequerido('Dirección residencial', 'direccion', {
            required: true,
            value: campos.paciente_direccion_residencial,
            onChange: (e) => actualizar('paciente_direccion_residencial', e.target.value),
          })}
          {campoRequerido('Ciudad', 'ciudad-paciente', {
            required: true,
            value: campos.paciente_ciudad,
            onChange: (e) => actualizar('paciente_ciudad', e.target.value),
          })}
          {campoRequerido('Teléfono (opcional)', 'telefono-paciente', {
            value: campos.paciente_telefono,
            onChange: (e) => actualizar('paciente_telefono', e.target.value),
          })}
 
          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
            Datos del acompañante (opcional)
          </h2>
          {campoRequerido('Nombres y apellidos', 'acompanante-nombre', {
            value: campos.acompanante_nombres_apellidos,
            onChange: (e) => actualizar('acompanante_nombres_apellidos', e.target.value),
          })}
          {campoRequerido('Parentesco', 'acompanante-parentesco', {
            value: campos.acompanante_parentesco,
            onChange: (e) => actualizar('acompanante_parentesco', e.target.value),
          })}
          {campoRequerido('Teléfono', 'acompanante-telefono', {
            value: campos.acompanante_telefono,
            onChange: (e) => actualizar('acompanante_telefono', e.target.value),
          })}
 
          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Recepción del paciente</h2>
          {campoRequerido('Fecha', 'recepcion-fecha', {
            required: true,
            type: 'date',
            value: campos.recepcion_fecha,
            onChange: (e) => actualizar('recepcion_fecha', e.target.value),
          })}
          {campoRequerido('Hora', 'recepcion-hora', {
            required: true,
            type: 'time',
            value: campos.recepcion_hora,
            onChange: (e) => actualizar('recepcion_hora', e.target.value),
          })}
          {campoRequerido('Ciudad', 'recepcion-ciudad', {
            required: true,
            value: campos.recepcion_ciudad,
            onChange: (e) => actualizar('recepcion_ciudad', e.target.value),
          })}
          {campoRequerido('IPS', 'recepcion-ips', {
            required: true,
            value: campos.recepcion_ips,
            onChange: (e) => actualizar('recepcion_ips', e.target.value),
          })}
          {campoRequerido('Servicio', 'recepcion-servicio', {
            required: true,
            value: campos.recepcion_servicio,
            onChange: (e) => actualizar('recepcion_servicio', e.target.value),
          })}
 
          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Entrega del paciente</h2>
          {campoRequerido('Fecha', 'entrega-fecha', {
            required: true,
            type: 'date',
            value: campos.entrega_fecha,
            onChange: (e) => actualizar('entrega_fecha', e.target.value),
          })}
          {campoRequerido('Hora', 'entrega-hora', {
            required: true,
            type: 'time',
            value: campos.entrega_hora,
            onChange: (e) => actualizar('entrega_hora', e.target.value),
          })}
          {campoRequerido('Ciudad', 'entrega-ciudad', {
            required: true,
            value: campos.entrega_ciudad,
            onChange: (e) => actualizar('entrega_ciudad', e.target.value),
          })}
          {campoRequerido('IPS', 'entrega-ips', {
            required: true,
            value: campos.entrega_ips,
            onChange: (e) => actualizar('entrega_ips', e.target.value),
          })}
          {campoRequerido('Servicio', 'entrega-servicio', {
            required: true,
            value: campos.entrega_servicio,
            onChange: (e) => actualizar('entrega_servicio', e.target.value),
          })}
 
          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
            Clasificación del traslado
          </h2>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="complejidad">
            Complejidad
          </label>
          <select
            id="complejidad"
            value={campos.complejidad}
            onChange={(e) => actualizar('complejidad', e.target.value as ComplejidadTraslado)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="alta">Alta</option>
            <option value="baja">Baja</option>
          </select>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="categoria">
            Categoría del paciente
          </label>
          <select
            id="categoria"
            value={campos.categoria_paciente}
            onChange={(e) => actualizar('categoria_paciente', e.target.value as CategoriaPaciente)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
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
            value={campos.nivel_servicio}
            onChange={(e) => actualizar('nivel_servicio', e.target.value as NivelServicioTraslado)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="basico">Básico</option>
            <option value="medicalizado">Medicalizado</option>
          </select>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="modalidad">
            Modalidad
          </label>
          <select
            id="modalidad"
            value={campos.modalidad}
            onChange={(e) => actualizar('modalidad', e.target.value as ModalidadTraslado)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="sencillo">Sencillo</option>
            <option value="redondo">Redondo</option>
          </select>
 
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {error}
            </p>
          )}
 
          <button
            type="submit"
            disabled={guardando}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar encabezado'}
          </button>
        </form>
      </div>
    </div>
  )
}
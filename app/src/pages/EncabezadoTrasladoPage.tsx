/**
 * Encabezado del formato de traslado asistencial (issue #8, TAP-LAFS-002):
 * datos del paciente, del acompañante, recepción del paciente, y la
 * clasificación del traslado.
 *
 * Mientras la atención sigue abierta se puede reescribir libremente
 * (ver ADR-0002 y ADR-0006) — por eso al entrar se intenta cargar un
 * encabezado ya guardado (si existe) para seguir editándolo, en vez de
 * siempre arrancar en blanco.
 *
 * Issue #55 (ADR-0014): "entrega del paciente" ya NO se pide acá —
 * antes se llenaba todo de una sola vez al recibir al paciente, pero a
 * esa hora todavía no se sabe dónde ni cuándo se lo va a entregar. Se
 * pide recién al cerrar la atención, en `ClinicoTrasladoPage`, mismo
 * patrón que ya usa `hora_entrega` en el formato SOAT (issue #70). Por
 * eso este componente guarda lo que ya hubiera de entrega al cargar
 * (`entregaExistente`) y lo reenvía tal cual al guardar: el PUT del
 * encabezado reemplaza el registro completo, así que no reenviarlo lo
 * borraría si se vuelve a editar la recepción después de cerrado.
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ApiError } from '../lib/api'
import { guardarEncabezadoTrasladoConRespaldo, obtenerFormatoTrasladoConRespaldo } from '../lib/trasladoOffline'
import type {
  CategoriaPaciente,
  ComplejidadTraslado,
  FormatoTrasladoEncabezado,
  ModalidadTraslado,
  NivelServicioTraslado,
  SexoPaciente,
  TipoDocumentoPaciente,
} from '../lib/types'
import logoLafs from '../assets/logo-lafs.png'

/** Mismos campos que `FormatoTrasladoEncabezado`, pero los que son
 * número o texto opcional se manejan como string de formulario (los
 * `<select>` de enums conservan su tipo real). No incluye los 5 campos
 * de "entrega" -- esos ya no se piden en esta pantalla (issue #55). */
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
  complejidad: ComplejidadTraslado
  categoria_paciente: CategoriaPaciente
  nivel_servicio: NivelServicioTraslado
  modalidad: ModalidadTraslado
}

/** Los 5 campos de entrega tal como vienen de `FormatoTrasladoOut` --
 * se preservan sin tocar, ver nota de módulo. */
interface EntregaExistente {
  entrega_fecha: string | null
  entrega_hora: string | null
  entrega_ciudad: string | null
  entrega_ips: string | null
  entrega_servicio: string | null
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
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        {...props}
      />
    </div>
  )
}
 
export function EncabezadoTrasladoPage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = atencionId ?? ''
 
  const [campos, setCampos] = useState<CamposTexto>(CAMPOS_VACIOS)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Issue #55 -- esta pantalla ya no pide "entrega del paciente", pero
  // si ya existía (p. ej. al volver a editar la recepción de una
  // atención que ya se cerró) hay que preservarla: el PUT reemplaza el
  // registro completo, así que mandar `null` acá la borraría. Mismo
  // patrón que `horaEntregaExistente` en `EncabezadoAccidenteSoatPage`.
  const entregaExistente = useRef<EntregaExistente>({
    entrega_fecha: null,
    entrega_hora: null,
    entrega_ciudad: null,
    entrega_ips: null,
    entrega_servicio: null,
  })

  useEffect(() => {
    obtenerFormatoTrasladoConRespaldo(id)
      .then((existente) => {
        if (existente === null) return
        entregaExistente.current = {
          entrega_fecha: existente.entrega_fecha,
          entrega_hora: existente.entrega_hora,
          entrega_ciudad: existente.entrega_ciudad,
          entrega_ips: existente.entrega_ips,
          entrega_servicio: existente.entrega_servicio,
        }
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
        // Se pide al cerrar, no acá (ver nota de módulo) -- si ya había
        // algo guardado de una visita anterior a esta pantalla, se
        // preserva en vez de pisarlo con null.
        ...entregaExistente.current,
      }
      await guardarEncabezadoTrasladoConRespaldo(id, datos)
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
      <div className="mx-auto max-w-sm sm:max-w-2xl lg:max-w-3xl">
        <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
          ← Volver
        </button>
 
        <form onSubmit={manejarEnvio} className="rounded-xl bg-white p-6 shadow-sm">
          <img src={logoLafs} alt="L.A.F.S. Ambulancias" className="mb-3 h-10 w-auto" />
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Encabezado de traslado</h1>
          <p className="mb-6 text-sm text-slate-500">
            Datos del paciente, acompañante y recepción. La entrega se pide al cerrar la atención.
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
            value={campos.paciente_tipo_documento}
            onChange={(e) =>
              actualizar('paciente_tipo_documento', e.target.value as TipoDocumentoPaciente)
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
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
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
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
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
            value={campos.nivel_servicio}
            onChange={(e) => actualizar('nivel_servicio', e.target.value as NivelServicioTraslado)}
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
            value={campos.modalidad}
            onChange={(e) => actualizar('modalidad', e.target.value as ModalidadTraslado)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
          >
            <option value="sencillo">Sencillo</option>
            <option value="redondo">Redondo</option>
          </select>
 
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
            {guardando ? 'Guardando…' : 'Guardar encabezado'}
          </button>
        </form>
      </div>
    </div>
  )
}
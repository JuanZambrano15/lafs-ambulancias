/**
 * Encabezado del formato de atención de accidentes SOAT (issue #17,
 * AA-LAFS-005): datos del paciente (o NN) y datos de recogida del
 * accidente — mismo patrón de pantalla que `EncabezadoTrasladoPage`
 * (issue #8), adaptado a los campos propios de este formato.
 *
 * A diferencia del traslado, el paciente puede quedar sin identificar
 * (NN, ADR-0002): el interruptor "Paciente identificado" decide si se
 * piden y se guardan los datos de identidad, o si se mandan en blanco.
 * Que un NN sin identificar bloquee el cierre es una validación que
 * vive en la pantalla clínica (mismo criterio que el backend,
 * `_campos_faltantes_para_cerrar_soat`), no en este formulario.
 *
 * Issue #70 (QA de la primera versión de estas pantallas): la hora de
 * entrega y el profesional que recibe al paciente NO se piden acá --
 * se preguntan al cerrar la atención, en `ClinicoAccidenteSoatPage`,
 * porque son justamente el último dato que se conoce (quien atiende
 * no sabe a qué hora ni a quién va a entregar el paciente mientras
 * todavía está en camino). Pedirlos en el encabezado, que se llena al
 * recibir al paciente, bloqueaba el flujo sin necesidad. Por el mismo
 * motivo se corrigieron los campos de vehículo y "documento expedido
 * en", que no están en el papel real (ver el fix sobre #17 que
 * acompaña este cambio) y `numero_poliza`, que pasó a ser opcional
 * porque el dato del paciente a veces se completa días después.
 */
 
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
 
import { ApiError } from '../lib/api'
import {
  guardarEncabezadoAccidenteSoatConRespaldo,
  obtenerFormatoAccidenteSoatConRespaldo,
} from '../lib/trasladoOffline'
import type {
  FormatoAccidenteSoatEncabezado,
  RolVictima,
  SexoPaciente,
  TipoDocumentoPaciente,
} from '../lib/types'
 
/** Mismos campos que `FormatoAccidenteSoatEncabezado`, pero los que
 * son número o texto opcional se manejan como string de formulario. */
interface CamposTexto {
  fecha_atencion: string
  hora_atencion: string
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
}
 
const CAMPOS_VACIOS: CamposTexto = {
  fecha_atencion: '',
  hora_atencion: '',
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
 
export function EncabezadoAccidenteSoatPage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = atencionId ?? ''
 
  const [campos, setCampos] = useState<CamposTexto>(CAMPOS_VACIOS)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // La hora de entrega ya no se pide en esta pantalla (issue #70 --
  // se pide al cerrar, ver `ClinicoAccidenteSoatPage`), pero si ya
  // existía una (p. ej. al volver a editar un encabezado de una
  // atención que ya se cerró) hay que preservarla: el PUT reemplaza
  // el registro completo, así que mandar `null` aquí la borraría.
  const horaEntregaExistente = useRef<string | null>(null)
 
  useEffect(() => {
    // Issue #70 (QA) -- se guarda si este efecto sigue siendo el
    // vigente antes de aplicar su resultado: sin esto, una carrera
    // entre dos pasadas del efecto (por ejemplo con React
    // StrictMode, que monta dos veces en desarrollo) podía dejar
    // mostrado el error de una pasada vieja aunque la siguiente
    // hubiera cargado bien el encabezado.
    let vigente = true
    obtenerFormatoAccidenteSoatConRespaldo(id)
      .then((existente) => {
        if (!vigente || existente === null) return
        horaEntregaExistente.current = existente.hora_entrega
        setCampos({
          fecha_atencion: existente.fecha_atencion,
          hora_atencion: existente.hora_atencion,
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
        })
      })
      .catch((err: unknown) => {
        if (!vigente) return
        setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el encabezado')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [id])
 
  function actualizar<K extends keyof CamposTexto>(campo: K, valor: CamposTexto[K]): void {
    setCampos((anterior) => ({ ...anterior, [campo]: valor }))
  }
 
  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const datos: FormatoAccidenteSoatEncabezado = {
        fecha_atencion: campos.fecha_atencion,
        hora_atencion: campos.hora_atencion,
        // Se pide al cerrar, no acá (ver nota de módulo) -- si ya
        // había una guardada de una visita anterior a esta pantalla,
        // se preserva en vez de pisarla con null.
        hora_entrega: horaEntregaExistente.current,
        identificado: campos.identificado,
        // NN (ADR-0002): si no está identificado, los datos de
        // identidad se mandan en blanco, aunque hubiera algo escrito
        // antes de desmarcar el interruptor.
        paciente_tipo_documento: campos.identificado ? campos.paciente_tipo_documento : null,
        paciente_numero_documento: campos.identificado
          ? campos.paciente_numero_documento || null
          : null,
        paciente_aseguradora: campos.identificado ? campos.paciente_aseguradora || null : null,
        paciente_nombres: campos.identificado ? campos.paciente_nombres || null : null,
        paciente_apellidos: campos.identificado ? campos.paciente_apellidos || null : null,
        paciente_edad: campos.identificado ? aNumeroONulo(campos.paciente_edad) : null,
        paciente_sexo: campos.identificado ? campos.paciente_sexo : null,
        lugar_ocurrencia: campos.lugar_ocurrencia,
        ciudad: campos.ciudad,
        telefono_contacto: campos.telefono_contacto || null,
        rol_victima: campos.rol_victima,
        poliza_vigente_desde: campos.poliza_vigente_desde || null,
        poliza_vigente_hasta: campos.poliza_vigente_hasta || null,
        numero_poliza: campos.numero_poliza || null,
      }
      await guardarEncabezadoAccidenteSoatConRespaldo(id, datos)
      navigate(`/atenciones/${id}/clinico-accidente-soat`, { replace: true })
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
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Atención de accidente SOAT</h1>
          <p className="mb-6 text-sm text-slate-500">
            Datos del accidente y del paciente (o NN) al recibirlo.
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
            value: campos.fecha_atencion,
            onChange: (e) => actualizar('fecha_atencion', e.target.value),
          })}
          {campoRequerido('Hora de atención', 'hora-atencion', {
            required: true,
            type: 'time',
            value: campos.hora_atencion,
            onChange: (e) => actualizar('hora_atencion', e.target.value),
          })}
 
          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Paciente</h2>
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={campos.identificado}
              onChange={(e) => actualizar('identificado', e.target.checked)}
            />
            Paciente identificado
          </label>
          {!campos.identificado && (
            <p className="mb-4 text-sm text-brand-amber-dark">
              Se registrará como NN. Los datos de identidad se pueden completar después, sin
              necesidad de cerrar la atención para corregirlos.
            </p>
          )}
          {campos.identificado && (
            <>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="tipo-documento"
              >
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
                value: campos.paciente_numero_documento,
                onChange: (e) => actualizar('paciente_numero_documento', e.target.value),
              })}
              {campoRequerido('Aseguradora (EPS/ARL)', 'aseguradora', {
                value: campos.paciente_aseguradora,
                onChange: (e) => actualizar('paciente_aseguradora', e.target.value),
              })}
              {campoRequerido('Nombres', 'nombres', {
                value: campos.paciente_nombres,
                onChange: (e) => actualizar('paciente_nombres', e.target.value),
              })}
              {campoRequerido('Apellidos', 'apellidos', {
                value: campos.paciente_apellidos,
                onChange: (e) => actualizar('paciente_apellidos', e.target.value),
              })}
              {campoRequerido('Edad', 'edad', {
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
            </>
          )}
 
          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Datos de recogida</h2>
          {campoRequerido('Lugar de ocurrencia', 'lugar-ocurrencia', {
            required: true,
            value: campos.lugar_ocurrencia,
            onChange: (e) => actualizar('lugar_ocurrencia', e.target.value),
          })}
          {campoRequerido('Ciudad', 'ciudad', {
            required: true,
            value: campos.ciudad,
            onChange: (e) => actualizar('ciudad', e.target.value),
          })}
          {campoRequerido('Teléfono de contacto (opcional)', 'telefono-contacto', {
            value: campos.telefono_contacto,
            onChange: (e) => actualizar('telefono_contacto', e.target.value),
          })}
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="rol-victima">
            Rol de la víctima
          </label>
          <select
            id="rol-victima"
            value={campos.rol_victima}
            onChange={(e) => actualizar('rol_victima', e.target.value as RolVictima)}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
          >
            {ROLES_VICTIMA.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
 
          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Póliza (opcional)</h2>
          <p className="mb-3 text-sm text-slate-500">
            Se puede completar después si todavía no se conoce.
          </p>
          {campoRequerido('Número de póliza', 'numero-poliza', {
            value: campos.numero_poliza,
            onChange: (e) => actualizar('numero_poliza', e.target.value),
          })}
          {campoRequerido('Vigente desde', 'poliza-desde', {
            type: 'date',
            value: campos.poliza_vigente_desde,
            onChange: (e) => actualizar('poliza_vigente_desde', e.target.value),
          })}
          {campoRequerido('Vigente hasta', 'poliza-hasta', {
            type: 'date',
            value: campos.poliza_vigente_hasta,
            onChange: (e) => actualizar('poliza_vigente_hasta', e.target.value),
          })}
 
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
 
function aNumeroONulo(valor: string): number | null {
  return valor === '' ? null : Number(valor)
}
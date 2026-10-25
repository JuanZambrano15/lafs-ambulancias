/**
 * "Corregir formato" > encabezado de un accidente SOAT ya cerrado
 * (issue #80), puerto de `app/src/pages/EncabezadoAccidenteSoatPage.tsx`
 * (issue #17) para el panel web -- mismo criterio de adaptación que
 * `EncabezadoTrasladoCorregirPage` (ver su nota de módulo): sin cola
 * sin conexión, `hora_entrega` (que en `app/` se pedía recién al
 * cerrar, en `ClinicoAccidenteSoatPage`) acá es un campo más del
 * encabezado, siempre editable, y `motivo` es obligatorio y viaja
 * como query param.
 *
 * Al guardar, navega a `ClinicoAccidenteSoatCorregirPage`.
 */

import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  ApiError,
  guardarEncabezadoAccidenteSoat,
  obtenerFormatoAccidenteSoat,
} from '../lib/api'
import type {
  FormatoAccidenteSoatEncabezado,
  RolVictima,
  SexoPaciente,
  TipoDocumentoPaciente,
} from '../lib/types'

interface CamposTexto {
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

const CAMPOS_VACIOS: CamposTexto = {
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

export function EncabezadoAccidenteSoatCorregirPage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = Number(atencionId)

  const [campos, setCampos] = useState<CamposTexto>(CAMPOS_VACIOS)
  const [motivo, setMotivo] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    obtenerFormatoAccidenteSoat(id)
      .then((existente) => {
        setCampos({
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
    if (motivo.trim() === '') {
      setError('Indica el motivo de la corrección')
      return
    }
    setGuardando(true)
    try {
      const datos: FormatoAccidenteSoatEncabezado = {
        fecha_atencion: campos.fecha_atencion,
        hora_atencion: campos.hora_atencion,
        hora_entrega: campos.hora_entrega || null,
        identificado: campos.identificado,
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
        vehiculo_placa: campos.vehiculo_placa || null,
        vehiculo_tipo: campos.vehiculo_tipo || null,
        vehiculo_marca: campos.vehiculo_marca || null,
      }
      await guardarEncabezadoAccidenteSoat(id, datos, motivo.trim())
      navigate(`/atenciones/${id}/corregir/clinico-accidente-soat`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la corrección')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <p className="text-slate-500">Cargando encabezado…</p>
  }

  return (
    <section>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
        ← Volver
      </button>

      <form onSubmit={manejarEnvio} className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Corregir encabezado</h1>
        <p className="mb-6 text-sm text-slate-500">
          Esta atención ya está cerrada -- la corrección queda en el historial de versiones con el
          motivo que se indique abajo.
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
        {campoRequerido('Hora de entrega (opcional)', 'hora-entrega', {
          type: 'time',
          value: campos.hora_entrega,
          onChange: (e) => actualizar('hora_entrega', e.target.value),
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
            Se registrará como NN. Los datos de identidad se pueden completar después.
          </p>
        )}
        {campos.identificado && (
          <>
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

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">
          Vehículo accidentado (opcional)
        </h2>
        {campoRequerido('Placa del vehículo', 'vehiculo-placa', {
          value: campos.vehiculo_placa,
          onChange: (e) => actualizar('vehiculo_placa', e.target.value),
        })}
        {campoRequerido('Tipo de vehículo', 'vehiculo-tipo', {
          value: campos.vehiculo_tipo,
          onChange: (e) => actualizar('vehiculo_tipo', e.target.value),
        })}
        {campoRequerido('Marca del vehículo', 'vehiculo-marca', {
          value: campos.vehiculo_marca,
          onChange: (e) => actualizar('vehiculo_marca', e.target.value),
        })}

        <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Póliza (opcional)</h2>
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
          placeholder="Por qué se está corrigiendo este encabezado"
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
          {guardando ? 'Guardando…' : 'Guardar y continuar a lo clínico'}
        </button>
      </form>
    </section>
  )
}

function aNumeroONulo(valor: string): number | null {
  return valor === '' ? null : Number(valor)
}
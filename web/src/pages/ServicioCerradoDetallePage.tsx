/**
 * Detalle de un servicio ya cerrado (issue #80): datos del formato
 * (paciente, documento, tipo de traslado, tripulación, móvil),
 * descargar el PDF, corregir el formato (el flujo que ya existía del
 * #14 para el backend, sin ninguna pantalla hasta este issue) y el
 * historial de versiones de esas correcciones -- sin notas médicas ni
 * diagnóstico visibles ahí (ver el comentario de `FormatoVersionOut`
 * en `lib/types.ts`: esos tipos ni siquiera traen esos campos).
 *
 * Solo un accidente SOAT tiene sección de fotografías (issue #18); un
 * traslado asistencial no, y termina en el botón de PDF -- mismo
 * criterio que ya regía en `ServiciosCerradosPage`/`FormatosCerradosPage`.
 */

import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  ApiError,
  descargarPdfFormatoAccidenteSoat,
  descargarPdfFormatoTraslado,
  historialFormatoAccidenteSoat,
  historialFormatoTraslado,
  obtenerAtencionCerrada,
} from '../lib/api'
import type { AtencionCerrada, FormatoAccidenteSoatVersionOut, FormatoVersionOut } from '../lib/types'

function etiquetaTipoServicio(atencion: AtencionCerrada): string {
  if (atencion.tipo === 'atencion_soat') return 'Accidente SOAT'
  return atencion.nivel_servicio === 'medicalizado' ? 'Traslado medicalizado' : 'Traslado básico'
}

function formatearFecha(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : '—'
}

type Version = FormatoVersionOut | FormatoAccidenteSoatVersionOut

export function ServicioCerradoDetallePage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = Number(atencionId)

  const [atencion, setAtencion] = useState<AtencionCerrada | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  const [historial, setHistorial] = useState<Version[] | null>(null)
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null)

  useEffect(() => {
    obtenerAtencionCerrada(id)
      .then(setAtencion)
      .catch((err: unknown) => {
        setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el servicio')
      })
  }, [id])

  useEffect(() => {
    const cargarHistorial =
      atencion === null
        ? null
        : atencion.tipo === 'atencion_soat'
          ? historialFormatoAccidenteSoat
          : historialFormatoTraslado
    if (cargarHistorial === null) return
    cargarHistorial(id)
      .then(setHistorial)
      .catch((err: unknown) => {
        setErrorHistorial(
          err instanceof ApiError ? err.message : 'No se pudo cargar el historial de versiones',
        )
      })
  }, [id, atencion])

  async function manejarDescargar(): Promise<void> {
    if (atencion === null) return
    setErrorDescarga(null)
    setDescargando(true)
    try {
      if (atencion.tipo === 'atencion_soat') {
        await descargarPdfFormatoAccidenteSoat(id)
      } else {
        await descargarPdfFormatoTraslado(id)
      }
    } catch (err) {
      setErrorDescarga(err instanceof ApiError ? err.message : 'No se pudo descargar el PDF')
    } finally {
      setDescargando(false)
    }
  }

  function irACorregir(): void {
    if (atencion === null) return
    navigate(
      atencion.tipo === 'atencion_soat'
        ? `/atenciones/${id}/corregir/encabezado-accidente-soat`
        : `/atenciones/${id}/corregir/encabezado-traslado`,
    )
  }

  if (errorCarga) {
    return (
      <section>
        <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
          ← Volver
        </button>
        <p role="alert" className="text-sm text-brand-orange-dark">
          {errorCarga}
        </p>
      </section>
    )
  }

  if (atencion === null) {
    return <p className="text-slate-500">Cargando…</p>
  }

  return (
    <section>
      <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
        ← Volver
      </button>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Datos del formato</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Paciente</dt>
            <dd className="font-medium text-slate-900">
              {atencion.paciente_nombres
                ? `${atencion.paciente_nombres} ${atencion.paciente_apellidos ?? ''}`
                : 'NN (sin identificar)'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Documento</dt>
            <dd className="font-medium text-slate-900">
              {atencion.paciente_numero_documento ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Tipo</dt>
            <dd className="font-medium text-slate-900">{etiquetaTipoServicio(atencion)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Móvil</dt>
            <dd className="font-medium text-slate-900">{atencion.ambulancia.movil}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Tripulación</dt>
            <dd className="font-medium text-slate-900">
              {atencion.responsable.nombres} {atencion.responsable.apellidos} (responsable),{' '}
              {atencion.conductor.nombres} {atencion.conductor.apellidos} (conductor)
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Cerrada</dt>
            <dd className="font-medium text-slate-900">{formatearFecha(atencion.cerrada_en)}</dd>
          </div>
        </dl>

        {errorDescarga && (
          <p role="alert" className="mt-4 text-sm text-brand-orange-dark">
            {errorDescarga}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {atencion.tiene_pdf ? (
            <button
              type="button"
              disabled={descargando}
              onClick={() => void manejarDescargar()}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {descargando ? 'Descargando…' : 'Descargar PDF'}
            </button>
          ) : (
            <span className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-400">
              Sin PDF
            </span>
          )}
          <button
            type="button"
            onClick={irACorregir}
            className="rounded-lg border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue"
          >
            Corregir formato
          </button>
          {atencion.tipo === 'atencion_soat' && (
            <Link
              to={`/atenciones/${id}/fotos-accidente-soat`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Fotos
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold text-slate-900">Historial de versiones</h2>
        <p className="mb-4 text-sm text-slate-500">
          Cada corrección hecha por un administrador sobre este formato ya cerrado, con el motivo
          que la justificó. No muestra notas médicas ni diagnóstico.
        </p>
        {errorHistorial && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {errorHistorial}
          </p>
        )}
        {historial === null ? (
          <p className="text-slate-500">Cargando…</p>
        ) : historial.length === 0 ? (
          <p className="text-slate-500">Este formato nunca se ha corregido.</p>
        ) : (
          <ul className="space-y-2">
            {historial.map((version) => (
              <li
                key={version.id}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm"
              >
                <p className="font-medium text-slate-900">
                  {formatearFecha(version.corregido_en)} — {version.corregido_por.documento}
                </p>
                <p className="text-slate-600">{version.motivo}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
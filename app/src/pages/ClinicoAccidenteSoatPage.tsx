/**
 * Parte clínica del formato de atención de accidentes SOAT (issue
 * #17, AA-LAFS-005): tratamiento, pupilas, signos vitales, lesiones,
 * escala de Glasgow, triage y descripción de la atención — mismo
 * patrón que `ClinicoTrasladoPage` (issue #9), adaptado a este
 * formato (sin firma: `FormatoAccidenteSoatClinico` no tiene campos
 * de firma, a diferencia del traslado).
 *
 * Issue #70 (QA de la primera versión de estas pantallas): la hora de
 * entrega y los datos de quién recibe al paciente (`profesional_recibe_*`,
 * ya existentes en el esquema clínico) se piden acá, pero no en el
 * formulario principal -- se piden al cerrar la atención, en el paso
 * "Cerrar atención" de más abajo, junto con el PIN. Es el último dato
 * que se conoce: quien atiende no sabe a qué hora ni a quién va a
 * entregar el paciente mientras todavía está en camino, así que
 * pedirlo de entrada bloqueaba el flujo sin necesidad.
 *
 * La hora de entrega vive en el encabezado (`hora_entrega`, issue
 * #17/#70), no en lo clínico -- y el PUT del encabezado reemplaza el
 * registro completo, no solo los campos que se manden. Por eso este
 * componente guarda el encabezado completo que cargó al entrar
 * (`encabezadoCargado`) y, al cerrar, lo reenvía entero con
 * `hora_entrega` ya puesto, en vez de mandar solo ese campo.
 *
 * Igual que lo clínico de traslado, el resto se llena progresivamente
 * y no tiene campos obligatorios para solo "Guardar" -- la validación
 * real es al intentar cerrar (ver `camposFaltantesParaCerrarSoat`,
 * espejo de `_campos_faltantes_para_cerrar_soat` en el backend),
 * incluyendo la regla de que un paciente marcado como identificado en
 * el encabezado necesita su identidad completa para poder cerrarse --
 * un NN sin identificar, en cambio, no bloquea el cierre (ADR-0002).
 * La hora de entrega y quién recibe no son parte de esa validación
 * del backend, pero sí hacen falta para poder *confirmar* el cierre
 * desde esta pantalla (ver el formulario de cierre más abajo).
 *
 * "Cerrar atención" (issue #12, ADR-0010) funciona igual que en
 * traslado: pide el PIN de firma, lo valida localmente si hay un hash
 * en este dispositivo y manda el cierre, en línea o encolado.
 */
 
import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
 
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'
import { pinLocalValido } from '../lib/pinLocal'
import {
  cerrarAtencionConRespaldo,
  guardarClinicoAccidenteSoatConRespaldo,
  guardarEncabezadoAccidenteSoatConRespaldo,
  obtenerFormatoAccidenteSoatConRespaldo,
} from '../lib/trasladoOffline'
import type {
  FormatoAccidenteSoatClinico,
  FormatoAccidenteSoatEncabezado,
  LesionTipo,
  ReflejoPupilar,
  TratamientoAplicado,
  TriageNivel,
} from '../lib/types'
 
const PIN_VALIDO = /^\d{4}$/
 
/** "HH:MM" en hora local, el mismo formato que produce un `<input
 * type="time">` -- mismo criterio que `ClinicoTrasladoPage` (issue #52). */
function horaActual(): string {
  const ahora = new Date()
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
}
 
interface SignoVitalForm {
  hora: string
  ta: string
  fc: string
  fr: string
  spo2: string
}
 
interface EstadoClinico {
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
  triage: TriageNivel | ''
  descripcion: string
}
 
const ESTADO_VACIO: EstadoClinico = {
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
  triage: '',
  descripcion: '',
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
 
// Mismos catálogos cerrados que `ClinicoTrasladoPage` (issue #53) --
// el backend valida los mismos rangos (glasgow_ocular 1-4,
// glasgow_verbal 1-5, glasgow_motora 1-6 en
// api/app/schemas/formato_accidente_soat.py).
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
 
/** Qué le falta al formulario para poder cerrar -- espejo de
 * `_campos_faltantes_para_cerrar_soat` en el backend. `identificado`
 * e `identidadCompleta` vienen del encabezado (cargado junto con lo
 * clínico, ver más abajo): un NN sin identificar no bloquea el
 * cierre, pero si se marcó como identificado sí hace falta su nombre,
 * apellido y número de documento.
 *
 * La hora de entrega y quién recibe al paciente NO están acá --el
 * backend nunca los exigió para cerrar-- se piden y validan aparte,
 * dentro del propio formulario de cierre (ver `manejarCierre`), igual
 * que el PIN. */
function camposFaltantesParaCerrarSoat(
  campos: EstadoClinico,
  identificado: boolean,
  identidadCompleta: boolean,
): string[] {
  const faltantes: string[] = []
  if (campos.signosVitales.filter((signo) => signo.hora.trim() !== '').length === 0) {
    faltantes.push('signos vitales')
  }
  if (campos.glasgowOcular === '' || campos.glasgowVerbal === '' || campos.glasgowMotora === '') {
    faltantes.push('escala de Glasgow')
  }
  if (campos.triage === '') {
    faltantes.push('triage')
  }
  if (campos.descripcion.trim() === '') {
    faltantes.push('descripción de la atención')
  }
  if (identificado && !identidadCompleta) {
    faltantes.push('identidad del paciente (marcado como identificado)')
  }
  return faltantes
}
 
export function ClinicoAccidenteSoatPage(): JSX.Element {
  const navigate = useNavigate()
  const { atencionId } = useParams<{ atencionId: string }>()
  const id = atencionId ?? ''
  const { tieneRol } = useAuth()
  const tieneRolAuxiliar = tieneRol('auxiliar_enfermeria')
  const tieneRolMedico = tieneRol('medico')
 
  const [campos, setCampos] = useState<EstadoClinico>(ESTADO_VACIO)
  const [profesionalRecibeNombre, setProfesionalRecibeNombre] = useState('')
  const [profesionalRecibeCedula, setProfesionalRecibeCedula] = useState('')
  const [horaEntrega, setHoraEntrega] = useState('')
  // Del encabezado (issue #17) -- deciden si la identidad del
  // paciente es obligatoria para poder cerrar, y además se guarda
  // completo para poder reenviarlo entero al cerrar (el PUT del
  // encabezado reemplaza todo el registro, ver nota de módulo).
  // `null` mientras carga o si todavía no existe encabezado.
  const [identificado, setIdentificado] = useState<boolean | null>(null)
  const [identidadCompleta, setIdentidadCompleta] = useState(false)
  const [encabezadoCargado, setEncabezadoCargado] = useState<FormatoAccidenteSoatEncabezado | null>(
    null,
  )
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
 
  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [pinCierre, setPinCierre] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
 
  useEffect(() => {
    // Issue #70 (QA) -- igual que en `EncabezadoAccidenteSoatPage`,
    // se guarda si este efecto sigue siendo el vigente antes de
    // aplicar su resultado, para no dejar mostrado un error de una
    // pasada vieja del efecto (React StrictMode monta dos veces en
    // desarrollo) aunque la pasada siguiente haya cargado bien.
    let vigente = true
    obtenerFormatoAccidenteSoatConRespaldo(id)
      .then((existente) => {
        if (!vigente || existente === null) return
        setCampos({
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
          triage: existente.triage ?? '',
          descripcion: existente.descripcion ?? '',
        })
        setProfesionalRecibeNombre(existente.profesional_recibe_nombre ?? '')
        setProfesionalRecibeCedula(existente.profesional_recibe_cedula ?? '')
        setHoraEntrega(existente.hora_entrega ?? '')
        setIdentificado(existente.identificado)
        setIdentidadCompleta(
          Boolean(
            existente.paciente_nombres &&
              existente.paciente_apellidos &&
              existente.paciente_numero_documento,
          ),
        )
        setEncabezadoCargado({
          fecha_atencion: existente.fecha_atencion,
          hora_atencion: existente.hora_atencion,
          hora_entrega: existente.hora_entrega,
          identificado: existente.identificado,
          paciente_tipo_documento: existente.paciente_tipo_documento,
          paciente_numero_documento: existente.paciente_numero_documento,
          paciente_aseguradora: existente.paciente_aseguradora,
          paciente_nombres: existente.paciente_nombres,
          paciente_apellidos: existente.paciente_apellidos,
          paciente_edad: existente.paciente_edad,
          paciente_sexo: existente.paciente_sexo,
          lugar_ocurrencia: existente.lugar_ocurrencia,
          ciudad: existente.ciudad,
          telefono_contacto: existente.telefono_contacto,
          rol_victima: existente.rol_victima,
          poliza_vigente_desde: existente.poliza_vigente_desde,
          poliza_vigente_hasta: existente.poliza_vigente_hasta,
          numero_poliza: existente.numero_poliza,
        })
      })
      .catch((err: unknown) => {
        if (!vigente) return
        setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar lo clínico')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
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
 
  const glasgowTotal =
    campos.glasgowOcular !== '' && campos.glasgowVerbal !== '' && campos.glasgowMotora !== ''
      ? Number(campos.glasgowOcular) + Number(campos.glasgowVerbal) + Number(campos.glasgowMotora)
      : null
 
  const faltantesParaCerrar = camposFaltantesParaCerrarSoat(
    campos,
    identificado ?? false,
    identidadCompleta,
  )
 
  /** Arma el payload de lo clínico a partir del estado actual del
   * formulario -- lo usan tanto "Guardar" como "Cerrar atención",
   * mismo motivo que en `ClinicoTrasladoPage` (issue #63, comentario):
   * cerrar debe guardar primero lo que haya en pantalla, para que el
   * servidor vea lo mismo que ve el chequeo del lado del cliente. */
  function construirDatosClinico(): FormatoAccidenteSoatClinico {
    return {
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
      triage: campos.triage || null,
      descripcion: campos.descripcion || null,
      profesional_recibe_nombre: profesionalRecibeNombre || null,
      profesional_recibe_cedula: profesionalRecibeCedula || null,
    }
  }
 
  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await guardarClinicoAccidenteSoatConRespaldo(id, construirDatosClinico())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar lo clínico')
    } finally {
      setGuardando(false)
    }
  }
 
  /** Cierra la atención con el PIN de firma -- mismo flujo que
   * `ClinicoTrasladoPage.manejarCierre` (issue #12, ADR-0010), más el
   * paso propio de este formato (issue #70): la hora de entrega y
   * quién recibe se piden acá mismo, justo antes de cerrar, y la hora
   * de entrega se guarda reenviando el encabezado completo (PUT es
   * reemplazo total, ver nota de módulo) con ese único campo puesto. */
  async function manejarCierre(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setErrorCierre(null)
 
    if (horaEntrega.trim() === '') {
      setErrorCierre('Falta la hora de entrega')
      return
    }
    if (!PIN_VALIDO.test(pinCierre)) {
      setErrorCierre('El PIN debe ser de 4 dígitos')
      return
    }
 
    setCerrando(true)
    try {
      const localmenteValido = await pinLocalValido(pinCierre)
      if (localmenteValido === false) {
        setErrorCierre('PIN incorrecto')
        return
      }
 
      if (encabezadoCargado !== null) {
        await guardarEncabezadoAccidenteSoatConRespaldo(id, {
          ...encabezadoCargado,
          hora_entrega: horaEntrega,
        })
      }
      await guardarClinicoAccidenteSoatConRespaldo(id, construirDatosClinico())
      await cerrarAtencionConRespaldo(id, pinCierre)
      navigate('/', { replace: true })
    } catch (err) {
      setErrorCierre(err instanceof ApiError ? err.message : 'No se pudo cerrar la atención')
    } finally {
      setCerrando(false)
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
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Atención del paciente</h1>
          <p className="mb-6 text-sm text-slate-500">
            Se puede guardar el avance las veces que haga falta.
          </p>
 
          {errorCarga && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {errorCarga}
            </p>
          )}
 
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
              <select
                id="glasgow-ocular"
                value={campos.glasgowOcular}
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowOcular: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowVerbal: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowMotora: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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
          <p className="mb-4 text-sm text-slate-500">
            Total: {glasgowTotal === null ? '— ' : glasgowTotal}/15
          </p>
 
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="triage">
            Triage
          </label>
          <select
            id="triage"
            value={campos.triage}
            onChange={(e) =>
              setCampos((anterior) => ({ ...anterior, triage: e.target.value as TriageNivel | '' }))
            }
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="">Sin registrar</option>
            {TRIAGE_OPCIONES.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
 
          <label
            className="mb-1 mt-6 block text-sm font-semibold text-slate-900"
            htmlFor="descripcion"
          >
            Descripción de la atención
          </label>
          <textarea
            id="descripcion"
            value={campos.descripcion}
            onChange={(e) => setCampos((anterior) => ({ ...anterior, descripcion: e.target.value }))}
            maxLength={2000}
            rows={4}
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          />
 
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
 
        {(tieneRolAuxiliar || tieneRolMedico) && (
          <div className="mt-4 rounded-xl bg-white p-6 shadow-sm">
            {faltantesParaCerrar.length > 0 && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
              >
                <p className="font-medium">Falta diligenciar antes de poder cerrar:</p>
                <ul className="mt-1 list-inside list-disc">
                  {faltantesParaCerrar.map((campo) => (
                    <li key={campo}>{campo}</li>
                  ))}
                </ul>
              </div>
            )}
            {!mostrarCierre ? (
              <button
                type="button"
                onClick={() => setMostrarCierre(true)}
                disabled={faltantesParaCerrar.length > 0}
                className="w-full rounded-lg border border-red-300 py-3 text-base font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cerrar atención
              </button>
            ) : (
              <form onSubmit={manejarCierre}>
                <h2 className="mb-1 text-base font-semibold text-slate-900">Cerrar atención</h2>
                <p className="mb-4 text-sm text-slate-500">
                  Estos son los últimos datos que se conocen al entregar al paciente -- se piden
                  acá y no antes.
                </p>
 
                <div className="mb-4">
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="hora-entrega"
                  >
                    Hora de entrega
                  </label>
                  <input
                    id="hora-entrega"
                    type="time"
                    value={horaEntrega}
                    onChange={(e) => setHoraEntrega(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="mb-4">
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="profesional-recibe-nombre"
                  >
                    Profesional que recibe
                  </label>
                  <input
                    id="profesional-recibe-nombre"
                    type="text"
                    value={profesionalRecibeNombre}
                    onChange={(e) => setProfesionalRecibeNombre(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="mb-4">
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="profesional-recibe-cedula"
                  >
                    Cédula de quien recibe
                  </label>
                  <input
                    id="profesional-recibe-cedula"
                    type="text"
                    value={profesionalRecibeCedula}
                    onChange={(e) => setProfesionalRecibeCedula(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                  />
                </div>
 
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="pin-cierre">
                  PIN
                </label>
                <input
                  id="pin-cierre"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  autoComplete="off"
                  value={pinCierre}
                  onChange={(e) => setPinCierre(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-red-500 focus:outline-none"
                />
 
                {errorCierre && (
                  <p role="alert" className="mb-4 text-sm text-red-600">
                    {errorCierre}
                  </p>
                )}
 
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarCierre(false)
                      setPinCierre('')
                      setErrorCierre(null)
                    }}
                    className="flex-1 rounded-lg border border-slate-300 py-3 text-base font-medium text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={cerrando || faltantesParaCerrar.length > 0}
                    className="flex-1 rounded-lg bg-red-600 py-3 text-base font-medium text-white disabled:opacity-60"
                  >
                    {cerrando ? 'Cerrando…' : 'Confirmar cierre'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
/**
 * Parte clínica del formato de atención de accidentes SOAT (issue
 * #17, AA-LAFS-005): tratamiento, pupilas, signos vitales, lesiones,
 * escala de Glasgow, triage y descripción de la atención — mismo
 * patrón que `ClinicoTrasladoPage` (issue #9), adaptado a este
 * formato.
 *
 * Issue #70 (QA de la primera versión de estas pantallas, corregido
 * dos veces): la primera versión pedía "profesional que recibe"
 * (nombre/cédula) al cerrar, un campo que en ese momento se creía
 * inventado -- resultó que sí existe en el papel real, solo que mal
 * ubicado (no va al cerrar) y le faltaba su firma. Lo que el papel sí
 * pide, y antes faltaba del todo, es la identificación y firma del
 * auxiliar que atiende ("atendido por"/firma, issue #11, mismo patrón
 * que `ClinicoTrasladoPage`): se autocompleta con el nombre de quien
 * está logueado y reusa su firma guardada si ya tiene una (personal
 * de planta), o se dibuja en pantalla si no. Opcionalmente, si
 * participó un médico, también queda su nombre y firma ("evolucionado
 * por") — este formato no tiene la noción de "medicalizado" que sí
 * tiene traslado, así que el médico siempre es opcional.
 *
 * Después de esas dos secciones va "Profesional que recibe" en la
 * IPS/ESE -- nombre, cédula y firma, siempre escritos/dibujados en
 * pantalla (es un tercero ajeno a la app, nunca se autocompleta de
 * ningún perfil ni se reusa una firma guardada). El sello físico que
 * lo acompaña en el papel no se captura acá. La firma del conductor
 * tampoco se diligencia en ninguna pantalla — queda para el PDF que
 * se genera en un issue aparte (ver
 * `app/app/models/formato_accidente_soat.py`).
 *
 * La hora de entrega sigue pidiéndose al cerrar, no en el formulario
 * principal: es el último dato que se conoce, quien atiende no sabe a
 * qué hora va a entregar el paciente mientras todavía está en camino.
 * Vive en el encabezado (`hora_entrega`), no en lo clínico -- y el
 * PUT del encabezado reemplaza el registro completo. Por eso este
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
 * La hora de entrega no es parte de esa validación del backend, pero
 * sí hace falta para poder *confirmar* el cierre desde esta pantalla.
 *
 * "Cerrar atención" (issue #12, ADR-0010) funciona igual que en
 * traslado: pide el PIN de firma, lo valida localmente si hay un hash
 * en este dispositivo y manda el cierre, en línea o encolado.
 */

import { useEffect, useRef, useState } from 'react'
import type { FormEvent, JSX, RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { DiagramaCorporal } from '../components/DiagramaCorporal'
import { FirmaCanvas, type FirmaCanvasHandle } from '../components/FirmaCanvas'
import { ApiError, listarMedicosDisponibles } from '../lib/api'
import { pinLocalValido } from '../lib/pinLocal'
import {
  cerrarAtencionConRespaldo,
  guardarClinicoAccidenteSoatConRespaldo,
  guardarEncabezadoAccidenteSoatConRespaldo,
  obtenerFormatoAccidenteSoatConRespaldo,
} from '../lib/trasladoOffline'
import type {
  Empleado,
  FormatoAccidenteSoatClinico,
  FormatoAccidenteSoatEncabezado,
  LesionLocalizada,
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
  lesionesLocalizadas: LesionLocalizada[]
  glasgowOcular: string
  glasgowVerbal: string
  glasgowMotora: string
  triage: TriageNivel | ''
  descripcion: string
  atendidoPor: string
  /** Lo que ya estaba guardado para este formato -- se precarga en el
   * canvas para no perderlo si quien firma no vuelve a dibujar nada
   * en una visita posterior (issue #11). */
  firmaAtendidoExistente: string | null
  evolucionadoPor: string
  firmaEvolucionadoExistente: string | null
  profesionalRecibeNombre: string
  profesionalRecibeCedula: string
  firmaProfesionalRecibeExistente: string | null
}

const ESTADO_VACIO: EstadoClinico = {
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
  atendidoPor: '',
  firmaAtendidoExistente: null,
  evolucionadoPor: '',
  firmaEvolucionadoExistente: null,
  profesionalRecibeNombre: '',
  profesionalRecibeCedula: '',
  firmaProfesionalRecibeExistente: null,
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
 * La hora de entrega NO está acá -- el backend nunca la exigió para
 * cerrar -- se pide y valida aparte, dentro del propio formulario de
 * cierre (ver `manejarCierre`), igual que el PIN. `atendido_por`/firma
 * tampoco son obligatorios para cerrar (mismo criterio que
 * `ClinicoTrasladoPage`): se autocompletan solos en la práctica, pero
 * no bloquean el cierre si por algún motivo quedaran vacíos. */
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
  const { perfil, tieneRol } = useAuth()
  const tieneRolAuxiliar = tieneRol('auxiliar_enfermeria')
  const tieneRolMedico = tieneRol('medico')
  // Si la misma persona tiene los dos roles a la vez, no puede firmar
  // dos veces con la misma firma guardada -- mismo criterio que
  // `ClinicoTrasladoPage` (issue #57).
  const tieneAmbosRoles = tieneRolAuxiliar && tieneRolMedico
  const firmaAtendidoRef = useRef<FirmaCanvasHandle>(null)
  const firmaEvolucionadoRef = useRef<FirmaCanvasHandle>(null)
  const firmaProfesionalRecibeRef = useRef<FirmaCanvasHandle>(null)

  const [campos, setCampos] = useState<EstadoClinico>(ESTADO_VACIO)
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

  // Médico opcional (issue #70, corrección) -- selector de médicos de
  // planta para elegir, más "otro" para escribir el nombre a mano si
  // no está en la lista, mismo patrón que `ClinicoTrasladoPage` (issue
  // #63). `null` mientras carga.
  const [medicos, setMedicos] = useState<Empleado[] | null>(null)
  const [medicoId, setMedicoId] = useState('')

  useEffect(() => {
    // `perfil === undefined` mientras se restaura la sesión guardada
    // -- se espera a que se resuelva para no pedir la lista de
    // médicos de más si quien está logueado termina siendo el médico
    // mismo (nunca la necesita).
    if (perfil === undefined || tieneRolMedico) return
    listarMedicosDisponibles()
      .then(setMedicos)
      .catch(() => setMedicos([]))
  }, [perfil, tieneRolMedico])

  useEffect(() => {
    // Issue #70 (QA) -- se guarda si este efecto sigue siendo el
    // vigente antes de aplicar su resultado, para no dejar mostrado
    // un error de una pasada vieja del efecto (React StrictMode
    // monta dos veces en desarrollo) aunque la pasada siguiente haya
    // cargado bien.
    let vigente = true
    const nombrePerfil = perfil?.empleado_nombre_completo ?? null
    obtenerFormatoAccidenteSoatConRespaldo(id)
      .then((existente) => {
        if (!vigente) return
        if (existente === null) {
          // Mismo criterio que `ClinicoTrasladoPage` -- "atendido
          // por"/"evolucionado por" se autocompletan con el nombre de
          // quien está logueado, según su rol, incluso antes de que
          // exista nada guardado todavía.
          if (nombrePerfil) {
            setCampos((anterior) => ({
              ...anterior,
              atendidoPor: tieneRolAuxiliar ? nombrePerfil : anterior.atendidoPor,
              evolucionadoPor: tieneRolMedico ? nombrePerfil : anterior.evolucionadoPor,
            }))
          }
          return
        }
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
          lesionesLocalizadas: existente.lesiones_localizadas,
          glasgowOcular: existente.glasgow_ocular === null ? '' : String(existente.glasgow_ocular),
          glasgowVerbal: existente.glasgow_verbal === null ? '' : String(existente.glasgow_verbal),
          glasgowMotora: existente.glasgow_motora === null ? '' : String(existente.glasgow_motora),
          triage: existente.triage ?? '',
          descripcion: existente.descripcion ?? '',
          // Nunca reemplaza un nombre que ya hubiera quedado guardado
          // -- propio o de otra persona en un turno anterior -- solo
          // precarga cuando el backend no tiene nada todavía.
          atendidoPor:
            existente.atendido_por ?? (tieneRolAuxiliar && nombrePerfil ? nombrePerfil : ''),
          firmaAtendidoExistente: existente.firma_atendido_por,
          evolucionadoPor:
            existente.evolucionado_por ?? (tieneRolMedico && nombrePerfil ? nombrePerfil : ''),
          firmaEvolucionadoExistente: existente.firma_evolucionado_por,
          profesionalRecibeNombre: existente.profesional_recibe_nombre ?? '',
          profesionalRecibeCedula: existente.profesional_recibe_cedula ?? '',
          firmaProfesionalRecibeExistente: existente.firma_profesional_recibe,
        })
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
  }, [id, perfil?.empleado_nombre_completo, tieneRolAuxiliar, tieneRolMedico])

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

  // Issue #63 (mismo criterio en `ClinicoTrasladoPage`) -- si quien
  // está logueado no es el médico, el nombre de "quien evolucionó" se
  // elige del selector de médicos de planta, o se escribe a mano con
  // "Otro".
  const mostrarSelectorMedico = !tieneRolMedico
  const modoOtroMedico =
    mostrarSelectorMedico && (medicoId === 'otro' || (medicoId === '' && campos.evolucionadoPor !== ''))

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
      lesiones_localizadas: campos.lesionesLocalizadas,
      glasgow_ocular: aNumeroONulo(campos.glasgowOcular),
      glasgow_verbal: aNumeroONulo(campos.glasgowVerbal),
      glasgow_motora: aNumeroONulo(campos.glasgowMotora),
      triage: campos.triage || null,
      descripcion: campos.descripcion || null,
      atendido_por: campos.atendidoPor || null,
      // La firma solo se recalcula para el rol de quien está logueado
      // ahora mismo; si no le corresponde, se reenvía la que ya
      // hubiera (mismo patrón de "reenvío completo" del resto del
      // formato). Si la misma persona tiene los dos roles, no puede
      // "firmar" dos veces con la misma firma guardada como si fueran
      // dos personas distintas: el auxiliar sigue autocompletándose
      // con la firma guardada del perfil, pero la del médico se exige
      // dibujada a mano en ese caso (ver FirmaField más abajo).
      firma_atendido_por: tieneRolAuxiliar
        ? perfil?.firma_guardada ?? firmaAtendidoRef.current?.exportar() ?? null
        : campos.firmaAtendidoExistente,
      evolucionado_por: campos.evolucionadoPor || null,
      // Issue #63 -- si quien está logueado no es el médico, la firma
      // de "quien evolucionó" siempre se dibuja a mano en el
      // dispositivo -- nunca se autocompleta con la firma guardada de
      // la cuenta de ningún médico. Si nadie dibujó nada (el médico no
      // participó en esta atención, lo normal), `exportar()` da
      // `null` y se reenvía lo que ya hubiera.
      firma_evolucionado_por: tieneRolMedico
        ? tieneAmbosRoles
          ? firmaEvolucionadoRef.current?.exportar() ?? campos.firmaEvolucionadoExistente
          : perfil?.firma_guardada ?? firmaEvolucionadoRef.current?.exportar() ?? null
        : firmaEvolucionadoRef.current?.exportar() ?? campos.firmaEvolucionadoExistente,
      profesional_recibe_nombre: campos.profesionalRecibeNombre || null,
      profesional_recibe_cedula: campos.profesionalRecibeCedula || null,
      // El profesional que recibe en la IPS/ESE es siempre un tercero
      // ajeno a la app -- su firma nunca se autocompleta de ningún
      // perfil, a diferencia de auxiliar/médico de arriba.
      firma_profesional_recibe:
        firmaProfesionalRecibeRef.current?.exportar() ?? campos.firmaProfesionalRecibeExistente,
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
   * paso propio de este formato: la hora de entrega se pide acá
   * mismo, justo antes de cerrar, y se guarda reenviando el
   * encabezado completo (PUT es reemplazo total, ver nota de módulo)
   * con ese único campo puesto. */
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
            <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
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
              setCampos((anterior) => ({
                ...anterior,
                pupilaDerecha: e.target.value as ReflejoPupilar | '',
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
              className="text-sm font-medium text-brand-blue"
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
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowOcular: e.target.value }))
                }
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
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowVerbal: e.target.value }))
                }
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
                onChange={(e) =>
                  setCampos((anterior) => ({ ...anterior, glasgowMotora: e.target.value }))
                }
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
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
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
            className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
          />

          <h2 className="mb-3 mt-6 text-sm font-semibold text-slate-900">Atendido por</h2>
          {campoTexto('Nombre del auxiliar', 'atendido-por', campos.atendidoPor, (valor) =>
            setCampos((anterior) => ({ ...anterior, atendidoPor: valor })),
          )}
          {tieneRolAuxiliar && (
            <FirmaField
              etiqueta="Firma de quien atendió"
              firmaGuardada={perfil?.firma_guardada ?? null}
              imagenInicial={campos.firmaAtendidoExistente}
              canvasRef={firmaAtendidoRef}
            />
          )}

          <h2 className="mb-3 mt-4 text-sm font-semibold text-slate-900">
            Médico que participó (opcional)
          </h2>
          {mostrarSelectorMedico ? (
            <>
              <div className="mb-4">
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="medico-evoluciono"
                >
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
                campoTexto('Nombre del médico', 'evolucionado-por', campos.evolucionadoPor, (valor) =>
                  setCampos((anterior) => ({ ...anterior, evolucionadoPor: valor })),
                )}
            </>
          ) : (
            campoTexto('Nombre del médico', 'evolucionado-por', campos.evolucionadoPor, (valor) =>
              setCampos((anterior) => ({ ...anterior, evolucionadoPor: valor })),
            )
          )}
          {tieneRolMedico ? (
            <FirmaField
              etiqueta="Firma de quien evolucionó"
              firmaGuardada={tieneAmbosRoles ? null : perfil?.firma_guardada ?? null}
              pista={
                tieneAmbosRoles
                  ? 'Ya se usó tu firma guardada como auxiliar — firma aquí a mano como médico.'
                  : undefined
              }
              imagenInicial={campos.firmaEvolucionadoExistente}
              canvasRef={firmaEvolucionadoRef}
              disabled={campos.evolucionadoPor.trim() === ''}
            />
          ) : (
            <FirmaField
              etiqueta="Firma de quien evolucionó"
              // Quien está logueado es el auxiliar, no el médico: su
              // firma nunca se autocompleta con la que tenga guardada
              // en su propia cuenta -- la dibuja aquí mismo, en el
              // dispositivo, él mismo. Si nadie dibuja nada (no
              // participó médico), no pasa nada: el campo es tan
              // opcional como el nombre de arriba. Mientras no haya
              // nombre de médico (ni elegido del selector ni escrito a
              // mano), el recuadro queda bloqueado -- no tiene sentido
              // una firma sin nombre asociado.
              firmaGuardada={null}
              pista={
                campos.evolucionadoPor.trim() === ''
                  ? 'Elige un médico o escribe su nombre para habilitar la firma.'
                  : 'El médico firma aquí, en el dispositivo, si participó en esta atención — no se completa sola aunque esté de planta.'
              }
              imagenInicial={campos.firmaEvolucionadoExistente}
              canvasRef={firmaEvolucionadoRef}
              disabled={campos.evolucionadoPor.trim() === ''}
            />
          )}

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
            // Es personal de la IPS/ESE, no de LAFS -- nunca tiene una
            // firma guardada en esta app, así que siempre se dibuja a
            // mano (el sello físico que la acompaña en el papel no se
            // captura acá).
            firmaGuardada={null}
            pista="Lo firma la persona que recibe al paciente en la institución, no el personal de LAFS."
            imagenInicial={campos.firmaProfesionalRecibeExistente}
            canvasRef={firmaProfesionalRecibeRef}
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
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </form>

        {(tieneRolAuxiliar || tieneRolMedico) && (
          <div className="mt-4 rounded-xl bg-white p-6 shadow-sm">
            {faltantesParaCerrar.length > 0 && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-brand-amber bg-brand-amber-soft p-3 text-sm text-brand-amber-dark"
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
                className="w-full rounded-lg border border-brand-orange py-3 text-base font-medium text-brand-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cerrar atención
              </button>
            ) : (
              <form onSubmit={manejarCierre}>
                <h2 className="mb-1 text-base font-semibold text-slate-900">Cerrar atención</h2>
                <p className="mb-4 text-sm text-slate-500">
                  La hora de entrega es el último dato que se conoce al entregar al paciente -- se
                  pide acá y no antes.
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
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
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
                  className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-orange-dark focus:outline-none"
                />

                {errorCierre && (
                  <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
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
                    className="flex-1 rounded-lg bg-brand-orange-dark py-3 text-base font-medium text-white disabled:opacity-60"
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

/**
 * Firma de quien atiende/evoluciona (issue #11), mismo componente que
 * `ClinicoTrasladoPage.FirmaField`. Si el usuario logueado ya tiene
 * firma guardada (personal de planta) se muestra como vista previa de
 * solo lectura y se reusa automáticamente al guardar — no hay nada
 * que dibujar. Si no (personal ocasional, o planta que todavía no
 * configuró la suya), se dibuja en el canvas, precargando lo que ya
 * hubiera quedado guardado en este formato.
 */
function FirmaField({
  etiqueta,
  firmaGuardada,
  imagenInicial,
  canvasRef,
  pista,
  disabled,
}: {
  etiqueta: string
  firmaGuardada: string | null
  imagenInicial: string | null
  canvasRef: RefObject<FirmaCanvasHandle | null>
  /** Aclaración opcional, p.ej. cuando se oculta la firma guardada a
   * propósito porque la misma persona ya la usó para el otro rol. */
  pista?: string
  /** Bloquea el recuadro -- p.ej. "quien evolucionó" mientras no se
   * haya elegido o escrito ningún médico (no tiene sentido dejar
   * dibujar una firma sin nombre asociado). */
  disabled?: boolean
}): JSX.Element {
  return (
    <div className="mb-4">
      <h3 className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</h3>
      {pista && <p className="mb-1 text-xs text-slate-500">{pista}</p>}
      {firmaGuardada ? (
        <img
          src={firmaGuardada}
          alt={etiqueta}
          className="h-20 w-full rounded-lg border border-slate-300 bg-white object-contain"
        />
      ) : (
        <FirmaCanvas ref={canvasRef} imagenInicial={imagenInicial} alto={120} disabled={disabled} />
      )}
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
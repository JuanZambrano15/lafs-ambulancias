/**
 * Tipos que reflejan los esquemas de la API (ver `api/app/schemas/`).
 * Se mantienen a mano porque el backend es pequeño todavía — si crece
 * mucho más, vale la pena generarlos desde el OpenAPI (`/openapi.json`).
 */

export interface Rol {
  id: number
  nombre: string
  descripcion: string | null
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  pin_configurado: boolean
  debe_cambiar_password: boolean
}

export interface AccessTokenResponse {
  access_token: string
  token_type: string
}

export interface MeResponse {
  documento: string
  activo: boolean
  empleado_id: number | null
  debe_cambiar_password: boolean
  pin_configurado: boolean
  roles: Rol[]
  /** `null` si no hay empleado vinculado (issue #11). */
  empleado_tipo_vinculacion: TipoVinculacion | null
  /** Data URL en base64 de la firma reutilizable, o `null` si todavía
   * no la configuró (o si es personal ocasional, que nunca la guarda). */
  firma_guardada: string | null
  /** `null` si no hay empleado vinculado -- igual que
   * `empleado_tipo_vinculacion`. Issue #57 (comentario): se usa para
   * autocompletar "atendido por"/"evolucionó por" con el nombre de
   * quien está logueado, el mismo patrón que ya existe para la
   * firma. */
  empleado_nombre_completo: string | null
}

/** Nombres de rol tal como los siembra la migración del backend. */
export type NombreRol = 'administrador' | 'auxiliar_enfermeria' | 'medico' | 'conductor' | 'contador'

export type TipoAmbulancia = 'basica' | 'medicalizada'

export interface Ambulancia {
  id: number
  movil: string
  placa: string
  tipo: TipoAmbulancia
  vencimiento_soat: string
  vencimiento_tecnomecanica: string
  activa: boolean
}

export type TipoVinculacion = 'planta' | 'ocasional'

export interface Empleado {
  id: number
  nombres: string
  apellidos: string
  cedula: string
  telefono: string | null
  tipo_vinculacion: TipoVinculacion
  activo: boolean
}

/** Issue #7: iniciar una atención y elegir el móvil. */
export type TipoAtencion = 'traslado' | 'atencion_soat'
export type EstadoAtencion = 'abierto' | 'cerrado'

export interface AtencionCreate {
  tipo: TipoAtencion
  ambulancia_id: number
  conductor_id: number
  /** UUID generado en el dispositivo (issue #10) — permite que el
   * backend detecte un reintento de sincronización y no duplique la
   * atención. Opcional porque sigue siendo válido crear una atención
   * en línea sin mandarlo. */
  client_id?: string
}

export interface Atencion {
  id: number
  tipo: TipoAtencion
  estado: EstadoAtencion
  abierta_en: string
  cerrada_en: string | null
  ambulancia: Ambulancia
  conductor: Empleado
  responsable: Empleado
}

/** Issue #8: encabezado del formato de traslado asistencial (TAP-LAFS-002). */
export type TipoDocumentoPaciente = 'rc' | 'ti' | 'cc' | 'ce' | 'ppt'
export type SexoPaciente = 'm' | 'f'
export type ComplejidadTraslado = 'alta' | 'baja'
export type CategoriaPaciente = 'neonato' | 'pediatrico' | 'adulto'
export type NivelServicioTraslado = 'basico' | 'medicalizado'
export type ModalidadTraslado = 'sencillo' | 'redondo'

export interface FormatoTrasladoEncabezado {
  paciente_tipo_documento: TipoDocumentoPaciente
  paciente_numero_documento: string
  paciente_eps: string
  paciente_nombres: string
  paciente_apellidos: string
  paciente_edad: number
  paciente_sexo: SexoPaciente
  paciente_direccion_residencial: string
  paciente_ciudad: string
  paciente_telefono: string | null
  acompanante_nombres_apellidos: string | null
  acompanante_parentesco: string | null
  acompanante_telefono: string | null
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

/** Issue #9: parte clínica del formato de traslado (mismo registro
 * que el encabezado — se llena progresivamente durante el traslado,
 * por eso todo es opcional). */
export type TratamientoAplicado =
  | 'collar_cervical'
  | 'inmovilizacion'
  | 'succion_secrecion'
  | 'oxigeno'
  | 'hemostasia'
  | 'linea_iv'
  | 'canula_orofaringea'
  | 'rcp'
  | 'canula_nasal'
  | 'monitoreo'
  | 'parto'
  | 'vendaje'
  | 'asepsia'
  | 'otros'

export type ReflejoPupilar = 'midriatica' | 'miotica' | 'isocorica' | 'anisocorica' | 'no_reactiva'

export type LesionTipo =
  | 'tce'
  | 'amputacion'
  | 'escalpe'
  | 'eritema'
  | 'fractura_abierta'
  | 'puncion'
  | 'laceracion'
  | 'edema'
  | 'luxacion'
  | 'mordedura'
  | 'abrasion'
  | 'hematoma'
  | 'esguince'
  | 'picadura'
  | 'trauma'
  | 'torax_inestable'
  | 'contusion'
  | 'cuerpo_extrano'
  | 'hemotorax_masivo'
  | 'abdomen_cerrado'
  | 'hemorragia'
  | 'quemadura'
  | 'aplastamiento'
  | 'avulsion'
  | 'dolor'
  | 'otro'

/** Issue #54: zona general del cuerpo donde está la lesión -- a
 * propósito, no es anatómicamente exacta ("brazo", no "tercio medio
 * del húmero"). No incluye lado -- eso es `LesionLado`, aparte. */
export type LesionZona =
  | 'cabeza'
  | 'cuello'
  | 'torax'
  | 'abdomen'
  | 'hombro'
  | 'brazo'
  | 'antebrazo'
  | 'mano'
  | 'muslo'
  | 'pierna'
  | 'pie'

/** Lado del cuerpo DEL PACIENTE, no de la pantalla -- en la vista
 * frontal el paciente da la cara a quien mira, así que su lado
 * derecho queda a la izquierda de la pantalla; en la vista posterior
 * es al revés. `central` es para las zonas sin lado. */
export type LesionLado = 'izquierdo' | 'derecho' | 'central'

export type LesionVista = 'frontal' | 'posterior'

/** Una lesión marcada en el diagrama corporal (issue #54): el QUÉ
 * (`tipo`) y el DÓNDE (`zona` + `lado` + `vista`). */
export interface LesionLocalizada {
  tipo: LesionTipo
  tipo_otro: string | null
  zona: LesionZona
  lado: LesionLado
  vista: LesionVista
}

export interface SignoVitalItem {
  hora: string
  ta: string | null
  fc: number | null
  fr: number | null
  spo2: number | null
}

export interface FormatoTrasladoClinico {
  diagnostico: string | null
  tratamiento: TratamientoAplicado[]
  tratamiento_otro: string | null
  pupila_derecha: ReflejoPupilar | null
  pupila_izquierda: ReflejoPupilar | null
  signos_vitales: SignoVitalItem[]
  lesiones_localizadas: LesionLocalizada[]
  glasgow_ocular: number | null
  glasgow_verbal: number | null
  glasgow_motora: number | null
  insumos_entregados: string[]
  nota_auxiliar: string | null
  atendido_por: string | null
  /** Data URL en base64 de lo dibujado en pantalla (issue #11). */
  firma_atendido_por: string | null
  nota_medica: string | null
  evolucionado_por: string | null
  firma_evolucionado_por: string | null
  /** Profesional que recibe al paciente en la IPS/ESE de destino
   * (issue #75) — personal de la institución, no de LAFS. */
  profesional_recibe_nombre: string | null
  profesional_recibe_cedula: string | null
  firma_profesional_recibe: string | null
  /** Issue #66 — campo "OBSERVACIONES" del papel (TAP-LAFS-002,
   * página 2), antes de la tripulación. No existía ninguna columna
   * para esto; el PDF generado no coincidía con el formato real. */
  observaciones: string | null
}

export interface FormatoTraslado extends FormatoTrasladoEncabezado, FormatoTrasladoClinico {
  atencion_id: number
  glasgow_total: number | null
}

/** Issue #17: formato de atención de accidentes SOAT (AA-LAFS-005) --
 * mismo criterio que el formato de traslado de arriba (encabezado +
 * parte clínica en el mismo registro), con varias casillas que
 * reutilizan los mismos tipos (`TratamientoAplicado`, `ReflejoPupilar`,
 * `LesionTipo`, `SignoVitalItem`) porque son el mismo check-list que
 * usa la empresa en los dos documentos de papel. */
export type RolVictima = 'conductor' | 'pasajero' | 'parrillero' | 'peaton' | 'otro'
export type TriageNivel = 'i' | 'ii' | 'iii'

export interface FormatoAccidenteSoatEncabezado {
  fecha_atencion: string
  hora_atencion: string
  hora_entrega: string | null
  /** Paciente NN (ADR-0002): mientras sea `false`, los demás campos de
   * identidad quedan en blanco -- a diferencia del formato de
   * traslado, donde el paciente siempre se identifica de entrada. */
  identificado: boolean
  paciente_tipo_documento: TipoDocumentoPaciente | null
  paciente_numero_documento: string | null
  paciente_aseguradora: string | null
  paciente_nombres: string | null
  paciente_apellidos: string | null
  paciente_edad: number | null
  paciente_sexo: SexoPaciente | null
  lugar_ocurrencia: string
  ciudad: string
  telefono_contacto: string | null
  rol_victima: RolVictima
  poliza_vigente_desde: string | null
  poliza_vigente_hasta: string | null
  /** Opcional -- puede no saberse todavía al recibir al paciente (el
   * dato del paciente a veces se completa días después). */
  numero_poliza: string | null
}

export interface FormatoAccidenteSoatClinico {
  tratamiento: TratamientoAplicado[]
  tratamiento_otro: string | null
  pupila_derecha: ReflejoPupilar | null
  pupila_izquierda: ReflejoPupilar | null
  signos_vitales: SignoVitalItem[]
  lesiones_localizadas: LesionLocalizada[]
  glasgow_ocular: number | null
  glasgow_verbal: number | null
  glasgow_motora: number | null
  triage: TriageNivel | null
  descripcion: string | null
  atendido_por: string | null
  firma_atendido_por: string | null
  evolucionado_por: string | null
  firma_evolucionado_por: string | null
  profesional_recibe_nombre: string | null
  profesional_recibe_cedula: string | null
  firma_profesional_recibe: string | null
}

export interface FormatoAccidenteSoat
  extends FormatoAccidenteSoatEncabezado,
    FormatoAccidenteSoatClinico {
  atencion_id: number
  glasgow_total: number | null
}
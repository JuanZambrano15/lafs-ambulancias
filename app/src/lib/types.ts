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
  lesiones: LesionTipo[]
  lesion_otro: string | null
  glasgow_ocular: number | null
  glasgow_verbal: number | null
  glasgow_motora: number | null
  insumos_entregados: string[]
  nota_auxiliar: string | null
  atendido_por: string | null
  nota_medica: string | null
  evolucionado_por: string | null
}
 
export interface FormatoTraslado extends FormatoTrasladoEncabezado, FormatoTrasladoClinico {
  atencion_id: number
  glasgow_total: number | null
}
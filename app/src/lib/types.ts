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
 
export interface FormatoTraslado extends FormatoTrasladoEncabezado {
  atencion_id: number
}
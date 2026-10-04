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
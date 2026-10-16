/**
 * Tipos que reflejan los esquemas de la API (ver `api/app/schemas/`).
 * Se mantienen a mano porque el backend es pequeño todavía — si crece
 * mucho más, vale la pena generarlos desde el OpenAPI (`/openapi.json`).
 *
 * Lo que este panel necesita: sesión/perfil, los tres CRUD
 * (usuarios, empleados, roles) del issue #49, y -- desde el issue
 * #15 -- las atenciones de traslado pendientes/cerradas. No incluye
 * nada del contenido clínico del formato (diagnóstico, signos
 * vitales, etc.) -- eso sigue siendo dominio exclusivo de `app/`, el
 * panel solo necesita lo mínimo para listar y descargar el PDF.
 */
 
export interface Rol {
  id: number
  nombre: string
  descripcion: string | null
}
 
export interface RolCreate {
  nombre: string
  descripcion?: string | null
}
 
export interface RolUpdate {
  nombre?: string
  descripcion?: string | null
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
  empleado_tipo_vinculacion: TipoVinculacion | null
  firma_guardada: string | null
}
 
/** Nombres de rol tal como los siembra la migración del backend. */
export type NombreRol = 'administrador' | 'auxiliar_enfermeria' | 'medico' | 'conductor' | 'contador'
 
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
 
export interface EmpleadoCreate {
  nombres: string
  apellidos: string
  cedula: string
  telefono?: string | null
  tipo_vinculacion?: TipoVinculacion
}
 
export interface EmpleadoUpdate {
  nombres?: string
  apellidos?: string
  telefono?: string | null
  tipo_vinculacion?: TipoVinculacion
}
 
export interface Usuario {
  id: number
  documento: string
  activo: boolean
  empleado_id: number | null
  debe_cambiar_password: boolean
  roles: Rol[]
}
 
export interface UsuarioCreate {
  documento: string
  empleado_id?: number | null
  roles?: number[]
}
 
export interface UsuarioUpdate {
  empleado_id?: number | null
  activo?: boolean
}
 
export interface AsignarRolesRequest {
  roles: number[]
}
 
// --- Atenciones de traslado (issue #15: pendientes/cerradas del panel) ---
 
export type TipoAtencion = 'traslado' | 'atencion_soat'
export type EstadoAtencion = 'abierto' | 'cerrado'
 
export interface Ambulancia {
  id: number
  movil: string
  placa: string
  tipo: 'basica' | 'medicalizada'
  vencimiento_soat: string
  vencimiento_tecnomecanica: string
  activa: boolean
}
 
/** Lo que devuelve `GET /atenciones/pendientes` -- atenciones de
 * traslado todavía abiertas, de cualquier responsable. */
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
 
/** Lo que devuelve `GET /atenciones/cerradas` -- igual que
 * `Atencion`, más los datos del paciente para poder identificarla, y
 * si tiene un PDF para descargar. */
export interface AtencionCerrada {
  id: number
  estado: EstadoAtencion
  abierta_en: string
  cerrada_en: string | null
  ambulancia: Ambulancia
  conductor: Empleado
  responsable: Empleado
  paciente_nombres: string
  paciente_apellidos: string
  paciente_numero_documento: string
  tiene_pdf: boolean
}
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
 
export type NivelServicioTraslado = 'basico' | 'medicalizado'
 
/** Lo que devuelve `GET /atenciones/cerradas` -- igual que
 * `Atencion`, más los datos del paciente para poder identificarla, y
 * si tiene un PDF para descargar.
 *
 * Issue #80: también es lo que devuelve `GET /atenciones/{id}` (el
 * detalle de un único servicio cerrado) -- mismo esquema
 * (`AtencionCerradaOut`) para las dos rutas, ver
 * `api/app/schemas/atencion.py`. */
export interface AtencionCerrada {
  id: number
  /** Issue #80 (adelanto): antes esta fila no decía si era un
   * traslado o un accidente SOAT -- el panel ni siquiera podía
   * mostrar el PDF de los SOAT, porque la búsqueda los ignoraba por
   * completo. */
  tipo: TipoAtencion
  /** `null` en un accidente SOAT -- ese formato no tiene la noción
   * de básico/medicalizado. */
  nivel_servicio: NivelServicioTraslado | null
  estado: EstadoAtencion
  abierta_en: string
  cerrada_en: string | null
  ambulancia: Ambulancia
  conductor: Empleado
  responsable: Empleado
  /** `null` si el paciente de un accidente SOAT sigue sin
   * identificar (NN) al momento del cierre. */
  paciente_nombres: string | null
  paciente_apellidos: string | null
  paciente_numero_documento: string | null
  tiene_pdf: boolean
}
 
/** Issue #18 -- foto del accidente, adjuntada después del cierre.
 * `subida_por` reusa el mismo criterio que el resto del formato
 * (documento, no nombres/apellidos: `Usuario` no siempre tiene un
 * `Empleado` con esos datos). */
export interface FormatoAccidenteSoatFoto {
  id: number
  atencion_id: number
  content_type: string
  tamanio_bytes: number
  subida_por: { id: number; documento: string }
  subida_en: string
}
 
// --- Formato de traslado y de accidente SOAT completos (issue #80:
// "Corregir formato" en el panel web) --
//
// Mismos tipos que ya existían en `app/src/lib/types.ts` (issues #8,
// #9, #17, #54) -- se duplican acá porque `app/` y `web/` son
// proyectos npm independientes sin mecanismo de código compartido
// (ver el resto de tipos/funciones ya duplicadas en este archivo:
// `Ambulancia`, `Empleado`, etc.). El panel nunca necesitó esto antes
// del #80 -- solo listaba y descargaba el PDF -- por eso no estaba.
 
export type TipoDocumentoPaciente = 'rc' | 'ti' | 'cc' | 'ce' | 'ppt'
export type SexoPaciente = 'm' | 'f'
export type ComplejidadTraslado = 'alta' | 'baja'
export type CategoriaPaciente = 'neonato' | 'pediatrico' | 'adulto'
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
  entrega_fecha: string | null
  entrega_hora: string | null
  entrega_ciudad: string | null
  entrega_ips: string | null
  entrega_servicio: string | null
  complejidad: ComplejidadTraslado
  categoria_paciente: CategoriaPaciente
  nivel_servicio: NivelServicioTraslado
  modalidad: ModalidadTraslado
}
 
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
 
export type LesionLado = 'izquierdo' | 'derecho' | 'central'
 
export type LesionVista = 'frontal' | 'posterior'
 
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
  firma_atendido_por: string | null
  nota_medica: string | null
  evolucionado_por: string | null
  firma_evolucionado_por: string | null
  profesional_recibe_nombre: string | null
  profesional_recibe_cedula: string | null
  firma_profesional_recibe: string | null
  observaciones: string | null
}
 
export interface FormatoTraslado extends FormatoTrasladoEncabezado, FormatoTrasladoClinico {
  atencion_id: number
  glasgow_total: number | null
}
 
export type RolVictima = 'conductor' | 'pasajero' | 'parrillero' | 'peaton' | 'otro'
export type TriageNivel = 'i' | 'ii' | 'iii'
 
export interface FormatoAccidenteSoatEncabezado {
  fecha_atencion: string
  hora_atencion: string
  hora_entrega: string | null
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
  numero_poliza: string | null
  vehiculo_placa: string | null
  vehiculo_tipo: string | null
  vehiculo_marca: string | null
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
  nota_auxiliar: string | null
  atendido_por: string | null
  firma_atendido_por: string | null
  nota_medica: string | null
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
 
// --- Historial de versiones (issue #14, panel; `motivo` desde el #80) --
//
// A propósito NO incluyen `diagnostico`/`descripcion` ni
// `nota_auxiliar`/`nota_medica` -- el #80 pide que el historial no
// muestre notas médicas ni diagnóstico, así que la pantalla de
// detalle solo usa estos tipos para mostrar QUIÉN corrigió, CUÁNDO y
// POR QUÉ (`motivo`), nunca el contenido clínico en sí (ver
// `ServicioCerradoDetallePage.tsx`).
 
export interface UsuarioResumenOut {
  id: number
  documento: string
}
 
export interface FormatoVersionOut {
  id: number
  atencion_id: number
  corregido_por: UsuarioResumenOut
  corregido_en: string
  motivo: string
}
 
export interface FormatoAccidenteSoatVersionOut {
  id: number
  atencion_id: number
  corregido_por: UsuarioResumenOut
  corregido_en: string
  motivo: string
}
 
// --- Reporte del contador (issue #24) --
//
// Totales de servicios CERRADOS por persona en un rango de fechas
// (filtrado por `cerrada_en`, no `abierta_en` -- ver nota de módulo
// de `app/api/routes/reportes.py`). `como_conductor`/`como_responsable`
// son columnas independientes: una misma persona puede sumar en las
// dos si alguna vez hizo de las dos cosas.
 
export interface ServicioPorPersona {
  empleado_id: number
  cedula: string
  nombres: string
  apellidos: string
  como_conductor: number
  como_responsable: number
  total: number
}
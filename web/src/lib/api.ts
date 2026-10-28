/**
 * Cliente HTTP para la API de LAFS Ambulancias.
 *
 * Mismo contrato que el de `app/` (ver `app/src/lib/api.ts`): maneja
 * en un solo lugar la URL base (`VITE_API_URL`), el header
 * `Authorization`, y el reintento automático con refresh token cuando
 * el access token expira (401). La única diferencia real es que aquí
 * `leerTokens`/`guardarAccessToken`/`borrarTokens` (storage.ts) son
 * síncronas (`localStorage`), no async (`Preferences`) — por eso no
 * hace falta `await` para leerlos.
 */
 
import { borrarTokens, guardarAccessToken, leerTokens } from './storage'
import type {
  AccessTokenResponse,
  Ambulancia,
  AsignarRolesRequest,
  Atencion,
  AtencionCerrada,
  Empleado,
  EmpleadoCreate,
  EmpleadoUpdate,
  FormatoAccidenteSoat,
  FormatoAccidenteSoatClinico,
  FormatoAccidenteSoatEncabezado,
  FormatoAccidenteSoatFoto,
  FormatoAccidenteSoatVersionOut,
  FormatoTraslado,
  FormatoTrasladoClinico,
  FormatoTrasladoEncabezado,
  FormatoVersionOut,
  FuncionServicio,
  MeResponse,
  Rol,
  RolCreate,
  RolUpdate,
  ServicioPorPersona,
  TokenResponse,
  Usuario,
  UsuarioCreate,
  UsuarioUpdate,
  ViajeDetalle,
} from './types'
 
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000') as string
 
export class ApiError extends Error {
  readonly status: number
 
  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
  }
}
 
interface ApiFetchOptions {
  method?: string
  body?: unknown
  /** false para rutas públicas (login) que no deben llevar token. */
  auth?: boolean
}
 
// Evita que dos 401 simultáneos disparen dos refresh en paralelo: el
// segundo espera el resultado del primero en vez de pedir uno nuevo.
let refreshEnCurso: Promise<string> | null = null
 
async function refrescarAccessToken(): Promise<string> {
  const { refreshToken } = leerTokens()
  if (!refreshToken) {
    throw new ApiError(401, 'No hay sesión activa')
  }
 
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
 
  if (!response.ok) {
    borrarTokens()
    throw new ApiError(401, 'La sesión expiró, inicia sesión de nuevo')
  }
 
  const datos = (await response.json()) as AccessTokenResponse
  guardarAccessToken(datos.access_token)
  return datos.access_token
}
 
async function leerError(response: Response): Promise<never> {
  let detail = `Error ${response.status}`
  try {
    const cuerpo = (await response.json()) as { detail?: string }
    if (cuerpo.detail) detail = cuerpo.detail
  } catch {
    // El cuerpo no era JSON (p. ej. un 204 o un error de red) — se usa el mensaje genérico.
  }
  throw new ApiError(response.status, detail)
}
 
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options
 
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const { accessToken } = leerTokens()
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  }
 
  const hacerPeticion = async (): Promise<Response> =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
 
  let response = await hacerPeticion()
 
  if (response.status === 401 && auth) {
    try {
      refreshEnCurso ??= refrescarAccessToken().finally(() => {
        refreshEnCurso = null
      })
      const nuevoAccessToken = await refreshEnCurso
      headers.Authorization = `Bearer ${nuevoAccessToken}`
      response = await hacerPeticion()
    } catch {
      await leerError(response)
    }
  }
 
  if (!response.ok) {
    await leerError(response)
  }
 
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
 
/**
 * Igual que `apiFetch` (mismo header de autenticación, mismo retry
 * con refresh token en un 401), pero para una respuesta binaria
 * (aquí, el PDF del issue #13) en vez de JSON -- `apiFetch` no sirve
 * para esto porque siempre intenta `response.json()`.
 */
async function apiFetchBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {}
  const { accessToken } = leerTokens()
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
 
  const hacerPeticion = async (): Promise<Response> => fetch(`${BASE_URL}${path}`, { headers })
 
  let response = await hacerPeticion()
 
  if (response.status === 401) {
    try {
      refreshEnCurso ??= refrescarAccessToken().finally(() => {
        refreshEnCurso = null
      })
      const nuevoAccessToken = await refreshEnCurso
      headers.Authorization = `Bearer ${nuevoAccessToken}`
      response = await hacerPeticion()
    } catch {
      await leerError(response)
    }
  }
 
  if (!response.ok) {
    await leerError(response)
  }
  return await response.blob()
}
 
/**
 * Igual que `apiFetch`, pero para subir un archivo (`multipart/form-data`,
 * issue #18) -- no se puede reusar `apiFetch` porque ese siempre manda
 * `Content-Type: application/json` y serializa el cuerpo con
 * `JSON.stringify`; acá el cuerpo es un `FormData` y el browser debe
 * poner su propio `Content-Type` (con el `boundary` del multipart).
 */
async function apiFetchFormData<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {}
  const { accessToken } = leerTokens()
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
 
  const hacerPeticion = async (): Promise<Response> =>
    fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData })
 
  let response = await hacerPeticion()
 
  if (response.status === 401) {
    try {
      refreshEnCurso ??= refrescarAccessToken().finally(() => {
        refreshEnCurso = null
      })
      const nuevoAccessToken = await refreshEnCurso
      headers.Authorization = `Bearer ${nuevoAccessToken}`
      response = await hacerPeticion()
    } catch {
      await leerError(response)
    }
  }
 
  if (!response.ok) {
    await leerError(response)
  }
  return (await response.json()) as T
}
 
export async function login(documento: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { documento, password },
    auth: false,
  })
}
 
export async function obtenerPerfil(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me')
}
 
export async function cambiarPassword(
  passwordActual: string,
  passwordNueva: string,
): Promise<void> {
  await apiFetch<void>('/auth/password', {
    method: 'PUT',
    body: { password_actual: passwordActual, password_nueva: passwordNueva },
  })
}
 
// --- Usuarios (issue #4 backend, issue #49 pantallas) ---
 
export async function listarUsuarios(): Promise<Usuario[]> {
  return apiFetch<Usuario[]>('/usuarios')
}
 
export async function crearUsuario(datos: UsuarioCreate): Promise<Usuario> {
  return apiFetch<Usuario>('/usuarios', { method: 'POST', body: datos })
}
 
export async function actualizarUsuario(id: number, datos: UsuarioUpdate): Promise<Usuario> {
  return apiFetch<Usuario>(`/usuarios/${id}`, { method: 'PATCH', body: datos })
}
 
export async function asignarRolesUsuario(id: number, datos: AsignarRolesRequest): Promise<Usuario> {
  return apiFetch<Usuario>(`/usuarios/${id}/roles`, { method: 'PUT', body: datos })
}
 
export async function resetearPasswordUsuario(id: number): Promise<void> {
  await apiFetch<void>(`/usuarios/${id}/resetear-password`, { method: 'POST' })
}
 
export async function desactivarUsuario(id: number): Promise<void> {
  await apiFetch<void>(`/usuarios/${id}`, { method: 'DELETE' })
}
 
// --- Empleados (issue #4 backend, issue #49 pantallas) ---
 
export async function listarEmpleados(soloActivos = false): Promise<Empleado[]> {
  const query = soloActivos ? '?solo_activos=true' : ''
  return apiFetch<Empleado[]>(`/empleados${query}`)
}
 
export async function crearEmpleado(datos: EmpleadoCreate): Promise<Empleado> {
  return apiFetch<Empleado>('/empleados', { method: 'POST', body: datos })
}
 
export async function actualizarEmpleado(id: number, datos: EmpleadoUpdate): Promise<Empleado> {
  return apiFetch<Empleado>(`/empleados/${id}`, { method: 'PATCH', body: datos })
}
 
export async function desactivarEmpleado(id: number): Promise<void> {
  await apiFetch<void>(`/empleados/${id}`, { method: 'DELETE' })
}
 
// --- Roles (issue #4 backend, issue #49 pantallas) ---
 
export async function listarRoles(): Promise<Rol[]> {
  return apiFetch<Rol[]>('/roles')
}
 
export async function crearRol(datos: RolCreate): Promise<Rol> {
  return apiFetch<Rol>('/roles', { method: 'POST', body: datos })
}
 
export async function actualizarRol(id: number, datos: RolUpdate): Promise<Rol> {
  return apiFetch<Rol>(`/roles/${id}`, { method: 'PATCH', body: datos })
}
 
export async function eliminarRol(id: number): Promise<void> {
  await apiFetch<void>(`/roles/${id}`, { method: 'DELETE' })
}
 
// --- Ambulancias (issue #79: estado "en uso" en el dashboard) ---
 
export async function listarAmbulancias(soloActivas = false): Promise<Ambulancia[]> {
  const query = soloActivas ? '?solo_activas=true' : ''
  return apiFetch<Ambulancia[]>(`/ambulancias${query}`)
}
 
/** Issue #80 -- selector de médico de planta en los formularios de
 * corrección clínica (mismo endpoint que ya usa `app/`, ver
 * `listarMedicosDisponibles` en `app/src/lib/api.ts`). */
export async function listarMedicosDisponibles(): Promise<Empleado[]> {
  return apiFetch<Empleado[]>('/atenciones/medicos-disponibles')
}
 
// --- Atenciones de traslado (issue #15: pendientes/cerradas del panel) ---
 
export async function listarAtencionesPendientes(): Promise<Atencion[]> {
  return apiFetch<Atencion[]>('/atenciones/pendientes')
}
 
export async function listarAtencionesCerradas(q?: string): Promise<AtencionCerrada[]> {
  const parametros = new URLSearchParams()
  if (q) parametros.set('q', q)
  const query = parametros.toString() ? `?${parametros.toString()}` : ''
  return apiFetch<AtencionCerrada[]>(`/atenciones/cerradas${query}`)
}
 
/** Detalle de un único servicio ya cerrado (issue #80) -- mismo
 * esquema que cada fila de `listarAtencionesCerradas`, para la
 * pantalla "Servicios cerrados" > detalle. */
export async function obtenerAtencionCerrada(atencionId: number): Promise<AtencionCerrada> {
  return apiFetch<AtencionCerrada>(`/atenciones/${atencionId}`)
}
 
// --- Corrección de formatos ya cerrados (issue #80: "Corregir
// formato" en el panel web, flujo que ya existía del #14 para el
// backend/la app móvil, sin ninguna pantalla propia hasta ahora) --
//
// `motivo` es obligatorio desde el #80 para corregir una atención ya
// cerrada (ver `_motivo_requerido` en el backend) -- viaja como
// parámetro de query, no en el cuerpo, porque el cuerpo sigue siendo
// el mismo esquema que usa el llenado normal (que no tiene ese
// campo). El PUT es un reemplazo completo del encabezado o de lo
// clínico, igual que en `app/` -- no hay PATCH parcial.
 
function conMotivo(path: string, motivo: string): string {
  return `${path}?motivo=${encodeURIComponent(motivo)}`
}
 
export async function obtenerFormatoTraslado(atencionId: number): Promise<FormatoTraslado> {
  return apiFetch<FormatoTraslado>(`/atenciones/${atencionId}/formato-traslado`)
}
 
/** Corrige, en una sola llamada, el encabezado y la parte clínica de
 * un formato de traslado ya cerrado (issue #80, ajuste) -- reemplaza
 * las dos llamadas separadas que había antes (`guardarEncabezadoTraslado`
 * + `guardarClinicoTraslado`, ahora eliminadas: el backend ya no
 * acepta correcciones de administrador por esas rutas, ver
 * `corregir_formato_traslado` en `atenciones.py`), que generaban dos
 * filas de historial y pedían el motivo dos veces para una sola
 * corrección lógica. */
export async function corregirFormatoTraslado(
  atencionId: number,
  datos: FormatoTrasladoEncabezado & FormatoTrasladoClinico,
  motivo: string,
): Promise<FormatoTraslado> {
  return apiFetch<FormatoTraslado>(
    conMotivo(`/atenciones/${atencionId}/formato-traslado/corregir`, motivo),
    { method: 'PUT', body: datos },
  )
}
 
export async function obtenerFormatoAccidenteSoat(
  atencionId: number,
): Promise<FormatoAccidenteSoat> {
  return apiFetch<FormatoAccidenteSoat>(`/atenciones/${atencionId}/formato-accidente-soat`)
}
 
/** Igual que `corregirFormatoTraslado`, para el formato de accidente
 * SOAT (issue #80, ajuste). */
export async function corregirFormatoAccidenteSoat(
  atencionId: number,
  datos: FormatoAccidenteSoatEncabezado & FormatoAccidenteSoatClinico,
  motivo: string,
): Promise<FormatoAccidenteSoat> {
  return apiFetch<FormatoAccidenteSoat>(
    conMotivo(`/atenciones/${atencionId}/formato-accidente-soat/corregir`, motivo),
    { method: 'PUT', body: datos },
  )
}
 
/** Historial de correcciones de un formato ya cerrado (issue #14,
 * ADR-0012), más reciente primero -- a propósito solo trae
 * quién/cuándo/motivo (ver `FormatoVersionOut` en `lib/types.ts`),
 * nunca el contenido clínico de esa versión anterior. */
export async function historialFormatoTraslado(atencionId: number): Promise<FormatoVersionOut[]> {
  return apiFetch<FormatoVersionOut[]>(`/atenciones/${atencionId}/formato-traslado/historial`)
}
 
export async function historialFormatoAccidenteSoat(
  atencionId: number,
): Promise<FormatoAccidenteSoatVersionOut[]> {
  return apiFetch<FormatoAccidenteSoatVersionOut[]>(
    `/atenciones/${atencionId}/formato-accidente-soat/historial`,
  )
}
 
/** Descarga el PDF del formato de una atención ya cerrada (issue
 * #13) y abre una pestaña nueva para mostrarlo/descargarlo -- no se
 * puede usar un `<a href>` simple porque el endpoint exige el header
 * `Authorization`, así que primero se trae como blob y se le crea
 * una URL temporal del navegador. */
export async function descargarPdfFormatoTraslado(atencionId: number): Promise<void> {
  const blob = await apiFetchBlob(`/atenciones/${atencionId}/formato-traslado/pdf`)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  // No se revoca la URL de inmediato -- la pestaña nueva todavía la
  // necesita para mostrar el PDF. El navegador la libera solo al
  // cerrar esa pestaña/documento.
}
 
/** Igual que `descargarPdfFormatoTraslado`, para el formato de
 * accidente SOAT (issue #71 en el backend; issue #80 adelanto acá --
 * el panel listaba estas atenciones pero no tenía de dónde bajar su
 * PDF). */
export async function descargarPdfFormatoAccidenteSoat(atencionId: number): Promise<void> {
  const blob = await apiFetchBlob(`/atenciones/${atencionId}/formato-accidente-soat/pdf`)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
 
// --- Fotos del accidente SOAT, adjuntadas después del cierre (issue #18) ---
// A diferencia de `app/` (que solo las sube el auxiliar/médico que
// atendió), el panel también puede subir -- decisión explícita del
// cliente para este issue, no el criterio por defecto.
 
export async function listarFotosAccidenteSoat(
  atencionId: number,
): Promise<FormatoAccidenteSoatFoto[]> {
  return apiFetch<FormatoAccidenteSoatFoto[]>(
    `/atenciones/${atencionId}/formato-accidente-soat/fotos`,
  )
}
 
/** El nombre del archivo (`nombreArchivo`) no se guarda en ningún
 * lado -- el backend solo necesita el contenido y el `Content-Type`
 * -- pero `FormData` lo exige para armar la parte del multipart. */
export async function subirFotoAccidenteSoat(
  atencionId: number,
  archivo: Blob,
  nombreArchivo: string,
): Promise<FormatoAccidenteSoatFoto> {
  const formData = new FormData()
  formData.append('archivo', archivo, nombreArchivo)
  return apiFetchFormData<FormatoAccidenteSoatFoto>(
    `/atenciones/${atencionId}/formato-accidente-soat/fotos`,
    formData,
  )
}
 
export async function descargarFotoAccidenteSoat(
  atencionId: number,
  fotoId: number,
): Promise<Blob> {
  return apiFetchBlob(`/atenciones/${atencionId}/formato-accidente-soat/fotos/${fotoId}`)
}
 
export async function eliminarFotoAccidenteSoat(
  atencionId: number,
  fotoId: number,
): Promise<void> {
  await apiFetch<void>(`/atenciones/${atencionId}/formato-accidente-soat/fotos/${fotoId}`, {
    method: 'DELETE',
  })
}
 
// --- Reporte del contador (issue #24) ---
 
function queryRango(desde: string, hasta: string): string {
  return `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`
}
 
/** `desde`/`hasta` van como `YYYY-MM-DD` (lo que entrega un
 * `<input type="date">`), igual formato que espera `date` en
 * Pydantic del lado del backend. */
export async function obtenerReporteServiciosPorPersona(
  desde: string,
  hasta: string,
): Promise<ServicioPorPersona[]> {
  return apiFetch<ServicioPorPersona[]>(
    `/reportes/servicios-por-persona${queryRango(desde, hasta)}`,
  )
}
 
/** A diferencia de `descargarPdfFormatoTraslado` (que abre una
 * pestaña nueva porque el navegador sabe mostrar un PDF), un .xlsx no
 * tiene visor integrado -- `window.open` lo intentaría navegar o
 * descargar con un nombre al azar. Se arma un `<a download>`
 * temporal para que el navegador lo guarde con el nombre real del
 * archivo que manda el backend (`Content-Disposition`). */
export async function descargarReporteServiciosPorPersonaExcel(
  desde: string,
  hasta: string,
): Promise<void> {
  const blob = await apiFetchBlob(`/reportes/servicios-por-persona.xlsx${queryRango(desde, hasta)}`)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `servicios-por-persona_${desde}_${hasta}.xlsx`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
 
/** El drill-down de una fila del reporte (issue #25): los viajes de
 * ese empleado, en esa función puntual (no mezcla conductor con
 * responsable), en el mismo rango de fechas ya consultado. */
export async function obtenerDetalleServiciosPorPersona(
  empleadoId: number,
  funcion: FuncionServicio,
  desde: string,
  hasta: string,
): Promise<ViajeDetalle[]> {
  const parametros = new URLSearchParams({
    empleado_id: String(empleadoId),
    funcion,
    desde,
    hasta,
  })
  return apiFetch<ViajeDetalle[]>(`/reportes/servicios-por-persona/detalle?${parametros}`)
}
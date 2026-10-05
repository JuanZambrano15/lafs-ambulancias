/**
 * Cliente HTTP para la API de LAFS Ambulancias.
 *
 * Maneja en un solo lugar: la URL base (`VITE_API_URL`), el header
 * `Authorization`, y el reintento automático con refresh token cuando
 * el access token expira (401) — así ninguna pantalla tiene que saber
 * de tokens, solo llamar `apiFetch`.
 */
 
import { borrarTokens, guardarAccessToken, leerTokens } from './storage'
import type {
  AccessTokenResponse,
  Ambulancia,
  Atencion,
  AtencionCreate,
  Empleado,
  FormatoTraslado,
  FormatoTrasladoClinico,
  FormatoTrasladoEncabezado,
  MeResponse,
  TokenResponse,
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
  const { refreshToken } = await leerTokens()
  if (!refreshToken) {
    throw new ApiError(401, 'No hay sesión activa')
  }
 
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
 
  if (!response.ok) {
    await borrarTokens()
    throw new ApiError(401, 'La sesión expiró, inicia sesión de nuevo')
  }
 
  const datos = (await response.json()) as AccessTokenResponse
  await guardarAccessToken(datos.access_token)
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
    const { accessToken } = await leerTokens()
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
 
export async function listarAmbulanciasDisponibles(): Promise<Ambulancia[]> {
  return apiFetch<Ambulancia[]>('/atenciones/ambulancias-disponibles')
}
 
export async function listarConductoresDisponibles(): Promise<Empleado[]> {
  return apiFetch<Empleado[]>('/atenciones/conductores-disponibles')
}
 
export async function crearAtencion(datos: AtencionCreate): Promise<Atencion> {
  return apiFetch<Atencion>('/atenciones', {
    method: 'POST',
    body: datos,
  })
}
 
/** `null` si la atención todavía no tiene encabezado guardado (404 del backend). */
export async function obtenerEncabezadoTraslado(
  atencionId: number,
): Promise<FormatoTraslado | null> {
  try {
    return await apiFetch<FormatoTraslado>(`/atenciones/${atencionId}/formato-traslado`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
 
export async function guardarEncabezadoTraslado(
  atencionId: number,
  datos: FormatoTrasladoEncabezado,
): Promise<FormatoTraslado> {
  return apiFetch<FormatoTraslado>(`/atenciones/${atencionId}/formato-traslado`, {
    method: 'PUT',
    body: datos,
  })
}
 
/** Issue #9 — a diferencia del encabezado, todos los campos son
 * opcionales: se guarda el avance clínico tal como esté hasta el
 * momento, sin necesidad de llenar todo de una. */
export async function guardarClinicoTraslado(
  atencionId: number,
  datos: FormatoTrasladoClinico,
): Promise<FormatoTraslado> {
  return apiFetch<FormatoTraslado>(`/atenciones/${atencionId}/formato-traslado/clinico`, {
    method: 'PUT',
    body: datos,
  })
}
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
  AsignarRolesRequest,
  Empleado,
  EmpleadoCreate,
  EmpleadoUpdate,
  MeResponse,
  Rol,
  RolCreate,
  RolUpdate,
  TokenResponse,
  Usuario,
  UsuarioCreate,
  UsuarioUpdate,
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
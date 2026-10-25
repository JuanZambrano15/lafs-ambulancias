
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
  FormatoAccidenteSoat,
  FormatoAccidenteSoatClinico,
  FormatoAccidenteSoatEncabezado,
  FormatoAccidenteSoatFoto,
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
 
/**
 * Igual que `apiFetch` (mismo header de autenticación, mismo retry
 * con refresh token en un 401), pero para una respuesta binaria --
 * issue #18, para mostrar/descargar una foto -- en vez de JSON
 * (`apiFetch` no sirve para esto porque siempre intenta
 * `response.json()`). Mismo mecanismo que `apiFetchBlob` de
 * `web/src/lib/api.ts`.
 */
async function apiFetchBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {}
  const { accessToken } = await leerTokens()
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
  const { accessToken } = await leerTokens()
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
 
/** Issue #11 — guarda la firma reutilizable del usuario autenticado
 * (solo personal de planta; el backend responde 409 si no aplica). */
export async function guardarFirma(firma: string): Promise<void> {
  await apiFetch<void>('/auth/firma', {
    method: 'PUT',
    body: { firma },
  })
}
 
/** Define o cambia el PIN de firma (issue #12) — sin restricción de
 * "solo la primera vez", igual que en el backend. */
export async function establecerPin(pin: string): Promise<void> {
  await apiFetch<void>('/auth/pin', {
    method: 'PUT',
    body: { pin },
  })
}
 
export async function listarAmbulanciasDisponibles(): Promise<Ambulancia[]> {
  return apiFetch<Ambulancia[]>('/atenciones/ambulancias-disponibles')
}
 
export async function listarConductoresDisponibles(): Promise<Empleado[]> {
  return apiFetch<Empleado[]>('/atenciones/conductores-disponibles')
}
 
/** Issue #63 -- médicos de planta activos, para el selector que se
 * muestra en lo clínico de un traslado medicalizado cuando quien está
 * logueado no es el médico. */
export async function listarMedicosDisponibles(): Promise<Empleado[]> {
  return apiFetch<Empleado[]>('/atenciones/medicos-disponibles')
}
 
export async function crearAtencion(datos: AtencionCreate): Promise<Atencion> {
  return apiFetch<Atencion>('/atenciones', {
    method: 'POST',
    body: datos,
  })
}
 
/** Issue #51 — atenciones abiertas donde el usuario logueado es el
 * responsable: así Home puede ofrecer "continuar" en vez de dejar a
 * alguien varado si salió de la pantalla sin cerrar. */
export async function listarAtencionesEnCurso(): Promise<Atencion[]> {
  return apiFetch<Atencion[]>('/atenciones/en-curso')
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
 
/** Issue #12 — cierra la atención con el PIN de firma. El backend
 * revalida el PIN contra el hash real sin importar si el dispositivo
 * ya lo validó localmente (ver ADR-0010). */
export async function cerrarAtencion(atencionId: number, pin: string): Promise<Atencion> {
  return apiFetch<Atencion>(`/atenciones/${atencionId}/cerrar`, {
    method: 'PUT',
    body: { pin },
  })
}
 
/** Issue #17 — mismo patrón que `obtenerEncabezadoTraslado`, pero para
 * el formato de accidente SOAT. */
export async function obtenerEncabezadoAccidenteSoat(
  atencionId: number,
): Promise<FormatoAccidenteSoat | null> {
  try {
    return await apiFetch<FormatoAccidenteSoat>(
      `/atenciones/${atencionId}/formato-accidente-soat`,
    )
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}
 
export async function guardarEncabezadoAccidenteSoat(
  atencionId: number,
  datos: FormatoAccidenteSoatEncabezado,
): Promise<FormatoAccidenteSoat> {
  return apiFetch<FormatoAccidenteSoat>(`/atenciones/${atencionId}/formato-accidente-soat`, {
    method: 'PUT',
    body: datos,
  })
}
 
export async function guardarClinicoAccidenteSoat(
  atencionId: number,
  datos: FormatoAccidenteSoatClinico,
): Promise<FormatoAccidenteSoat> {
  return apiFetch<FormatoAccidenteSoat>(
    `/atenciones/${atencionId}/formato-accidente-soat/clinico`,
    {
      method: 'PUT',
      body: datos,
    },
  )
}
 
/** Issue #18 -- atenciones ya cerradas donde el usuario logueado es el
 * responsable: desde acá se llega a la pantalla de fotos de una de
 * ellas (a diferencia de `listarAtencionesEnCurso`, que es para las
 * que todavía no se cierran). */
export async function listarMisAtencionesCerradas(): Promise<Atencion[]> {
  return apiFetch<Atencion[]>('/atenciones/mis-cerradas')
}
 
export async function listarFotosAccidenteSoat(
  atencionId: number,
): Promise<FormatoAccidenteSoatFoto[]> {
  return apiFetch<FormatoAccidenteSoatFoto[]>(
    `/atenciones/${atencionId}/formato-accidente-soat/fotos`,
  )
}
 
/** El nombre del archivo (`nombreArchivo`) no se guarda en ningún
 * lado -- el backend solo necesita el contenido y el `Content-Type`
 * (ver `_CONTENT_TYPES_FOTO_PERMITIDOS`) -- pero `FormData` lo exige
 * para armar la parte del multipart. */
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
 
/** Devuelve el contenido binario de la foto -- quien llama es
 * responsable de convertirlo en algo mostrable (p. ej. con
 * `URL.createObjectURL`) y de liberarlo después. */
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

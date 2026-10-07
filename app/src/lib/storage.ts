/**
 * Persistencia de los tokens en el dispositivo.
 *
 * Se usa `@capacitor/preferences` en vez de `localStorage`: en Android
 * empaquetado con Capacitor, `localStorage` de la WebView se puede
 * perder (actualización de la app, limpieza de caché del sistema) de
 * una forma en la que `Preferences` no — además de ser la API que
 * Capacitor recomienda para este caso.
 */
 
import { Preferences } from '@capacitor/preferences'
 
const CLAVE_ACCESS_TOKEN = 'lafs.access_token'
const CLAVE_REFRESH_TOKEN = 'lafs.refresh_token'
// Hash SHA-256 del PIN de firma, solo para validarlo sin conexión en
// este dispositivo (issue #12, ADR-0010) — nunca es la autorización
// real, esa siempre la hace el servidor contra el hash Argon2id.
const CLAVE_PIN_HASH_LOCAL = 'lafs.pin_hash_local'
 
export async function guardarTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    Preferences.set({ key: CLAVE_ACCESS_TOKEN, value: accessToken }),
    Preferences.set({ key: CLAVE_REFRESH_TOKEN, value: refreshToken }),
  ])
}
 
export async function guardarAccessToken(accessToken: string): Promise<void> {
  await Preferences.set({ key: CLAVE_ACCESS_TOKEN, value: accessToken })
}
 
export async function leerTokens(): Promise<{
  accessToken: string | null
  refreshToken: string | null
}> {
  const [accessToken, refreshToken] = await Promise.all([
    Preferences.get({ key: CLAVE_ACCESS_TOKEN }),
    Preferences.get({ key: CLAVE_REFRESH_TOKEN }),
  ])
  return { accessToken: accessToken.value, refreshToken: refreshToken.value }
}
 
export async function borrarTokens(): Promise<void> {
  await Promise.all([
    Preferences.remove({ key: CLAVE_ACCESS_TOKEN }),
    Preferences.remove({ key: CLAVE_REFRESH_TOKEN }),
  ])
}
 
export async function guardarHashPinLocal(hash: string): Promise<void> {
  await Preferences.set({ key: CLAVE_PIN_HASH_LOCAL, value: hash })
}
 
export async function leerHashPinLocal(): Promise<string | null> {
  const { value } = await Preferences.get({ key: CLAVE_PIN_HASH_LOCAL })
  return value
}
 
export async function borrarHashPinLocal(): Promise<void> {
  await Preferences.remove({ key: CLAVE_PIN_HASH_LOCAL })
}
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

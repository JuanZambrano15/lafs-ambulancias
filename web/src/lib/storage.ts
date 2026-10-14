/**
 * Persistencia de los tokens en el navegador.
 *
 * A diferencia de `app/` (la app Android empaquetada con Capacitor,
 * que usa `@capacitor/preferences` porque `localStorage` de su WebView
 * se puede perder entre actualizaciones), este panel corre siempre en
 * un navegador de escritorio normal — `localStorage` es la persistencia
 * estándar de la plataforma y no hay ninguna razón para traer una
 * dependencia de Capacitor que no aplica aquí.
 */

const CLAVE_ACCESS_TOKEN = 'lafs.admin.access_token'
const CLAVE_REFRESH_TOKEN = 'lafs.admin.refresh_token'

export function guardarTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(CLAVE_ACCESS_TOKEN, accessToken)
  localStorage.setItem(CLAVE_REFRESH_TOKEN, refreshToken)
}

export function guardarAccessToken(accessToken: string): void {
  localStorage.setItem(CLAVE_ACCESS_TOKEN, accessToken)
}

export function leerTokens(): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: localStorage.getItem(CLAVE_ACCESS_TOKEN),
    refreshToken: localStorage.getItem(CLAVE_REFRESH_TOKEN),
  }
}

export function borrarTokens(): void {
  localStorage.removeItem(CLAVE_ACCESS_TOKEN)
  localStorage.removeItem(CLAVE_REFRESH_TOKEN)
}
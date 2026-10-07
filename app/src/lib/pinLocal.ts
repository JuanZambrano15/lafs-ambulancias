/**
 * Validación del PIN de firma en el dispositivo, sin red (issue #12,
 * ADR-0010).
 *
 * El backend siempre revalida el PIN contra `pin_hash` (Argon2id) al
 * cerrar una atención — esto es solo para que el dispositivo pueda
 * decir "PIN incorrecto" al instante, sin esperar a tener señal. Por
 * eso un hash rápido (SHA-256, con `crypto.subtle`, sin librería)
 * alcanza: no hace falta que sea lento ni resistente a fuerza bruta,
 * esa parte ya la hace el servidor con el hash real.
 *
 * Si todavía no hay un hash local guardado en este dispositivo (nunca
 * se definió/cambió el PIN desde aquí, o se borró al cerrar sesión),
 * `pinLocalValido` no tiene con qué comparar — en ese caso el llamador
 * debe dejar pasar el intento y confiar en la revalidación del
 * servidor, no bloquear al usuario.
 */
 
import { borrarHashPinLocal, guardarHashPinLocal, leerHashPinLocal } from './storage'
 
async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto)
  const buffer = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
 
/** Se llama cada vez que `PUT /auth/pin` se confirma contra el backend. */
export async function guardarPinLocal(pin: string): Promise<void> {
  await guardarHashPinLocal(await sha256Hex(pin))
}
 
export async function hayPinLocal(): Promise<boolean> {
  return (await leerHashPinLocal()) !== null
}
 
/** `true` si coincide, `false` si no, `null` si no hay hash local
 * contra qué comparar (no es lo mismo que "incorrecto"). */
export async function pinLocalValido(pin: string): Promise<boolean | null> {
  const hash = await leerHashPinLocal()
  if (hash === null) return null
  return hash === (await sha256Hex(pin))
}
 
export { borrarHashPinLocal as borrarPinLocal }
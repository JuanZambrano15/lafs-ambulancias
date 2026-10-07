/**
 * Estado global de sesión: quién está logueado, con qué roles, y si
 * tiene que pasar por el cambio de contraseña obligatorio antes de
 * usar el resto de la app.
 *
 * Al arrancar, intenta restaurar la sesión desde los tokens guardados
 * en el dispositivo (`@capacitor/preferences`) llamando `GET /auth/me`
 * — si el access token ya expiró, `apiFetch` lo renueva solo con el
 * refresh token; si ni el refresh token sirve, se trata como "no hay
 * sesión" y se manda a login.
 */
 
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
 
import { login as loginApi, obtenerPerfil } from '../lib/api'
import { borrarPinLocal } from '../lib/pinLocal'
import { borrarTokens, guardarTokens } from '../lib/storage'
import type { MeResponse, NombreRol } from '../lib/types'
 
interface AuthContextValue {
  /** `undefined` mientras se restaura la sesión guardada; `null` si no hay sesión. */
  perfil: MeResponse | null | undefined
  roles: NombreRol[]
  tieneRol: (...nombres: NombreRol[]) => boolean
  iniciarSesion: (documento: string, password: string) => Promise<void>
  cerrarSesion: () => Promise<void>
  /** Para refrescar el perfil después de `PUT /auth/password`, sin recargar la página. */
  refrescarPerfil: () => Promise<void>
}
 
const AuthContext = createContext<AuthContextValue | null>(null)
 
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [perfil, setPerfil] = useState<MeResponse | null | undefined>(undefined)
 
  const refrescarPerfil = useCallback(async () => {
    const datos = await obtenerPerfil()
    setPerfil(datos)
  }, [])
 
  useEffect(() => {
    obtenerPerfil()
      .then(setPerfil)
      .catch(() => {
        setPerfil(null)
      })
  }, [])
 
  const iniciarSesion = useCallback(async (documento: string, password: string) => {
    const tokens = await loginApi(documento, password)
    await guardarTokens(tokens.access_token, tokens.refresh_token)
    await refrescarPerfil()
  }, [refrescarPerfil])
 
  const cerrarSesion = useCallback(async () => {
    // El hash local del PIN (issue #12, ADR-0010) es por usuario de
    // este dispositivo — se borra al cerrar sesión para que la
    // siguiente persona que entre aquí no herede un atajo que no es
    // suyo.
    await Promise.all([borrarTokens(), borrarPinLocal()])
    setPerfil(null)
  }, [])
 
  const roles = useMemo<NombreRol[]>(
    () => (perfil?.roles.map((rol) => rol.nombre as NombreRol) ?? []),
    [perfil],
  )
 
  const tieneRol = useCallback(
    (...nombres: NombreRol[]) => nombres.some((nombre) => roles.includes(nombre)),
    [roles],
  )
 
  const value = useMemo<AuthContextValue>(
    () => ({ perfil, roles, tieneRol, iniciarSesion, cerrarSesion, refrescarPerfil }),
    [perfil, roles, tieneRol, iniciarSesion, cerrarSesion, refrescarPerfil],
  )
 
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
 
export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext)
  if (!contexto) {
    throw new Error('useAuth se debe usar dentro de <AuthProvider>')
  }
  return contexto
}
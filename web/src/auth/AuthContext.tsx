/**
 * Estado global de sesión: quién está logueado, con qué roles, y si
 * tiene que pasar por el cambio de contraseña obligatorio antes de
 * usar el resto del panel.
 *
 * Mismo patrón que `app/src/auth/AuthContext.tsx`, sin lo que no
 * aplica aquí (PIN de firma, issue #12 — ese flujo es solo para
 * quien firma un formato de traslado desde la app móvil, no para el
 * administrador en este panel).
 *
 * Al arrancar, intenta restaurar la sesión desde los tokens guardados
 * en este navegador (`localStorage`) llamando `GET /auth/me` — si el
 * access token ya expiró, `apiFetch` lo renueva solo con el refresh
 * token; si ni el refresh token sirve, se trata como "no hay sesión"
 * y se manda a login.
 */
 
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
 
import { login as loginApi, obtenerPerfil } from '../lib/api'
import { borrarTokens, guardarTokens } from '../lib/storage'
import type { MeResponse, NombreRol } from '../lib/types'
 
interface AuthContextValue {
  /** `undefined` mientras se restaura la sesión guardada; `null` si no hay sesión. */
  perfil: MeResponse | null | undefined
  roles: NombreRol[]
  esAdministrador: boolean
  /** Devuelve el perfil recién obtenido (issue #24) -- lo necesita
   * `LoginPage` para decidir a dónde navegar según el rol sin
   * depender del `perfil` del contexto, que todavía no se habrá
   * actualizado en este mismo render cuando el `await` resuelve. */
  iniciarSesion: (documento: string, password: string) => Promise<MeResponse>
  cerrarSesion: () => void
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
 
  const iniciarSesion = useCallback(
    async (documento: string, password: string): Promise<MeResponse> => {
      const tokens = await loginApi(documento, password)
      guardarTokens(tokens.access_token, tokens.refresh_token)
      const datos = await obtenerPerfil()
      setPerfil(datos)
      return datos
    },
    [],
  )
 
  const cerrarSesion = useCallback(() => {
    borrarTokens()
    setPerfil(null)
  }, [])
 
  const roles = useMemo<NombreRol[]>(
    () => (perfil?.roles.map((rol) => rol.nombre as NombreRol) ?? []),
    [perfil],
  )
 
  const esAdministrador = useMemo(() => roles.includes('administrador'), [roles])
 
  const value = useMemo<AuthContextValue>(
    () => ({ perfil, roles, esAdministrador, iniciarSesion, cerrarSesion, refrescarPerfil }),
    [perfil, roles, esAdministrador, iniciarSesion, cerrarSesion, refrescarPerfil],
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
/**
 * Envuelve las rutas que requieren sesión -- por defecto, de
 * administrador.
 *
 * Mismo patrón de tres casos que `app/src/routes/ProtectedRoute.tsx`
 * para "todavía restaurando" / "sin sesión" / "debe cambiar
 * contraseña", más uno nuevo que no aplica allá: con sesión válida
 * pero sin ninguno de los roles permitidos (por ejemplo, un conductor
 * que por error intenta entrar a este panel) se muestra un mensaje,
 * no se redirige a ningún lado — no hay una pantalla "de conductor" a
 * la que mandarlo desde aquí.
 *
 * Issue #24: el panel entero seguía siendo "solo administrador" --
 * `rolesPermitidos` deja abrir una sola rama de rutas (el reporte del
 * contador) a otro rol sin tocar el resto, que sigue con el valor por
 * defecto (`['administrador']`). No es una lista de roles por ruta
 * individual porque no hace falta todavía: cada grupo de rutas que
 * use un valor distinto de `rolesPermitidos` se envuelve en su propio
 * `<Route element={<ProtectedRoute rolesPermitidos={...} />}>` en
 * `App.tsx`.
 *
 * No hay paso de "configurar PIN" (issue #12): ese flujo es para
 * quien firma un formato desde la app móvil, no para el administrador.
 */
 
import type { JSX } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
 
import { useAuth } from '../auth/AuthContext'
import type { NombreRol } from '../lib/types'
 
interface ProtectedRouteProps {
  rolesPermitidos?: NombreRol[]
}
 
export function ProtectedRoute({
  rolesPermitidos = ['administrador'],
}: ProtectedRouteProps): JSX.Element {
  const { perfil, roles } = useAuth()
  const location = useLocation()
 
  if (perfil === undefined) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Cargando sesión…
      </div>
    )
  }
 
  if (perfil === null) {
    return <Navigate to="/login" replace state={{ desde: location }} />
  }
 
  if (perfil.debe_cambiar_password) {
    return location.pathname === '/cambiar-password' ? (
      <Outlet />
    ) : (
      <Navigate to="/cambiar-password" replace />
    )
  }
 
  const tienePermiso = roles.some((rol) => rolesPermitidos.includes(rol))
  if (!tienePermiso) {
    return (
      <div className="flex h-screen items-center justify-center px-4 text-center text-slate-600">
        Tu usuario no tiene ninguno de los roles necesarios para entrar aquí.
      </div>
    )
  }
 
  return <Outlet />
}
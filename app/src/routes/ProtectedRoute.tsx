/**
 * Envuelve las rutas que requieren sesión.
 *
 * Tres casos:
 * - Todavía restaurando la sesión (`perfil === undefined`): pantalla de carga.
 * - Sin sesión (`perfil === null`): redirige a /login.
 * - Con sesión pero `debe_cambiar_password`: redirige a /cambiar-password,
 *   salvo que la ruta protegida ya sea esa (para no encerrar al usuario en un bucle).
 */

import type { JSX } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

export function ProtectedRoute(): JSX.Element {
  const { perfil } = useAuth()
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

  if (perfil.debe_cambiar_password && location.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />
  }

  return <Outlet />
}

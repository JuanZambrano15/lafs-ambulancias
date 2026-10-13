/**
 * Envuelve las rutas que requieren sesión de administrador.
 *
 * Mismo patrón de tres casos que `app/src/routes/ProtectedRoute.tsx`
 * para "todavía restaurando" / "sin sesión" / "debe cambiar
 * contraseña", más uno nuevo que no aplica allá: con sesión válida
 * pero sin el rol `administrador` (por ejemplo, un conductor que por
 * error intenta entrar a este panel) se muestra un mensaje, no se
 * redirige a ningún lado — no hay una pantalla "de conductor" a la
 * que mandarlo desde aquí, este panel es solo para administradores.
 *
 * No hay paso de "configurar PIN" (issue #12): ese flujo es para
 * quien firma un formato desde la app móvil, no para el administrador.
 */

import type { JSX } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

export function ProtectedRoute(): JSX.Element {
  const { perfil, esAdministrador } = useAuth()
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

  if (!esAdministrador) {
    return (
      <div className="flex h-screen items-center justify-center px-4 text-center text-slate-600">
        Tu usuario no tiene el rol de administrador — este panel no es para ti.
      </div>
    )
  }

  return <Outlet />
}
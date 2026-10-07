/**
 * Envuelve las rutas que requieren sesión.
 *
 * Cuatro casos:
 * - Todavía restaurando la sesión (`perfil === undefined`): pantalla de carga.
 * - Sin sesión (`perfil === null`): redirige a /login.
 * - Con sesión pero `debe_cambiar_password`: redirige a /cambiar-password,
 *   salvo que la ruta protegida ya sea esa (para no encerrar al usuario en un bucle).
 * - Con sesión pero sin PIN configurado (issue #12): redirige a
 *   /configurar-pin, mismo patrón — pero solo una vez resuelto el paso
 *   anterior: mientras `debe_cambiar_password` siga pendiente, ese es
 *   el único formulario que se le exige, para no encimarle los dos a
 *   la vez (y, sobre todo, para no entrar en un bucle de redirecciones
 *   entre las dos pantallas si a alguien le faltan ambas cosas).
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
 
  // Mientras deba cambiar la contraseña, esa es la única pantalla que
  // se le exige — ni se evalúa el PIN todavía, para no terminar
  // rebotando entre /cambiar-password y /configurar-pin.
  if (perfil.debe_cambiar_password) {
    return location.pathname === '/cambiar-password' ? (
      <Outlet />
    ) : (
      <Navigate to="/cambiar-password" replace />
    )
  }
 
  if (!perfil.pin_configurado) {
    return location.pathname === '/configurar-pin' ? (
      <Outlet />
    ) : (
      <Navigate to="/configurar-pin" replace />
    )
  }
 
  return <Outlet />
}
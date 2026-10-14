/**
 * Marco común de las pantallas protegidas: barra lateral con los tres
 * CRUD de este issue (usuarios, empleados, roles) y botón de cerrar
 * sesión. Las pantallas de pendientes/alertas (issue #15) se agregan
 * acá cuando se construyan.
 */

import type { JSX, ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

const ENLACES = [
  { to: '/usuarios', etiqueta: 'Usuarios' },
  { to: '/empleados', etiqueta: 'Empleados' },
  { to: '/roles', etiqueta: 'Roles' },
]

function claseEnlace({ isActive }: { isActive: boolean }): string {
  return [
    'block rounded-lg px-4 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100',
  ].join(' ')
}

export function Layout({ children }: { children: ReactNode }): JSX.Element {
  const { perfil, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  function manejarCerrarSesion(): void {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-56 flex-col justify-between border-r border-slate-200 bg-white p-4">
        <div>
          <h1 className="mb-6 px-4 text-lg font-semibold text-slate-900">L.A.F.S. Admin</h1>
          <nav className="space-y-1">
            {ENLACES.map((enlace) => (
              <NavLink key={enlace.to} to={enlace.to} className={claseEnlace}>
                {enlace.etiqueta}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="truncate px-4 text-xs text-slate-500">{perfil?.documento}</p>
          <button
            type="button"
            onClick={manejarCerrarSesion}
            className="mt-2 w-full rounded-lg px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
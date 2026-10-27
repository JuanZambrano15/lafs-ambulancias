/**
 * Marco común de las pantallas protegidas: barra lateral con el
 * dashboard de inicio (issue #79, antes "Pendientes" del #15),
 * servicios cerrados (separado del dashboard en el #79, renombrado de
 * "Formatos cerrados" en el #80), los tres CRUD del issue #49
 * (usuarios, empleados, roles), el reporte del contador (issue #24),
 * y botón de cerrar sesión.
 *
 * Issue #24: primer menú que no es igual para todo el mundo -- el
 * contador solo ve "Servicios por persona" (lo único a lo que tiene
 * acceso, ver `ProtectedRoute`/`App.tsx`); el resto de enlaces son
 * admin-only y no tendría sentido mostrárselos solo para que el click
 * lo mande al aviso de "no tiene ninguno de los roles necesarios".
 */
 
import type { JSX, ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
 
import { useAuth } from '../auth/AuthContext'
import logoLafs from '../assets/logo-lafs.png'
 
const ENLACES_ADMINISTRADOR = [
  { to: '/', etiqueta: 'Inicio' },
  { to: '/servicios-cerrados', etiqueta: 'Servicios cerrados' },
  { to: '/reportes/servicios', etiqueta: 'Servicios por persona' },
  { to: '/usuarios', etiqueta: 'Usuarios' },
  { to: '/empleados', etiqueta: 'Empleados' },
  { to: '/roles', etiqueta: 'Roles' },
]
 
const ENLACES_CONTADOR = [{ to: '/reportes/servicios', etiqueta: 'Servicios por persona' }]
 
function claseEnlace({ isActive }: { isActive: boolean }): string {
  return [
    'block rounded-lg px-4 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-blue text-white' : 'text-slate-700 hover:bg-slate-100',
  ].join(' ')
}
 
export function Layout({ children }: { children: ReactNode }): JSX.Element {
  const { perfil, roles, esAdministrador, cerrarSesion } = useAuth()
  const navigate = useNavigate()
  const enlaces = esAdministrador
    ? ENLACES_ADMINISTRADOR
    : roles.includes('contador')
      ? ENLACES_CONTADOR
      : []
 
  function manejarCerrarSesion(): void {
    cerrarSesion()
    navigate('/login', { replace: true })
  }
 
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-56 flex-col justify-between border-r border-slate-200 bg-white p-4">
        <div>
          <div className="mb-6 flex items-center gap-2 px-4">
            <img src={logoLafs} alt="L.A.F.S. Ambulancias" className="h-8 w-auto" />
            <h1 className="text-base font-semibold text-slate-900">L.A.F.S. Admin</h1>
          </div>
          <nav className="space-y-1">
            {enlaces.map((enlace) => (
              // `end` en "/" evita que NavLink lo marque "activo" en
              // cualquier otra ruta -- sin esto, al no ser exacto por
              // defecto, "Inicio" se vería resaltado también en
              // Usuarios/Empleados/Roles.
              <NavLink key={enlace.to} to={enlace.to} end={enlace.to === '/'} className={claseEnlace}>
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
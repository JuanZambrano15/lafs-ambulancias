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
 *
 * Issue #98: la barra lateral solo existe como columna fija desde
 * `lg` (escritorio). En pantallas más angostas pasa a ser una barra
 * superior con un botón "Menú" que despliega los mismos enlaces, para
 * que el contenido no quede apretado al lado de un menú de 224px. El
 * contenido va en un contenedor con ancho máximo para que, en monitores
 * grandes, las tablas no se estiren de lado a lado. También aquí vive
 * el botón de modo oscuro.
 */
 
import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
 
import { useAuth } from '../auth/AuthContext'
import logoLafs from '../assets/logo-lafs.png'
import { BotonTema } from './BotonTema'
 
const ENLACES_ADMINISTRADOR = [
  { to: '/', etiqueta: 'Inicio' },
  { to: '/servicios-cerrados', etiqueta: 'Servicios cerrados' },
  { to: '/flota', etiqueta: 'Estado de la flota' },
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
  // Solo importa por debajo de `lg`: en escritorio el menú siempre se ve
  // (las clases `lg:` ignoran este estado).
  const [menuAbierto, setMenuAbierto] = useState(false)
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
    <div className="min-h-screen bg-slate-50 lg:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          {/* alt vacío: el nombre ya está escrito al lado. */}
          <img src={logoLafs} alt="" className="h-8 w-auto" />
          <span className="text-base font-semibold text-slate-900">L.A.F.S. Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          aria-expanded={menuAbierto}
          aria-controls="menu-principal"
          className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Menú
        </button>
      </header>
 
      <aside
        id="menu-principal"
        className={`${menuAbierto ? 'flex' : 'hidden'} flex-col justify-between border-b border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0`}
      >
        <div>
          <div className="mb-6 hidden items-center gap-2 px-4 lg:flex">
            <img src={logoLafs} alt="L.A.F.S. Ambulancias" className="h-8 w-auto" />
            <h1 className="text-base font-semibold text-slate-900">L.A.F.S. Admin</h1>
          </div>
          <nav className="space-y-1" aria-label="Menú principal">
            {enlaces.map((enlace) => (
              // `end` en "/" evita que NavLink lo marque "activo" en
              // cualquier otra ruta -- sin esto, al no ser exacto por
              // defecto, "Inicio" se vería resaltado también en
              // Usuarios/Empleados/Roles.
              <NavLink
                key={enlace.to}
                to={enlace.to}
                end={enlace.to === '/'}
                className={claseEnlace}
                onClick={() => setMenuAbierto(false)}
              >
                {enlace.etiqueta}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="mb-3 px-4">
            <BotonTema className="w-full justify-center" />
          </div>
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
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
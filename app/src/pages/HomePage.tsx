/**
 * Pantalla principal: muestra solo las secciones que le corresponden
 * al rol (o roles) del usuario logueado. Las secciones todavía no
 * existen como pantallas propias (vienen en próximos issues: formatos
 * de traslado, atención SOAT, chequeos, inventario) — por ahora cada
 * una es un marcador de "Próximamente" para dejar lista la navegación
 * base que pide el issue #6.
 */

import type { JSX } from 'react'

import { useAuth } from '../auth/AuthContext'
import type { NombreRol } from '../lib/types'

interface Seccion {
  titulo: string
  descripcion: string
}

const SECCIONES_POR_ROL: Record<NombreRol, Seccion[]> = {
  administrador: [
    { titulo: 'Usuarios y roles', descripcion: 'Gestionar cuentas del sistema' },
    { titulo: 'Empleados', descripcion: 'Planta y personal ocasional' },
    { titulo: 'Ambulancias', descripcion: 'Flota, SOAT y tecnomecánica' },
  ],
  contador: [{ titulo: 'Ambulancias', descripcion: 'Consultar flota y vigencias' }],
  medico: [
    { titulo: 'Atención SOAT', descripcion: 'Registrar atención de accidente' },
    { titulo: 'Formato de traslado', descripcion: 'Diligenciar traslado de paciente' },
  ],
  auxiliar_enfermeria: [
    { titulo: 'Formato de traslado', descripcion: 'Diligenciar traslado de paciente' },
    { titulo: 'Chequeo de ambulancia', descripcion: 'Insumos y estado del vehículo' },
  ],
  conductor: [{ titulo: 'Chequeo de ambulancia', descripcion: 'Insumos y estado del vehículo' }],
}

export function HomePage(): JSX.Element {
  const { perfil, roles, cerrarSesion } = useAuth()

  const secciones = roles.flatMap((rol) => SECCIONES_POR_ROL[rol] ?? [])
  const sinDuplicados = Array.from(new Map(secciones.map((s) => [s.titulo, s])).values())

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">L.A.F.S. Ambulancias</h1>
          <p className="text-sm text-slate-500">Documento: {perfil?.documento}</p>
        </div>
        <button
          onClick={() => void cerrarSesion()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {sinDuplicados.length === 0 ? (
          <p className="text-slate-500">Tu usuario no tiene secciones asignadas todavía.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sinDuplicados.map((seccion) => (
              <li
                key={seccion.titulo}
                className="rounded-xl bg-white p-5 shadow-sm"
              >
                <h2 className="mb-1 font-medium text-slate-900">{seccion.titulo}</h2>
                <p className="mb-3 text-sm text-slate-500">{seccion.descripcion}</p>
                <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  Próximamente
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

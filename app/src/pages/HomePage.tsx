/**
 * Pantalla principal: muestra solo las secciones que le corresponden
 * al rol (o roles) del usuario logueado. Las secciones todavía no
 * existen como pantallas propias (vienen en próximos issues: formatos
 * de traslado, atención SOAT, chequeos, inventario) — por ahora cada
 * una es un marcador de "Próximamente" para dejar lista la navegación
 * base que pide el issue #6.
 */
 
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
 
import { useAuth } from '../auth/AuthContext'
import { listarAtencionesEnCurso } from '../lib/api'
import type { Atencion, NombreRol } from '../lib/types'
 
interface Seccion {
  titulo: string
  descripcion: string
  /** Si tiene ruta, la sección ya funciona y se puede entrar; si no, va como "Próximamente". */
  ruta?: string
}
 
const INICIAR_ATENCION: Seccion = {
  titulo: 'Iniciar atención',
  descripcion: 'Elegir móvil, conductor y tipo de atención',
  ruta: '/atenciones/nueva',
}
 
const SECCIONES_POR_ROL: Record<NombreRol, Seccion[]> = {
  administrador: [
    { titulo: 'Usuarios y roles', descripcion: 'Gestionar cuentas del sistema' },
    { titulo: 'Empleados', descripcion: 'Planta y personal ocasional' },
    { titulo: 'Ambulancias', descripcion: 'Flota, SOAT y tecnomecánica' },
  ],
  contador: [{ titulo: 'Ambulancias', descripcion: 'Consultar flota y vigencias' }],
  medico: [
    INICIAR_ATENCION,
    { titulo: 'Atención SOAT', descripcion: 'Registrar atención de accidente' },
    { titulo: 'Formato de traslado', descripcion: 'Diligenciar traslado de paciente' },
  ],
  auxiliar_enfermeria: [
    INICIAR_ATENCION,
    { titulo: 'Formato de traslado', descripcion: 'Diligenciar traslado de paciente' },
    { titulo: 'Chequeo de ambulancia', descripcion: 'Insumos y estado del vehículo' },
  ],
  conductor: [
    INICIAR_ATENCION,
    { titulo: 'Chequeo de ambulancia', descripcion: 'Insumos y estado del vehículo' },
  ],
}
 
/** Issue #51 — solo auxiliar_enfermeria/medico pueden ser responsables
 * de una atención (ver `require_personal_clinico` en el backend), así
 * que solo a ellos vale la pena preguntarles por atenciones en curso. */
function puedeTenerAtencionesEnCurso(roles: NombreRol[]): boolean {
  return roles.includes('auxiliar_enfermeria') || roles.includes('medico')
}
 
/** A dónde manda "Continuar": el formato de traslado siempre arranca
 * por el encabezado (precarga lo que ya haya y de ahí sigue solo al
 * clínico al guardar — ver EncabezadoTrasladoPage), así que no hace
 * falta que este endpoint diga si el encabezado ya existe o no. La
 * atención SOAT (issue #17) todavía no tiene pantalla propia. */
function rutaParaContinuar(atencion: Atencion): string | null {
  if (atencion.tipo === 'traslado') return `/atenciones/${atencion.id}/encabezado-traslado`
  return null
}
 
export function HomePage(): JSX.Element {
  const { perfil, roles, cerrarSesion } = useAuth()
  const [atencionesEnCurso, setAtencionesEnCurso] = useState<Atencion[]>([])
 
  useEffect(() => {
    if (!puedeTenerAtencionesEnCurso(roles)) return
    listarAtencionesEnCurso()
      .then(setAtencionesEnCurso)
      .catch(() => {
        // Si falla, Home sigue funcionando igual -- no es más grave
        // que no ver el aviso de "servicio en curso" esta vez.
      })
  }, [roles])
 
  const secciones = roles.flatMap((rol) => SECCIONES_POR_ROL[rol] ?? [])
  // "Mi firma" no depende del rol sino de `tipo_vinculacion` del
  // empleado (issue #11) — solo planta puede guardar una firma
  // reutilizable, así que a personal ocasional no se le muestra.
  if (perfil?.empleado_tipo_vinculacion === 'planta') {
    secciones.push({
      titulo: 'Mi firma',
      descripcion: 'Configurar la firma que se reutiliza al diligenciar formatos',
      ruta: '/configurar-firma',
    })
  }
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
        {atencionesEnCurso.length > 0 && (
          <ul className="mb-6 flex flex-col gap-3">
            {atencionesEnCurso.map((atencion) => {
              const ruta = rutaParaContinuar(atencion)
              return (
                <li
                  key={atencion.id}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-medium text-amber-900">
                        Servicio en curso — móvil {atencion.ambulancia.movil}
                      </h2>
                      <p className="text-sm text-amber-700">
                        {atencion.tipo === 'traslado' ? 'Traslado asistencial' : 'Atención SOAT'}
                        , iniciado sin cerrar todavía.
                      </p>
                    </div>
                    {ruta ? (
                      <Link
                        to={ruta}
                        className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white"
                      >
                        Continuar
                      </Link>
                    ) : (
                      <span className="shrink-0 text-xs text-amber-700">
                        Sin pantalla todavía
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {sinDuplicados.length === 0 ? (
          <p className="text-slate-500">Tu usuario no tiene secciones asignadas todavía.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sinDuplicados.map((seccion) => (
              <li key={seccion.titulo} className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="mb-1 font-medium text-slate-900">{seccion.titulo}</h2>
                <p className="mb-3 text-sm text-slate-500">{seccion.descripcion}</p>
                {seccion.ruta ? (
                  <Link
                    to={seccion.ruta}
                    className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    Empezar
                  </Link>
                ) : (
                  <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    Próximamente
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
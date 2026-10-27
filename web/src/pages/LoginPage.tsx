import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import type { Location } from 'react-router-dom'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
 
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'
import type { MeResponse } from '../lib/types'
import logoLafs from '../assets/logo-lafs.png'
 
/** A dónde cae cada quien después de iniciar sesión, cuando no venía
 * de una ruta protegida puntual (`location.state.desde`) -- issue
 * #24: el contador no tiene acceso a "/" (el dashboard es solo
 * administrador), así que mandarlo ahí lo dejaría viendo el aviso de
 * "no tiene ninguno de los roles necesarios" sin ningún enlace a su
 * propia pantalla. Quien es administrador Y contador a la vez cae en
 * "/" igual, porque sí puede verlo.
 */
function rutaDeInicioPara(perfil: MeResponse): string {
  const nombresRoles = perfil.roles.map((rol) => rol.nombre)
  if (nombresRoles.includes('administrador')) return '/'
  if (nombresRoles.includes('contador')) return '/reportes/servicios'
  return '/'
}
 
export function LoginPage(): JSX.Element {
  const { perfil, iniciarSesion } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
 
  const [documento, setDocumento] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
 
  // Ya hay sesión (p. ej. llegó a /login a mano): no tiene sentido pedirle que inicie de nuevo.
  if (perfil) {
    const destino = (location.state as { desde?: Pick<Location, 'pathname'> } | null)?.desde
      ?.pathname ?? rutaDeInicioPara(perfil)
    return <Navigate to={destino} replace />
  }
 
  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const perfilFresco = await iniciarSesion(documento, password)
      navigate(rutaDeInicioPara(perfilFresco), { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }
 
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={manejarEnvio} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <img src={logoLafs} alt="L.A.F.S. Ambulancias" className="mx-auto mb-3 h-14 w-auto" />
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">L.A.F.S. Ambulancias</h1>
        <p className="mb-6 text-sm text-slate-500">
          Panel de administración — ingresa con tu documento y contraseña.
        </p>
 
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="documento">
          Documento
        </label>
        <input
          id="documento"
          name="documento"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          required
          value={documento}
          onChange={(evento) => setDocumento(evento.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />
 
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand-blue focus:outline-none"
        />
 
        {error && (
          <p role="alert" className="mb-4 text-sm text-brand-orange-dark">
            {error}
          </p>
        )}
 
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-brand-blue py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
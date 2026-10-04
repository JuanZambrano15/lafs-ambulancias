import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import type { Location } from 'react-router-dom'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'

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
      ?.pathname ?? '/'
    return <Navigate to={destino} replace />
  }

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await iniciarSesion(documento, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={manejarEnvio}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md"
      >
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">L.A.F.S. Ambulancias</h1>
        <p className="mb-6 text-sm text-slate-500">Ingresa con tu documento y contraseña.</p>

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
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
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
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
        />

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

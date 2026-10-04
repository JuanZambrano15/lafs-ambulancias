/**
 * Cambio de contraseña obligatorio en el primer login (la contraseña
 * inicial es igual al documento — ver ADR 0003 del backend). También
 * sirve como cambio de contraseña "normal" si el usuario entra aquí
 * sin estar forzado.
 */

import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { ApiError, cambiarPassword } from '../lib/api'

export function CambiarPasswordPage(): JSX.Element {
  const { perfil, refrescarPerfil } = useAuth()
  const navigate = useNavigate()

  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNueva, setPasswordNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)

    if (passwordNueva !== confirmacion) {
      setError('Las contraseñas nuevas no coinciden')
      return
    }
    if (passwordNueva.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres')
      return
    }

    setEnviando(true)
    try {
      await cambiarPassword(passwordActual, passwordNueva)
      await refrescarPerfil()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña')
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
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Cambia tu contraseña</h1>
        <p className="mb-6 text-sm text-slate-500">
          {perfil?.debe_cambiar_password
            ? 'Por seguridad, debes definir una contraseña propia antes de continuar.'
            : 'Define una nueva contraseña para tu cuenta.'}
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password-actual">
          Contraseña actual
        </label>
        <input
          id="password-actual"
          type="password"
          autoComplete="current-password"
          required
          value={passwordActual}
          onChange={(evento) => setPasswordActual(evento.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password-nueva">
          Contraseña nueva
        </label>
        <input
          id="password-nueva"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={passwordNueva}
          onChange={(evento) => setPasswordNueva(evento.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="confirmacion">
          Confirma la contraseña nueva
        </label>
        <input
          id="confirmacion"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmacion}
          onChange={(evento) => setConfirmacion(evento.target.value)}
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
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  )
}

/**
 * Define o cambia el PIN de firma, obligatorio antes de usar el resto
 * de la app (issue #12, ADR-0010) — mismo patrón que
 * `CambiarPasswordPage` para la contraseña, pero con un PIN numérico
 * de 4 dígitos en vez de una contraseña.
 *
 * Además de mandarlo al backend (`PUT /auth/pin`), guarda un hash
 * local (`lib/pinLocal.ts`) para poder validar el PIN sin conexión al
 * cerrar una atención — el servidor sigue siendo la autorización real.
 */
 
import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useNavigate } from 'react-router-dom'
 
import { useAuth } from '../auth/AuthContext'
import { ApiError, establecerPin } from '../lib/api'
import { guardarPinLocal } from '../lib/pinLocal'
 
const PIN_VALIDO = /^\d{4}$/
 
export function ConfigurarPinPage(): JSX.Element {
  const { perfil, refrescarPerfil } = useAuth()
  const navigate = useNavigate()
 
  const [pin, setPin] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
 
  async function manejarEnvio(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    setError(null)
 
    if (!PIN_VALIDO.test(pin)) {
      setError('El PIN debe ser de 4 dígitos')
      return
    }
    if (pin !== confirmacion) {
      setError('Los PIN no coinciden')
      return
    }
 
    setEnviando(true)
    try {
      await establecerPin(pin)
      await guardarPinLocal(pin)
      await refrescarPerfil()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el PIN')
    } finally {
      setEnviando(false)
    }
  }
 
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form onSubmit={manejarEnvio} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">Define tu PIN de firma</h1>
        <p className="mb-6 text-sm text-slate-500">
          {perfil?.pin_configurado
            ? 'Define un nuevo PIN de 4 dígitos.'
            : 'Lo vas a necesitar para cerrar los formatos que diligencies — defínelo antes de continuar.'}
        </p>
 
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="pin">
          PIN (4 dígitos)
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="off"
          required
          value={pin}
          onChange={(evento) => setPin(evento.target.value.replace(/\D/g, '').slice(0, 4))}
          className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
        />
 
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="pin-confirmacion">
          Confirma el PIN
        </label>
        <input
          id="pin-confirmacion"
          type="password"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="off"
          required
          value={confirmacion}
          onChange={(evento) => setConfirmacion(evento.target.value.replace(/\D/g, '').slice(0, 4))}
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
          {enviando ? 'Guardando…' : 'Guardar PIN'}
        </button>
      </form>
    </div>
  )
}
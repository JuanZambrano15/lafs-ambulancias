/**
 * Configurar la firma reutilizable (issue #11, ADR-0009) — solo tiene
 * sentido para personal de planta: la ocasional dibuja su firma en
 * pantalla cada vez que firma un formato, sin guardarla aquí. Se
 * puede volver a esta pantalla las veces que haga falta para
 * rehacerla (sobreescribe la anterior).
 */
 
import { useRef, useState } from 'react'
import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'
 
import { useAuth } from '../auth/AuthContext'
import { FirmaCanvas, type FirmaCanvasHandle } from '../components/FirmaCanvas'
import { ApiError, guardarFirma } from '../lib/api'
 
export function ConfigurarFirmaPage(): JSX.Element {
  const { perfil, refrescarPerfil } = useAuth()
  const navigate = useNavigate()
  const canvasRef = useRef<FirmaCanvasHandle>(null)
 
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
 
  const esPlanta = perfil?.empleado_tipo_vinculacion === 'planta'
 
  async function manejarGuardar(): Promise<void> {
    const firma = canvasRef.current?.exportar()
    if (!firma) {
      setError('Dibuja tu firma antes de guardar')
      return
    }
    setError(null)
    setGuardando(true)
    try {
      await guardarFirma(firma)
      await refrescarPerfil()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la firma')
    } finally {
      setGuardando(false)
    }
  }
 
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-sm">
        <button onClick={() => navigate(-1)} className="mb-4 text-sm font-medium text-slate-500">
          ← Volver
        </button>
 
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Configurar mi firma</h1>
 
          {!esPlanta ? (
            <p className="text-sm text-slate-500">
              Solo el personal de planta puede guardar una firma reutilizable. Como personal
              ocasional, firmas en pantalla cada vez que diligencias un formato.
            </p>
          ) : (
            <>
              <p className="mb-6 text-sm text-slate-500">
                Esta firma se usará automáticamente cada vez que diligencies un formato. Puedes
                volver aquí cuando quieras para rehacerla.
              </p>
 
              <FirmaCanvas ref={canvasRef} imagenInicial={perfil?.firma_guardada ?? null} />
 
              <button
                type="button"
                onClick={() => canvasRef.current?.limpiar()}
                className="mt-2 text-sm font-medium text-slate-500"
              >
                Borrar y empezar de nuevo
              </button>
 
              {error && (
                <p role="alert" className="mt-4 text-sm text-red-600">
                  {error}
                </p>
              )}
 
              <button
                type="button"
                onClick={() => void manejarGuardar()}
                disabled={guardando}
                className="mt-4 w-full rounded-lg bg-blue-600 py-3 text-base font-medium text-white disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar firma'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
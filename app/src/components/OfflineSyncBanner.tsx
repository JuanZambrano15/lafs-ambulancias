/**
 * Aviso fijo en toda la app (issue #10): cuántos traslados quedaron
 * guardados sin conexión en este dispositivo, y un botón para
 * sincronizarlos ahora. Se sincroniza solo cuando el dispositivo
 * recupera señal (evento `online`), nunca a mitad de un formulario
 * que se está llenando — ver ADR-0008.
 */
 
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
 
import { contarPendientes, sincronizarPendientes } from '../lib/trasladoOffline'
 
export function OfflineSyncBanner(): JSX.Element | null {
  const [pendientes, setPendientes] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
 
  const sincronizar = useCallback(async (): Promise<void> => {
    setSincronizando(true)
    setMensaje(null)
    try {
      const { sincronizados, fallidos } = await sincronizarPendientes()
      const partes: string[] = []
      if (sincronizados > 0) partes.push(`${sincronizados} traslado(s) sincronizado(s)`)
      if (fallidos > 0) partes.push(`${fallidos} no se pudieron sincronizar todavía`)
      if (partes.length > 0) setMensaje(partes.join(' — '))
    } finally {
      setPendientes(await contarPendientes())
      setSincronizando(false)
    }
  }, [])
 
  useEffect(() => {
    // Carga inicial del conteo — vía `.then()`, no un `await` directo
    // en el cuerpo del efecto (mismo patrón que el resto de las
    // pantallas al cargar datos en un `useEffect`).
    contarPendientes()
      .then((n) => setPendientes(n))
      .catch(() => {
        // Si falla (p. ej. el storage local no está disponible), no
        // hay nada que mostrar todavía — no es un error del usuario.
      })
 
    const alRecuperarSenal = (): void => {
      void sincronizar()
    }
    window.addEventListener('online', alRecuperarSenal)
    return () => window.removeEventListener('online', alRecuperarSenal)
  }, [sincronizar])
 
  if (pendientes === 0 && mensaje === null) return null
 
  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <span>
        {sincronizando
          ? 'Sincronizando traslados pendientes…'
          : pendientes > 0
            ? `${pendientes} traslado(s) guardado(s) sin conexión, pendientes por sincronizar.`
            : mensaje}
      </span>
      {pendientes > 0 && !sincronizando && (
        <button onClick={() => void sincronizar()} className="shrink-0 font-medium underline">
          Sincronizar ahora
        </button>
      )}
    </div>
  )
}
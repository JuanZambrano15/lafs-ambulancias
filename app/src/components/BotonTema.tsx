/**
 * Botón para alternar entre modo claro y oscuro (issue #98).
 *
 * Es un botón de alternar (`aria-pressed`), no un interruptor ni un
 * desplegable: el nombre accesible es siempre "Modo oscuro" y el
 * estado (activado o no) lo anuncia `aria-pressed`, así el lector de
 * pantalla no lee una etiqueta distinta cada vez que se pulsa.
 */

import { useState } from 'react'
import type { JSX } from 'react'

import { aplicarTema, guardarTema, temaAplicado } from '../lib/tema'
import type { Tema } from '../lib/tema'

interface BotonTemaProps {
  /** Solo el ícono en pantallas pequeñas (el texto queda para el
   * lector de pantalla). */
  compacto?: boolean
  className?: string
}

export function BotonTema({ compacto = false, className = '' }: BotonTemaProps): JSX.Element {
  // Se lee lo que ya está aplicado en <html> (lo dejó ahí index.html o
  // main.tsx), no se recalcula: así el botón nunca contradice lo que
  // se ve en pantalla.
  const [tema, setTema] = useState<Tema>(temaAplicado)
  const oscuro = tema === 'oscuro'

  function alternar(): void {
    const siguiente: Tema = oscuro ? 'claro' : 'oscuro'
    aplicarTema(siguiente)
    guardarTema(siguiente)
    setTema(siguiente)
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={oscuro}
      title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${className}`}
    >
      {oscuro ? (
        // Sol: lo que se obtiene al pulsar.
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Luna.
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      <span className={compacto ? 'sr-only sm:not-sr-only' : undefined}>Modo oscuro</span>
    </button>
  )
}
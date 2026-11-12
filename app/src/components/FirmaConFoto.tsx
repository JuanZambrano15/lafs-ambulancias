/**
 * Firma de un tercero (el profesional de la IPS/ESE que entrega o que
 * recibe al paciente): además de dibujarla en el recuadro, se puede
 * tomar una foto con la cámara de la tablet o adjuntar una imagen ya
 * guardada. Lo normal en el servicio es la foto en el momento; adjuntar
 * un archivo sirve para la demostración y para cuando la firma ya
 * existe en papel o en otro dispositivo.
 *
 * Expone el mismo handle que `FirmaCanvas` (`exportar`, `limpiar`,
 * `estaVacio`), así que las pantallas lo usan igual que antes: piden el
 * resultado por la ref al guardar. Si hay una foto, `exportar` devuelve
 * esa foto (JPEG reducido, ver `lib/imagenFirma.ts`); si no, lo dibujado.
 *
 * El botón "Tomar foto" usa `<input type="file" capture>` (igual que las
 * fotos del accidente SOAT): en el WebView de Capacitor abre la cámara
 * sin necesidad de ningún plugin ni permiso extra en el manifest.
 */

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

import { archivoADataUrlFirma } from '../lib/imagenFirma'
import { FirmaCanvas, type FirmaCanvasHandle } from './FirmaCanvas'

interface FirmaConFotoProps {
  /** Lo que ya estaba guardado para este formato. Una foto (JPEG) se
   * muestra como foto; un dibujo (PNG) se precarga en el recuadro. */
  imagenInicial?: string | null
  alto?: number
  /** Bloquea dibujar y cargar imagen mientras no haya a quién
   * atribuirle la firma. */
  disabled?: boolean
}

function esFoto(dataUrl: string | null | undefined): dataUrl is string {
  return typeof dataUrl === 'string' && dataUrl.startsWith('data:image/jpeg')
}

const BOTON =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50'

export const FirmaConFoto = forwardRef<FirmaCanvasHandle, FirmaConFotoProps>(function FirmaConFoto(
  { imagenInicial, alto = 120, disabled = false },
  ref,
) {
  const canvasRef = useRef<FirmaCanvasHandle>(null)
  const inputCamaraRef = useRef<HTMLInputElement>(null)
  const inputArchivoRef = useRef<HTMLInputElement>(null)
  const [foto, setFoto] = useState<string | null>(esFoto(imagenInicial) ? imagenInicial : null)
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)

  useImperativeHandle(
    ref,
    () => ({
      exportar: () => foto ?? canvasRef.current?.exportar() ?? null,
      limpiar: () => {
        setFoto(null)
        setError(null)
        canvasRef.current?.limpiar()
      },
      estaVacio: () => foto === null && (canvasRef.current?.estaVacio() ?? true),
    }),
    [foto],
  )

  async function manejarArchivo(evento: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const archivo = evento.target.files?.[0]
    // Se limpia el input para poder volver a elegir el mismo archivo.
    evento.target.value = ''
    if (!archivo) return
    setError(null)
    setLeyendo(true)
    try {
      setFoto(await archivoADataUrlFirma(archivo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la imagen.')
    } finally {
      setLeyendo(false)
    }
  }

  return (
    <div>
      {foto ? (
        <img
          src={foto}
          alt="Foto de la firma"
          className="h-32 w-full rounded-lg border border-slate-300 bg-white object-contain"
        />
      ) : (
        <FirmaCanvas
          ref={canvasRef}
          imagenInicial={esFoto(imagenInicial) ? null : imagenInicial}
          alto={alto}
          disabled={disabled}
        />
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={BOTON}
          disabled={disabled || leyendo}
          onClick={() => inputCamaraRef.current?.click()}
        >
          Tomar foto
        </button>
        <button
          type="button"
          className={BOTON}
          disabled={disabled || leyendo}
          onClick={() => inputArchivoRef.current?.click()}
        >
          Adjuntar imagen
        </button>
        <button
          type="button"
          className={BOTON}
          disabled={disabled || leyendo}
          onClick={() => {
            setFoto(null)
            setError(null)
            canvasRef.current?.limpiar()
          }}
        >
          {foto ? 'Quitar foto' : 'Borrar firma'}
        </button>
      </div>

      <input
        ref={inputCamaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Foto de la firma con la cámara"
        onChange={(e) => void manejarArchivo(e)}
      />
      <input
        ref={inputArchivoRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Imagen de la firma desde un archivo"
        onChange={(e) => void manejarArchivo(e)}
      />

      {leyendo && <p className="mt-1 text-xs text-slate-500">Procesando la imagen…</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm text-brand-orange-dark">
          {error}
        </p>
      )}
    </div>
  )
})
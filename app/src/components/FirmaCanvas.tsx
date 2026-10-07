/**
 * Recuadro para dibujar una firma con el dedo o el mouse (issue #11):
 * el clásico "firme aquí" de una tablet. Exporta lo dibujado como PNG
 * en base64 (`canvas.toDataURL()`) — no hay nada más que instalar, es
 * lo que cualquier canvas HTML ya sabe hacer.
 *
 * Es un componente "no controlado": el trazo vive dentro del canvas,
 * no en el estado de React (redibujar en cada pixel movido sería
 * carísimo). El padre pide el resultado a través de la ref
 * (`exportar`, `limpiar`, `estaVacio`) en vez de con un prop `value`.
 */
 
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
 
export interface FirmaCanvasHandle {
  /** `null` si no se ha dibujado nada todavía. */
  exportar: () => string | null
  limpiar: () => void
  estaVacio: () => boolean
}
 
interface FirmaCanvasProps {
  /** Data URL a precargar (p. ej. la firma guardada, para "rehacerla"). */
  imagenInicial?: string | null
  alto?: number
  className?: string
}
 
export const FirmaCanvas = forwardRef<FirmaCanvasHandle, FirmaCanvasProps>(
  function FirmaCanvas({ imagenInicial, alto = 160, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const dibujandoRef = useRef(false)
    const vacioRef = useRef(true)
 
    function contexto(): CanvasRenderingContext2D | null {
      return canvasRef.current?.getContext('2d') ?? null
    }
 
    useEffect(() => {
      const canvas = canvasRef.current
      const ctx = contexto()
      if (!canvas || !ctx) return
 
      // Escala por devicePixelRatio para que la línea no se vea
      // pixelada en pantallas de alta densidad (la mayoría de tablets).
      const relacion = window.devicePixelRatio || 1
      const ancho = canvas.clientWidth
      canvas.width = ancho * relacion
      canvas.height = alto * relacion
      ctx.scale(relacion, relacion)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#1e293b'
 
      if (imagenInicial) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, ancho, alto)
          vacioRef.current = false
        }
        img.src = imagenInicial
      }
      // Solo al montar: si `imagenInicial` cambia después, el padre
      // suele querer mantener lo que el usuario ya dibujó encima.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
 
    function posicion(evento: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
      const rect = evento.currentTarget.getBoundingClientRect()
      return { x: evento.clientX - rect.left, y: evento.clientY - rect.top }
    }
 
    function manejarPointerDown(evento: React.PointerEvent<HTMLCanvasElement>): void {
      const ctx = contexto()
      if (!ctx) return
      evento.currentTarget.setPointerCapture(evento.pointerId)
      dibujandoRef.current = true
      const { x, y } = posicion(evento)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
 
    function manejarPointerMove(evento: React.PointerEvent<HTMLCanvasElement>): void {
      if (!dibujandoRef.current) return
      const ctx = contexto()
      if (!ctx) return
      const { x, y } = posicion(evento)
      ctx.lineTo(x, y)
      ctx.stroke()
      vacioRef.current = false
    }
 
    function terminarTrazo(evento: React.PointerEvent<HTMLCanvasElement>): void {
      dibujandoRef.current = false
      evento.currentTarget.releasePointerCapture(evento.pointerId)
    }
 
    useImperativeHandle(ref, () => ({
      exportar: () => (vacioRef.current ? null : (canvasRef.current?.toDataURL('image/png') ?? null)),
      limpiar: () => {
        const canvas = canvasRef.current
        const ctx = contexto()
        if (!canvas || !ctx) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        vacioRef.current = true
      },
      estaVacio: () => vacioRef.current,
    }))
 
    return (
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Recuadro para firmar"
        onPointerDown={manejarPointerDown}
        onPointerMove={manejarPointerMove}
        onPointerUp={terminarTrazo}
        onPointerLeave={(e) => dibujandoRef.current && terminarTrazo(e)}
        style={{ height: alto, width: '100%', touchAction: 'none' }}
        className={className ?? 'rounded-lg border border-slate-300 bg-white'}
      />
    )
  },
)
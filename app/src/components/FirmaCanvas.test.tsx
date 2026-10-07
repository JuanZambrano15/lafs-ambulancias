/**
 * jsdom no implementa canvas 2D de verdad — se reemplaza
 * `getContext`/`toDataURL` por un doble mínimo que solo registra
 * llamadas, para probar la lógica del componente (vacío/no vacío,
 * exportar, limpiar, precarga) sin depender de un render real.
 */
import { createRef } from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import { FirmaCanvas, type FirmaCanvasHandle } from './FirmaCanvas'
 
const EXPORTADA = 'data:image/png;base64,EXPORTADA'
 
/** jsdom no carga imágenes de verdad — sin esto, `img.onload` del
 * componente nunca dispara y la precarga quedaría imposible de probar. */
class ImagenFalsa {
  onload: (() => void) | null = null
  set src(_valor: string) {
    setTimeout(() => this.onload?.(), 0)
  }
}
 
function instalarContextoFalso(): void {
  vi.stubGlobal('Image', ImagenFalsa)
  const ctxFalso = {
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    lineWidth: 0,
    lineCap: '',
    strokeStyle: '',
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctxFalso as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(EXPORTADA)
  // jsdom no define estos dos en absoluto (ni siquiera como no-op) —
  // hay que asignarlos directo, `spyOn` exige que la propiedad ya exista.
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()
}
 
beforeEach(() => {
  instalarContextoFalso()
})
 
describe('FirmaCanvas', () => {
  it('arranca vacío y exportar() devuelve null', () => {
    const ref = createRef<FirmaCanvasHandle>()
    render(<FirmaCanvas ref={ref} />)
 
    expect(ref.current?.estaVacio()).toBe(true)
    expect(ref.current?.exportar()).toBeNull()
  })
 
  it('dibujar un trazo lo deja no-vacío y exportar() trae el PNG', () => {
    const ref = createRef<FirmaCanvasHandle>()
    const { container } = render(<FirmaCanvas ref={ref} />)
    const canvas = container.querySelector('canvas')!
 
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
    )
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 20, bubbles: true }),
    )
 
    expect(ref.current?.estaVacio()).toBe(false)
    expect(ref.current?.exportar()).toBe(EXPORTADA)
  })
 
  it('limpiar() vuelve a dejarlo vacío', () => {
    const ref = createRef<FirmaCanvasHandle>()
    const { container } = render(<FirmaCanvas ref={ref} />)
    const canvas = container.querySelector('canvas')!
 
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
    )
    canvas.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 20, bubbles: true }),
    )
    ref.current?.limpiar()
 
    expect(ref.current?.estaVacio()).toBe(true)
    expect(ref.current?.exportar()).toBeNull()
  })
 
  it('con una imagen inicial, arranca no-vacío', async () => {
    const ref = createRef<FirmaCanvasHandle>()
    render(<FirmaCanvas ref={ref} imagenInicial="data:image/png;base64,PRECARGADA" />)
 
    // El <img> interno dispara `onload` de forma asíncrona.
    await vi.waitFor(() => {
      expect(ref.current?.estaVacio()).toBe(false)
    })
    expect(ref.current?.exportar()).toBe(EXPORTADA)
  })
})
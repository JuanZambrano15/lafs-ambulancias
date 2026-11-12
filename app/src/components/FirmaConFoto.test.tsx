/**
 * La conversión real de la foto (canvas + JPEG) no corre en jsdom, así
 * que `archivoADataUrlFirma` se reemplaza por un doble. Aquí se prueba
 * lo que hace el componente con el resultado: mostrarlo, exportarlo
 * por la ref y volver al recuadro de dibujo.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { archivoADataUrlFirma } from '../lib/imagenFirma'
import type { FirmaCanvasHandle } from './FirmaCanvas'
import { FirmaConFoto } from './FirmaConFoto'

vi.mock('../lib/imagenFirma', () => ({ archivoADataUrlFirma: vi.fn() }))

const FOTO = 'data:image/jpeg;base64,FOTO'
const ARCHIVO = new File(['x'], 'firma.jpg', { type: 'image/jpeg' })

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom no implementa el canvas 2D (ver FirmaCanvas.test.tsx).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

function montar(props: { imagenInicial?: string | null; disabled?: boolean } = {}) {
  const ref = createRef<FirmaCanvasHandle>()
  render(<FirmaConFoto ref={ref} {...props} />)
  return ref
}

describe('FirmaConFoto', () => {
  it('ofrece dibujar, tomar foto y adjuntar una imagen', () => {
    montar()

    expect(screen.getByRole('img', { name: 'Recuadro para firmar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adjuntar imagen' })).toBeInTheDocument()
  })

  it('"Tomar foto" abre la cámara trasera y "Adjuntar imagen" el selector de archivos', () => {
    montar()

    const camara = screen.getByLabelText('Foto de la firma con la cámara')
    const archivo = screen.getByLabelText('Imagen de la firma desde un archivo')
    expect(camara).toHaveAttribute('capture', 'environment')
    expect(camara).toHaveAttribute('accept', 'image/*')
    expect(archivo).not.toHaveAttribute('capture')
    expect(archivo).toHaveAttribute('accept', 'image/*')
  })

  it('al tomar una foto la muestra y la exporta como la firma', async () => {
    vi.mocked(archivoADataUrlFirma).mockResolvedValue(FOTO)
    const ref = montar()

    await userEvent.upload(screen.getByLabelText('Foto de la firma con la cámara'), ARCHIVO)

    expect(await screen.findByRole('img', { name: 'Foto de la firma' })).toHaveAttribute('src', FOTO)
    expect(ref.current?.exportar()).toBe(FOTO)
    expect(ref.current?.estaVacio()).toBe(false)
    expect(screen.queryByRole('img', { name: 'Recuadro para firmar' })).not.toBeInTheDocument()
  })

  it('al adjuntar un archivo pasa por la misma conversión', async () => {
    vi.mocked(archivoADataUrlFirma).mockResolvedValue(FOTO)
    const ref = montar()

    await userEvent.upload(screen.getByLabelText('Imagen de la firma desde un archivo'), ARCHIVO)

    await waitFor(() => expect(ref.current?.exportar()).toBe(FOTO))
    expect(archivoADataUrlFirma).toHaveBeenCalledWith(ARCHIVO)
  })

  it('"Quitar foto" vuelve al recuadro de dibujo y deja la firma vacía', async () => {
    vi.mocked(archivoADataUrlFirma).mockResolvedValue(FOTO)
    const ref = montar()
    await userEvent.upload(screen.getByLabelText('Foto de la firma con la cámara'), ARCHIVO)
    await screen.findByRole('img', { name: 'Foto de la firma' })

    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto' }))

    expect(screen.getByRole('img', { name: 'Recuadro para firmar' })).toBeInTheDocument()
    expect(ref.current?.exportar()).toBeNull()
    expect(ref.current?.estaVacio()).toBe(true)
  })

  it('una foto ya guardada (JPEG) se muestra como foto', () => {
    const ref = montar({ imagenInicial: FOTO })

    expect(screen.getByRole('img', { name: 'Foto de la firma' })).toHaveAttribute('src', FOTO)
    expect(ref.current?.exportar()).toBe(FOTO)
  })

  it('un dibujo ya guardado (PNG) se precarga en el recuadro, no como foto', () => {
    montar({ imagenInicial: 'data:image/png;base64,DIBUJO' })

    expect(screen.getByRole('img', { name: 'Recuadro para firmar' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Foto de la firma' })).not.toBeInTheDocument()
  })

  it('avisa si la imagen no se pudo procesar y no cambia la firma', async () => {
    vi.mocked(archivoADataUrlFirma).mockRejectedValue(new Error('El archivo elegido no es una imagen.'))
    const ref = montar()

    await userEvent.upload(screen.getByLabelText('Imagen de la firma desde un archivo'), ARCHIVO)

    expect(await screen.findByRole('alert')).toHaveTextContent('no es una imagen')
    expect(ref.current?.exportar()).toBeNull()
  })

  it('deshabilitado no deja tomar foto ni adjuntar', () => {
    montar({ disabled: true })

    expect(screen.getByRole('button', { name: 'Tomar foto' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adjuntar imagen' })).toBeDisabled()
  })
})
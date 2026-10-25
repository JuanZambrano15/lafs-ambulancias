
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import type { FormatoAccidenteSoatFoto } from '../lib/types'
import { FotosAccidenteSoatPage } from './FotosAccidenteSoatPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
 
// jsdom no implementa `URL.createObjectURL`/`revokeObjectURL` (mismo
// motivo que el stub de `ResizeObserver` en `test/setup.ts`) -- esta
// pantalla es la única que los usa, así que se mockean solo aquí.
beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})
 
const FOTO: FormatoAccidenteSoatFoto = {
  id: 1,
  atencion_id: 1,
  content_type: 'image/png',
  tamanio_bytes: 1234,
  subida_por: { id: 5, documento: '700000001' },
  subida_en: '01/01/2027 08:05',
}
 
function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/atenciones/1/fotos-accidente-soat']}>
      <Routes>
        <Route path="/" element={<div>pantalla principal</div>} />
        <Route
          path="/atenciones/:atencionId/fotos-accidente-soat"
          element={<FotosAccidenteSoatPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}
 
describe('FotosAccidenteSoatPage', () => {
  it('avisa cuando todavía no hay fotos adjuntas', async () => {
    vi.mocked(api.listarFotosAccidenteSoat).mockResolvedValue([])
 
    renderPagina()
 
    expect(await screen.findByText('Todavía no hay fotos adjuntas.')).toBeInTheDocument()
  })
 
  it('muestra un error si la lista no se pudo cargar', async () => {
    vi.mocked(api.listarFotosAccidenteSoat).mockRejectedValue(
      new api.ApiError(403, 'No puedes ver las fotos de esta atención'),
    )
 
    renderPagina()
 
    expect(
      await screen.findByText('No puedes ver las fotos de esta atención'),
    ).toBeInTheDocument()
  })
 
  it('pide la miniatura de cada foto ya subida', async () => {
    vi.mocked(api.listarFotosAccidenteSoat).mockResolvedValue([FOTO])
    vi.mocked(api.descargarFotoAccidenteSoat).mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
 
    renderPagina()
 
    await waitFor(() => expect(api.descargarFotoAccidenteSoat).toHaveBeenCalledWith(1, 1))
    expect(await screen.findByAltText('Foto subida el 01/01/2027 08:05')).toHaveAttribute(
      'src',
      'blob:mock-url',
    )
  })
 
  it('sube la foto elegida y la agrega a la lista', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarFotosAccidenteSoat).mockResolvedValue([])
    const fotoSubida: FormatoAccidenteSoatFoto = { ...FOTO, id: 2 }
    vi.mocked(api.subirFotoAccidenteSoat).mockResolvedValue(fotoSubida)
 
    renderPagina()
    await screen.findByText('Todavía no hay fotos adjuntas.')
 
    const archivo = new File(['contenido'], 'foto.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await usuario.upload(input, archivo)
 
    await waitFor(() =>
      expect(api.subirFotoAccidenteSoat).toHaveBeenCalledWith(1, archivo, 'foto.png'),
    )
    expect(screen.queryByText('Todavía no hay fotos adjuntas.')).not.toBeInTheDocument()
  })
 
  it('muestra un error si la subida falla', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.listarFotosAccidenteSoat).mockResolvedValue([])
    vi.mocked(api.subirFotoAccidenteSoat).mockRejectedValue(
      new api.ApiError(413, 'El archivo es demasiado grande'),
    )
 
    renderPagina()
    await screen.findByText('Todavía no hay fotos adjuntas.')
 
    const archivo = new File(['contenido'], 'foto.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await usuario.upload(input, archivo)
 
    expect(await screen.findByText('El archivo es demasiado grande')).toBeInTheDocument()
  })
 
  it('borra la foto tras confirmar', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(api.listarFotosAccidenteSoat).mockResolvedValue([FOTO])
    vi.mocked(api.descargarFotoAccidenteSoat).mockResolvedValue(new Blob(['x']))
    vi.mocked(api.eliminarFotoAccidenteSoat).mockResolvedValue(undefined)
 
    renderPagina()
    const boton = await screen.findByRole('button', { name: 'Borrar' })
    await usuario.click(boton)
 
    await waitFor(() => expect(api.eliminarFotoAccidenteSoat).toHaveBeenCalledWith(1, 1))
    expect(screen.queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
  })
 
  it('no borra nada si se cancela la confirmación', async () => {
    const usuario = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.mocked(api.listarFotosAccidenteSoat).mockResolvedValue([FOTO])
    vi.mocked(api.descargarFotoAccidenteSoat).mockResolvedValue(new Blob(['x']))
 
    renderPagina()
    const boton = await screen.findByRole('button', { name: 'Borrar' })
    await usuario.click(boton)
 
    expect(api.eliminarFotoAccidenteSoat).not.toHaveBeenCalled()
  })
})
 
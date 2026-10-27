
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import type { ServicioPorPersona } from '../lib/types'
import { ReporteServiciosPage } from './ReporteServiciosPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
 
function fila(overrides: Partial<ServicioPorPersona> = {}): ServicioPorPersona {
  return {
    empleado_id: 1,
    cedula: '800000001',
    nombres: 'Pedro',
    apellidos: 'Londoño',
    funcion: 'conductor',
    basicos: 2,
    medicalizados: 1,
    soat: 0,
    total: 3,
    ...overrides,
  }
}
 
beforeEach(() => {
  vi.clearAllMocks()
})
 
function renderPagina(): void {
  render(
    <MemoryRouter>
      <ReporteServiciosPage />
    </MemoryRouter>,
  )
}
 
describe('ReporteServiciosPage', () => {
  it('no consulta nada hasta que se pulsa "Consultar"', () => {
    renderPagina()
 
    expect(api.obtenerReporteServiciosPorPersona).not.toHaveBeenCalled()
    expect(screen.getByText(/elige un rango/i)).toBeInTheDocument()
  })
 
  it('consulta y muestra los totales por persona', async () => {
    vi.mocked(api.obtenerReporteServiciosPorPersona).mockResolvedValue([
      fila(),
      fila({
        empleado_id: 2,
        cedula: '700000001',
        nombres: 'Ana',
        apellidos: 'Ruiz',
        funcion: 'responsable',
        basicos: 0,
        medicalizados: 5,
        soat: 0,
        total: 5,
      }),
    ])
    renderPagina()
 
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
 
    expect(await screen.findByText('Pedro Londoño')).toBeInTheDocument()
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument()
    expect(api.obtenerReporteServiciosPorPersona).toHaveBeenCalledTimes(1)
  })
 
  it('muestra la fila de totales al pie de la tabla', async () => {
    vi.mocked(api.obtenerReporteServiciosPorPersona).mockResolvedValue([
      fila({ basicos: 2, medicalizados: 1, soat: 0, total: 3 }),
      fila({
        empleado_id: 2,
        cedula: '700000001',
        nombres: 'Ana',
        apellidos: 'Ruiz',
        funcion: 'responsable',
        basicos: 1,
        medicalizados: 0,
        soat: 4,
        total: 5,
      }),
    ])
    renderPagina()
 
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await screen.findByText('Pedro Londoño')
 
    const filaTotal = document.querySelector('tfoot tr')
    expect(filaTotal).not.toBeNull()
    const celdas = Array.from(filaTotal?.querySelectorAll('td') ?? []).map((td) => td.textContent)
    expect(celdas).toEqual(['Total', '3', '1', '4', '8'])
  })
 
  it('muestra un aviso cuando no hay servicios en el rango', async () => {
    vi.mocked(api.obtenerReporteServiciosPorPersona).mockResolvedValue([])
    renderPagina()
 
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
 
    expect(await screen.findByText(/no hay servicios cerrados en ese rango/i)).toBeInTheDocument()
  })
 
  it('muestra un error si falla la consulta', async () => {
    vi.mocked(api.obtenerReporteServiciosPorPersona).mockRejectedValue(
      new ApiError(500, 'Error raro'),
    )
    renderPagina()
 
    await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Error raro')
  })
 
  it('descarga el Excel con el rango elegido', async () => {
    vi.mocked(api.descargarReporteServiciosPorPersonaExcel).mockResolvedValue(undefined)
    renderPagina()
 
    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }))
 
    await waitFor(() =>
      expect(api.descargarReporteServiciosPorPersonaExcel).toHaveBeenCalledTimes(1),
    )
    const [desde, hasta] = vi.mocked(api.descargarReporteServiciosPorPersonaExcel).mock.calls[0]
    expect(desde <= hasta).toBe(true)
  })
 
  it('muestra un error si falla la descarga', async () => {
    vi.mocked(api.descargarReporteServiciosPorPersonaExcel).mockRejectedValue(
      new ApiError(500, 'No se pudo generar el Excel'),
    )
    renderPagina()
 
    await userEvent.click(screen.getByRole('button', { name: 'Descargar Excel' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar el Excel')
  })
})

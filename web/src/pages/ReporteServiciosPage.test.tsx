import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import type { ServicioPorPersona, ViajeDetalle } from '../lib/types'
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
 
    expect(await screen.findByRole('button', { name: /Pedro Londoño/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ana Ruiz/ })).toBeInTheDocument()
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
    await screen.findByRole('button', { name: /Pedro Londoño/ })
 
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
 
  function viaje(overrides: Partial<ViajeDetalle> = {}): ViajeDetalle {
    return {
      atencion_id: 10,
      fecha: '2027-01-05',
      origen: 'Clínica Norte (Ocaña)',
      destino: 'Hospital Central (Cúcuta)',
      paciente: 'Juan Pérez',
      cedula: '900000001',
      ...overrides,
    }
  }
 
  describe('drill-down de viajes (issue #25)', () => {
    async function consultarYExpandir(): Promise<void> {
      vi.mocked(api.obtenerReporteServiciosPorPersona).mockResolvedValue([fila()])
      renderPagina()
      await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
      await userEvent.click(await screen.findByRole('button', { name: /Pedro Londoño/ }))
    }
 
    it('pide el detalle solo al expandir la fila, no junto con el reporte', async () => {
      vi.mocked(api.obtenerReporteServiciosPorPersona).mockResolvedValue([fila()])
      renderPagina()
      await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
      await screen.findByRole('button', { name: /Pedro Londoño/ })
 
      expect(api.obtenerDetalleServiciosPorPersona).not.toHaveBeenCalled()
    })
 
    it('muestra los viajes al expandir, con la función de la fila', async () => {
      vi.mocked(api.obtenerDetalleServiciosPorPersona).mockResolvedValue([viaje()])
      await consultarYExpandir()
 
      expect(await screen.findByText('Clínica Norte (Ocaña)')).toBeInTheDocument()
      expect(screen.getByText('Hospital Central (Cúcuta)')).toBeInTheDocument()
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
      expect(api.obtenerDetalleServiciosPorPersona).toHaveBeenCalledWith(
        1,
        'conductor',
        expect.any(String),
        expect.any(String),
      )
    })
 
    it('colapsa la fila al volver a hacer clic', async () => {
      vi.mocked(api.obtenerDetalleServiciosPorPersona).mockResolvedValue([viaje()])
      await consultarYExpandir()
      await screen.findByText('Juan Pérez')
 
      await userEvent.click(screen.getByRole('button', { name: /Pedro Londoño/ }))
 
      expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument()
    })
 
    it('no repite la llamada si se colapsa y se vuelve a expandir la misma fila', async () => {
      vi.mocked(api.obtenerDetalleServiciosPorPersona).mockResolvedValue([viaje()])
      await consultarYExpandir()
      await screen.findByText('Juan Pérez')
 
      const boton = screen.getByRole('button', { name: /Pedro Londoño/ })
      await userEvent.click(boton) // colapsa
      await userEvent.click(boton) // expande de nuevo
 
      expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
      expect(api.obtenerDetalleServiciosPorPersona).toHaveBeenCalledTimes(1)
    })
 
    it('muestra un aviso si la persona no tiene viajes en el rango', async () => {
      vi.mocked(api.obtenerDetalleServiciosPorPersona).mockResolvedValue([])
      await consultarYExpandir()
 
      expect(await screen.findByText(/no hay viajes para mostrar/i)).toBeInTheDocument()
    })
 
    it('muestra un error si falla la carga del detalle', async () => {
      vi.mocked(api.obtenerDetalleServiciosPorPersona).mockRejectedValue(
        new ApiError(500, 'No se pudo cargar el detalle'),
      )
      await consultarYExpandir()
 
      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el detalle')
    })
 
    it('se expande al hacer clic en cualquier parte de la fila, no solo en el nombre', async () => {
      vi.mocked(api.obtenerReporteServiciosPorPersona).mockResolvedValue([fila()])
      vi.mocked(api.obtenerDetalleServiciosPorPersona).mockResolvedValue([viaje()])
      renderPagina()
      await userEvent.click(screen.getByRole('button', { name: 'Consultar' }))
      await screen.findByRole('button', { name: /Pedro Londoño/ })
 
      // Clic en la celda de "Función", no en el nombre.
      await userEvent.click(screen.getByText('Conductor'))
 
      expect(await screen.findByText('Juan Pérez')).toBeInTheDocument()
    })
 
    it('muestra solo 5 viajes y un botón "Ver más" para los siguientes', async () => {
      const viajes = Array.from({ length: 7 }, (_, i) =>
        viaje({ atencion_id: i + 1, fecha: `2027-01-${String(i + 1).padStart(2, '0')}` }),
      )
      vi.mocked(api.obtenerDetalleServiciosPorPersona).mockResolvedValue(viajes)
      await consultarYExpandir()
 
      await screen.findByText('2027-01-05')
      expect(screen.getAllByText(/2027-01-0[1-5]/)).toHaveLength(5)
      expect(screen.queryByText('2027-01-06')).not.toBeInTheDocument()
 
      await userEvent.click(screen.getByRole('button', { name: 'Ver más' }))
 
      expect(await screen.findByText('2027-01-06')).toBeInTheDocument()
      expect(screen.getByText('2027-01-07')).toBeInTheDocument()
      // Ya se mostraron los 7 -- el botón desaparece.
      expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument()
    })
  })
})
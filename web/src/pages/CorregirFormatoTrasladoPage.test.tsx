import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import type { Ambulancia, AtencionCerrada, Empleado, FormatoTraslado } from '../lib/types'
import { CorregirFormatoTrasladoPage } from './CorregirFormatoTrasladoPage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))

// jsdom no trae `ResizeObserver` ni canvas, que usa `FirmaCanvas`: acá solo
// importa que la firma exista como campo, no dibujarla.
vi.mock('../components/FirmaCanvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    FirmaCanvas: forwardRef(function FirmaFalsa(_props, ref) {
      useImperativeHandle(ref, () => ({ exportar: () => null, limpiar: () => undefined }))
      return null
    }),
  }
})

function empleado(id: number, nombres: string): Empleado {
  return {
    id,
    nombres,
    apellidos: 'Prueba',
    cedula: String(1000 + id),
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: true,
  }
}

function ambulancia(id: number, movil: string): Ambulancia {
  return {
    id,
    movil,
    placa: `AAA${id}00`,
    tipo: 'basica',
    vencimiento_soat: '2027-01-01',
    vencimiento_tecnomecanica: '2027-01-01',
    activa: true,
  }
}

const ATENCION: AtencionCerrada = {
  id: 1,
  tipo: 'traslado',
  nivel_servicio: 'basico',
  estado: 'cerrado',
  abierta_en: '2026-11-01T10:00:00Z',
  cerrada_en: '2026-11-01T12:00:00Z',
  ambulancia: ambulancia(1, 'M01'),
  conductor: empleado(10, 'Carlos'),
  responsable: empleado(20, 'Ana'),
  paciente_nombres: 'Juan',
  paciente_apellidos: 'Pérez',
  paciente_numero_documento: '123456',
  paciente_eps: 'Sanitas',
  tiene_pdf: true,
}

const FORMATO: FormatoTraslado = {
  atencion_id: 1,
  glasgow_total: null,
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '123456',
  paciente_eps: 'Sanitas',
  paciente_nombres: 'Juan',
  paciente_apellidos: 'Pérez',
  paciente_edad: 40,
  paciente_sexo: 'm',
  paciente_direccion_residencial: 'Calle 1',
  paciente_ciudad: 'Cúcuta',
  paciente_telefono: null,
  acompanante_nombres_apellidos: null,
  acompanante_parentesco: null,
  acompanante_telefono: null,
  recepcion_fecha: '2026-11-01',
  recepcion_hora: '10:00',
  recepcion_ciudad: 'Cúcuta',
  recepcion_ips: 'Clínica Norte',
  recepcion_servicio: 'Urgencias',
  entrega_fecha: '2026-11-01',
  entrega_hora: '11:30',
  entrega_ciudad: 'Cúcuta',
  entrega_ips: 'Hospital Central',
  entrega_servicio: 'UCI',
  complejidad: 'baja',
  categoria_paciente: 'adulto',
  nivel_servicio: 'basico',
  modalidad: 'sencillo',
  diagnostico: null,
  tratamiento: [],
  tratamiento_otro: null,
  pupila_derecha: null,
  pupila_izquierda: null,
  signos_vitales: [],
  lesiones_localizadas: [],
  glasgow_ocular: null,
  glasgow_verbal: null,
  glasgow_motora: null,
  insumos_entregados: [],
  nota_auxiliar: null,
  atendido_por: null,
  firma_atendido_por: null,
  nota_medica: null,
  evolucionado_por: null,
  firma_evolucionado_por: null,
  profesional_entrega_nombre: null,
  profesional_entrega_cedula: null,
  firma_profesional_entrega: null,
  profesional_recibe_nombre: null,
  profesional_recibe_cedula: null,
  firma_profesional_recibe: null,
  observaciones: null,
}

function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/atenciones/1/corregir-traslado']}>
      <Routes>
        <Route path="/atenciones/:atencionId/corregir-traslado" element={<CorregirFormatoTrasladoPage />} />
        <Route path="/atenciones/:atencionId/detalle" element={<p>detalle</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerFormatoTraslado).mockResolvedValue(FORMATO)
  vi.mocked(api.obtenerAtencionCerrada).mockResolvedValue(ATENCION)
  vi.mocked(api.listarAmbulancias).mockResolvedValue([ambulancia(1, 'M01'), ambulancia(2, 'M02')])
  vi.mocked(api.listarConductoresDisponibles).mockResolvedValue([
    empleado(10, 'Carlos'),
    empleado(11, 'Luis'),
  ])
  vi.mocked(api.listarResponsablesDisponibles).mockResolvedValue([
    empleado(20, 'Ana'),
    empleado(21, 'Marta'),
  ])
  vi.mocked(api.corregirFormatoTraslado).mockResolvedValue(FORMATO)
})

describe('CorregirFormatoTrasladoPage', () => {
  it('sin tocar la tripulación no manda ids de ambulancia, conductor ni responsable', async () => {
    const usuario = userEvent.setup()
    renderPagina()
    await screen.findByLabelText('Nombres')

    await usuario.type(screen.getByLabelText('Motivo de la corrección'), 'Error de digitación')
    await usuario.click(screen.getByRole('button', { name: 'Guardar corrección' }))

    await waitFor(() => expect(api.corregirFormatoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.corregirFormatoTraslado).mock.calls[0]
    expect(datos).not.toHaveProperty('ambulancia_id')
    expect(datos).not.toHaveProperty('conductor_id')
    expect(datos).not.toHaveProperty('responsable_id')
    expect(datos.paciente_edad).toBe(40)
  })

  it('manda la ambulancia, el conductor y el responsable que se cambiaron', async () => {
    const usuario = userEvent.setup()
    renderPagina()
    await screen.findByRole('option', { name: /M02/ })

    await usuario.selectOptions(screen.getByLabelText('Ambulancia'), '2')
    await usuario.selectOptions(screen.getByLabelText('Conductor'), '11')
    await usuario.selectOptions(screen.getByLabelText('Auxiliar o médico responsable'), '21')
    await usuario.type(screen.getByLabelText('Motivo de la corrección'), 'Se registró el móvil equivocado')
    await usuario.click(screen.getByRole('button', { name: 'Guardar corrección' }))

    await waitFor(() => expect(api.corregirFormatoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.corregirFormatoTraslado).mock.calls[0]
    expect(datos).toMatchObject({ ambulancia_id: 2, conductor_id: 11, responsable_id: 21 })
  })

  it('permite corregir la edad dando la fecha de nacimiento', async () => {
    const usuario = userEvent.setup()
    renderPagina()
    await screen.findByLabelText('Nombres')

    await usuario.click(screen.getByRole('radio', { name: 'Ingresar fecha de nacimiento' }))
    await usuario.type(screen.getByLabelText('Fecha de nacimiento'), '1985-03-10')
    expect(screen.getByTestId('edad-calculada')).toHaveTextContent('Edad: 41 años')
    await usuario.type(screen.getByLabelText('Motivo de la corrección'), 'La edad estaba mal')
    await usuario.click(screen.getByRole('button', { name: 'Guardar corrección' }))

    await waitFor(() => expect(api.corregirFormatoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.corregirFormatoTraslado).mock.calls[0]
    expect(datos.paciente_edad).toBeNull()
    expect(datos.paciente_fecha_nacimiento).toBe('1985-03-10')
  })
})
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import { AuthProvider } from '../auth/AuthContext'
import type { FormatoTraslado, MeResponse } from '../lib/types'
import { ClinicoTrasladoPage } from './ClinicoTrasladoPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
 
function perfilCon(
  roles: MeResponse['roles'],
  firmaGuardada: string | null = null,
): MeResponse {
  return {
    documento: '123456789',
    activo: true,
    empleado_id: 1,
    debe_cambiar_password: false,
    pin_configurado: true,
    roles,
    empleado_tipo_vinculacion: firmaGuardada ? 'planta' : null,
    firma_guardada: firmaGuardada,
  }
}
 
const FORMATO: FormatoTraslado = {
  atencion_id: 1,
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '123456789',
  paciente_eps: 'Nueva EPS',
  paciente_nombres: 'Pepito',
  paciente_apellidos: 'Pérez',
  paciente_edad: 45,
  paciente_sexo: 'm',
  paciente_direccion_residencial: 'Calle 1 # 2-3',
  paciente_ciudad: 'Cúcuta',
  paciente_telefono: '3001234567',
  acompanante_nombres_apellidos: 'María Pérez',
  acompanante_parentesco: 'Hermana',
  acompanante_telefono: '3007654321',
  recepcion_fecha: '2027-01-01',
  recepcion_hora: '08:00:00',
  recepcion_ciudad: 'Cúcuta',
  recepcion_ips: 'Clínica Norte',
  recepcion_servicio: 'Urgencias',
  entrega_fecha: '2027-01-01',
  entrega_hora: '09:30:00',
  entrega_ciudad: 'Cúcuta',
  entrega_ips: 'Hospital Universitario',
  entrega_servicio: 'UCI',
  complejidad: 'alta',
  categoria_paciente: 'adulto',
  nivel_servicio: 'medicalizado',
  modalidad: 'sencillo',
  diagnostico: 'TCE leve',
  tratamiento: ['oxigeno', 'collar_cervical'],
  tratamiento_otro: null,
  pupila_derecha: 'isocorica',
  pupila_izquierda: 'isocorica',
  signos_vitales: [{ hora: '08:05', ta: '120/80', fc: 88, fr: 18, spo2: 97 }],
  lesiones: ['tce'],
  lesion_otro: null,
  glasgow_ocular: 4,
  glasgow_verbal: 5,
  glasgow_motora: 6,
  insumos_entregados: ['Collar cervical talla M'],
  nota_auxiliar: 'Paciente estable',
  atendido_por: 'Ana Ruiz',
  firma_atendido_por: null,
  nota_medica: 'Evolución favorable',
  evolucionado_por: 'Laura Gómez',
  firma_evolucionado_por: null,
  glasgow_total: 15,
}
 
const FORMATO_SIN_CLINICO: FormatoTraslado = {
  ...FORMATO,
  diagnostico: null,
  tratamiento: [],
  tratamiento_otro: null,
  pupila_derecha: null,
  pupila_izquierda: null,
  signos_vitales: [],
  lesiones: [],
  lesion_otro: null,
  glasgow_ocular: null,
  glasgow_verbal: null,
  glasgow_motora: null,
  insumos_entregados: [],
  nota_auxiliar: null,
  atendido_por: null,
  nota_medica: null,
  evolucionado_por: null,
  glasgow_total: null,
}
 
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon([]))
})
 
function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/atenciones/1/clinico-traslado']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<div>pantalla principal</div>} />
          <Route
            path="/atenciones/:atencionId/clinico-traslado"
            element={<ClinicoTrasladoPage />}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}
 
describe('ClinicoTrasladoPage', () => {
  it('arranca en blanco si todavía no hay nada clínico guardado', async () => {
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
 
    renderPagina()
 
    expect(await screen.findByLabelText('Diagnóstico')).toHaveValue('')
    expect(screen.getByText('Total: — /15')).toBeInTheDocument()
  })
 
  it('precarga el formulario si ya hay datos clínicos guardados', async () => {
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO)
 
    renderPagina()
 
    expect(await screen.findByLabelText('Diagnóstico')).toHaveValue('TCE leve')
    expect(screen.getByLabelText('Collar cervical')).toBeChecked()
    expect(screen.getByLabelText('Oxígeno')).toBeChecked()
    expect(screen.getByLabelText('Inmovilización')).not.toBeChecked()
    expect(screen.getByLabelText('Derecha')).toHaveValue('isocorica')
    expect(screen.getByText('Total: 15/15')).toBeInTheDocument()
    expect(screen.getByLabelText('Atendido por')).toHaveValue('Ana Ruiz')
  })
 
  it('muestra un error si falla la carga', async () => {
    vi.mocked(api.obtenerEncabezadoTraslado).mockRejectedValue(
      new api.ApiError(500, 'Error del servidor'),
    )
 
    renderPagina()
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor')
  })
 
  it('guarda el avance clínico y vuelve a la pantalla principal', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
    vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
 
    renderPagina()
 
    await usuario.type(await screen.findByLabelText('Diagnóstico'), 'TCE leve')
    await usuario.click(screen.getByLabelText('Oxígeno'))
    await usuario.selectOptions(screen.getByLabelText('Derecha'), 'isocorica')
    await usuario.type(screen.getByLabelText('Ocular (1-4)'), '4')
    await usuario.type(screen.getByLabelText('Verbal (1-5)'), '5')
    await usuario.type(screen.getByLabelText('Motora (1-6)'), '6')
 
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
    await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
    const [atencionId, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
    expect(atencionId).toBe(1)
    expect(datos.diagnostico).toBe('TCE leve')
    expect(datos.tratamiento).toEqual(['oxigeno'])
    expect(datos.pupila_derecha).toBe('isocorica')
    expect(datos.glasgow_ocular).toBe(4)
    expect(datos.signos_vitales).toEqual([])
    expect(datos.insumos_entregados).toEqual([])
 
    expect(await screen.findByText('pantalla principal')).toBeInTheDocument()
  })
 
  it('agrega una fila de signos vitales y la manda en el guardado', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
    vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
 
    renderPagina()
 
    await screen.findByLabelText('Diagnóstico')
    await usuario.click(screen.getByRole('button', { name: '+ Agregar medición' }))
    await usuario.type(screen.getByLabelText('Hora medición 1'), '08:05')
    await usuario.type(screen.getByLabelText('TA medición 1'), '120/80')
    await usuario.type(screen.getByLabelText('FC medición 1'), '88')
 
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
    await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
    expect(datos.signos_vitales).toEqual([{ hora: '08:05', ta: '120/80', fc: 88, fr: null, spo2: null }])
  })
 
  it('muestra un error si falla al guardar', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO)
    vi.mocked(api.guardarClinicoTraslado).mockRejectedValue(
      new api.ApiError(404, 'Esta atención todavía no tiene encabezado — guárdalo primero'),
    )
 
    renderPagina()
 
    await screen.findByLabelText('Diagnóstico')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta atención todavía no tiene encabezado — guárdalo primero',
    )
  })
 
  describe('firma de quien atiende/evoluciona (issue #11)', () => {
    const EXPORTADA = 'data:image/png;base64,EXPORTADA'
 
    class ImagenFalsa {
      onload: (() => void) | null = null
      set src(_valor: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }
 
    beforeEach(() => {
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
      HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
      HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()
    })
 
    it('personal de planta: usa la firma guardada automática, sin canvas', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon(
          [{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }],
          'data:image/png;base64,GUARDADA',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
 
      renderPagina()
 
      expect(await screen.findByAltText('Firma de quien atendió')).toHaveAttribute(
        'src',
        'data:image/png;base64,GUARDADA',
      )
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
      await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
      const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      expect(datos.firma_atendido_por).toBe('data:image/png;base64,GUARDADA')
    })
 
    it('personal ocasional: dibuja en el canvas y esa firma se envía', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'medico', descripcion: null }]),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
 
      renderPagina()
 
      const canvas = await screen.findByLabelText('Recuadro para firmar')
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
      )
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 20, clientY: 20, bubbles: true }),
      )
 
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
      await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
      const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      expect(datos.firma_evolucionado_por).toBe(EXPORTADA)
      expect(datos.firma_atendido_por).toBeNull()
    })
 
    it('un rol sin firma propia reenvía la firma existente del otro sin tocarla', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'medico', descripcion: null }]),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue({
        ...FORMATO,
        firma_atendido_por: 'data:image/png;base64,DEL-AUXILIAR',
        firma_evolucionado_por: null,
      })
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
 
      renderPagina()
 
      await screen.findByLabelText('Diagnóstico')
      expect(screen.queryByAltText('Firma de quien atendió')).not.toBeInTheDocument()
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
      await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
      const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      expect(datos.firma_atendido_por).toBe('data:image/png;base64,DEL-AUXILIAR')
    })
  })
})
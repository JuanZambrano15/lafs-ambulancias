import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from '../lib/api'
import * as pinLocal from '../lib/pinLocal'
import { AuthProvider } from '../auth/AuthContext'
import type { Ambulancia, Atencion, Empleado, FormatoTraslado, MeResponse } from '../lib/types'
import { ClinicoTrasladoPage } from './ClinicoTrasladoPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
vi.mock('../lib/pinLocal')
 
function perfilCon(
  roles: MeResponse['roles'],
  firmaGuardada: string | null = null,
  nombreCompleto: string | null = null,
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
    empleado_nombre_completo: nombreCompleto,
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
 
const AMBULANCIA: Ambulancia = {
  id: 1,
  movil: 'M-01',
  placa: 'ABC123',
  tipo: 'basica',
  vencimiento_soat: '2027-01-01',
  vencimiento_tecnomecanica: '2027-01-01',
  activa: true,
}
 
const EMPLEADO: Empleado = {
  id: 1,
  nombres: 'Ana',
  apellidos: 'Ruiz',
  cedula: '800000001',
  telefono: null,
  tipo_vinculacion: 'planta',
  activo: true,
}
 
const ATENCION_CERRADA: Atencion = {
  id: 1,
  tipo: 'traslado',
  estado: 'cerrado',
  abierta_en: '2026-10-07T08:00:00Z',
  cerrada_en: '2026-10-07T09:00:00Z',
  ambulancia: AMBULANCIA,
  conductor: EMPLEADO,
  responsable: EMPLEADO,
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
    await usuario.selectOptions(screen.getByLabelText('Ocular (1-4)'), '4')
    await usuario.selectOptions(screen.getByLabelText('Verbal (1-5)'), '5')
    await usuario.selectOptions(screen.getByLabelText('Motora (1-6)'), '6')
 
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
    // La hora viene precargada con la hora actual (issue #52) -- se
    // limpia primero para probar que también se puede corregir a mano.
    await usuario.clear(screen.getByLabelText('Hora medición 1'))
    await usuario.type(screen.getByLabelText('Hora medición 1'), '08:05')
    await usuario.type(screen.getByLabelText('TA medición 1'), '120/80')
    await usuario.type(screen.getByLabelText('FC medición 1'), '88')
 
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
    await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
    expect(datos.signos_vitales).toEqual([{ hora: '08:05', ta: '120/80', fc: 88, fr: null, spo2: null }])
  })
 
  it('la escala de Glasgow solo ofrece los valores válidos de cada componente (issue #53)', async () => {
    renderPagina()
 
    await screen.findByLabelText('Diagnóstico')
 
    // El backend valida ocular 1-4, verbal 1-5 y motora 1-6 -- cada
    // <select> debe tener exactamente esas opciones (más "Sin
    // registrar"), no un rango libre.
    const opcionesDe = (etiqueta: string): string[] =>
      within(screen.getByLabelText(etiqueta))
        .getAllByRole('option')
        .map((opcion) => opcion.textContent)
        .filter((texto): texto is string => texto !== null && texto !== 'Sin registrar')
 
    expect(opcionesDe('Ocular (1-4)')).toHaveLength(4)
    expect(opcionesDe('Verbal (1-5)')).toHaveLength(5)
    expect(opcionesDe('Motora (1-6)')).toHaveLength(6)
  })
 
  it('guarda el valor elegido de Glasgow como número', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
    vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
 
    renderPagina()
 
    await screen.findByLabelText('Diagnóstico')
    await usuario.selectOptions(screen.getByLabelText('Ocular (1-4)'), '3')
    await usuario.selectOptions(screen.getByLabelText('Verbal (1-5)'), '4')
    await usuario.selectOptions(screen.getByLabelText('Motora (1-6)'), '5')
 
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
    await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
    expect(datos.glasgow_ocular).toBe(3)
    expect(datos.glasgow_verbal).toBe(4)
    expect(datos.glasgow_motora).toBe(5)
  })
 
  it('precarga la hora actual al agregar una medición (issue #52)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
    vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
 
    renderPagina()
 
    await screen.findByLabelText('Diagnóstico')
    await usuario.click(screen.getByRole('button', { name: '+ Agregar medición' }))
 
    // No se fija la hora exacta del reloj del sistema -- solo que
    // venga precargada con algo (no vacía) y en formato HH:MM, para no
    // perder la fila completa si a alguien se le olvida escribirla a
    // mano (antes del fix, `hora: ''` por defecto hacía que el filtro
    // de guardado descartara toda la medición).
    const campoHora = screen.getByLabelText('Hora medición 1') as HTMLInputElement
    expect(campoHora.value).toMatch(/^\d{2}:\d{2}$/)
 
    await usuario.type(screen.getByLabelText('TA medición 1'), '120/80')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
    await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
    expect(datos.signos_vitales).toHaveLength(1)
    expect(datos.signos_vitales[0].hora).toMatch(/^\d{2}:\d{2}$/)
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
 
    it('issue #57: con ambos roles, la firma del médico no se duplica de la del auxiliar', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon(
          [
            { id: 1, nombre: 'auxiliar_enfermeria', descripcion: null },
            { id: 2, nombre: 'medico', descripcion: null },
          ],
          'data:image/png;base64,GUARDADA',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
 
      renderPagina()
 
      // El auxiliar sigue viendo su firma guardada como vista previa
      // automática...
      expect(await screen.findByAltText('Firma de quien atendió')).toHaveAttribute(
        'src',
        'data:image/png;base64,GUARDADA',
      )
      // ...pero el médico no ve la misma imagen reusada: se le pide
      // dibujarla a mano, con una pista de por qué.
      expect(screen.queryByAltText('Firma de quien evolucionó')).not.toBeInTheDocument()
      expect(
        screen.getByText(/ya se usó tu firma guardada como auxiliar/i),
      ).toBeInTheDocument()
 
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
      expect(datos.firma_atendido_por).toBe('data:image/png;base64,GUARDADA')
      expect(datos.firma_evolucionado_por).toBe(EXPORTADA)
      expect(datos.firma_evolucionado_por).not.toBe(datos.firma_atendido_por)
    })
  })
 
  describe('autocompletar el nombre de quien atiende/evoluciona (issue #57)', () => {
    it('auxiliar: precarga "Atendido por" con su propio nombre si está vacío', async () => {
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon(
          [{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }],
          null,
          'Camila Torres',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
 
      renderPagina()
 
      await screen.findByLabelText('Atendido por')
      await waitFor(() =>
        expect(screen.getByLabelText('Atendido por')).toHaveValue('Camila Torres'),
      )
    })
 
    it('médico: precarga "Evolucionado por" con su propio nombre si está vacío', async () => {
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'medico', descripcion: null }], null, 'Camila Torres'),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
 
      renderPagina()
 
      await screen.findByLabelText('Evolucionado por')
      await waitFor(() =>
        expect(screen.getByLabelText('Evolucionado por')).toHaveValue('Camila Torres'),
      )
    })
 
    it('no reemplaza el nombre si ya hay uno guardado de un turno anterior', async () => {
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon(
          [{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }],
          null,
          'Camila Torres',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue({
        ...FORMATO,
        atendido_por: 'Ana Ruiz',
      })
 
      renderPagina()
 
      await screen.findByLabelText('Atendido por')
      await waitFor(() => expect(screen.getByLabelText('Atendido por')).toHaveValue('Ana Ruiz'))
    })
 
    it('precarga el nombre incluso si la atención todavía no tiene encabezado guardado', async () => {
      // obtenerEncabezadoTraslado devuelve null cuando el backend
      // responde 404 (atención recién creada, sin encabezado todavía)
      // -- el autocompletado debe funcionar igual en ese caso, no solo
      // cuando ya hay un formato existente que cargar.
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon(
          [{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }],
          null,
          'Camila Torres',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(null)
 
      renderPagina()
 
      await screen.findByLabelText('Atendido por')
      await waitFor(() =>
        expect(screen.getByLabelText('Atendido por')).toHaveValue('Camila Torres'),
      )
    })
  })
 
  describe('cerrar atención (issue #12)', () => {
    beforeEach(() => {
      // Issue #57 agrega una validación de completitud al cerrar --
      // estas pruebas solo le interesan la mecánica del PIN (quién
      // puede cerrar, hash local, error del servidor), así que usan
      // un formato completo para no mezclarse con esa otra
      // validación (ver 'cerrar atención exige campos completos'
      // más abajo, que sí usa FORMATO_SIN_CLINICO a propósito).
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO)
    })
 
    it('no muestra la opción de cerrar si el usuario no tiene rol clínico', async () => {
      vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon([]))
 
      renderPagina()
 
      await screen.findByLabelText('Diagnóstico')
      expect(screen.queryByRole('button', { name: 'Cerrar atención' })).not.toBeInTheDocument()
    })
 
    it('muestra la opción de cerrar para auxiliar o médico y revela el formulario de PIN', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
 
      renderPagina()
 
      await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
 
      expect(screen.getByLabelText('PIN')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Confirmar cierre' })).toBeInTheDocument()
    })
 
    it('cierra la atención con el PIN correcto y vuelve a la pantalla principal', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'medico', descripcion: null }]),
      )
      vi.mocked(pinLocal.pinLocalValido).mockResolvedValue(true)
      vi.mocked(api.cerrarAtencion).mockResolvedValue(ATENCION_CERRADA)
 
      renderPagina()
 
      await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
      await usuario.type(screen.getByLabelText('PIN'), '1234')
      await usuario.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
 
      await waitFor(() => expect(api.cerrarAtencion).toHaveBeenCalledWith(1, '1234'))
      expect(await screen.findByText('pantalla principal')).toBeInTheDocument()
    })
 
    it('rechaza el PIN sin tocar la red si no coincide con el hash local del dispositivo', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
      vi.mocked(pinLocal.pinLocalValido).mockResolvedValue(false)
 
      renderPagina()
 
      await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
      await usuario.type(screen.getByLabelText('PIN'), '0000')
      await usuario.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
 
      expect(await screen.findByRole('alert')).toHaveTextContent('PIN incorrecto')
      expect(api.cerrarAtencion).not.toHaveBeenCalled()
    })
 
    it('muestra el error del servidor si el PIN es incorrecto allí', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'medico', descripcion: null }]),
      )
      vi.mocked(pinLocal.pinLocalValido).mockResolvedValue(null)
      vi.mocked(api.cerrarAtencion).mockRejectedValue(new api.ApiError(401, 'PIN incorrecto'))
 
      renderPagina()
 
      await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
      await usuario.type(screen.getByLabelText('PIN'), '1234')
      await usuario.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
 
      expect(await screen.findByRole('alert')).toHaveTextContent('PIN incorrecto')
    })
  })
 
  describe('aviso de campos faltantes antes de cerrar (issue #57)', () => {
    it('deshabilita "Cerrar atención" y lista lo que falta si el formato está vacío', async () => {
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
 
      renderPagina()
 
      const boton = await screen.findByRole('button', { name: 'Cerrar atención' })
      expect(boton).toBeDisabled()
      const aviso = screen.getByRole('alert')
      expect(aviso).toHaveTextContent('signos vitales')
      expect(aviso).toHaveTextContent('Glasgow')
      expect(aviso).toHaveTextContent('diagnóstico')
      expect(aviso).toHaveTextContent('nota de enfermería')
    })
 
    it('no deshabilita "Cerrar atención" si todo lo clínico está completo', async () => {
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO)
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
 
      renderPagina()
 
      const boton = await screen.findByRole('button', { name: 'Cerrar atención' })
      expect(boton).not.toBeDisabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
 
    it('en un traslado medicalizado exige nota médica para cerrar', async () => {
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue({
        ...FORMATO,
        nivel_servicio: 'medicalizado',
        nota_medica: null,
      })
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'medico', descripcion: null }]),
      )
 
      renderPagina()
 
      const boton = await screen.findByRole('button', { name: 'Cerrar atención' })
      expect(boton).toBeDisabled()
      expect(screen.getByRole('alert')).toHaveTextContent('nota médica')
    })
 
    it('en un traslado básico no exige nota médica para cerrar', async () => {
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue({
        ...FORMATO,
        nivel_servicio: 'basico',
        nota_medica: null,
      })
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
 
      renderPagina()
 
      const boton = await screen.findByRole('button', { name: 'Cerrar atención' })
      expect(boton).not.toBeDisabled()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
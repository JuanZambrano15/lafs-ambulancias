import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import { AuthProvider } from '../auth/AuthContext'
import * as api from '../lib/api'
import * as pinLocal from '../lib/pinLocal'
import type { FormatoAccidenteSoat, MeResponse } from '../lib/types'
import { ClinicoAccidenteSoatPage } from './ClinicoAccidenteSoatPage'
 
vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')
vi.mock('../lib/pinLocal')
 
function perfilCon(roles: MeResponse['roles']): MeResponse {
  return {
    documento: '123456789',
    activo: true,
    empleado_id: 1,
    debe_cambiar_password: false,
    pin_configurado: true,
    roles,
    empleado_tipo_vinculacion: null,
    firma_guardada: null,
    empleado_nombre_completo: null,
  }
}
 
// Issue #70 (QA, corregido dos veces): sin
// `paciente_documento_expedido_en` ni
// `vehiculo_placa`/`vehiculo_tipo`/`vehiculo_marca` -- se quitaron del
// formato (ver el fix sobre #17 que acompaña esta revisión).
// `profesional_recibe_nombre`/`profesional_recibe_cedula` sí existían
// desde el principio, pero mal ubicados -- viven en el formulario
// principal (después de "Atendido por" y del médico), no en "Cerrar
// atención", que solo pide la hora de entrega y el PIN.
const FORMATO_BASE: FormatoAccidenteSoat = {
  atencion_id: 1,
  fecha_atencion: '2027-01-01',
  hora_atencion: '08:00:00',
  hora_entrega: null,
  identificado: true,
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '123456789',
  paciente_aseguradora: 'Nueva EPS',
  paciente_nombres: 'Pepito',
  paciente_apellidos: 'Pérez',
  paciente_edad: 45,
  paciente_sexo: 'm',
  lugar_ocurrencia: 'Vía Ocaña - Cúcuta km 5',
  ciudad: 'Cúcuta',
  telefono_contacto: '3001234567',
  rol_victima: 'conductor',
  poliza_vigente_desde: null,
  poliza_vigente_hasta: null,
  numero_poliza: 'POL-001',
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
  triage: null,
  descripcion: null,
  atendido_por: null,
  firma_atendido_por: null,
  evolucionado_por: null,
  firma_evolucionado_por: null,
  profesional_recibe_nombre: null,
  profesional_recibe_cedula: null,
  firma_profesional_recibe: null,
  glasgow_total: null,
}
 
const FORMATO_CLINICO_COMPLETO: FormatoAccidenteSoat = {
  ...FORMATO_BASE,
  tratamiento: ['oxigeno', 'collar_cervical'],
  pupila_derecha: 'isocorica',
  pupila_izquierda: 'isocorica',
  signos_vitales: [{ hora: '08:05', ta: '120/80', fc: 88, fr: 18, spo2: 97 }],
  lesiones: ['tce'],
  glasgow_ocular: 4,
  glasgow_verbal: 5,
  glasgow_motora: 6,
  triage: 'ii',
  descripcion: 'Paciente consciente, trauma leve',
  // Ya se habían llenado en una visita anterior -- deben precargarse
  // en el formulario principal.
  profesional_recibe_nombre: 'Ana Ruiz',
  profesional_recibe_cedula: '800000001',
  glasgow_total: 15,
}
 
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon([]))
})
 
function renderPagina(): void {
  render(
    <MemoryRouter initialEntries={['/atenciones/1/clinico-accidente-soat']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<div>pantalla principal</div>} />
          <Route
            path="/atenciones/:atencionId/clinico-accidente-soat"
            element={<ClinicoAccidenteSoatPage />}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}
 
describe('ClinicoAccidenteSoatPage', () => {
  it('arranca en blanco si todavía no hay nada clínico guardado', async () => {
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_BASE)
 
    renderPagina()
 
    expect(await screen.findByLabelText('Descripción de la atención')).toHaveValue('')
    expect(screen.getByText('Total: — /15')).toBeInTheDocument()
  })
 
  it('no pide la hora de entrega en el formulario principal, pero sí quién recibe (issue #70, corregido)', async () => {
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
 
    renderPagina()
 
    await screen.findByLabelText('Descripción de la atención')
    expect(screen.queryByLabelText(/hora de entrega/i)).not.toBeInTheDocument()
    // "Profesional que recibe" sí vive en el formulario principal --
    // es "Cerrar atención" quien NO lo pide (ver prueba de más abajo).
    expect(screen.getByLabelText('Nombre de quien recibe')).toBeInTheDocument()
    expect(screen.getByLabelText('Cédula de quien recibe')).toBeInTheDocument()
  })
 
  it('precarga el formulario principal si ya hay datos clínicos guardados', async () => {
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
 
    renderPagina()
 
    expect(await screen.findByLabelText('Descripción de la atención')).toHaveValue(
      'Paciente consciente, trauma leve',
    )
    expect(screen.getByLabelText('Collar cervical')).toBeChecked()
    expect(screen.getByLabelText('Oxígeno')).toBeChecked()
    expect(screen.getByLabelText('Derecha')).toHaveValue('isocorica')
    expect(screen.getByText('Total: 15/15')).toBeInTheDocument()
    expect(screen.getByLabelText('Triage')).toHaveValue('ii')
    expect(screen.getByLabelText('Nombre de quien recibe')).toHaveValue('Ana Ruiz')
    expect(screen.getByLabelText('Cédula de quien recibe')).toHaveValue('800000001')
  })
 
  it('no muestra "Cerrar atención" a quien no es auxiliar ni médico', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'conductor', descripcion: null }]),
    )
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
 
    renderPagina()
 
    await screen.findByLabelText('Descripción de la atención')
    expect(screen.queryByRole('button', { name: 'Cerrar atención' })).not.toBeInTheDocument()
  })
 
  it('avisa qué falta y deja deshabilitado "Cerrar atención" si no está todo completo', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_BASE)
 
    renderPagina()
 
    await screen.findByLabelText('Descripción de la atención')
    expect(await screen.findByText('signos vitales')).toBeInTheDocument()
    expect(screen.getByText('escala de Glasgow')).toBeInTheDocument()
    expect(screen.getByText('triage')).toBeInTheDocument()
    expect(screen.getByText('descripción de la atención')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeDisabled()
  })
 
  it('exige la identidad del paciente para cerrar si quedó marcado como identificado', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue({
      ...FORMATO_CLINICO_COMPLETO,
      identificado: true,
      paciente_nombres: null,
    })
 
    renderPagina()
 
    expect(
      await screen.findByText('identidad del paciente (marcado como identificado)'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar atención' })).toBeDisabled()
  })
 
  it('un NN sin identificar no bloquea el cierre (ADR-0002)', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue({
      ...FORMATO_CLINICO_COMPLETO,
      identificado: false,
      paciente_nombres: null,
      paciente_apellidos: null,
      paciente_numero_documento: null,
    })
 
    renderPagina()
 
    await screen.findByLabelText('Descripción de la atención')
    expect(
      screen.queryByText('identidad del paciente (marcado como identificado)'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar atención' })).not.toBeDisabled()
  })
 
  it('guarda lo clínico', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_BASE)
    vi.mocked(api.guardarClinicoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
 
    renderPagina()
 
    await usuario.type(
      await screen.findByLabelText('Descripción de la atención'),
      'Paciente consciente, trauma leve',
    )
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
 
    await waitFor(() => expect(api.guardarClinicoAccidenteSoat).toHaveBeenCalledTimes(1))
    const [atencionId, datos] = vi.mocked(api.guardarClinicoAccidenteSoat).mock.calls[0]
    expect(atencionId).toBe(1)
    expect(datos.descripcion).toBe('Paciente consciente, trauma leve')
 
    expect(await screen.findByText('pantalla principal')).toBeInTheDocument()
  })
 
  it('"Cerrar atención" solo pide la hora de entrega y el PIN, no quién recibe (issue #70, corregido)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
 
    renderPagina()
 
    await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
 
    expect(screen.getByLabelText('Hora de entrega')).toBeInTheDocument()
    expect(screen.getByLabelText('PIN')).toBeInTheDocument()
    // "Profesional que recibe" sigue viéndose, pero porque es parte
    // del formulario principal (que no se oculta al abrir "Cerrar
    // atención") -- no porque el paso de cierre lo vuelva a pedir por
    // su cuenta. Solo debe existir una vez en toda la pantalla.
    expect(screen.getAllByLabelText('Nombre de quien recibe')).toHaveLength(1)
  })
 
  it('exige la hora de entrega para poder confirmar el cierre (issue #70)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
    vi.mocked(pinLocal.pinLocalValido).mockResolvedValue(true)
 
    renderPagina()
 
    await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
    await usuario.type(screen.getByLabelText('PIN'), '1234')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent('Falta la hora de entrega')
    expect(api.cerrarAtencion).not.toHaveBeenCalled()
  })
 
  it('cierra la atención con PIN válido, guardando la hora de entrega, quién recibe y lo clínico (issue #12, #63, #70)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
    vi.mocked(api.guardarEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
    vi.mocked(api.guardarClinicoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
    vi.mocked(pinLocal.pinLocalValido).mockResolvedValue(true)
    vi.mocked(api.cerrarAtencion).mockResolvedValue({
      id: 1,
      tipo: 'atencion_soat',
      estado: 'cerrado',
      abierta_en: '2026-10-07T08:00:00Z',
      cerrada_en: '2026-10-07T09:00:00Z',
      ambulancia: {
        id: 1,
        movil: 'M-01',
        placa: 'ABC123',
        tipo: 'basica',
        vencimiento_soat: '2027-01-01',
        vencimiento_tecnomecanica: '2027-01-01',
        activa: true,
      },
      conductor: {
        id: 1,
        nombres: 'Ana',
        apellidos: 'Ruiz',
        cedula: '800000001',
        telefono: null,
        tipo_vinculacion: 'planta',
        activo: true,
      },
      responsable: {
        id: 1,
        nombres: 'Ana',
        apellidos: 'Ruiz',
        cedula: '800000001',
        telefono: null,
        tipo_vinculacion: 'planta',
        activo: true,
      },
    })
 
    renderPagina()
 
    await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
    await usuario.type(screen.getByLabelText('Hora de entrega'), '09:30')
    await usuario.type(screen.getByLabelText('PIN'), '1234')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
 
    await waitFor(() => expect(api.cerrarAtencion).toHaveBeenCalledWith(1, '1234'))
 
    // La hora de entrega se guarda reenviando el encabezado completo
    // (PUT reemplaza todo el registro) con ese campo ya puesto.
    expect(api.guardarEncabezadoAccidenteSoat).toHaveBeenCalledTimes(1)
    const [atencionId, encabezado] = vi.mocked(api.guardarEncabezadoAccidenteSoat).mock.calls[0]
    expect(atencionId).toBe(1)
    expect(encabezado.hora_entrega).toBe('09:30')
    expect(encabezado.lugar_ocurrencia).toBe(FORMATO_CLINICO_COMPLETO.lugar_ocurrencia)
    expect(encabezado.paciente_nombres).toBe(FORMATO_CLINICO_COMPLETO.paciente_nombres)
 
    expect(api.guardarClinicoAccidenteSoat).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('pantalla principal')).toBeInTheDocument()
  })
 
  it('muestra un error si el PIN es incorrecto, sin cerrar la atención', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(FORMATO_CLINICO_COMPLETO)
    vi.mocked(pinLocal.pinLocalValido).mockResolvedValue(false)
 
    renderPagina()
 
    await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
    await usuario.type(screen.getByLabelText('Hora de entrega'), '09:30')
    await usuario.type(screen.getByLabelText('PIN'), '0000')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
 
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN incorrecto')
    expect(api.cerrarAtencion).not.toHaveBeenCalled()
  })
})

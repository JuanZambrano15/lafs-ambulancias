import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '../lib/api'
import { AuthProvider } from '../auth/AuthContext'
import type { Atencion, FormatoAccidenteSoat, FormatoTraslado, MeResponse } from '../lib/types'
import { HomePage } from './HomePage'

vi.mock('../lib/api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
vi.mock('../lib/storage')

function perfilCon(
  roles: MeResponse['roles'],
  tipoVinculacion: MeResponse['empleado_tipo_vinculacion'] = null,
): MeResponse {
  return {
    documento: '123456789',
    activo: true,
    empleado_id: null,
    debe_cambiar_password: false,
    pin_configurado: true,
    roles,
    empleado_tipo_vinculacion: tipoVinculacion,
    firma_guardada: null,
    empleado_nombre_completo: null,
  }
}

const ATENCION_EN_CURSO: Atencion = {
  id: 7,
  tipo: 'traslado',
  estado: 'abierto',
  abierta_en: '2026-10-13T23:35:51.780547+00:00',
  cerrada_en: null,
  ambulancia: {
    id: 1,
    movil: 'M-03',
    placa: 'ABC123',
    tipo: 'basica',
    vencimiento_soat: '2027-01-01',
    vencimiento_tecnomecanica: '2027-01-01',
    activa: true,
  },
  conductor: {
    id: 2,
    nombres: 'Pedro',
    apellidos: 'Londoño',
    cedula: '800000009',
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: true,
  },
  responsable: {
    id: 3,
    nombres: 'Ana',
    apellidos: 'Ruiz',
    cedula: '700000001',
    telefono: null,
    tipo_vinculacion: 'planta',
    activo: true,
  },
}

const ENCABEZADO_YA_GUARDADO: FormatoTraslado = {
  atencion_id: 7,
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
  profesional_recibe_nombre: null,
  profesional_recibe_cedula: null,
  observaciones: null,
  firma_profesional_recibe: null,
  glasgow_total: null,
}

const ATENCION_SOAT_EN_CURSO: Atencion = {
  ...ATENCION_EN_CURSO,
  id: 9,
  tipo: 'atencion_soat',
}

const ENCABEZADO_SOAT_YA_GUARDADO: FormatoAccidenteSoat = {
  atencion_id: 9,
  fecha_atencion: '2027-01-01',
  hora_atencion: '08:00:00',
  hora_entrega: null,
  identificado: true,
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '123456789',
  paciente_aseguradora: 'SOAT Seguros XYZ',
  paciente_nombres: 'Pepito',
  paciente_apellidos: 'Pérez',
  paciente_edad: 45,
  paciente_sexo: 'm',
  lugar_ocurrencia: 'Av. Gran Colombia con calle 10',
  ciudad: 'Cúcuta',
  telefono_contacto: '3001234567',
  rol_victima: 'conductor',
  poliza_vigente_desde: '2026-01-01',
  poliza_vigente_hasta: '2027-01-01',
  numero_poliza: 'SOAT-0001',
  vehiculo_placa: null,
  vehiculo_tipo: null,
  vehiculo_marca: null,
  tratamiento: [],
  tratamiento_otro: null,
  pupila_derecha: null,
  pupila_izquierda: null,
  signos_vitales: [],
  lesiones_localizadas: [],
  glasgow_ocular: null,
  glasgow_verbal: null,
  glasgow_motora: null,
  triage: null,
  descripcion: null,
  nota_auxiliar: null,
  atendido_por: null,
  firma_atendido_por: null,
  nota_medica: null,
  evolucionado_por: null,
  firma_evolucionado_por: null,
  profesional_recibe_nombre: null,
  profesional_recibe_cedula: null,
  firma_profesional_recibe: null,
  glasgow_total: null,
}

function renderHome(): void {
  render(
    <MemoryRouter>
      <AuthProvider>
        <HomePage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HomePage', () => {
  it('muestra solo las secciones del rol conductor', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'conductor', descripcion: null }]),
    )

    renderHome()

    await waitFor(() => expect(screen.getByText('Chequeo de ambulancia')).toBeInTheDocument())
    expect(screen.getByText('Iniciar atención')).toBeInTheDocument()
    expect(screen.queryByText('Usuarios y roles')).not.toBeInTheDocument()
    expect(screen.queryByText('Atención SOAT')).not.toBeInTheDocument()
  })

  it('muestra las secciones combinadas cuando el usuario tiene varios roles', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([
        { id: 1, nombre: 'medico', descripcion: null },
        { id: 2, nombre: 'conductor', descripcion: null },
      ]),
    )

    renderHome()

    await waitFor(() => expect(screen.getByText('Atención SOAT')).toBeInTheDocument())
    // "Formato de traslado" la comparten medico y auxiliar — no debe duplicarse.
    expect(screen.getAllByText('Formato de traslado')).toHaveLength(1)
    // "Iniciar atención" la comparten medico y conductor — tampoco debe duplicarse.
    expect(screen.getAllByText('Iniciar atención')).toHaveLength(1)
    expect(screen.getByText('Chequeo de ambulancia')).toBeInTheDocument()
  })

  it('el enlace de "Iniciar atención" apunta a /atenciones/nueva', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )

    renderHome()

    const enlace = await screen.findByRole('link', { name: 'Empezar' })
    expect(enlace).toHaveAttribute('href', '/atenciones/nueva')
  })

  it('avisa cuando el usuario no tiene secciones asignadas', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(perfilCon([]))

    renderHome()

    expect(
      await screen.findByText('Tu usuario no tiene secciones asignadas todavía.'),
    ).toBeInTheDocument()
  })

  it('muestra "Mi firma" solo si el empleado es de planta (issue #11)', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }], 'planta'),
    )

    renderHome()

    expect(await screen.findByText('Mi firma')).toBeInTheDocument()
  })

  it('no muestra "Mi firma" para personal ocasional', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }], 'ocasional'),
    )

    renderHome()

    await screen.findByText('Formato de traslado')
    expect(screen.queryByText('Mi firma')).not.toBeInTheDocument()
  })

  it('enlaza al encabezado si todavía no se ha guardado ninguno (issue #51)', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.listarAtencionesEnCurso).mockResolvedValue([ATENCION_EN_CURSO])
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(null)

    renderHome()

    expect(await screen.findByText(/Servicio en curso — móvil M-03/)).toBeInTheDocument()
    const enlace = screen.getByRole('link', { name: 'Continuar' })
    expect(enlace).toHaveAttribute('href', '/atenciones/7/encabezado-traslado')
  })

  it('enlaza directo al clínico si el encabezado ya se guardó (issue #51)', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.listarAtencionesEnCurso).mockResolvedValue([ATENCION_EN_CURSO])
    // No importa el contenido exacto -- solo que ya exista un formato
    // guardado es lo que indica que el encabezado ya se llenó.
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(ENCABEZADO_YA_GUARDADO)

    renderHome()

    expect(await screen.findByText(/Servicio en curso — móvil M-03/)).toBeInTheDocument()
    const enlace = screen.getByRole('link', { name: 'Continuar' })
    expect(enlace).toHaveAttribute('href', '/atenciones/7/clinico-traslado')
  })

  it('enlaza al encabezado SOAT si todavía no se ha guardado ninguno (issue #70)', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.listarAtencionesEnCurso).mockResolvedValue([ATENCION_SOAT_EN_CURSO])
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(null)

    renderHome()

    expect(await screen.findByText(/Servicio en curso — móvil M-03/)).toBeInTheDocument()
    const enlace = screen.getByRole('link', { name: 'Continuar' })
    expect(enlace).toHaveAttribute('href', '/atenciones/9/encabezado-accidente-soat')
  })

  it('enlaza directo al clínico SOAT si el encabezado ya se guardó (issue #70)', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
    )
    vi.mocked(api.listarAtencionesEnCurso).mockResolvedValue([ATENCION_SOAT_EN_CURSO])
    vi.mocked(api.obtenerEncabezadoAccidenteSoat).mockResolvedValue(ENCABEZADO_SOAT_YA_GUARDADO)

    renderHome()

    expect(await screen.findByText(/Servicio en curso — móvil M-03/)).toBeInTheDocument()
    const enlace = screen.getByRole('link', { name: 'Continuar' })
    expect(enlace).toHaveAttribute('href', '/atenciones/9/clinico-accidente-soat')
  })

  it('no pregunta por servicios en curso si el rol no puede ser responsable', async () => {
    vi.mocked(api.obtenerPerfil).mockResolvedValue(
      perfilCon([{ id: 1, nombre: 'conductor', descripcion: null }]),
    )

    renderHome()

    await screen.findByText('Chequeo de ambulancia')
    expect(api.listarAtencionesEnCurso).not.toHaveBeenCalled()
  })
})
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
  lesiones_localizadas: [
    { tipo: 'tce', tipo_otro: null, zona: 'cabeza', lado: 'central', vista: 'frontal' },
  ],
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
  profesional_recibe_nombre: 'Carlos Gómez',
  profesional_recibe_cedula: '900000002',
  firma_profesional_recibe: null,
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
  lesiones_localizadas: [],
  glasgow_ocular: null,
  glasgow_verbal: null,
  glasgow_motora: null,
  insumos_entregados: [],
  nota_auxiliar: null,
  atendido_por: null,
  nota_medica: null,
  evolucionado_por: null,
  profesional_recibe_nombre: null,
  profesional_recibe_cedula: null,
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

  it('precarga las lesiones localizadas ya guardadas (issue #54)', async () => {
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO)

    renderPagina()

    expect(await screen.findByText('TCE — Cabeza (vista frontal)')).toBeInTheDocument()
  })

  it('tocar el diagrama, elegir un tipo y agregarlo se manda en el guardado (issue #54)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
    vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

    renderPagina()

    await screen.findByLabelText('Diagnóstico')
    // Lado de pantalla izquierdo, en vista frontal (la que arranca
    // por defecto), es el lado DERECHO real del paciente.
    await usuario.click(screen.getByRole('button', { name: 'Pierna derecha' }))
    await usuario.selectOptions(screen.getByLabelText('Tipo de lesión'), 'hematoma')
    await usuario.click(screen.getByRole('button', { name: 'Agregar a la lista' }))

    expect(screen.getByText('Hematoma — Pierna derecha (vista frontal)')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
    expect(datos.lesiones_localizadas).toEqual([
      { tipo: 'hematoma', tipo_otro: null, zona: 'pierna', lado: 'derecho', vista: 'frontal' },
    ])
  })

  it('"Quitar" saca una lesión de la lista antes de guardar (issue #54)', async () => {
    const usuario = userEvent.setup()
    vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO)
    vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

    renderPagina()

    const fila = await screen.findByText('TCE — Cabeza (vista frontal)')
    // "Quitar" también existe para signos vitales/insumos -- se acota
    // al botón dentro de la misma fila de esta lesión.
    await usuario.click(within(fila.closest('div')!).getByRole('button', { name: 'Quitar' }))
    expect(screen.queryByText('TCE — Cabeza (vista frontal)')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
    const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
    expect(datos.lesiones_localizadas).toEqual([])
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
        // QA: la firma se bloquea mientras no haya nombre de médico, así
        // que aquí se usa un médico de planta (nombre ya precargado)
        // para poder dibujar de una vez.
        perfilCon([{ id: 1, nombre: 'medico', descripcion: null }], null, 'Dra. Ejemplo'),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

      renderPagina()

      // Issue #75 agregó otro recuadro siempre presente ("profesional
      // que recibe") -- el de "quien evolucionó" sigue siendo el
      // primero en el DOM, de ahí `findAllBy` en vez de `findBy`.
      await screen.findByDisplayValue('Dra. Ejemplo')
      const [canvas] = await screen.findAllByLabelText('Recuadro para firmar')
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
          // QA: la firma del médico se bloquea mientras no haya un
          // nombre -- aquí el médico es de planta y ya tiene su
          // nombre precargado, así que puede dibujar de una vez.
          'Dr. Ejemplo',
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

      // Issue #75 agregó otro recuadro siempre presente ("profesional
      // que recibe") -- el de "quien evolucionó" sigue siendo el
      // primero en el DOM, de ahí `findAllBy` en vez de `findBy`.
      const [canvas] = await screen.findAllByLabelText('Recuadro para firmar')
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

  describe('selector de médico en lo clínico (issue #63)', () => {
    const MEDICO_PLANTA: Empleado = {
      id: 2,
      nombres: 'Laura',
      apellidos: 'Páez',
      cedula: '900000001',
      telefono: null,
      tipo_vinculacion: 'planta',
      activo: true,
    }
    const EXPORTADA = 'data:image/png;base64,FIRMA-MEDICO-EN-VIVO'

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

    it('auxiliar: ofrece un selector de médicos de planta, no un campo libre', async () => {
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.listarMedicosDisponibles).mockResolvedValue([MEDICO_PLANTA])

      renderPagina()

      const selector = await screen.findByLabelText('Médico que evolucionó')
      expect(await within(selector).findByText('Laura Páez')).toBeInTheDocument()
      expect(within(selector).getByText('Otro (escribir el nombre)')).toBeInTheDocument()
      expect(screen.queryByLabelText('Evolucionado por')).not.toBeInTheDocument()
    })

    it('elegir un médico de la lista completa el nombre y exige la firma a mano', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        // Firma guardada propia (de planta) para el auxiliar, para que
        // "quien atendió" se muestre como vista previa (<img>) y no
        // deje dos canvas de firma en pantalla -- lo que aquí interesa
        // probar es el canvas de "quien evolucionó" (el médico).
        perfilCon(
          [{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }],
          'data:image/png;base64,GUARDADA-AUXILIAR',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.listarMedicosDisponibles).mockResolvedValue([MEDICO_PLANTA])
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

      renderPagina()

      const selector = await screen.findByLabelText('Médico que evolucionó')
      await screen.findByText('Laura Páez')
      await usuario.selectOptions(selector, '2')
      // La firma del médico elegido nunca se autocompleta sola -- se
      // dibuja aquí mismo, en el dispositivo (issue #63).
      expect(screen.queryByAltText('Firma de quien evolucionó')).not.toBeInTheDocument()
      // Issue #75 agregó otro recuadro siempre presente ("profesional
      // que recibe") -- el de "quien evolucionó" sigue siendo el
      // primero en el DOM, de ahí `findAllBy` en vez de `findBy`.
      const [canvas] = await screen.findAllByLabelText('Recuadro para firmar')
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
      )
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 20, clientY: 20, bubbles: true }),
      )

      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
      const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      expect(datos.evolucionado_por).toBe('Laura Páez')
      expect(datos.firma_evolucionado_por).toBe(EXPORTADA)
    })

    it('"Otro" revela un campo de texto para el médico que no está de planta', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.listarMedicosDisponibles).mockResolvedValue([MEDICO_PLANTA])
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

      renderPagina()

      const selector = await screen.findByLabelText('Médico que evolucionó')
      await screen.findByText('Laura Páez')
      await usuario.selectOptions(selector, 'otro')
      await usuario.type(screen.getByLabelText('Nombre del médico'), 'Carlos Mora')

      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
      const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      expect(datos.evolucionado_por).toBe('Carlos Mora')
    })

    it('traslado básico: también ofrece el selector de médicos de planta, y el canvas para firmar', async () => {
      // Pedido explícito del usuario: antes el selector solo salía en
      // medicalizado y en básico el nombre quedaba como campo libre.
      // En básico el médico también puede ir (es opcional, no
      // obligatorio como en medicalizado), y elegirlo de una lista es
      // más fácil que escribirlo a mano -- así que el selector se
      // ofrece igual en los dos casos.
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue({
        ...FORMATO_SIN_CLINICO,
        nivel_servicio: 'basico',
      })
      vi.mocked(api.listarMedicosDisponibles).mockResolvedValue([MEDICO_PLANTA])

      renderPagina()

      const selector = await screen.findByLabelText('Médico que evolucionó')
      expect(await within(selector).findByText('Laura Páez')).toBeInTheDocument()
      expect(within(selector).getByText('Otro (escribir el nombre)')).toBeInTheDocument()
      expect(screen.queryByLabelText('Evolucionado por')).not.toBeInTheDocument()
      // Bug encontrado en pruebas manuales: en básico el médico es
      // opcional, pero si va, igual hay que poder capturar su firma --
      // antes el canvas solo aparecía si quien estaba logueado era el
      // médico, así que un auxiliar llenando un básico no tenía dónde
      // ponerla aunque el médico sí hubiera ido ese día. (Tres
      // recuadros en total: el propio, de "quien atendió"; el de
      // "quien evolucionó"; y el de "profesional que recibe" -- issue
      // #75, siempre presente -- de ahí `findAllBy` en vez de `findBy`.)
      expect(await screen.findAllByLabelText('Recuadro para firmar')).toHaveLength(3)
    })

    it('traslado básico: si el médico fue y firma, la firma se manda; si no, se manda null', async () => {
      const usuario = userEvent.setup()
      const EXPORTADA = 'data:image/png;base64,FIRMA-MEDICO-BASICO'
      class ImagenFalsa {
        onload: (() => void) | null = null
        set src(_valor: string) {
          setTimeout(() => this.onload?.(), 0)
        }
      }
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

      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        // Firma guardada propia (de planta) para el auxiliar, para que
        // "quien atendió" se muestre como vista previa (<img>) y no
        // deje dos canvas de firma en pantalla -- aquí interesa
        // probar solo el canvas de "quien evolucionó" (el médico).
        perfilCon(
          [{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }],
          'data:image/png;base64,GUARDADA-AUXILIAR',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue({
        ...FORMATO_SIN_CLINICO,
        nivel_servicio: 'basico',
      })
      // Sin médicos de planta registrados -- este médico no está de
      // planta, así que se usa "Otro" para escribir el nombre a mano.
      vi.mocked(api.listarMedicosDisponibles).mockResolvedValue([])
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

      renderPagina()

      const selector = await screen.findByLabelText('Médico que evolucionó')
      await screen.findByText('No hay médicos de planta registrados')
      await usuario.selectOptions(selector, 'otro')
      await usuario.type(screen.getByLabelText('Nombre del médico'), 'Carlos Mora')
      // Issue #75 agregó otro recuadro siempre presente ("profesional
      // que recibe") -- el de "quien evolucionó" sigue siendo el
      // primero en el DOM, de ahí `findAllBy` en vez de `findBy`.
      const [canvas] = await screen.findAllByLabelText('Recuadro para firmar')
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
      )
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 20, clientY: 20, bubbles: true }),
      )

      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
      const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      expect(datos.evolucionado_por).toBe('Carlos Mora')
      expect(datos.firma_evolucionado_por).toBe(EXPORTADA)
    })

    it('traslado básico: si nadie dibuja nada en el canvas del médico, se manda null', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue({
        ...FORMATO_SIN_CLINICO,
        nivel_servicio: 'basico',
      })
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

      renderPagina()

      await screen.findByLabelText('Diagnóstico')
      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

      await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
      const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      expect(datos.firma_evolucionado_por).toBeNull()
    })

    it('médico logueado: sigue viendo el campo libre de siempre, no el selector', async () => {
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'medico', descripcion: null }], null, 'Laura Páez'),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)

      renderPagina()

      await screen.findByLabelText('Diagnóstico')
      expect(screen.queryByLabelText('Médico que evolucionó')).not.toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByLabelText('Evolucionado por')).toHaveValue('Laura Páez'),
      )
      expect(api.listarMedicosDisponibles).not.toHaveBeenCalled()
    })

    it('bloquea la firma de "quien evolucionó" mientras no haya nombre de médico (bug de QA)', async () => {
      // Reportado en pruebas manuales: con el selector de médicos
      // todavía en "Elige un médico de planta" (sin elegir nadie), el
      // canvas de "Firma de quien evolucionó" dejaba firmar igual --
      // la misma clase de bug ya corregida antes para el formato de
      // accidente SOAT.
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.listarMedicosDisponibles).mockResolvedValue([MEDICO_PLANTA])
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

      renderPagina()

      await screen.findByLabelText('Médico que evolucionó')
      await screen.findByText('Laura Páez')

      // Con rol auxiliar y sin firma guardada, "quien atendió" también
      // dibuja a mano (issue #11) y aparece primero en el DOM; el de
      // "quien evolucionó" (el que bloquea este fix) es el segundo, y
      // "profesional que recibe" (issue #75) el tercero.
      const [, canvas] = await screen.findAllByLabelText('Recuadro para firmar')
      expect(canvas).toHaveAttribute('aria-disabled', 'true')
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }),
      )
      canvas.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 20, clientY: 20, bubbles: true }),
      )

      await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
      await waitFor(() => expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1))
      const [, datosSinMedico] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      // El trazo mientras estaba bloqueado nunca se registró -- se
      // manda null, no la firma a medio dibujar.
      expect(datosSinMedico.firma_evolucionado_por).toBeNull()
    })

    it('al elegir un médico de la lista se habilita la firma que antes estaba bloqueada', async () => {
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.listarMedicosDisponibles).mockResolvedValue([MEDICO_PLANTA])

      renderPagina()

      const selector = await screen.findByLabelText('Médico que evolucionó')
      await screen.findByText('Laura Páez')

      const [, canvasAntes] = await screen.findAllByLabelText('Recuadro para firmar')
      expect(canvasAntes).toHaveAttribute('aria-disabled', 'true')

      await usuario.selectOptions(selector, '2')

      const [, canvasDespues] = await screen.findAllByLabelText('Recuadro para firmar')
      await waitFor(() => expect(canvasDespues).toHaveAttribute('aria-disabled', 'false'))
    })
  })

  describe('profesional que recibe en la IPS/ESE (issue #75)', () => {
    it('siempre muestra nombre, cédula y firma de quien recibe', async () => {
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)

      renderPagina()

      expect(await screen.findByLabelText('Nombre de quien recibe')).toBeInTheDocument()
      expect(screen.getByLabelText('Cédula de quien recibe')).toBeInTheDocument()
      // Nunca se muestra como vista previa guardada (<img>) -- siempre
      // es un recuadro para dibujar, sin importar quién esté logueado.
      expect(screen.getByText('Firma de quien recibe')).toBeInTheDocument()
      expect(screen.queryByAltText('Firma de quien recibe')).not.toBeInTheDocument()
    })

    it('precarga lo que ya estuviera guardado', async () => {
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO)

      renderPagina()

      expect(await screen.findByLabelText('Nombre de quien recibe')).toHaveValue('Carlos Gómez')
      expect(screen.getByLabelText('Cédula de quien recibe')).toHaveValue('900000002')
    })

    it('nunca se autocompleta de ningún perfil, aunque quien firma tenga firma guardada', async () => {
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon(
          [{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }],
          'data:image/png;base64,GUARDADA-AUXILIAR',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)

      renderPagina()

      await screen.findByLabelText('Nombre de quien recibe')
      expect(screen.queryByAltText('Firma de quien recibe')).not.toBeInTheDocument()
      expect(screen.getByText('Firma de quien recibe')).toBeInTheDocument()
    })

    it('guarda el nombre, la cédula y la firma dibujada', async () => {
      const usuario = userEvent.setup()
      const EXPORTADA = 'data:image/png;base64,FIRMA-RECIBE'
      class ImagenFalsa {
        onload: (() => void) | null = null
        set src(_valor: string) {
          setTimeout(() => this.onload?.(), 0)
        }
      }
      vi.stubGlobal('Image', ImagenFalsa)
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
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
      } as unknown as CanvasRenderingContext2D)
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(EXPORTADA)
      HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
      HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()

      // Firma guardada propia para el médico -- "evolucionado por" se
      // muestra como <img>, así que el único "Recuadro para firmar" en
      // pantalla es el de "profesional que recibe" (sin ambigüedad de
      // cuál es).
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon(
          [{ id: 1, nombre: 'medico', descripcion: null }],
          'data:image/png;base64,GUARDADA-MEDICO',
        ),
      )
      vi.mocked(api.obtenerEncabezadoTraslado).mockResolvedValue(FORMATO_SIN_CLINICO)
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)

      renderPagina()

      await usuario.type(
        await screen.findByLabelText('Nombre de quien recibe'),
        'Ana Ruiz',
      )
      await usuario.type(screen.getByLabelText('Cédula de quien recibe'), '800000001')
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
      expect(datos.profesional_recibe_nombre).toBe('Ana Ruiz')
      expect(datos.profesional_recibe_cedula).toBe('800000001')
      expect(datos.firma_profesional_recibe).toBe(EXPORTADA)
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

    it('issue #63: guarda lo que hay en pantalla antes de cerrar, sin exigir un "Guardar" aparte primero', async () => {
      // Antes de este fix, cerrar mandaba el PIN directo al servidor
      // sin guardar primero lo que estuviera en pantalla: el aviso de
      // "qué falta" antes de cerrar solo mira el estado en pantalla,
      // no lo que ya quedó guardado en el servidor, así que si
      // alguien editaba algo y le daba "Cerrar atención" sin haber
      // pasado antes por "Guardar", esa edición se perdía (el
      // servidor seguía viendo el valor viejo). Esta prueba arranca
      // de un formato ya completo (nada deshabilita "Cerrar
      // atención") y solo cambia el diagnóstico a mano, para aislar
      // justo el comportamiento que se arregla: que cerrar guarde la
      // edición antes de pedir el PIN, en el mismo clic.
      const usuario = userEvent.setup()
      vi.mocked(api.obtenerPerfil).mockResolvedValue(
        perfilCon([{ id: 1, nombre: 'auxiliar_enfermeria', descripcion: null }]),
      )
      vi.mocked(api.guardarClinicoTraslado).mockResolvedValue(FORMATO)
      vi.mocked(pinLocal.pinLocalValido).mockResolvedValue(true)
      vi.mocked(api.cerrarAtencion).mockResolvedValue(ATENCION_CERRADA)

      renderPagina()

      const diagnostico = await screen.findByLabelText('Diagnóstico')
      await usuario.clear(diagnostico)
      await usuario.type(diagnostico, 'TCE moderado, revalorado')

      await usuario.click(await screen.findByRole('button', { name: 'Cerrar atención' }))
      await usuario.type(screen.getByLabelText('PIN'), '1234')
      await usuario.click(screen.getByRole('button', { name: 'Confirmar cierre' }))

      await waitFor(() => expect(api.cerrarAtencion).toHaveBeenCalledWith(1, '1234'))
      expect(api.guardarClinicoTraslado).toHaveBeenCalledTimes(1)
      // Se guardó antes de cerrar (no después, ni en paralelo sin
      // garantía de orden) y con el valor que se acababa de escribir
      // -- no el que había al cargar la página.
      const ordenGuardar = vi.mocked(api.guardarClinicoTraslado).mock.invocationCallOrder[0]
      const ordenCerrar = vi.mocked(api.cerrarAtencion).mock.invocationCallOrder[0]
      expect(ordenGuardar).toBeLessThan(ordenCerrar)
      const [, datos] = vi.mocked(api.guardarClinicoTraslado).mock.calls[0]
      expect(datos.diagnostico).toBe('TCE moderado, revalorado')
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
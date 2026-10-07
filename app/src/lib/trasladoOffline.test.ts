import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as api from './api'
import { _reiniciarParaPruebas, listarPendientes } from './offlineStore'
import {
  contarPendientes,
  crearAtencionConRespaldo,
  esIdLocal,
  guardarClinicoConRespaldo,
  guardarEncabezadoConRespaldo,
  obtenerFormatoConRespaldo,
  sincronizarPendientes,
} from './trasladoOffline'
import type { Ambulancia, Atencion, Empleado, FormatoTrasladoClinico, FormatoTrasladoEncabezado } from './types'
 
vi.mock('./api', () => import('../test/mockApi').then((m) => m.construirMockApi()))
 
const ambulancia: Ambulancia = {
  id: 1,
  movil: 'M-01',
  placa: 'ABC123',
  tipo: 'basica',
  vencimiento_soat: '2027-01-01',
  vencimiento_tecnomecanica: '2027-01-01',
  activa: true,
}
 
const conductor: Empleado = {
  id: 2,
  nombres: 'Carlos',
  apellidos: 'Gómez',
  cedula: '800000001',
  telefono: null,
  tipo_vinculacion: 'planta',
  activo: true,
}
 
function atencionDeServidor(id: number): Atencion {
  return {
    id,
    tipo: 'traslado',
    estado: 'abierto',
    abierta_en: '2026-10-07T08:00:00Z',
    cerrada_en: null,
    ambulancia,
    conductor,
    responsable: conductor,
  }
}
 
const ENCABEZADO: FormatoTrasladoEncabezado = {
  paciente_tipo_documento: 'cc',
  paciente_numero_documento: '123',
  paciente_eps: 'EPS',
  paciente_nombres: 'Juan',
  paciente_apellidos: 'Pérez',
  paciente_edad: 40,
  paciente_sexo: 'm',
  paciente_direccion_residencial: 'Calle 1',
  paciente_ciudad: 'Ocaña',
  paciente_telefono: null,
  acompanante_nombres_apellidos: null,
  acompanante_parentesco: null,
  acompanante_telefono: null,
  recepcion_fecha: '2026-10-07',
  recepcion_hora: '08:00',
  recepcion_ciudad: 'Ocaña',
  recepcion_ips: 'IPS',
  recepcion_servicio: 'Urgencias',
  entrega_fecha: '2026-10-07',
  entrega_hora: '09:00',
  entrega_ciudad: 'Ocaña',
  entrega_ips: 'IPS 2',
  entrega_servicio: 'UCI',
  complejidad: 'baja',
  categoria_paciente: 'adulto',
  nivel_servicio: 'basico',
  modalidad: 'sencillo',
}
 
const CLINICO: FormatoTrasladoClinico = {
  diagnostico: 'Dolor torácico',
  tratamiento: ['oxigeno'],
  tratamiento_otro: null,
  pupila_derecha: null,
  pupila_izquierda: null,
  signos_vitales: [],
  lesiones: [],
  lesion_otro: null,
  glasgow_ocular: 4,
  glasgow_verbal: 5,
  glasgow_motora: 6,
  insumos_entregados: [],
  nota_auxiliar: null,
  atendido_por: null,
  firma_atendido_por: null,
  nota_medica: null,
  evolucionado_por: null,
  firma_evolucionado_por: null,
}
 
function conEstadoDeRed(enLinea: boolean): () => void {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
  return () => {
    if (original) Object.defineProperty(window.navigator, 'onLine', original)
  }
}
 
beforeEach(async () => {
  vi.clearAllMocks()
  await _reiniciarParaPruebas()
})
 
describe('crearAtencionConRespaldo', () => {
  it('crea en línea cuando hay conexión y el backend responde', async () => {
    const restaurar = conEstadoDeRed(true)
    vi.mocked(api.crearAtencion).mockResolvedValue(atencionDeServidor(7))
 
    const resultado = await crearAtencionConRespaldo({
      tipo: 'traslado',
      ambulancia_id: 1,
      conductor_id: 2,
    })
 
    expect(resultado).toEqual({ atencionId: '7', tipo: 'traslado', guardadaSinConexion: false })
    expect(api.crearAtencion).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'traslado', ambulancia_id: 1, conductor_id: 2 }),
    )
    restaurar()
  })
 
  it('guarda localmente si la llamada falla por un error de red', async () => {
    const restaurar = conEstadoDeRed(true)
    vi.mocked(api.crearAtencion).mockRejectedValue(new TypeError('Failed to fetch'))
 
    const resultado = await crearAtencionConRespaldo({
      tipo: 'traslado',
      ambulancia_id: 1,
      conductor_id: 2,
    })
 
    expect(resultado.guardadaSinConexion).toBe(true)
    expect(esIdLocal(resultado.atencionId)).toBe(true)
    expect(await listarPendientes()).toHaveLength(1)
    restaurar()
  })
 
  it('no intenta la red si el dispositivo ya está sin conexión', async () => {
    const restaurar = conEstadoDeRed(false)
 
    const resultado = await crearAtencionConRespaldo({
      tipo: 'traslado',
      ambulancia_id: 1,
      conductor_id: 2,
    })
 
    expect(resultado.guardadaSinConexion).toBe(true)
    expect(api.crearAtencion).not.toHaveBeenCalled()
    restaurar()
  })
 
  it('propaga un error que no es de red (p. ej. 409 del backend)', async () => {
    const restaurar = conEstadoDeRed(true)
    vi.mocked(api.crearAtencion).mockRejectedValue(
      new api.ApiError(409, 'Esa ambulancia ya tiene una atención abierta'),
    )
 
    await expect(
      crearAtencionConRespaldo({ tipo: 'traslado', ambulancia_id: 1, conductor_id: 2 }),
    ).rejects.toBeInstanceOf(api.ApiError)
    expect(await listarPendientes()).toHaveLength(0)
    restaurar()
  })
})
 
describe('flujo local completo (sin conexión)', () => {
  it('guarda encabezado y clínico localmente y los vuelve a leer combinados', async () => {
    const restaurar = conEstadoDeRed(false)
    const { atencionId } = await crearAtencionConRespaldo({
      tipo: 'traslado',
      ambulancia_id: 1,
      conductor_id: 2,
    })
 
    expect(await obtenerFormatoConRespaldo(atencionId)).toBeNull()
 
    await guardarEncabezadoConRespaldo(atencionId, ENCABEZADO)
    const soloEncabezado = await obtenerFormatoConRespaldo(atencionId)
    expect(soloEncabezado?.paciente_nombres).toBe('Juan')
    expect(soloEncabezado?.glasgow_ocular).toBeNull()
 
    await guardarClinicoConRespaldo(atencionId, CLINICO)
    const completo = await obtenerFormatoConRespaldo(atencionId)
    expect(completo?.paciente_nombres).toBe('Juan')
    expect(completo?.diagnostico).toBe('Dolor torácico')
 
    restaurar()
  })
 
  it('guardarEncabezadoConRespaldo lanza error si el registro local no existe', async () => {
    await expect(guardarEncabezadoConRespaldo('local-no-existe', ENCABEZADO)).rejects.toThrow()
  })
})
 
describe('sincronizarPendientes', () => {
  it('sincroniza creación + encabezado + clínico y borra el pendiente', async () => {
    const restaurar = conEstadoDeRed(false)
    const { atencionId } = await crearAtencionConRespaldo({
      tipo: 'traslado',
      ambulancia_id: 1,
      conductor_id: 2,
    })
    await guardarEncabezadoConRespaldo(atencionId, ENCABEZADO)
    await guardarClinicoConRespaldo(atencionId, CLINICO)
    restaurar()
 
    vi.mocked(api.crearAtencion).mockResolvedValue(atencionDeServidor(9))
    vi.mocked(api.guardarEncabezadoTraslado).mockResolvedValue({
      ...ENCABEZADO,
      ...CLINICO,
      atencion_id: 9,
      glasgow_total: 15,
    })
    vi.mocked(api.guardarClinicoTraslado).mockResolvedValue({
      ...ENCABEZADO,
      ...CLINICO,
      atencion_id: 9,
      glasgow_total: 15,
    })
 
    const resultado = await sincronizarPendientes()
 
    expect(resultado).toEqual({ sincronizados: 1, fallidos: 0 })
    expect(api.guardarEncabezadoTraslado).toHaveBeenCalledWith(9, ENCABEZADO)
    expect(api.guardarClinicoTraslado).toHaveBeenCalledWith(9, CLINICO)
    expect(await contarPendientes()).toBe(0)
    expect(await listarPendientes()).toHaveLength(0)
  })
 
  it('deja el pendiente en la cola (sin borrar) si falla la sincronización', async () => {
    const restaurar = conEstadoDeRed(false)
    await crearAtencionConRespaldo({ tipo: 'traslado', ambulancia_id: 1, conductor_id: 2 })
    restaurar()
 
    vi.mocked(api.crearAtencion).mockRejectedValue(new api.ApiError(409, 'ya ocupada'))
 
    const resultado = await sincronizarPendientes()
 
    expect(resultado).toEqual({ sincronizados: 0, fallidos: 1 })
    expect(await contarPendientes()).toBe(1)
    const [pendiente] = await listarPendientes()
    expect(pendiente.error).toBe('ya ocupada')
  })
 
  it('no reintenta un pendiente que ya quedó marcado como sincronizado', async () => {
    const restaurar = conEstadoDeRed(false)
    await crearAtencionConRespaldo({ tipo: 'traslado', ambulancia_id: 1, conductor_id: 2 })
    restaurar()
    const [pendiente] = await listarPendientes()
    await (await import('./offlineStore')).guardarPendiente({ ...pendiente, sincronizado: true })
 
    const resultado = await sincronizarPendientes()
 
    expect(resultado).toEqual({ sincronizados: 0, fallidos: 0 })
    expect(api.crearAtencion).not.toHaveBeenCalled()
  })
})
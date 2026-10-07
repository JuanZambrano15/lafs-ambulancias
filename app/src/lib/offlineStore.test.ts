import { beforeEach, describe, expect, it } from 'vitest'
 
import {
  _reiniciarParaPruebas,
  contarPendientesSinSincronizar,
  eliminarCierrePendiente,
  eliminarPendiente,
  guardarCierrePendiente,
  guardarPendiente,
  listarCierresPendientes,
  listarPendientes,
  obtenerPendiente,
  type CierrePendiente,
  type TrasladoPendiente,
} from './offlineStore'
 
function pendiente(clientId: string, sincronizado = false): TrasladoPendiente {
  return {
    clientId,
    creadoEn: '2026-10-07T08:00:00.000Z',
    atencion: { tipo: 'traslado', ambulancia_id: 1, conductor_id: 2, client_id: clientId },
    atencionId: null,
    encabezado: null,
    clinico: null,
    cierre: null,
    sincronizado,
    error: null,
  }
}
 
function cierre(atencionId: string): CierrePendiente {
  return { atencionId, pin: '1234', intentadoEn: '2026-10-07T08:00:00.000Z', error: null }
}
 
beforeEach(async () => {
  await _reiniciarParaPruebas()
})
 
describe('offlineStore', () => {
  it('guarda y vuelve a leer un pendiente por su clientId', async () => {
    await guardarPendiente(pendiente('aaa'))
 
    const leido = await obtenerPendiente('aaa')
 
    expect(leido?.atencion.ambulancia_id).toBe(1)
  })
 
  it('devuelve null si no existe ese clientId', async () => {
    expect(await obtenerPendiente('no-existe')).toBeNull()
  })
 
  it('lista todos los pendientes guardados', async () => {
    await guardarPendiente(pendiente('aaa'))
    await guardarPendiente(pendiente('bbb'))
 
    const lista = await listarPendientes()
 
    expect(lista.map((p) => p.clientId).sort()).toEqual(['aaa', 'bbb'])
  })
 
  it('sobreescribe un pendiente existente (mismo clientId)', async () => {
    await guardarPendiente(pendiente('aaa'))
    await guardarPendiente({ ...pendiente('aaa'), sincronizado: true })
 
    const lista = await listarPendientes()
 
    expect(lista).toHaveLength(1)
    expect(lista[0].sincronizado).toBe(true)
  })
 
  it('elimina un pendiente', async () => {
    await guardarPendiente(pendiente('aaa'))
 
    await eliminarPendiente('aaa')
 
    expect(await obtenerPendiente('aaa')).toBeNull()
  })
 
  it('cuenta solo los que no están sincronizados', async () => {
    await guardarPendiente(pendiente('aaa', false))
    await guardarPendiente(pendiente('bbb', true))
 
    expect(await contarPendientesSinSincronizar()).toBe(1)
  })
})
 
describe('cierres_pendientes (issue #12)', () => {
  it('guarda y lista un cierre pendiente', async () => {
    await guardarCierrePendiente(cierre('7'))
 
    const lista = await listarCierresPendientes()
 
    expect(lista).toHaveLength(1)
    expect(lista[0]).toEqual(cierre('7'))
  })
 
  it('sobreescribe un cierre existente (mismo atencionId)', async () => {
    await guardarCierrePendiente(cierre('7'))
    await guardarCierrePendiente({ ...cierre('7'), error: 'ya ocupada' })
 
    const lista = await listarCierresPendientes()
 
    expect(lista).toHaveLength(1)
    expect(lista[0].error).toBe('ya ocupada')
  })
 
  it('elimina un cierre pendiente', async () => {
    await guardarCierrePendiente(cierre('7'))
 
    await eliminarCierrePendiente('7')
 
    expect(await listarCierresPendientes()).toHaveLength(0)
  })
})
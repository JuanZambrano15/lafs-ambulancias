import { beforeEach, describe, expect, it, vi } from 'vitest'
 
import * as storage from './storage'
import { borrarPinLocal, guardarPinLocal, hayPinLocal, pinLocalValido } from './pinLocal'
 
vi.mock('./storage')
 
// SHA-256('1234') — calculado una sola vez para comparar contra lo que
// produce `pinLocal.ts`, sin depender de la Web Crypto API del test.
const HASH_1234 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'
 
beforeEach(() => {
  vi.clearAllMocks()
})
 
describe('guardarPinLocal', () => {
  it('guarda el hash SHA-256 del PIN, no el PIN en claro', async () => {
    await guardarPinLocal('1234')
 
    expect(storage.guardarHashPinLocal).toHaveBeenCalledWith(HASH_1234)
  })
})
 
describe('hayPinLocal', () => {
  it('true si ya hay un hash guardado en este dispositivo', async () => {
    vi.mocked(storage.leerHashPinLocal).mockResolvedValue(HASH_1234)
 
    expect(await hayPinLocal()).toBe(true)
  })
 
  it('false si todavía no hay nada guardado', async () => {
    vi.mocked(storage.leerHashPinLocal).mockResolvedValue(null)
 
    expect(await hayPinLocal()).toBe(false)
  })
})
 
describe('pinLocalValido', () => {
  it('true si el PIN coincide con el hash guardado', async () => {
    vi.mocked(storage.leerHashPinLocal).mockResolvedValue(HASH_1234)
 
    expect(await pinLocalValido('1234')).toBe(true)
  })
 
  it('false si el PIN no coincide con el hash guardado', async () => {
    vi.mocked(storage.leerHashPinLocal).mockResolvedValue(HASH_1234)
 
    expect(await pinLocalValido('9999')).toBe(false)
  })
 
  it('null (no se puede saber) si este dispositivo no tiene un hash guardado', async () => {
    vi.mocked(storage.leerHashPinLocal).mockResolvedValue(null)
 
    expect(await pinLocalValido('1234')).toBeNull()
  })
})
 
describe('borrarPinLocal', () => {
  it('delega en borrarHashPinLocal', async () => {
    await borrarPinLocal()
 
    expect(storage.borrarHashPinLocal).toHaveBeenCalledTimes(1)
  })
})
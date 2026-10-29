import { afterEach, describe, expect, it, vi } from 'vitest'

import { CLAVE_TEMA, aplicarTema, leerTemaGuardado, temaInicial } from './tema'

afterEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.tema
  vi.unstubAllGlobals()
})

describe('tema', () => {
  it('issue #98: sin elección guardada sigue la preferencia del sistema', () => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: consulta === '(prefers-color-scheme: dark)',
    }))
    expect(temaInicial()).toBe('oscuro')
  })

  it('issue #98: la elección guardada gana sobre la del sistema', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    window.localStorage.setItem(CLAVE_TEMA, 'claro')
    expect(temaInicial()).toBe('claro')
  })

  it('issue #98: ignora valores guardados que no son un tema', () => {
    window.localStorage.setItem(CLAVE_TEMA, 'morado')
    expect(leerTemaGuardado()).toBeNull()
  })

  it('issue #98: aplicarTema deja el atributo en <html>', () => {
    aplicarTema('oscuro')
    expect(document.documentElement.dataset.tema).toBe('oscuro')
  })
})
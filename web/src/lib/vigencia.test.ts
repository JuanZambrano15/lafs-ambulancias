import { describe, expect, it } from 'vitest'

import { formatearFechaDia, textoChequeo, textoVencimiento } from './vigencia'

describe('vigencia', () => {
  it('formatea la fecha como día/mes/año', () => {
    expect(formatearFechaDia('2027-03-05')).toBe('05/03/2027')
  })

  it('dice cuánto falta, o hace cuánto venció', () => {
    expect(textoVencimiento(20)).toBe('Vence en 20 días')
    expect(textoVencimiento(1)).toBe('Vence en 1 día')
    expect(textoVencimiento(0)).toBe('Vence hoy')
    expect(textoVencimiento(-1)).toBe('Vencido hace 1 día')
    expect(textoVencimiento(-5)).toBe('Vencido hace 5 días')
  })

  it('dice hace cuánto fue el último chequeo', () => {
    expect(textoChequeo(null)).toBe('Sin chequeos todavía')
    expect(textoChequeo(0)).toBe('Chequeo de hoy')
    expect(textoChequeo(1)).toBe('Último chequeo hace 1 día')
    expect(textoChequeo(4)).toBe('Último chequeo hace 4 días')
  })
})
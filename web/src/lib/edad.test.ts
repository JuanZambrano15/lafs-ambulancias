import { describe, expect, it } from 'vitest'

import { calcularEdad, datosDeEdad, valorDesdeEdad } from './edad'

describe('calcularEdad', () => {
  it('cuenta años cumplidos', () => {
    expect(calcularEdad('1990-05-10', '2026-05-10')).toBe(36)
    expect(calcularEdad('1990-05-10', '2026-05-09')).toBe(35)
    expect(calcularEdad('1990-05-10', '2026-12-31')).toBe(36)
  })

  it('un recién nacido tiene 0 años', () => {
    expect(calcularEdad('2026-11-01', '2026-11-25')).toBe(0)
    expect(calcularEdad('2026-11-25', '2026-11-25')).toBe(0)
  })

  it('devuelve null con fechas inválidas o nacimiento futuro', () => {
    expect(calcularEdad('', '2026-11-25')).toBeNull()
    expect(calcularEdad('2027-01-01', '2026-11-25')).toBeNull()
    expect(calcularEdad('abc', '2026-11-25')).toBeNull()
  })
})

describe('datosDeEdad', () => {
  it('manda solo la edad escrita', () => {
    expect(datosDeEdad({ modo: 'edad', edad: '45', nacimiento: '1980-01-01' })).toEqual({
      paciente_edad: 45,
    })
  })

  it('manda solo la fecha de nacimiento cuando se eligió esa opción', () => {
    expect(datosDeEdad({ modo: 'nacimiento', edad: '45', nacimiento: '1980-01-01' })).toEqual({
      paciente_edad: null,
      paciente_fecha_nacimiento: '1980-01-01',
    })
  })

  it('edad vacía es null', () => {
    expect(datosDeEdad({ modo: 'edad', edad: '', nacimiento: '' })).toEqual({ paciente_edad: null })
    expect(datosDeEdad({ modo: 'nacimiento', edad: '', nacimiento: '' })).toEqual({
      paciente_edad: null,
    })
  })
})

describe('valorDesdeEdad', () => {
  it('arranca en modo edad con lo guardado', () => {
    expect(valorDesdeEdad(30)).toEqual({ modo: 'edad', edad: '30', nacimiento: '' })
    expect(valorDesdeEdad(null)).toEqual({ modo: 'edad', edad: '', nacimiento: '' })
  })
})
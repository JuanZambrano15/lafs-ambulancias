import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { INTERVALO_MINUTOS, sincronizarRecordatorioServicio } from './recordatorioServicio'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn() } }))
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    createChannel: vi.fn(),
    schedule: vi.fn(),
    cancel: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
  vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' })
})

describe('sincronizarRecordatorioServicio', () => {
  it('fuera de la app nativa no hace nada', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)

    await sincronizarRecordatorioServicio(2)

    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
    expect(LocalNotifications.cancel).not.toHaveBeenCalled()
  })

  it('con servicios abiertos programa un aviso persistente que se repite', async () => {
    await sincronizarRecordatorioServicio(1)

    const { notifications } = vi.mocked(LocalNotifications.schedule).mock.calls[0][0]
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      title: 'Tienes un servicio activo',
      ongoing: true,
      autoCancel: false,
      schedule: { every: 'minute', count: INTERVALO_MINUTOS },
    })
  })

  it('el aviso se repite cada 30 minutos', () => {
    expect(INTERVALO_MINUTOS).toBe(30)
  })

  it('el texto dice cuántos servicios hay abiertos', async () => {
    await sincronizarRecordatorioServicio(3)

    const { notifications } = vi.mocked(LocalNotifications.schedule).mock.calls[0][0]
    expect(notifications[0].body).toContain('3 servicios')
  })

  it('cuando ya no queda ninguno cancela el aviso', async () => {
    await sincronizarRecordatorioServicio(0)

    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1001 }] })
    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
  })

  it('pide el permiso si todavía no se ha decidido', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'prompt' })
    vi.mocked(LocalNotifications.requestPermissions).mockResolvedValue({ display: 'granted' })

    await sincronizarRecordatorioServicio(1)

    expect(LocalNotifications.requestPermissions).toHaveBeenCalled()
    expect(LocalNotifications.schedule).toHaveBeenCalled()
  })

  it('si el usuario niega el permiso no programa nada', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'denied' })

    await sincronizarRecordatorioServicio(1)

    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
  })

  it('un fallo del plugin no rompe la app', async () => {
    vi.mocked(LocalNotifications.schedule).mockRejectedValue(new Error('boom'))

    await expect(sincronizarRecordatorioServicio(1)).resolves.toBeUndefined()
  })
})
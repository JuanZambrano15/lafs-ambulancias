/**
 * Recordatorio en la barra de notificaciones de la tablet: mientras el
 * usuario tenga algún servicio abierto, cada `INTERVALO_MINUTOS` minutos
 * aparece "Tienes un servicio activo". La notificación es persistente
 * (no se puede descartar deslizando) y solo desaparece cuando ya no queda
 * ningún servicio abierto, es decir, cuando se cierra el último.
 *
 * Usa notificaciones locales programadas con el sistema (AlarmManager),
 * así que siguen apareciendo aunque la app esté en segundo plano o
 * cerrada. Se vuelven a sincronizar cada vez que se abre Home, que es a
 * donde la app vuelve después de guardar o cerrar una atención.
 *
 * En el navegador (desarrollo, panel, pruebas) no hace nada: solo existe
 * en la app nativa.
 */

import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

/** Cada cuánto se repite el aviso. Cámbielo a 60 para "cada hora". */
export const INTERVALO_MINUTOS = 30

/** Id fijo: hay un solo recordatorio por tablet, no uno por servicio. */
const ID_NOTIFICACION = 1001

const ID_CANAL = 'servicio-activo'

export async function sincronizarRecordatorioServicio(serviciosActivos: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    if (serviciosActivos <= 0) {
      await LocalNotifications.cancel({ notifications: [{ id: ID_NOTIFICACION }] })
      return
    }

    let permiso = await LocalNotifications.checkPermissions()
    if (permiso.display === 'prompt' || permiso.display === 'prompt-with-rationale') {
      permiso = await LocalNotifications.requestPermissions()
    }
    if (permiso.display !== 'granted') return

    await LocalNotifications.createChannel({
      id: ID_CANAL,
      name: 'Servicio activo',
      description: 'Recordatorio de servicios que siguen abiertos',
      importance: 4,
    })

    // Se reemplaza el recordatorio anterior en vez de apilar otro: así el
    // texto siempre refleja cuántos servicios hay abiertos ahora.
    await LocalNotifications.cancel({ notifications: [{ id: ID_NOTIFICACION }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID_NOTIFICACION,
          channelId: ID_CANAL,
          title: 'Tienes un servicio activo',
          body:
            serviciosActivos === 1
              ? 'Hay un servicio sin cerrar. Ábrelo para continuar o cerrarlo.'
              : `Hay ${serviciosActivos} servicios sin cerrar. Ábrelos para continuar o cerrarlos.`,
          ongoing: true,
          autoCancel: false,
          schedule: {
            every: 'minute',
            count: INTERVALO_MINUTOS,
            allowWhileIdle: true,
          },
        },
      ],
    })
  } catch {
    // El recordatorio es una ayuda: si falla (permiso, plugin, sistema),
    // la app sigue funcionando igual.
  }
}
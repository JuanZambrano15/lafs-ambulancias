/**
 * Cola local de traslados pendientes por sincronizar (issue #10,
 * ADR-0008) — IndexedDB, no SQLite: ya está disponible en el WebView
 * de Capacitor sin plugin nativo ni rebuild de Android.
 *
 * Una fila por atención creada sin conexión, con los datos para crear
 * la atención y lo que se haya guardado del encabezado/parte clínica
 * hasta el momento. Se borra una vez los tres pasos se confirmaron
 * contra el backend (ver `trasladoOffline.ts`).
 */
 
import type { AtencionCreate, FormatoTrasladoClinico, FormatoTrasladoEncabezado } from './types'
 
export interface TrasladoPendiente {
  /** UUID generado en el dispositivo — llave de la fila y también lo
   * que identifica la atención ante el backend al sincronizar. */
  clientId: string
  creadoEn: string
  atencion: AtencionCreate
  /** `null` hasta que `POST /atenciones` se confirma contra el backend. */
  atencionId: number | null
  encabezado: FormatoTrasladoEncabezado | null
  clinico: FormatoTrasladoClinico | null
  sincronizado: boolean
  /** Mensaje del último intento fallido de sincronización, si lo hubo. */
  error: string | null
}
 
const DB_NAME = 'lafs-offline'
const DB_VERSION = 1
const STORE = 'traslados_pendientes'
 
function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NAME, DB_VERSION)
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientId' })
      }
    }
    solicitud.onsuccess = () => resolve(solicitud.result)
    solicitud.onerror = () => reject(solicitud.error ?? new Error('No se pudo abrir el storage local'))
  })
}
 
async function conTransaccion<T>(
  modo: IDBTransactionMode,
  accion: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await abrirDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, modo)
      const solicitud = accion(tx.objectStore(STORE))
      solicitud.onsuccess = () => resolve(solicitud.result)
      solicitud.onerror = () => reject(solicitud.error ?? new Error('Error de storage local'))
    })
  } finally {
    db.close()
  }
}
 
export async function guardarPendiente(pendiente: TrasladoPendiente): Promise<void> {
  await conTransaccion('readwrite', (store) => store.put(pendiente))
}
 
export async function obtenerPendiente(clientId: string): Promise<TrasladoPendiente | null> {
  const resultado = await conTransaccion<TrasladoPendiente | undefined>('readonly', (store) =>
    store.get(clientId),
  )
  return resultado ?? null
}
 
export async function listarPendientes(): Promise<TrasladoPendiente[]> {
  return conTransaccion('readonly', (store) => store.getAll())
}
 
export async function eliminarPendiente(clientId: string): Promise<void> {
  await conTransaccion('readwrite', (store) => store.delete(clientId))
}
 
export async function contarPendientesSinSincronizar(): Promise<number> {
  const pendientes = await listarPendientes()
  return pendientes.filter((p) => !p.sincronizado).length
}
 
/** Solo para pruebas: deja la cola local en blanco entre tests. */
export async function _reiniciarParaPruebas(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const solicitud = indexedDB.deleteDatabase(DB_NAME)
    solicitud.onsuccess = () => resolve()
    solicitud.onerror = () => reject(solicitud.error ?? new Error('No se pudo reiniciar el storage'))
    solicitud.onblocked = () => resolve()
  })
}
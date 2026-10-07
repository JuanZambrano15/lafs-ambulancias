/**
 * Capa que decide, para el flujo de un traslado (crear atención →
 * encabezado → clínico), si habla con el backend o con la cola local
 * (issue #10, ADR-0008). Las pantallas llaman a estas funciones en
 * vez de a `lib/api.ts` directamente, y no necesitan saber si el
 * identificador que reciben es el id real de la atención o uno local
 * todavía sin sincronizar.
 *
 * Un identificador local se ve como `local-<uuid>`; uno real es el id
 * numérico de la atención, siempre como string en esta capa (las
 * pantallas lo usan tal cual en las rutas).
 */
 
import {
  crearAtencion,
  guardarClinicoTraslado,
  guardarEncabezadoTraslado,
  obtenerEncabezadoTraslado,
} from './api'
import {
  contarPendientesSinSincronizar,
  eliminarPendiente,
  guardarPendiente,
  listarPendientes,
  obtenerPendiente,
  type TrasladoPendiente,
} from './offlineStore'
import type {
  AtencionCreate,
  FormatoTraslado,
  FormatoTrasladoClinico,
  FormatoTrasladoEncabezado,
  TipoAtencion,
} from './types'
 
const LOCAL_PREFIX = 'local-'
 
export function esIdLocal(atencionId: string): boolean {
  return atencionId.startsWith(LOCAL_PREFIX)
}
 
function idDesdeClientId(clientId: string): string {
  return `${LOCAL_PREFIX}${clientId}`
}
 
function clientIdDesdeId(atencionId: string): string {
  return atencionId.slice(LOCAL_PREFIX.length)
}
 
/** `fetch` lanza `TypeError` cuando no hay red (a diferencia de
 * `ApiError`, que es una respuesta HTTP real del servidor) — es la
 * señal de que toca guardar localmente en vez de reintentar. */
function esErrorDeRed(err: unknown): boolean {
  return err instanceof TypeError
}
 
const CLINICO_VACIO: FormatoTrasladoClinico = {
  diagnostico: null,
  tratamiento: [],
  tratamiento_otro: null,
  pupila_derecha: null,
  pupila_izquierda: null,
  signos_vitales: [],
  lesiones: [],
  lesion_otro: null,
  glasgow_ocular: null,
  glasgow_verbal: null,
  glasgow_motora: null,
  insumos_entregados: [],
  nota_auxiliar: null,
  atendido_por: null,
  nota_medica: null,
  evolucionado_por: null,
}
 
function formatoDesdeLocal(pendiente: TrasladoPendiente): FormatoTraslado | null {
  if (pendiente.encabezado === null) return null
  return {
    ...pendiente.encabezado,
    ...(pendiente.clinico ?? CLINICO_VACIO),
    // No hay id de atención real todavía — nada en las pantallas de
    // encabezado/clínico lee este campo, solo lo pide el tipo.
    atencion_id: 0,
    glasgow_total: null,
  }
}
 
export interface ResultadoCrearAtencion {
  atencionId: string
  tipo: TipoAtencion
  /** true si se guardó localmente porque no había conexión. */
  guardadaSinConexion: boolean
}
 
export async function crearAtencionConRespaldo(
  datos: AtencionCreate,
): Promise<ResultadoCrearAtencion> {
  const clientId = crypto.randomUUID()
  const datosConClientId: AtencionCreate = { ...datos, client_id: clientId }
 
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await guardarComoPendiente(clientId, datosConClientId)
    return { atencionId: idDesdeClientId(clientId), tipo: datos.tipo, guardadaSinConexion: true }
  }
 
  try {
    const atencion = await crearAtencion(datosConClientId)
    return { atencionId: String(atencion.id), tipo: atencion.tipo, guardadaSinConexion: false }
  } catch (err) {
    if (!esErrorDeRed(err)) throw err
    await guardarComoPendiente(clientId, datosConClientId)
    return { atencionId: idDesdeClientId(clientId), tipo: datos.tipo, guardadaSinConexion: true }
  }
}
 
async function guardarComoPendiente(clientId: string, atencion: AtencionCreate): Promise<void> {
  await guardarPendiente({
    clientId,
    creadoEn: new Date().toISOString(),
    atencion,
    atencionId: null,
    encabezado: null,
    clinico: null,
    sincronizado: false,
    error: null,
  })
}
 
async function pendienteOFallar(atencionId: string): Promise<TrasladoPendiente> {
  const pendiente = await obtenerPendiente(clientIdDesdeId(atencionId))
  if (pendiente === null) {
    throw new Error('No se encontró el traslado guardado sin conexión en este dispositivo')
  }
  return pendiente
}
 
export async function obtenerFormatoConRespaldo(atencionId: string): Promise<FormatoTraslado | null> {
  if (esIdLocal(atencionId)) {
    const pendiente = await obtenerPendiente(clientIdDesdeId(atencionId))
    return pendiente === null ? null : formatoDesdeLocal(pendiente)
  }
  return obtenerEncabezadoTraslado(Number(atencionId))
}
 
export async function guardarEncabezadoConRespaldo(
  atencionId: string,
  datos: FormatoTrasladoEncabezado,
): Promise<void> {
  if (esIdLocal(atencionId)) {
    const pendiente = await pendienteOFallar(atencionId)
    await guardarPendiente({ ...pendiente, encabezado: datos })
    return
  }
  await guardarEncabezadoTraslado(Number(atencionId), datos)
}
 
export async function guardarClinicoConRespaldo(
  atencionId: string,
  datos: FormatoTrasladoClinico,
): Promise<void> {
  if (esIdLocal(atencionId)) {
    const pendiente = await pendienteOFallar(atencionId)
    await guardarPendiente({ ...pendiente, clinico: datos })
    return
  }
  await guardarClinicoTraslado(Number(atencionId), datos)
}
 
export async function contarPendientes(): Promise<number> {
  return contarPendientesSinSincronizar()
}
 
export interface ResultadoSincronizacion {
  sincronizados: number
  fallidos: number
}
 
/** Sube a la API todo lo que se alcanzó a guardar localmente, en
 * orden: crear la atención (si aún no tiene id real), luego el
 * encabezado, luego lo clínico — mismos endpoints que usa la app en
 * línea, así que repetirlos con el mismo cuerpo no duplica nada
 * (ADR-0006, ADR-0007). Se llama al recuperar señal (evento `online`)
 * o manualmente desde el aviso de pendientes. */
export async function sincronizarPendientes(): Promise<ResultadoSincronizacion> {
  const pendientes = await listarPendientes()
  let sincronizados = 0
  let fallidos = 0
 
  for (const pendiente of pendientes) {
    if (pendiente.sincronizado) continue
    try {
      await sincronizarUno(pendiente)
      sincronizados += 1
    } catch (err) {
      fallidos += 1
      await guardarPendiente({
        ...pendiente,
        error: err instanceof Error ? err.message : 'No se pudo sincronizar',
      })
    }
  }
 
  return { sincronizados, fallidos }
}
 
async function sincronizarUno(pendiente: TrasladoPendiente): Promise<void> {
  let atencionId = pendiente.atencionId
  if (atencionId === null) {
    const atencion = await crearAtencion(pendiente.atencion)
    atencionId = atencion.id
    await guardarPendiente({ ...pendiente, atencionId })
  }
  if (pendiente.encabezado !== null) {
    await guardarEncabezadoTraslado(atencionId, pendiente.encabezado)
  }
  if (pendiente.clinico !== null) {
    await guardarClinicoTraslado(atencionId, pendiente.clinico)
  }
  await eliminarPendiente(pendiente.clientId)
}
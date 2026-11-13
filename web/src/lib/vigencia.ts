/** Textos y fechas del semáforo de vigencias (SOAT y tecnomecánica).
 * El color y los días los calcula el backend; aquí solo se muestran. */

export function formatearFechaDia(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

export function textoVencimiento(dias: number): string {
  if (dias < 0) return `Vencido hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export function textoChequeo(diasDesde: number | null): string {
  if (diasDesde === null) return 'Sin chequeos todavía'
  if (diasDesde === 0) return 'Chequeo de hoy'
  return `Último chequeo hace ${diasDesde} ${diasDesde === 1 ? 'día' : 'días'}`
}
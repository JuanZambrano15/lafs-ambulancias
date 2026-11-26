/** Edad del paciente: se puede escribir directo o salir de la fecha de
 * nacimiento (una u otra). La fecha de nacimiento NUNCA se guarda ni se
 * imprime en el PDF: el backend solo conserva la edad en años cumplidos,
 * calculada a la fecha del servicio. Este cálculo del cliente es solo la
 * vista previa que se muestra mientras se escribe. */

export type ModoEdad = 'edad' | 'nacimiento'

export interface EdadONacimientoValor {
  modo: ModoEdad
  /** Edad escrita a mano, como texto de formulario. */
  edad: string
  /** Fecha de nacimiento `YYYY-MM-DD`. */
  nacimiento: string
}

export const EDAD_VACIA: EdadONacimientoValor = { modo: 'edad', edad: '', nacimiento: '' }

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function partes(fecha: string): [number, number, number] | null {
  const m = FECHA_ISO.exec(fecha)
  if (m === null) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Fecha de hoy en hora local, `YYYY-MM-DD`. */
export function hoyISO(): string {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

/** Años cumplidos entre `nacimiento` y `referencia` (ambas `YYYY-MM-DD`).
 * `null` si alguna fecha es inválida o el nacimiento es posterior a la
 * referencia. Misma regla que `app.core.edad.calcular_edad` del backend. */
export function calcularEdad(nacimiento: string, referencia: string): number | null {
  const n = partes(nacimiento)
  const r = partes(referencia)
  if (n === null || r === null) return null
  const [ny, nm, nd] = n
  const [ry, rm, rd] = r
  if (ny > ry || (ny === ry && (nm > rm || (nm === rm && nd > rd)))) return null
  let edad = ry - ny
  if (rm < nm || (rm === nm && rd < nd)) edad -= 1
  return edad
}

/** Lo que se manda al backend: la edad escrita, o la fecha de
 * nacimiento (de la que el backend saca la edad). Solo una de las dos. */
export function datosDeEdad(valor: EdadONacimientoValor): {
  paciente_edad: number | null
  paciente_fecha_nacimiento?: string
} {
  if (valor.modo === 'nacimiento') {
    return valor.nacimiento === ''
      ? { paciente_edad: null }
      : { paciente_edad: null, paciente_fecha_nacimiento: valor.nacimiento }
  }
  return { paciente_edad: valor.edad === '' ? null : Number(valor.edad) }
}

/** Valor inicial del selector a partir de una edad ya guardada. */
export function valorDesdeEdad(edad: number | null): EdadONacimientoValor {
  return { modo: 'edad', edad: edad === null ? '' : String(edad), nacimiento: '' }
}
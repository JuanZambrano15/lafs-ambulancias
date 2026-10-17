/**
 * Factory para `vi.mock('../lib/api', ...)` que mockea las funciones
 * de red pero conserva la clase real `ApiError` — el automock de
 * Vitest reemplaza el constructor de las clases por un mock vacío, lo
 * que rompe `new ApiError(...)` (el mensaje y el status quedan
 * `undefined`). Cada test file importa esto dentro de su propio
 * `vi.mock('../lib/api', () => import('../test/mockApi').then(...))`
 * — ver los archivos de prueba para el uso exacto.
 */
 
import { vi } from 'vitest'
 
export async function construirMockApi(): Promise<Record<string, unknown>> {
  const real = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...real,
    login: vi.fn(),
    obtenerPerfil: vi.fn(),
    cambiarPassword: vi.fn(),
    guardarFirma: vi.fn(),
    establecerPin: vi.fn(),
    listarAmbulanciasDisponibles: vi.fn(),
    listarConductoresDisponibles: vi.fn(),
    // Default a [] -- igual que `listarAtencionesEnCurso` más abajo:
    // la mayoría de las pruebas de ClinicoTrasladoPage no les importa
    // el selector de médico (issue #63), así que no deberían tener
    // que mockear esto explícitamente para no romper con un
    // `undefined.then(...)` cuando el auxiliar logueado dispara la
    // carga de la lista.
    listarMedicosDisponibles: vi.fn().mockResolvedValue([]),
    crearAtencion: vi.fn(),
    // Default a [] -- la mayoría de las pruebas de HomePage no les
    // importa el aviso de "servicio en curso" (issue #51), así que no
    // deberían tener que mockear esto explícitamente para no romper
    // con un `undefined.then(...)`.
    listarAtencionesEnCurso: vi.fn().mockResolvedValue([]),
    // Default a null ("sin encabezado guardado todavía") -- Home lo usa
    // para decidir a dónde manda "Continuar" en el aviso de servicio en
    // curso (issue #51); cada prueba que le importe el valor real lo
    // sobreescribe (ver ClinicoTrasladoPage.test.tsx y
    // EncabezadoTrasladoPage.test.tsx).
    obtenerEncabezadoTraslado: vi.fn().mockResolvedValue(null),
    guardarEncabezadoTraslado: vi.fn(),
    guardarClinicoTraslado: vi.fn(),
    // Issue #70 -- mismo criterio que `obtenerEncabezadoTraslado` de
    // arriba, para el formato de accidente SOAT (issue #17).
    obtenerEncabezadoAccidenteSoat: vi.fn().mockResolvedValue(null),
    guardarEncabezadoAccidenteSoat: vi.fn(),
    guardarClinicoAccidenteSoat: vi.fn(),
    cerrarAtencion: vi.fn(),
  }
}
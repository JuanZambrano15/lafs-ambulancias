
/**
 * Factory para `vi.mock('../lib/api', ...)` que mockea las funciones
 * de red pero conserva la clase real `ApiError` — el automock de
 * Vitest reemplaza el constructor de las clases por un mock vacío, lo
 * que rompe `new ApiError(...)` (el mensaje y el status quedan
 * `undefined`). Cada test file importa esto dentro de su propio
 * `vi.mock('../lib/api', () => import('../test/mockApi').then(...))`
 * — ver los archivos de prueba para el uso exacto. Mismo patrón que
 * `app/src/test/mockApi.ts`.
 */
 
import { vi } from 'vitest'
 
export async function construirMockApi(): Promise<Record<string, unknown>> {
  const real = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...real,
    login: vi.fn(),
    obtenerPerfil: vi.fn(),
    cambiarPassword: vi.fn(),
    listarUsuarios: vi.fn(),
    crearUsuario: vi.fn(),
    actualizarUsuario: vi.fn(),
    asignarRolesUsuario: vi.fn(),
    resetearPasswordUsuario: vi.fn(),
    desactivarUsuario: vi.fn(),
    listarEmpleados: vi.fn(),
    crearEmpleado: vi.fn(),
    actualizarEmpleado: vi.fn(),
    desactivarEmpleado: vi.fn(),
    listarRoles: vi.fn(),
    crearRol: vi.fn(),
    actualizarRol: vi.fn(),
    eliminarRol: vi.fn(),
    // Issue #15 -- se mockean con `[]` por defecto (no `undefined`)
    // para que un test que no las toca a propósito (p. ej. uno de
    // otra página) no rompa por un render que las espera resueltas.
    listarAtencionesPendientes: vi.fn().mockResolvedValue([]),
    listarAtencionesCerradas: vi.fn().mockResolvedValue([]),
    descargarPdfFormatoTraslado: vi.fn(),
    descargarPdfFormatoAccidenteSoat: vi.fn(),
    // Issue #18 -- mismo criterio que las de arriba.
    listarFotosAccidenteSoat: vi.fn().mockResolvedValue([]),
    subirFotoAccidenteSoat: vi.fn(),
    descargarFotoAccidenteSoat: vi.fn(),
    eliminarFotoAccidenteSoat: vi.fn(),
  }
}
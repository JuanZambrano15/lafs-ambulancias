/**
 * Modo claro / oscuro (issue #__ISSUE__).
 *
 * El tema vive en el atributo `data-tema` de <html>; `index.css`
 * redefine las variables de color cuando vale "oscuro", así que
 * ninguna pantalla necesita saber en qué modo está. La elección se
 * guarda en `localStorage` (es una preferencia de este navegador o
 * dispositivo, no de la cuenta). Si nunca se ha elegido, se sigue la
 * preferencia del sistema operativo.
 *
 * El mismo cálculo se repite en un script de `index.html` para aplicar
 * el tema antes del primer pintado -- sin eso la pantalla parpadea en
 * claro un instante antes de que cargue React.
 */

export type Tema = 'claro' | 'oscuro'

export const CLAVE_TEMA = 'lafs-tema'

/** `null` si nunca se eligió o si el almacenamiento no está disponible
 * (modo privado, WebView con el almacenamiento bloqueado...). */
export function leerTemaGuardado(): Tema | null {
  try {
    const valor = window.localStorage.getItem(CLAVE_TEMA)
    return valor === 'claro' || valor === 'oscuro' ? valor : null
  } catch {
    return null
  }
}

export function guardarTema(tema: Tema): void {
  try {
    window.localStorage.setItem(CLAVE_TEMA, tema)
  } catch {
    // Sin almacenamiento el cambio igual se aplica, solo que no se
    // recuerda para la próxima vez.
  }
}

export function temaDelSistema(): Tema {
  // jsdom (pruebas) y algunos WebView viejos no tienen matchMedia.
  if (typeof window.matchMedia !== 'function') return 'claro'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

export function temaInicial(): Tema {
  return leerTemaGuardado() ?? temaDelSistema()
}

export function temaAplicado(): Tema {
  return document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro'
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema
}
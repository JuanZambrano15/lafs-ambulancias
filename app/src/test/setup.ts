import '@testing-library/jest-dom/vitest'
// jsdom no implementa IndexedDB — lo necesita el storage local del
// issue #10 (offlineStore.ts). Sin esto, `indexedDB` sería `undefined`
// en cualquier prueba, incluso las que no tocan nada offline.
import 'fake-indexeddb/auto'
 
// jsdom tampoco implementa ResizeObserver — lo necesita FirmaCanvas
// (issue #78) para redimensionar el lienzo cuando la tablet rota. Los
// tests no verifican el redimensionamiento en sí, así que un stub que
// no observa nada de verdad es suficiente para que monten sin reventar.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
// @ts-expect-error -- jsdom no tiene este tipo global
global.ResizeObserver = ResizeObserverStub
import '@testing-library/jest-dom/vitest'
// jsdom no implementa IndexedDB — lo necesita el storage local del
// issue #10 (offlineStore.ts). Sin esto, `indexedDB` sería `undefined`
// en cualquier prueba, incluso las que no tocan nada offline.
import 'fake-indexeddb/auto'
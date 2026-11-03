import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App.tsx'
import './index.css'
import { aplicarTema, temaInicial } from './lib/tema'

// Issue #98: respaldo del script de index.html -- si por algo no
// corrió (p. ej. una política de seguridad que bloquee scripts en
// línea), el tema igual queda aplicado antes de montar React.
if (!document.documentElement.dataset.tema) {
  aplicarTema(temaInicial())
}

const elementoRaiz = document.getElementById('root')
if (!elementoRaiz) {
  throw new Error('No se encontró el elemento #root en index.html')
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
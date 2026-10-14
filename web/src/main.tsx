import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from './App.tsx'
import './index.css'

const elementoRaiz = document.getElementById('root')
if (!elementoRaiz) {
  throw new Error('No se encontró el elemento #root en index.html')
}

createRoot(elementoRaiz).render(
  <StrictMode>
    {/* basename="/admin": Caddy sirve este build bajo /admin/ (ver
        infra/Caddyfile e issue #49) — sin esto, react-router
        interpretaría las rutas internas (/usuarios, /empleados...)
        como si colgaran de la raíz del dominio. */}
    <BrowserRouter basename="/admin">
      <App />
    </BrowserRouter>
  </StrictMode>,
)
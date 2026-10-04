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
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

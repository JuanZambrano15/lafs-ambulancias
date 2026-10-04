import type { JSX } from 'react'
import { Route, Routes } from 'react-router-dom'
 
import { AuthProvider } from './auth/AuthContext'
import { CambiarPasswordPage } from './pages/CambiarPasswordPage'
import { CrearAtencionPage } from './pages/CrearAtencionPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
 
export function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/atenciones/nueva" element={<CrearAtencionPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
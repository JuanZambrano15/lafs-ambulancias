import type { JSX } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { CambiarPasswordPage } from './pages/CambiarPasswordPage'
import { EmpleadosPage } from './pages/EmpleadosPage'
import { LoginPage } from './pages/LoginPage'
import { RolesPage } from './pages/RolesPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { ProtectedRoute } from './routes/ProtectedRoute'

export function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
          {/* Sin pantalla propia en "/" todavía — issue #15 la agrega
              (pendientes y alertas). Por ahora, entrar al panel manda
              directo a usuarios, que es lo que resuelve este issue. */}
          <Route path="/" element={<Navigate to="/usuarios" replace />} />
          <Route
            path="/usuarios"
            element={
              <Layout>
                <UsuariosPage />
              </Layout>
            }
          />
          <Route
            path="/empleados"
            element={
              <Layout>
                <EmpleadosPage />
              </Layout>
            }
          />
          <Route
            path="/roles"
            element={
              <Layout>
                <RolesPage />
              </Layout>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
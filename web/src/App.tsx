import type { JSX } from 'react'
import { Route, Routes } from 'react-router-dom'
 
import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { CambiarPasswordPage } from './pages/CambiarPasswordPage'
import { CorregirFormatoAccidenteSoatPage } from './pages/CorregirFormatoAccidenteSoatPage'
import { CorregirFormatoTrasladoPage } from './pages/CorregirFormatoTrasladoPage'
import { DashboardPage } from './pages/DashboardPage'
import { EmpleadosPage } from './pages/EmpleadosPage'
import { FotosAccidenteSoatPage } from './pages/FotosAccidenteSoatPage'
import { LoginPage } from './pages/LoginPage'
import { RolesPage } from './pages/RolesPage'
import { ServicioCerradoDetallePage } from './pages/ServicioCerradoDetallePage'
import { ServiciosCerradosPage } from './pages/ServiciosCerradosPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
 
export function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
          <Route
            path="/"
            element={
              <Layout>
                <DashboardPage />
              </Layout>
            }
          />
          <Route
            path="/servicios-cerrados"
            element={
              <Layout>
                <ServiciosCerradosPage />
              </Layout>
            }
          />
          <Route
            path="/atenciones/:atencionId/detalle"
            element={
              <Layout>
                <ServicioCerradoDetallePage />
              </Layout>
            }
          />
          <Route
            path="/atenciones/:atencionId/corregir/traslado"
            element={
              <Layout>
                <CorregirFormatoTrasladoPage />
              </Layout>
            }
          />
          <Route
            path="/atenciones/:atencionId/corregir/accidente-soat"
            element={
              <Layout>
                <CorregirFormatoAccidenteSoatPage />
              </Layout>
            }
          />
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
          <Route
            path="/atenciones/:atencionId/fotos-accidente-soat"
            element={
              <Layout>
                <FotosAccidenteSoatPage />
              </Layout>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
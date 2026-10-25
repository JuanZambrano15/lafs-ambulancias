import type { JSX } from 'react'
import { Route, Routes } from 'react-router-dom'
 
import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { CambiarPasswordPage } from './pages/CambiarPasswordPage'
import { ClinicoAccidenteSoatCorregirPage } from './pages/ClinicoAccidenteSoatCorregirPage'
import { ClinicoTrasladoCorregirPage } from './pages/ClinicoTrasladoCorregirPage'
import { DashboardPage } from './pages/DashboardPage'
import { EmpleadosPage } from './pages/EmpleadosPage'
import { EncabezadoAccidenteSoatCorregirPage } from './pages/EncabezadoAccidenteSoatCorregirPage'
import { EncabezadoTrasladoCorregirPage } from './pages/EncabezadoTrasladoCorregirPage'
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
            path="/atenciones/:atencionId/corregir/encabezado-traslado"
            element={
              <Layout>
                <EncabezadoTrasladoCorregirPage />
              </Layout>
            }
          />
          <Route
            path="/atenciones/:atencionId/corregir/clinico-traslado"
            element={
              <Layout>
                <ClinicoTrasladoCorregirPage />
              </Layout>
            }
          />
          <Route
            path="/atenciones/:atencionId/corregir/encabezado-accidente-soat"
            element={
              <Layout>
                <EncabezadoAccidenteSoatCorregirPage />
              </Layout>
            }
          />
          <Route
            path="/atenciones/:atencionId/corregir/clinico-accidente-soat"
            element={
              <Layout>
                <ClinicoAccidenteSoatCorregirPage />
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

import type { JSX } from 'react'
import { Route, Routes } from 'react-router-dom'
 
import { AuthProvider } from './auth/AuthContext'
import { OfflineSyncBanner } from './components/OfflineSyncBanner'
import { CambiarPasswordPage } from './pages/CambiarPasswordPage'
import { ClinicoAccidenteSoatPage } from './pages/ClinicoAccidenteSoatPage'
import { ClinicoTrasladoPage } from './pages/ClinicoTrasladoPage'
import { ConfigurarFirmaPage } from './pages/ConfigurarFirmaPage'
import { ConfigurarPinPage } from './pages/ConfigurarPinPage'
import { CrearAtencionPage } from './pages/CrearAtencionPage'
import { EncabezadoAccidenteSoatPage } from './pages/EncabezadoAccidenteSoatPage'
import { EncabezadoTrasladoPage } from './pages/EncabezadoTrasladoPage'
import { FotosAccidenteSoatPage } from './pages/FotosAccidenteSoatPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProtectedRoute } from './routes/ProtectedRoute'
 
export function App(): JSX.Element {
  return (
    <AuthProvider>
      <OfflineSyncBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
          <Route path="/configurar-pin" element={<ConfigurarPinPage />} />
          <Route path="/configurar-firma" element={<ConfigurarFirmaPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/atenciones/nueva" element={<CrearAtencionPage />} />
          <Route
            path="/atenciones/:atencionId/encabezado-traslado"
            element={<EncabezadoTrasladoPage />}
          />
          <Route
            path="/atenciones/:atencionId/clinico-traslado"
            element={<ClinicoTrasladoPage />}
          />
          <Route
            path="/atenciones/:atencionId/encabezado-accidente-soat"
            element={<EncabezadoAccidenteSoatPage />}
          />
          <Route
            path="/atenciones/:atencionId/clinico-accidente-soat"
            element={<ClinicoAccidenteSoatPage />}
          />
          <Route
            path="/atenciones/:atencionId/fotos-accidente-soat"
            element={<FotosAccidenteSoatPage />}
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
 
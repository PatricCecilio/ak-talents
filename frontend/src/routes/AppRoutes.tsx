import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { PrivateRoute } from '../components/PrivateRoute'
import { CandidatePage } from '../pages/CandidatePage'
import { CompanyPage } from '../pages/CompanyPage'
import { AdminPage } from '../pages/AdminPage'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { RegisterPage } from '../pages/RegisterPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/candidate"
            element={
              <PrivateRoute allowedRoles={['candidate']}>
                <CandidatePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/company"
            element={
              <PrivateRoute allowedRoles={['company']}>
                <CompanyPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminPage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

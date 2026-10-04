import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { WorkspaceLayout } from '../layouts/WorkspaceLayout'
import { PrivateRoute } from '../components/PrivateRoute'
import { CandidatePage } from '../pages/CandidatePage'
import { CompanyPage } from '../pages/CompanyPage'
import { AdminPage } from '../pages/AdminPage'
import { HomePage, RecruitmentSolutionPage } from '../pages/HomePage'
import { JobDetailPage } from '../pages/JobDetailPage'
import { JobsPage } from '../pages/JobsPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PrivacyPage } from '../pages/PrivacyPage'
import { RegisterPage } from '../pages/RegisterPage'
import { RecruiterHomePage } from '../pages/recruiter/RecruiterHomePage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Internal AK Talent area: no public header/footer. */}
        <Route
          element={
            <PrivateRoute allowedRoles={['admin', 'recruiter']}>
              <WorkspaceLayout />
            </PrivateRoute>
          }
        >
          <Route path="/recrutador" element={<RecruiterHomePage />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/solucoes/recrutamento" element={<RecruitmentSolutionPage />} />
          <Route path="/vagas" element={<JobsPage />} />
          <Route path="/vagas/:slug" element={<JobDetailPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
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

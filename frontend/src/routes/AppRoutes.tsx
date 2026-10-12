import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { WorkspaceLayout } from '../layouts/WorkspaceLayout'
import { PrivateRoute } from '../components/PrivateRoute'
import { AppIntelliRouteGate } from '../components/AppIntelliRouteGate'
import { ScrollToTop } from '../components/ScrollToTop'
import { COMPANY_CLOSED_PATH, isCompanyPortalEnabled } from '../services/companyPortal'
import { CandidatePage } from '../pages/CandidatePage'
import { CompanyPage } from '../pages/CompanyPage'
import { AdminPage } from '../pages/AdminPage'
import { HomePage, RecruitmentSolutionPage } from '../pages/HomePage'
import { JobDetailPage } from '../pages/JobDetailPage'
import { JobsPage } from '../pages/JobsPage'
import { GoogleReturnPage } from '../pages/GoogleReturnPage'
import { LoginChooserPage } from '../pages/LoginChooserPage'
import { LoginDoorPage } from '../pages/LoginDoorPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PrivacyPage } from '../pages/PrivacyPage'
import { RegisterPage } from '../pages/RegisterPage'
import { RecruiterApplicationPage } from '../pages/recruiter/RecruiterApplicationPage'
import { RecruiterHomePage } from '../pages/recruiter/RecruiterHomePage'
import { RecruiterJobPage } from '../pages/recruiter/RecruiterJobPage'

// Old /login links keep working (with whatever state they carried).
function LegacyLoginRedirect() {
  const { state } = useLocation()
  return <Navigate to="/entrar" replace state={state} />
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AppIntelliRouteGate />
      <ScrollToTop />
      <Routes>
        {/* Internal AK Talent area: no public header/footer. */}
        <Route
          element={
            <PrivateRoute allowedRoles={['recruiter', 'admin']}>
              <WorkspaceLayout />
            </PrivateRoute>
          }
        >
          <Route path="/recrutador" element={<RecruiterHomePage />} />
          <Route path="/recrutador/vagas/:jobId" element={<RecruiterJobPage />} />
          <Route path="/recrutador/candidaturas/:applicationId" element={<RecruiterApplicationPage />} />
        </Route>

        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/solucoes/recrutamento" element={<RecruitmentSolutionPage />} />
          <Route path="/vagas" element={<JobsPage />} />
          <Route path="/vagas/:slug" element={<JobDetailPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/entrar" element={<LoginChooserPage />} />
          <Route path="/entrar/candidato" element={<LoginDoorPage key="candidato" door="candidato" />} />
          <Route path="/entrar/empresa" element={<LoginDoorPage key="empresa" door="empresa" />} />
          {/* Back from Google (redirect mode): one-time code exchange or the consent step for a new account. */}
          <Route path="/entrar/google" element={<GoogleReturnPage />} />
          {/* AK team login: not linked from any menu or footer; kept out of search engines. */}
          <Route path="/equipe" element={<LoginDoorPage key="equipe" door="equipe" />} />
          {/* Recruiters' login: same rules as /equipe (no menu link, noindex). */}
          <Route path="/recrutamento" element={<LoginDoorPage key="recrutamento" door="recrutamento" />} />
          <Route path="/login" element={<LegacyLoginRedirect />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/candidate"
            element={
              <PrivateRoute allowedRoles={['candidate']}>
                <CandidatePage />
              </PrivateRoute>
            }
          />
          {/* Old company portal: kept in the code, reachable only with VITE_COMPANY_PORTAL_ENABLED="true". */}
          <Route
            path="/company"
            element={
              isCompanyPortalEnabled() ? (
                <PrivateRoute allowedRoles={['company']}>
                  <CompanyPage />
                </PrivateRoute>
              ) : (
                <Navigate to={COMPANY_CLOSED_PATH} replace />
              )
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

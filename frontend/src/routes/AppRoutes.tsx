import { Analytics } from '@vercel/analytics/react'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { PrivateRoute } from '../components/PrivateRoute'
import { AppIntelliRouteGate } from '../components/AppIntelliRouteGate'
import { ScrollToTop } from '../components/ScrollToTop'
import { COMPANY_CLOSED_PATH, isCompanyPortalEnabled } from '../services/companyPortal'
import { publicPagesOnly } from '../services/webAnalytics'
import { CandidatePage } from '../pages/CandidatePage'
import { CompanyPage } from '../pages/CompanyPage'
import { HomePage, RecruitmentSolutionPage } from '../pages/HomePage'
import { JobDetailPage } from '../pages/JobDetailPage'
import { JobsPage } from '../pages/JobsPage'
import { GoogleReturnPage } from '../pages/GoogleReturnPage'
import { LoginChooserPage } from '../pages/LoginChooserPage'
import { LoginDoorPage } from '../pages/LoginDoorPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PrivacyPage } from '../pages/PrivacyPage'
import { RegisterPage } from '../pages/RegisterPage'
import { legacyPanelPath } from '../panel/panelFormat'

// The team panel is its own chunk: the public site never downloads it.
type PanelModule = typeof import('../panel')
const panelPage = (name: keyof PanelModule) => lazy(() => import('../panel').then((module) => ({ default: module[name] })))
const PanelLayout = panelPage('PanelLayout')
const PanelSignedOut = panelPage('PanelSignedOut')
const OverviewPage = panelPage('OverviewPage')
const PanelJobsPage = panelPage('JobsPage')
const JobPage = panelPage('JobPage')
const ApplicationPage = panelPage('ApplicationPage')
const CompaniesPage = panelPage('CompaniesPage')
const CandidatesPage = panelPage('CandidatesPage')
const CandidateProfilePage = panelPage('CandidateProfilePage')
const TeamPage = panelPage('TeamPage')
const TeamMemberPage = panelPage('TeamMemberPage')
const PanelNotFoundPage = panelPage('PanelNotFoundPage')

// The old team areas (/admin, /recrutador/...) now open the same page in /painel.
function LegacyPanelRedirect() {
  const { pathname } = useLocation()
  return <Navigate to={legacyPanelPath(pathname)} replace />
}

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
      {/* Vercel Web Analytics (no cookies): only public pages, never the query string or hash. */}
      <Analytics beforeSend={publicPagesOnly} />
      <Routes>
        {/* AK team panel (admin and recruiters): no public header/footer, noindex, no menu link. Signed out, the
            person picks the admin or the recruiter login. */}
        <Route
          element={
            <Suspense fallback={null}>
              <PrivateRoute allowedRoles={['recruiter', 'admin']} signedOut={<PanelSignedOut />}>
                <PanelLayout />
              </PrivateRoute>
            </Suspense>
          }
        >
          <Route path="/painel" element={<OverviewPage />} />
          <Route path="/painel/vagas" element={<PanelJobsPage />} />
          <Route path="/painel/vagas/:jobId" element={<JobPage />} />
          <Route path="/painel/candidaturas/:applicationId" element={<ApplicationPage />} />
          <Route path="/painel/empresas" element={<CompaniesPage />} />
          <Route path="/painel/candidatos" element={<CandidatesPage />} />
          <Route path="/painel/candidatos/:candidateId" element={<CandidateProfilePage />} />
          <Route path="/painel/recrutadoras" element={<TeamPage />} />
          <Route path="/painel/recrutadoras/:userId" element={<TeamMemberPage />} />
          <Route path="/painel/*" element={<PanelNotFoundPage />} />
        </Route>
        <Route path="/admin/*" element={<LegacyPanelRedirect />} />
        <Route path="/recrutador/*" element={<LegacyPanelRedirect />} />

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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

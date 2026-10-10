import { Outlet, useLocation } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

export function MainLayout() {
  const location = useLocation()
  const isLanding = location.pathname === '/' || location.pathname === '/solucoes/recrutamento'

  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <Header />
      <main className={`flex-1 ${isLanding ? '' : 'pt-20 lg:pt-24'}`}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

import { Outlet } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

export function MainLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <Header />
      <main className="flex-1 pt-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

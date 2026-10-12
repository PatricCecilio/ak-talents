import { Link } from 'react-router-dom'
import { getCurrentUser } from '../services/authService'
import { PANEL_BASE } from './panelFormat'
import { PanelCard, PanelPageHeader } from './PanelUi'
import { panelButton } from './panelStyles'

// Screens of the next stage of the new panel. Meanwhile the old area keeps everything working.
export function ComingSoonPage({ title }: { title: string }) {
  const oldArea = getCurrentUser()?.role === 'admin' ? '/admin' : '/recrutador'
  return (
    <div className="grid content-start gap-4">
      <PanelPageHeader title={title} />
      <PanelCard>
        <div className="grid gap-3 p-5 text-sm text-ink-700">
          <p>Esta tela chega na próxima etapa do painel novo. Enquanto isso, ela continua disponível no painel atual.</p>
          <div className="flex flex-wrap gap-2">
            <Link to={oldArea} className={panelButton.outline}>Abrir o painel atual</Link>
            <Link to={PANEL_BASE} className={panelButton.navy}>Voltar para a visão geral</Link>
          </div>
        </div>
      </PanelCard>
    </div>
  )
}

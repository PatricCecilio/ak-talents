import { Link } from 'react-router-dom'
import { PANEL_BASE } from './panelFormat'
import { PanelCard, PanelPageHeader } from './PanelUi'
import { panelButton } from './panelStyles'

export function PanelNotFoundPage() {
  return (
    <div className="grid content-start gap-4">
      <PanelPageHeader title="Página não encontrada" />
      <PanelCard>
        <div className="grid gap-3 p-5 text-sm text-ink-700">
          <p>Este endereço não existe no painel.</p>
          <div>
            <Link to={PANEL_BASE} className={panelButton.navy}>Voltar para a visão geral</Link>
          </div>
        </div>
      </PanelCard>
    </div>
  )
}

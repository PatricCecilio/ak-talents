import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CompanyForm } from '../components/admin/CompanyForm'
import { formatCnpj, formatPhone } from '../services/adminForms'
import { setCompanyActive } from '../services/adminService'
import { getCurrentUser } from '../services/authService'
import { whatsappLink } from '../services/pipelineFormat'
import type { AdminCompany } from '../types/user'
import { usePanelActions } from './panelContext'
import { deleteCompany, getPanelCompanies } from './panelApi'
import { PANEL_BASE } from './panelFormat'
import { ActionsMenu, PanelCard, PanelDialog, PanelPageHeader, Pagination, Pill, type MenuAction } from './PanelUi'
import { panelButton, panelFocus } from './panelStyles'

const PAGE_SIZE = 10

// Empresas: client companies (internal records). Admin creates, edits, deactivates and deletes (only without jobs);
// recruiters only read (they need to know who receives the report).
export function CompaniesPage() {
  const navigate = useNavigate()
  const isAdmin = getCurrentUser()?.role === 'admin'
  const [companies, setCompanies] = useState<AdminCompany[] | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<AdminCompany | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AdminCompany | null>(null)

  const load = useCallback(() => {
    getPanelCompanies()
      .then(setCompanies)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Não foi possível carregar as empresas.'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  usePanelActions(
    isAdmin ? (
      <button type="button" className={panelButton.navy} onClick={() => setEditing('new')}>
        + Nova empresa
      </button>
    ) : null,
    [isAdmin],
  )

  async function run(action: () => Promise<unknown>, done: string) {
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(done)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  function actionsFor(company: AdminCompany): MenuAction[] {
    const list: MenuAction[] = [{ label: 'Ver vagas da empresa', onSelect: () => navigate(`${PANEL_BASE}/vagas?empresa=${company.id}`) }]
    if (!isAdmin) return list
    list.push({ label: 'Editar', onSelect: () => setEditing(company) })
    list.push(
      company.is_active === false
        ? { label: 'Reativar', onSelect: () => void run(() => setCompanyActive(company.id, true), 'Empresa reativada.') }
        : { label: 'Desativar', hint: 'As vagas saem das listas e do site. Nada é apagado.', onSelect: () => void run(() => setCompanyActive(company.id, false), 'Empresa desativada (nada foi apagado).') },
    )
    if ((company.jobs_count ?? 0) === 0 && !company.has_account) {
      list.push({ label: 'Excluir', danger: true, hint: 'Só empresas sem vagas.', onSelect: () => setDeleting(company) })
    }
    return list
  }

  const rows = companies ?? []
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4 xl:h-full xl:min-h-0">
      <PanelPageHeader title="Empresas" subtitle={isAdmin ? 'Clientes da AK. Elas não entram no sistema: os relatórios vão pelo WhatsApp.' : 'Clientes da AK (só leitura).'} />
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}

      <PanelCard className="xl:min-h-0 xl:flex-1">
        <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#faf8f4] text-xs font-semibold text-ink-600">
              <tr>
                {['Empresa', 'Responsável', 'WhatsApp', 'Cidade', 'Vagas', 'Status', 'Ações'].map((label) => (
                  <th key={label} className="px-4 py-3 font-semibold first:pl-5">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-ink-600">Nenhuma empresa cadastrada.</td>
                </tr>
              ) : null}
              {pageRows.map((company) => (
                <tr key={company.id} className={company.is_active === false ? 'text-ink-400' : ''}>
                  <td className="px-4 py-3 pl-5">
                    <span className="block font-semibold text-ink-950">{company.company_name}</span>
                    {company.cnpj ? <span className="block text-xs text-ink-600">CNPJ {formatCnpj(company.cnpj)}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{company.responsible_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {company.whatsapp ? (
                      <a href={whatsappLink(company.whatsapp)} target="_blank" rel="noopener noreferrer" className={`font-semibold text-brand-700 hover:underline ${panelFocus}`}>
                        {formatPhone(company.whatsapp)}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-700">{[company.city, company.state].filter(Boolean).join('/') || '—'}</td>
                  <td className="px-4 py-3">{company.jobs_count ?? 0}</td>
                  <td className="px-4 py-3">
                    {company.is_active === false ? <Pill tone="bg-slate-100 text-ink-600">Desativada</Pill> : <Pill tone="bg-emerald-50 text-emerald-800">Ativa</Pill>}
                  </td>
                  <td className="px-4 py-3">
                    <ActionsMenu label={`Ações da empresa ${company.company_name}`} actions={actionsFor(company)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-ink-600">
          <span>{rows.length} {rows.length === 1 ? 'empresa' : 'empresas'}</span>
          <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
        </footer>
      </PanelCard>

      {editing ? (
        <PanelDialog title={editing === 'new' ? 'Nova empresa' : 'Editar empresa'} onClose={() => setEditing(null)} wide>
          <CompanyForm
            company={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={(saved, created) => {
              setEditing(null)
              setMessage(created ? `Empresa ${saved.company_name} cadastrada.` : `Empresa ${saved.company_name} atualizada.`)
              load()
            }}
          />
        </PanelDialog>
      ) : null}

      {deleting ? (
        <PanelDialog title="Excluir empresa" onClose={() => setDeleting(null)}>
          <p className="text-sm text-ink-700">Excluir a empresa {deleting.company_name}? Essa ação não pode ser desfeita.</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={panelButton.outline} onClick={() => setDeleting(null)}>Cancelar</button>
            <button
              type="button"
              className={`${panelButton.navy} bg-red-700 hover:bg-red-800`}
              onClick={() => {
                const company = deleting
                setDeleting(null)
                void run(() => deleteCompany(company.id), `Empresa ${company.company_name} excluída.`)
              }}
            >
              Sim, excluir
            </button>
          </div>
        </PanelDialog>
      ) : null}
    </div>
  )
}

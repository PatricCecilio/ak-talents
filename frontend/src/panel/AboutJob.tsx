import { formatContractType, formatSalary, formatWorkMode } from '../services/jobFormat'
import type { PanelJobDetail } from './types'

// "Sobre a vaga" on the application screen: what the recruiter needs next to the candidate, without leaving the page.
export function AboutJob({ job }: { job: PanelJobDetail }) {
  const facts: Array<[string, string]> = [
    ['Empresa', job.company_name],
    ['Cidade', job.location ?? '—'],
    ['Modelo', [formatWorkMode(job.work_mode), formatContractType(job.contract_type)].filter(Boolean).join(' · ') || '—'],
    ['Salário', formatSalary(job) || 'A combinar'],
    ['Horário', job.schedule ?? '—'],
  ]
  const texts: Array<[string, string | null]> = [
    ['Descrição', job.description],
    ['Requisitos', job.requirements],
    ['Benefícios', job.benefits],
  ]
  return (
    <div className="grid gap-4 text-sm">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</dt>
            <dd className="mt-0.5 break-words text-ink-950">{value}</dd>
          </div>
        ))}
      </dl>
      {texts.map(([label, value]) =>
        value ? (
          <section key={label}>
            <h3 className="font-display text-sm font-bold text-ink-950">{label}</h3>
            <p className="mt-1 whitespace-pre-line leading-6 text-ink-800">{value}</p>
          </section>
        ) : null,
      )}
    </div>
  )
}

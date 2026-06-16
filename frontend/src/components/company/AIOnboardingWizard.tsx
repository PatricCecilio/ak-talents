import { useState } from 'react'
import { FormField } from '../FormField'
import { Alert, Badge, Button, Card, Select, Textarea } from '../ui'
import { useFormState } from '../../hooks/useFormState'
import { generateCompanyJob } from '../../services/aiService'
import { createJob } from '../../services/jobService'
import { updateCompanyProfile } from '../../services/profileService'
import type { CompanyJobAIResponse } from '../../types/ai'
import type { Job } from '../../types/user'

interface AIOnboardingWizardProps {
  onJobCreated: (job: Job) => void
}

function parseSalaryRange(value: string) {
  const values = value.match(/\d+(?:[.,]\d+)?/g)?.map((item) => Number(item.replace('.', '').replace(',', '.'))) ?? []

  return {
    salary_min: values[0] ?? null,
    salary_max: values[1] ?? values[0] ?? null,
  }
}

function workModeLabel(value: string) {
  const labels: Record<string, string> = {
    remote: 'Remoto',
    hybrid: 'Hibrido',
    onsite: 'Presencial',
  }

  return labels[value] || value
}

export function AIOnboardingWizard({ onJobCreated }: AIOnboardingWizardProps) {
  const [step, setStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [aiResult, setAIResult] = useState<CompanyJobAIResponse | null>(null)
  const { values: companyValues, updateField: updateCompanyField } = useFormState({
    company_name: '',
    city: '',
    industry: '',
    company_size: '',
    description: '',
  })
  const { values: jobValues, updateField: updateJobField } = useFormState({
    role: '',
    activities: '',
    experience: '',
    work_mode: 'remote',
    salary: '',
    skills: '',
  })

  async function generatePreview() {
    setIsGenerating(true)
    setError('')
    setSuccess('')

    try {
      const response = await generateCompanyJob({
        role: jobValues.role,
        activities: jobValues.activities,
        requirements: `${jobValues.experience}. Habilidades importantes: ${jobValues.skills}`,
        salary: jobValues.salary,
        city: companyValues.city,
        work_mode: jobValues.work_mode,
      })
      setAIResult(response)
      setStep(4)
      setSuccess('A IA preparou uma primeira versao da sua vaga.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel gerar a vaga com IA.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSave() {
    if (!aiResult) {
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      await updateCompanyProfile({
        company_name: companyValues.company_name,
        city: companyValues.city,
        industry: companyValues.industry,
        company_size: companyValues.company_size,
        description: companyValues.description,
      })

      const salary = parseSalaryRange(jobValues.salary)
      const createdJob = await createJob({
        title: aiResult.optimized_title,
        description: aiResult.job_description,
        requirements: [...aiResult.mandatory_requirements, ...aiResult.desirable_requirements].join(', '),
        salary_min: salary.salary_min,
        salary_max: salary.salary_max,
        location: companyValues.city,
        work_mode: jobValues.work_mode,
      })

      onJobCreated(createdJob)
      setSuccess('Empresa salva e vaga publicada. Ela pode precisar de aprovacao do admin antes de aparecer para candidatos.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar a empresa e publicar a vaga.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 bg-ink-950 p-6 text-white">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-gold-400">AI Onboarding Wizard</p>
            <h2 className="mt-2 text-2xl font-black">Crie sua empresa e primeira vaga com IA</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Uma conversa guiada, com poucos campos por vez, para transformar suas respostas em uma vaga clara.
            </p>
          </div>
          <Badge status="pending">Etapa {step} de 4</Badge>
        </div>
      </div>

      <div className="p-6">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <div className="mt-4"><Alert tone="success">{success}</Alert></div> : null}

        {step === 1 ? (
          <div className="mt-4 grid gap-6">
            <div className="rounded-lg bg-slate-50 p-6">
              <h3 className="text-2xl font-black text-ink-950">Ola, vou te ajudar a cadastrar sua empresa e criar sua primeira vaga em poucos minutos.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-600">
                Responda perguntas simples. A IA organiza o texto, melhora a vaga e deixa tudo pronto para voce revisar antes de publicar.
              </p>
            </div>
            <div>
              <Button type="button" onClick={() => setStep(2)}>
                Comecar com IA
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 grid gap-5">
            <h3 className="text-xl font-black text-ink-950">Sobre a empresa</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                id="wizard_company_name"
                label="Qual o nome da empresa?"
                value={companyValues.company_name}
                placeholder="Empresa Exemplo"
                onChange={(value) => updateCompanyField('company_name', value)}
              />
              <FormField
                id="wizard_city"
                label="Em qual cidade fica?"
                value={companyValues.city}
                placeholder="Sao Paulo"
                onChange={(value) => updateCompanyField('city', value)}
              />
              <FormField
                id="wizard_industry"
                label="Qual segmento?"
                value={companyValues.industry}
                placeholder="Tecnologia, saude, varejo..."
                onChange={(value) => updateCompanyField('industry', value)}
              />
              <FormField
                id="wizard_company_size"
                label="Quantos funcionarios possui?"
                value={companyValues.company_size}
                placeholder="11-50, 51-200..."
                onChange={(value) => updateCompanyField('company_size', value)}
              />
            </div>
            <Textarea
              id="wizard_company_description"
              label="O que sua empresa faz?"
              value={companyValues.description}
              rows={4}
              placeholder="Explique de forma simples o produto, servico ou mercado da empresa"
              onChange={(event) => updateCompanyField('description', event.target.value)}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button type="button" onClick={() => setStep(3)}>
                Continuar
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 grid gap-5">
            <h3 className="text-xl font-black text-ink-950">Sobre a vaga</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                id="wizard_role"
                label="Qual profissional voce precisa contratar?"
                value={jobValues.role}
                placeholder="Analista de Marketing"
                onChange={(value) => updateJobField('role', value)}
              />
              <FormField
                id="wizard_salary"
                label="Qual faixa salarial?"
                value={jobValues.salary}
                placeholder="R$ 5.000 a R$ 7.000"
                onChange={(value) => updateJobField('salary', value)}
              />
            </div>
            <Textarea
              id="wizard_activities"
              label="Quais atividades essa pessoa vai fazer?"
              value={jobValues.activities}
              rows={4}
              placeholder="Conte as principais tarefas do dia a dia"
              onChange={(event) => updateJobField('activities', event.target.value)}
            />
            <Textarea
              id="wizard_experience"
              label="Precisa de experiencia?"
              value={jobValues.experience}
              rows={3}
              placeholder="Exemplo: pelo menos 2 anos na area, experiencia com atendimento..."
              onChange={(event) => updateJobField('experience', event.target.value)}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                id="wizard_work_mode"
                label="E presencial, hibrido ou remoto?"
                value={jobValues.work_mode}
                onChange={(event) => updateJobField('work_mode', event.target.value)}
              >
                <option value="remote">Remoto</option>
                <option value="hybrid">Hibrido</option>
                <option value="onsite">Presencial</option>
              </Select>
              <FormField
                id="wizard_skills"
                label="Quais habilidades sao importantes?"
                value={jobValues.skills}
                placeholder="Excel, comunicacao, React, vendas..."
                onChange={(value) => updateJobField('skills', value)}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button type="button" isLoading={isGenerating} onClick={() => void generatePreview()}>
                Gerar revisao inteligente
              </Button>
            </div>
          </div>
        ) : null}

        {step === 4 && aiResult ? (
          <div className="mt-4 grid gap-5">
            <div>
              <h3 className="text-xl font-black text-ink-950">Revisao inteligente</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">
                Confira tudo antes de salvar. Depois de publicada, a vaga pode precisar de aprovacao do admin.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-ink-400">Empresa</p>
                <h4 className="mt-3 text-lg font-black text-ink-950">{companyValues.company_name}</h4>
                <p className="mt-2 text-sm leading-6 text-ink-600">{companyValues.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>{companyValues.city || 'Cidade nao informada'}</Badge>
                  <Badge>{companyValues.industry || 'Segmento nao informado'}</Badge>
                  <Badge>{companyValues.company_size || 'Tamanho nao informado'}</Badge>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-ink-400">Vaga</p>
                <h4 className="mt-3 text-lg font-black text-ink-950">{aiResult.optimized_title}</h4>
                <p className="mt-2 text-sm leading-6 text-ink-600">{aiResult.job_description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>{jobValues.salary || 'Salario nao informado'}</Badge>
                  <Badge>{workModeLabel(jobValues.work_mode)}</Badge>
                  <Badge>{companyValues.city || 'Cidade nao informada'}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-ink-400">Requisitos obrigatorios</h4>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-700">
                  {aiResult.mandatory_requirements.map((item) => (
                    <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-ink-400">Requisitos desejaveis</h4>
                <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-700">
                  {aiResult.desirable_requirements.map((item) => (
                    <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                Editar
              </Button>
              <Button type="button" variant="dark" isLoading={isGenerating} onClick={() => void generatePreview()}>
                Gerar novamente com IA
              </Button>
              <Button type="button" isLoading={isSaving} onClick={() => void handleSave()}>
                Salvar empresa e publicar vaga
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  )
}

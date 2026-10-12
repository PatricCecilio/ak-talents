import type { FormEvent } from 'react'
import { useState } from 'react'
import { createCompany, updateCompany } from '../../services/adminService'
import { BRAZIL_UFS, EMPTY_COMPANY_FORM, companyFormToPayload, companyToForm, type CompanyFormValues } from '../../services/adminForms'
import type { AdminCompany } from '../../types/user'
import { Alert, Button, Input, Select, Textarea } from '../ui'

interface CompanyFormProps {
  /** Editing this company; creating a new one when absent. */
  company?: AdminCompany
  onSaved: (company: AdminCompany, created: boolean) => void
  onCancel: () => void
}

// Client company as an internal AK record: no login. Only the name and the WhatsApp are required.
export function CompanyForm({ company, onSaved, onCancel }: CompanyFormProps) {
  const [values, setValues] = useState<CompanyFormValues>(() => (company ? companyToForm(company) : EMPTY_COMPANY_FORM))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const prefix = company ? `company-${company.id}` : 'company-new'

  function update(field: keyof CompanyFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { payload, error: problem } = companyFormToPayload(values)
    if (!payload) {
      setError(problem)
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const saved = company ? await updateCompany(company.id, payload) : await createCompany(payload)
      onSaved(saved, !company)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a empresa.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-gold-100 bg-gold-50/60 p-4 sm:p-5">
      <h3 className="text-lg font-black text-ink-950">{company ? `Editar ${company.company_name}` : 'Nova empresa'}</h3>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Input
        id={`${prefix}-name`}
        label="Nome da empresa"
        value={values.company_name}
        placeholder="Padaria Boa Massa"
        required
        onChange={(event) => update('company_name', event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={`${prefix}-responsible`}
          label="Responsável"
          value={values.responsible_name}
          placeholder="Nome de quem recebe os relatórios"
          onChange={(event) => update('responsible_name', event.target.value)}
        />
        <Input
          id={`${prefix}-whatsapp`}
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          value={values.whatsapp}
          placeholder="(41) 99999-0000"
          required
          onChange={(event) => update('whatsapp', event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id={`${prefix}-cnpj`}
          label="CNPJ (opcional)"
          inputMode="numeric"
          value={values.cnpj}
          placeholder="00.000.000/0000-00"
          onChange={(event) => update('cnpj', event.target.value)}
        />
        <Input
          id={`${prefix}-email`}
          label="E-mail (opcional)"
          type="email"
          value={values.contact_email}
          placeholder="rh@empresa.com.br"
          onChange={(event) => update('contact_email', event.target.value)}
        />
      </div>
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)_7rem]">
        <Input
          id={`${prefix}-city`}
          label="Cidade"
          value={values.city}
          placeholder="Curitiba"
          onChange={(event) => update('city', event.target.value)}
        />
        <Select id={`${prefix}-state`} label="UF" value={values.state} onChange={(event) => update('state', event.target.value)}>
          <option value="">—</option>
          {BRAZIL_UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </Select>
      </div>
      <Textarea
        id={`${prefix}-notes`}
        label="Observações (só a equipe AK vê)"
        value={values.notes}
        placeholder="Melhor horário para falar, combinados com o cliente…"
        rows={3}
        maxLength={2000}
        onChange={(event) => update('notes', event.target.value)}
      />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSaving}>
          {company ? 'Salvar alterações' : 'Cadastrar empresa'}
        </Button>
      </div>
    </form>
  )
}

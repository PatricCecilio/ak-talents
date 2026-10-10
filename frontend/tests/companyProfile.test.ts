import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  COMPANY_SIZE_OPTIONS,
  companySizeOptions,
  toCompanyProfilePayload,
  validateCompanyProfile,
  type CompanyProfileFormValues,
} from '../src/services/companyProfileForm.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')

const complete: CompanyProfileFormValues = {
  company_name: 'Mercado Bom Preço',
  responsible_name: 'Ana Costa',
  phone: '(41) 99999-9999',
  city: 'Curitiba',
  state: 'PR',
  industry: '',
  company_size: '',
  description: '',
  website_url: '',
}

test('company profile: five required fields, the rest optional', () => {
  assert.equal(validateCompanyProfile(complete).isValid, true)
  for (const field of ['company_name', 'responsible_name', 'phone', 'city', 'state'] as const) {
    assert.equal(validateCompanyProfile({ ...complete, [field]: '  ' }).isValid, false, field)
  }
  assert.match(validateCompanyProfile({ ...complete, phone: '9999' }).message, /DDD/)
  assert.equal(toCompanyProfilePayload({ ...complete, city: '  Curitiba ' }).city, 'Curitiba')
})

test('company size is a list, keeping an older free-text value', () => {
  assert.deepEqual([...COMPANY_SIZE_OPTIONS], ['Só eu', '2 a 10', '11 a 50', '51 a 200', 'Mais de 200'])
  assert.deepEqual(companySizeOptions('11 a 50'), [...COMPANY_SIZE_OPTIONS])
  assert.equal(companySizeOptions('51-200 colaboradores')[0], '51-200 colaboradores')
})

test('company profile form: optional fields are not required by the browser and the grid fits the card', () => {
  const page = read('src/pages/CompanyPage.tsx')
  for (const label of ['Segmento (opcional)', 'Tamanho (opcional)', 'Site (opcional)', 'Descrição (opcional)']) {
    assert.match(page, new RegExp(label.replace(/[()]/g, '\\$&')))
  }
  assert.equal((page.match(/required=\{false\}/g) ?? []).length >= 2, true)
  assert.match(page, /validateCompanyProfile\(companyProfileValues\)/)
  assert.match(page, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,0\.9fr\)\]/)
  assert.doesNotMatch(page, /md:grid-cols-3/)

  assert.match(read('src/components/FormField.tsx'), /required = true/)
  for (const control of ['Input', 'Select', 'Textarea']) {
    assert.match(read(`src/components/ui/${control}.tsx`), /w-full min-w-0/, control)
  }
})

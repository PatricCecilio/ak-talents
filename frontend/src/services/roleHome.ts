// Where each kind of account lands (after login, after sign-up and from "Meu painel"). No runtime imports.

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  recruiter: '/recrutador',
  company: '/company',
  candidate: '/candidate',
}

export function roleHome(role: string | null | undefined): string {
  return (role && ROLE_HOME[role]) || '/candidate'
}

export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

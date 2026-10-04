/** Job progress for the company, in its own words. Counts only, never names. */
export function companyJobProgress(stageCounts: Record<string, number> | undefined): Array<{ label: string; value: number }> {
  const count = (stage: string) => stageCounts?.[stage] ?? 0
  return [
    { label: 'Em triagem', value: count('new') + count('screening') },
    { label: 'Entrevista', value: count('ak_interview') },
    { label: 'Finalistas', value: count('finalist') },
    { label: 'Aprovados por você', value: count('client_approved') },
    { label: 'Contratados', value: count('hired') },
  ]
}

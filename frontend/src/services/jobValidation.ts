export const SALARY_RANGE_ERROR = 'O salário mínimo não pode ser maior que o salário máximo.'

/** Mirrors the backend rule: when both bounds are given, minimum must not exceed maximum. */
export function getSalaryRangeError(salaryMin: number | null, salaryMax: number | null): string {
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    return SALARY_RANGE_ERROR
  }
  return ''
}

// Defaults of the "Contratado" step, from how many positions the job has. No runtime imports.

export interface HireDefaults {
  /** Move the other active candidates to "Reprovado" with the note "Vaga preenchida". */
  closeOthers: boolean
  /** Close the job (it leaves the site). */
  closeJob: boolean
}

/** "o outro candidato ativo" / "os outros 3 candidatos ativos". */
export function otherActivePhrase(count: number): string {
  return count === 1 ? 'o outro candidato ativo' : `os outros ${count} candidatos ativos`
}

/** What else happened after a move (shown after "Movido para ..."). */
export function moveResultNote(closedOthers: number, jobClosed: boolean | undefined): string {
  const parts: string[] = []
  if (closedOthers === 1) parts.push('1 outro candidato foi encerrado (Vaga preenchida).')
  else if (closedOthers > 1) parts.push(`${closedOthers} outros candidatos foram encerrados (Vaga preenchida).`)
  if (jobClosed) parts.push('A vaga foi encerrada e saiu do site.')
  return parts.map((part) => ` ${part}`).join('')
}

/** One position (or not informed): the hire fills the job. More positions: keep everything open. */
export function hireDefaults(openings: number | null | undefined): HireDefaults {
  const singlePosition = !openings || openings <= 1
  return { closeOthers: singlePosition, closeJob: singlePosition }
}

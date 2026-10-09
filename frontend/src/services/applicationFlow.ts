import type { PublicScreeningQuestion, ScreeningAnswerPayload } from '../types/user'

// Pure helpers for the public application flow (no runtime imports: the tests load this file directly).

export type ApplicationStep = 'form' | 'questions' | 'done'

export type ScreeningAnswers = Record<number, boolean | string>

export const APPLICATION_CONFIRMATION_TITLE = 'Candidatura enviada!'
export const APPLICATION_CONFIRMATION_MESSAGE =
  'A equipe AK Talent vai analisar seu perfil e falar com você pelo WhatsApp ou telefone informado.'
export const MISSING_SCREENING_ANSWER_MESSAGE = 'Responda todas as perguntas obrigatórias para concluir.'

/** After the application is created: finished already (job without questions) or ask the questions on the page. */
export function stepAfterApplication(screeningCompleted: boolean, questions: PublicScreeningQuestion[]): ApplicationStep {
  return screeningCompleted || questions.length === 0 ? 'done' : 'questions'
}

export function isMissingAnswer(question: PublicScreeningQuestion, answers: ScreeningAnswers): boolean {
  const value = answers[question.id]
  if (question.question_type === 'YES_NO') return typeof value !== 'boolean'
  return typeof value !== 'string' || value.trim() === ''
}

export function firstMissingRequiredAnswer(
  questions: PublicScreeningQuestion[],
  answers: ScreeningAnswers,
): PublicScreeningQuestion | undefined {
  return questions.find((question) => question.required && isMissingAnswer(question, answers))
}

export function toScreeningAnswers(questions: PublicScreeningQuestion[], answers: ScreeningAnswers): ScreeningAnswerPayload[] {
  return questions
    .filter((question) => !isMissingAnswer(question, answers))
    .map((question) => {
      const value = answers[question.id]
      return { question_id: question.id, value: typeof value === 'string' ? value.trim() : value }
    })
}

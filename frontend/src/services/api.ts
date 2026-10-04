const LOCAL_API_BASE_URL = 'http://localhost:8000'

export function resolveApiBaseUrl(env: ImportMetaEnv | undefined = import.meta.env): string {
  return env?.VITE_API_BASE_URL?.trim() || LOCAL_API_BASE_URL
}

export const API_BASE_URL = resolveApiBaseUrl()
const TOKEN_KEY = 'ak_talent_access_token'
const USER_KEY = 'ak_talent_auth_user'

export const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar. Verifique sua internet e tente novamente.'
const GENERIC_ERROR_MESSAGE = 'Não foi possível concluir a solicitação. Tente novamente em instantes.'

/** Error thrown for any failed API call. `status` is the HTTP status, or 0 when the request never got an answer. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  get isNetworkError() {
    return this.status === 0
  }

  get isNotFound() {
    return this.status === 404
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: boolean
}

/** Turns a FastAPI `detail` (string, or a list of validation errors) into a readable message. */
export function extractErrorMessage(detail: unknown): string {
  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (Array.isArray(detail)) {
    const first = detail.find((item) => typeof item === 'object' && item !== null && 'msg' in item) as
      | { msg?: unknown }
      | undefined
    if (typeof first?.msg === 'string' && first.msg.trim()) {
      return first.msg.replace(/^Value error,\s*/, '')
    }
  }

  return GENERIC_ERROR_MESSAGE
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')
  const isJson = contentType?.includes('application/json')
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    }

    const detail = typeof data === 'object' && data !== null && 'detail' in data ? data.detail : null
    throw new ApiError(response.status, extractErrorMessage(detail))
  }

  return data as T
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = new Headers(options.headers)

  headers.set('Content-Type', 'application/json')

  if (options.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    // fetch only rejects when there is no HTTP answer at all (offline, DNS, CORS, server down).
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }

  return parseResponse<T>(response)
}

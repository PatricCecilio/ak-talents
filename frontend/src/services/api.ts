export const API_BASE_URL = 'http://localhost:8000'
const TOKEN_KEY = 'ak_talent_access_token'
const USER_KEY = 'ak_talent_auth_user'

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: boolean
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

    const detail = typeof data === 'object' && data !== null && 'detail' in data ? data.detail : data
    throw new Error(typeof detail === 'string' ? detail : 'Erro ao processar solicitacao.')
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  return parseResponse<T>(response)
}

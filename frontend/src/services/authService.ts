import type { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/user'
import { apiRequest } from './api'

const TOKEN_KEY = 'ak_talent_access_token'
const USER_KEY = 'ak_talent_auth_user'

function persistSession(response: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, response.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(response.user))
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: payload,
    auth: false,
  })
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    auth: false,
  })

  persistSession(response)
  return response
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getCurrentUser(): User | null {
  const storedUser = localStorage.getItem(USER_KEY)

  if (!storedUser) {
    return null
  }

  return JSON.parse(storedUser) as User
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(getToken())
}

export const authService = {
  register: registerUser,
  login: loginUser,
  getToken,
  getCurrentUser,
  logout,
  isAuthenticated,
}

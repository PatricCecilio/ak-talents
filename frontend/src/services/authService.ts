import type { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/user'
import { apiRequest } from './api'

const TOKEN_KEY = 'ak_talent_access_token'
const USER_KEY = 'ak_talent_auth_user'

function persistSession(response: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, response.access_token)
  localStorage.setItem(USER_KEY, JSON.stringify(response.user))
}

// The API answers sign-up with a session, so the new account is signed in right away.
export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: payload,
    auth: false,
  })

  persistSession(response)
  return response
}

/** Checks the credentials WITHOUT signing in (the staff door decides first whether this account may enter). */
export async function authenticate(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: payload,
    auth: false,
  })
}

export function startSession(response: AuthResponse) {
  persistSession(response)
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const response = await authenticate(payload)
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

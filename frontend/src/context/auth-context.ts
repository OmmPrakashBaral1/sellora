import { createContext } from 'react'
import type { AuthUser } from '../api/auth'

export type AuthContextValue = {
  user: AuthUser | null
  accessToken: string | null
  loading: boolean
  login: (gmail: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

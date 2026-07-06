import { create } from 'zustand'
import { authAPI, usersAPI } from '@/lib/api'

interface User {
  id: string
  email: string
  username: string
  email_verified: boolean
  role: string
  status: string
}

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      // The backend sets access_token/refresh_token as httpOnly cookies on
      // this response - nothing to store manually here anymore.
      await authAPI.login(email, password)
      const meRes = await usersAPI.getMe()
      set({ user: meRes.data, isAuthenticated: true, isLoading: false })
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login failed'
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  logout: async () => {
    try { await authAPI.logout() } catch {}
    set({ user: null, isAuthenticated: false })
  },

  fetchMe: async () => {
    try {
      const res = await usersAPI.getMe()
      set({ user: res.data, isAuthenticated: true })
    } catch {
      set({ user: null, isAuthenticated: false })
    }
  },

  clearError: () => set({ error: null }),
}))

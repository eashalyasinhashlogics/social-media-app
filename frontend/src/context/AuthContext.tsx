"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { usersAPI } from '@/lib/api'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  refreshAuth: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Tokens live in httpOnly cookies now, so we can't read them from JS to
  // know if the user is logged in. Instead we ask the backend - the cookie
  // (if valid) is sent automatically by the browser.
  const refreshAuth = useCallback(async () => {
    try {
      await usersAPI.getMe()
      setIsAuthenticated(true)
    } catch {
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshAuth()
  }, [refreshAuth])

  const logout = () => {
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, refreshAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

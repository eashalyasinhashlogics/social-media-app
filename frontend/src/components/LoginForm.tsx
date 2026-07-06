'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'

export function LoginForm() {
  const router = useRouter()
  const { login, isLoading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
      router.push('/feed')
    } catch {}
  }

  return (
    <form onSubmit={handleLogin} style={{ margin: 0 }}>
      {/* Error Alert */}
      {error && (
        <div style={{
          padding: '12px 14px',
          background: '#fef2f2',
          border: '1px solid #fee2e2',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px',
          fontWeight: '500',
          marginBottom: '20px',
          animation: 'fadeIn 0.2s ease-in'
        }}>
          {error}
        </div>
      )}

      {/* Email Input */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="email" style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '600',
          color: '#1a1a1a',
          marginBottom: '8px'
        }}>
          Email address
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={{
            width: '100%',
            padding: '12px 14px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#6366f1'
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb'
            e.currentTarget.style.boxShadow = 'none'
          }}
          onMouseEnter={(e) => {
            if (document.activeElement !== e.currentTarget) {
              e.currentTarget.style.borderColor = '#d1d5db'
            }
          }}
          onMouseLeave={(e) => {
            if (document.activeElement !== e.currentTarget) {
              e.currentTarget.style.borderColor = '#e5e7eb'
            }
          }}
        />
      </div>

      {/* Password Input */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <label htmlFor="password" style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#1a1a1a'
          }}>
            Password
          </label>
          <Link 
            href="/forgot-password" 
            style={{
              fontSize: '13px',
              color: '#6366f1',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s ease'
            }}
          >
            Forgot password?
          </Link>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: '12px 14px',
              paddingRight: '42px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb'
              e.currentTarget.style.boxShadow = 'none'
            }}
            onMouseEnter={(e) => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.borderColor = '#d1d5db'
              }
            }}
            onMouseLeave={(e) => {
              if (document.activeElement !== e.currentTarget) {
                e.currentTarget.style.borderColor = '#e5e7eb'
              }
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              color: '#9ca3af',
              fontSize: '18px',
              background: 'transparent',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {/* Login Button */}
      <button
        type="submit"
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '12px',
          background: isLoading 
            ? 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' 
            : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          marginBottom: '16px',
          opacity: isLoading ? 0.6 : 1
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(99, 102, 241, 0.4)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }
        }}
        onMouseDown={(e) => {
          if (!isLoading) {
            e.currentTarget.style.transform = 'translateY(0)'
          }
        }}
      >
        {isLoading ? (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span style={{
              width: '16px',
              height: '16px',
              border: '2px solid white',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite'
            }}></span>
            Logging in...
          </span>
        ) : (
          'Log in'
        )}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </form>
  )
}
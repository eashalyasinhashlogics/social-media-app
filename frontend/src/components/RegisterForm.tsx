'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI } from '@/lib/api'

export function RegisterForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    // Validation
    if (!fullName || !email || !password || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (fullName.length < 2) {
      setError('Full name must be at least 2 characters')
      return
    }

    setIsLoading(true)
    try {
      // Split full name into first and last name for the API
      const nameParts = fullName.trim().split(' ')
      const username = nameParts[0].toLowerCase()
      
      await authAPI.register(email, username, password)
      setSuccess('Account created! Check your email for the verification code.')
      setTimeout(() => router.push(`/verify-email?email=${encodeURIComponent(email)}`), 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleRegister} style={{ margin: 0 }}>
      {/* Error Alert */}
      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 14px',
          background: '#fef2f2',
          border: '1px solid #fee2e2',
          borderRadius: '8px',
          color: '#991b1b',
          fontSize: '14px',
          fontWeight: '500',
          animation: 'fadeIn 0.2s ease-in'
        }}>
          {error}
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 14px',
          background: '#f0fdf4',
          border: '1px solid #dcfce7',
          borderRadius: '8px',
          color: '#15803d',
          fontSize: '14px',
          fontWeight: '500',
          animation: 'fadeIn 0.2s ease-in'
        }}>
          {success}
        </div>
      )}

      {/* OAuth Buttons */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <button
          type="button"
          style={{
            flex: 1,
            padding: '8px 16px',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            background: 'white',
            color: '#1e293b',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f8fafc'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white'
          }}
        >
          Google
        </button>
        <button
          type="button"
          style={{
            flex: 1,
            padding: '8px 16px',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            background: 'white',
            color: '#1e293b',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f8fafc'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white'
          }}
        >
          GitHub
        </button>
      </div>

      {/* Divider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '24px',
        gap: '16px'
      }}>
        <div style={{
          flex: 1,
          height: '1px',
          background: '#e2e8f0'
        }}></div>
        <span style={{
          fontSize: '12px',
          fontWeight: '500',
          color: '#94a3b8'
        }}>or with email</span>
        <div style={{
          flex: 1,
          height: '1px',
          background: '#e2e8f0'
        }}></div>
      </div>

      {/* Full Name Input */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="fullName" style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '6px'
        }}>
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          placeholder="Alex Rivera"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          style={{
            width: '100%',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '14px',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box',
            color: '#1e293b'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#6366f1'
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)'
            e.currentTarget.style.outline = 'none'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
      </div>

      {/* Email Input */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="email" style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '6px'
        }}>
          Email address
        </label>
        <div style={{ position: 'relative' }}>
          <svg style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: '#94a3b8',
            pointerEvents: 'none'
          }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
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
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              paddingLeft: '40px',
              paddingRight: '16px',
              paddingTop: '10px',
              paddingBottom: '10px',
              fontSize: '14px',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
              color: '#1e293b'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)'
              e.currentTarget.style.outline = 'none'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
      </div>

      {/* Password Input */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="password" style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '6px'
        }}>
          Password
        </label>
        <div style={{ position: 'relative' }}>
          <svg style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: '#94a3b8',
            pointerEvents: 'none'
          }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            style={{
              width: '100%',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              paddingLeft: '40px',
              paddingRight: '40px',
              paddingTop: '10px',
              paddingBottom: '10px',
              fontSize: '14px',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
              color: '#1e293b'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)'
              e.currentTarget.style.outline = 'none'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0'
              e.currentTarget.style.boxShadow = 'none'
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
              background: 'transparent',
              border: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#475569'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            <svg style={{
              width: '16px',
              height: '16px'
            }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Confirm Password Input */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="confirmPassword" style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '6px'
        }}>
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Repeat password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          style={{
            width: '100%',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '14px',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box',
            color: '#1e293b'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#6366f1'
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.1)'
            e.currentTarget.style.outline = 'none'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
      </div>

      {/* Register Button */}
      <button
        type="submit"
        disabled={isLoading}
        style={{
          width: '100%',
          background: '#a5b4fc',
          color: 'white',
          borderRadius: '12px',
          padding: '12px',
          fontWeight: '600',
          fontSize: '15px',
          border: 'none',
          marginTop: '16px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: isLoading ? 0.7 : 1,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.background = '#c7d2fe'
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            e.currentTarget.style.background = '#a5b4fc'
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
            Creating account...
          </span>
        ) : (
          'Create account'
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
        input::placeholder {
          color: #cbd5e1;
        }
      `}</style>
    </form>
  )
}
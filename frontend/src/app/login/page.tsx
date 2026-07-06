'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { oauthAPI } from '@/lib/api'
import { LoginForm } from '@/components/LoginForm'

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    try {
      const res = await oauthAPI.getGoogleUrl()
      window.location.href = res.data.auth_url
    } catch {
      alert('Google OAuth not configured yet')
      setGoogleLoading(false)
    }
  }

  const handleGithubLogin = async () => {
    setGithubLoading(true)
    try {
      const res = await oauthAPI.getGithubUrl()
      window.location.href = res.data.auth_url
    } catch {
      alert('GitHub OAuth not configured yet')
      setGithubLoading(false)
    }
  }

  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
      background: '#f5f5f5',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      {/* Main Container - Exactly 420px max-width */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)',
        width: '100%',
        maxWidth: '420px',
        padding: '60px 40px 40px'
      }}>
        
        {/* Logo Section */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '40px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '20px',
            marginRight: '12px'
          }}>
            F
          </div>
          <span style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#1a1a1a',
            letterSpacing: '0.5px'
          }}>FOMO</span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1a1a1a',
          marginBottom: '8px',
          textAlign: 'center'
        }}>Welcome back</h1>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          marginBottom: '32px',
          textAlign: 'center'
        }}>Log in to your FOMO account</p>

        {/* OAuth Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              background: 'white',
              borderRadius: '8px',
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: '#1a1a1a',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: googleLoading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!googleLoading) {
                e.currentTarget.style.background = '#f9fafb'
                e.currentTarget.style.borderColor = '#d1d5db'
              }
            }}
            onMouseLeave={(e) => {
              if (!googleLoading) {
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }
            }}
          >
            <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#EA4335">G</text>
            </svg>
            Google
          </button>
          
          <button
            onClick={handleGithubLogin}
            disabled={githubLoading}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #e5e7eb',
              background: 'white',
              borderRadius: '8px',
              cursor: githubLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: '#1a1a1a',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: githubLoading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!githubLoading) {
                e.currentTarget.style.background = '#f9fafb'
                e.currentTarget.style.borderColor = '#d1d5db'
              }
            }}
            onMouseLeave={(e) => {
              if (!githubLoading) {
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.borderColor = '#e5e7eb'
              }
            }}
          >
            <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        {/* Divider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          color: '#9ca3af',
          fontSize: '13px'
        }}>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
          <span>or continue with email</span>
          <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }}></div>
        </div>

        {/* Login Form */}
        <LoginForm />

        {/* Sign Up Link */}
        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          color: '#6b7280',
          marginTop: '24px'
        }}>
          Don't have an account?{' '}
          <Link 
            href="/register" 
            style={{
              color: '#6366f1',
              textDecoration: 'none',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'color 0.2s ease'
            }}
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}
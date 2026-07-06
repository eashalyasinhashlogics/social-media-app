'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usersAPI } from '@/lib/api'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

export default function SplashPage() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 3
      })
    }, 50)

    const timer = setTimeout(() => {
      // Only call getMe() if we have a token cookie.
      // If there's no token, the user is definitely not logged in,
      // so skip the API call and go straight to login.
      const hasToken = getCookie('access_token') !== null
      
      if (!hasToken) {
        // No token means no session — go to login immediately
        router.push('/login')
      } else {
        // Token exists — verify it's still valid
        usersAPI.getMe()
          .then(() => router.push('/feed'))
          .catch(() => router.push('/login'))
      }
    }, 2600)

    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [router])

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #6c3bfb 0%, #583fe1 45%, #00b0df 100%)',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          color: '#ffffff',
        }}
      >
        {/* Logo Box - Glassmorphism */}
        <div
          style={{
            width: '110px',
            height: '110px',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '28px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            marginBottom: '24px',
          }}
        >
          <span
            style={{
              fontSize: '3.2rem',
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            F
          </span>
        </div>

        {/* App Title */}
        <h1
          style={{
            fontSize: '3.2rem',
            fontWeight: 800,
            letterSpacing: '0.5px',
            lineHeight: 1,
            marginBottom: '8px',
            margin: 0,
          }}
        >
          FOMO
        </h1>

        {/* App Tagline */}
        <p
          style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: '0.2px',
            marginBottom: '48px',
            margin: 0,
            marginBottom: '48px',
          }}
        >
          Authentic Connections
        </p>

        {/* Progress Container */}
        <div
          style={{
            width: '220px',
            height: '6px',
            background: 'rgba(255, 255, 255, 0.25)',
            borderRadius: '100px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}
        >
          {/* Progress Bar */}
          <div
            style={{
              height: '100%',
              background: '#ffffff',
              borderRadius: '100px',
              width: `${progress}%`,
              transition: 'width 0.01s linear',
            }}
          />
        </div>

        {/* Status Text */}
        <p
          style={{
            fontSize: '0.85rem',
            fontWeight: 400,
            color: 'rgba(255, 255, 255, 0.55)',
            letterSpacing: '0.1px',
            margin: 0,
          }}
        >
          Building your social space...
        </p>
      </div>
    </div>
  )
}
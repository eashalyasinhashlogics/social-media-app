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
    <div className="w-full h-screen flex justify-center items-center bg-[linear-gradient(135deg,#6c3bfb_0%,#583fe1_45%,#00b0df_100%)] overflow-hidden font-['Inter',sans-serif] m-0 p-0 box-border">
      <div className="flex flex-col items-center text-center text-white">
        
        {/* Logo Box - Glassmorphism */}
        <div className="w-[110px] h-[110px] bg-[rgba(255,255,255,0.15)] border border-[rgba(255,255,255,0.25)] rounded-[28px] flex justify-center items-center shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] backdrop-blur-[4px] mb-[24px]">
          <span className="text-[3.2rem] font-[800] text-white">
            F
          </span>
        </div>

        {/* App Title */}
        <h1 className="text-[3.2rem] font-[800] tracking-[0.5px] leading-[1] m-0 mb-[8px]">
          FOMO
        </h1>

        {/* App Tagline */}
        <p className="text-[1.15rem] font-[600] text-[rgba(255,255,255,0.9)] tracking-[0.2px] m-0 mb-[48px]">
          Authentic Connections
        </p>

        {/* Progress Container */}
        <div className="w-[220px] h-[6px] bg-[rgba(255,255,255,0.25)] rounded-[100px] overflow-hidden mb-[16px]">
          {/* Progress Bar */}
          <div
            className="h-full bg-white rounded-[100px] transition-[width] duration-[10ms] ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status Text */}
        <p className="text-[0.85rem] font-[400] text-[rgba(255,255,255,0.55)] tracking-[0.1px] m-0">
          Building your social space...
        </p>
      </div>
    </div>
  )
}
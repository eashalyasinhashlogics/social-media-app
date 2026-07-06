'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usersAPI } from '@/lib/api'

export default function OAuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // The backend already set the access_token/refresh_token httpOnly
    // cookies before redirecting here, so there's nothing to read from the
    // URL anymore. We just confirm the session is valid and move on.
    usersAPI.getMe()
      .then(() => router.replace('/feed'))
      .catch(() => router.replace('/login?error=oauth_failed'))
  }, [router])

  return (
    <div className="min-h-screen fomo-gradient flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-lg font-medium">Completing sign in...</p>
      </div>
    </div>
  )
}

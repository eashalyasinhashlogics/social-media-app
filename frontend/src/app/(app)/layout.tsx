'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ProfileProvider, useProfile } from '@/context/ProfileContext'
import { AppNavbar } from '@/components/AppNavbar'

function AppShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, fetchMe, isLoading } = useAuthStore()
  const { refreshOwnProfile } = useProfile()

  useEffect(() => {
    fetchMe().then(() => {
      const auth = useAuthStore.getState().isAuthenticated
      if (!auth) router.replace('/login')
    })
  }, [])

  useEffect(() => {
    if (!user) return
    refreshOwnProfile()
  }, [user])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#5B52E7_0%,#4C43D4_100%)] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-[48px] h-[48px] border-[4px] border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-[spin_0.8s_linear_infinite] mx-auto mb-[12px]" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="font-[inherit] text-[#1a202c] min-h-screen pb-[48px]">
      <AppNavbar />
      <main className="max-w-[1240px] mx-auto px-[24px] mt-[32px]">{children}</main>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
        <ProfileProvider>
          <AppShellInner>{children}</AppShellInner>
        </ProfileProvider>
      </>
    </ProtectedRoute>
  )
}
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/feed')
    }
  }, [user, router])

  if (!user || user.role !== 'admin') return null

  return <>{children}</>
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      {/* Sidebar stacks above content below md instead of squeezing the
          table/cards into whatever's left of the viewport width. */}
      <div className="flex flex-col md:flex-row items-start gap-[16px] md:gap-[24px]">
        <AdminSidebar />
        <div className="flex-1 min-w-0 w-full">{children}</div>
      </div>
    </AdminGate>
  )
}
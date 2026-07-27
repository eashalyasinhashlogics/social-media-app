'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useProfile } from '@/context/ProfileContext'
import { resolveMediaUrl } from '@/lib/api'

interface Tab {
  key: string
  label: string
  href: string
  icon: string
  badge?: string
}

const TABS: Tab[] = [
  { key: 'home', label: 'Home', href: '/feed', icon: 'house' },
  { key: 'explore', label: 'Explore', href: '/explore', icon: 'compass' },
  { key: 'messages', label: 'Messages', href: '/messages', icon: 'comment-dots' },
  { key: 'notifications', label: 'Notifications', href: '/notifications', icon: 'bell' },
  { key: 'communities', label: 'Communities', href: '/communities', icon: 'users' },
  { key: 'profile', label: 'Profile', href: '/profile', icon: 'user' },
]

const TAB_BASE_CLASSES =
  'px-[20px] py-[10px] rounded-[8px] text-[14px] font-medium transition-all duration-[0.2s] ease flex items-center gap-[8px] text-[#64748b] hover:text-[#1a202c] bg-transparent border-none relative cursor-pointer no-underline'

const TAB_ACTIVE_CLASSES =
  'px-[20px] py-[10px] rounded-[8px] text-[14px] font-medium transition-all duration-[0.2s] ease flex items-center gap-[8px] bg-[#EEF2FF] text-[#5B52E7] border-none relative cursor-pointer no-underline'

export function AppNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { ownProfile } = useProfile()

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  if (!user) return null

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[#e2e8f0] py-[12px] px-[24px] flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <Link href="/feed" className="flex items-center gap-[12px] cursor-pointer no-underline">
        <div
          className="bg-[linear-gradient(135deg,#6366f1,#4f46e5)] text-[22px] font-[700] w-[44px] h-[44px] flex items-center justify-center shadow-[0_4px_14px_rgba(79,70,229,0.4)]"
          style={{ borderRadius: '14px' }}
        >
          <span style={{ color: '#fcfbfb' }}>F</span>
        </div>
        <span className="text-[20px] font-[800] text-[#0f172a] tracking-[-0.5px]">FOMO</span>
      </Link>

      <div className="flex items-center gap-[4px] bg-white p-[4px] rounded-[12px] border border-[#e2e8f0]">
        {TABS.map((tab) => {
          const isActive = tab.href === '/profile' ? pathname.startsWith('/profile') : pathname === tab.href
          return (
            <Link key={tab.key} href={tab.href} className={isActive ? TAB_ACTIVE_CLASSES : TAB_BASE_CLASSES}>
              <i className={`fa-solid fa-${tab.icon}`}></i>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="absolute top-[-4px] right-[-4px] bg-[#06b6d4] text-white text-[10px] font-bold w-[16px] h-[16px] rounded-full flex items-center justify-center border border-white">
                  {tab.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      <div className="flex items-center gap-[16px]">
        {/* <Link
          href="/feed"
          className="bg-[#5B52E7] hover:bg-[#4C43D4] px-[20px] py-[8px] rounded-full text-[14px] shadow-[0_4px_6px_rgba(91,82,231,0.1)] border-none cursor-pointer flex items-center gap-[8px] transition-all duration-200 ease no-underline"
          style={{ color: '#ffffff' }}
          aria-label="Create"
        >
          <i className="fa-solid fa-plus text-[12px]" style={{ color: '#ffffff' }}></i>
          <span style={{ color: '#ffffff', fontWeight: 700 }}>Create</span>
        </Link> */}
        <Link href="/profile" className="flex items-center gap-[8px] no-underline">
          <div className="relative">
            <img
              src={ownProfile?.avatar_url ? resolveMediaUrl(ownProfile.avatar_url) : 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.username}
              alt={`${user.username} Avatar`}
              className="w-[32px] h-[32px] rounded-full object-cover border border-[#e2e8f0]"
            />
          </div>
          <span className="text-[14px] font-bold text-[#374151] no-underline">{user.username}</span>
        </Link>
        <button
          onClick={handleLogout}
          className="bg-[#5B52E7] hover:bg-[#4C43D4] px-[16px] py-[8px] rounded-[8px] text-[14px] font-medium border-none cursor-pointer flex items-center gap-[6px] transition-all duration-200 ease"
          style={{ color: '#ffffff' }}
        >
          <i className="fa-solid fa-sign-out-alt text-[14px]" style={{ color: '#ffffff' }}></i>
          <span style={{ color: '#ffffff' }}>Logout</span>
        </button>
      </div>
    </nav>
  )
}
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AdminNavItem {
  key: string
  label: string
  href: string
  icon: string
}

const NAV_ITEMS: AdminNavItem[] = [
  { key: 'users', label: 'Users', href: '/admin/users', icon: 'users' },
  { key: 'posts', label: 'Posts', href: '/admin/posts', icon: 'file-lines' },
  { key: 'audit-logs', label: 'Audit Logs', href: '/admin/audit-logs', icon: 'clipboard-list' },
  { key: 'stats', label: 'Stats', href: '/admin/stats', icon: 'chart-line' },
]

const ITEM_BASE =
  'flex items-center gap-[10px] px-[14px] py-[10px] rounded-[8px] text-[14px] font-[600] no-underline transition-colors duration-150 ease cursor-pointer whitespace-nowrap shrink-0'

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    // Below md, this collapses from a vertical sidebar into a horizontal
    // scrollable tab bar (same .no-scrollbar utility the rest of the app
    // already defines globally in app/(app)/layout.tsx) instead of eating
    // a fixed 200px column on a narrow viewport.
    <aside className="w-full md:w-[200px] md:shrink-0">
      <div className="md:sticky md:top-[88px]">
        <div className="mb-[8px] md:mb-[16px] px-[14px] hidden md:block">
          <p className="text-[11px] font-[700] tracking-[0.5px] text-[#94a3b8] uppercase">Admin</p>
        </div>
        <nav className="flex md:flex-col gap-[4px] overflow-x-auto no-scrollbar pb-[4px] md:pb-0">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.key}
                href={item.href}
                className={
                  isActive
                    ? `${ITEM_BASE} bg-[#EEF2FF] text-[#5B52E7]`
                    : `${ITEM_BASE} text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1a202c]`
                }
              >
                <i className={`fa-solid fa-${item.icon} w-[16px]`}></i>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
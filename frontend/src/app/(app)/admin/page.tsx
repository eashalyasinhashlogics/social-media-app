'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// /admin has nothing of its own to show - the shell's default landing
// spot is the users table.
export default function AdminIndexPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/admin/users')
  }, [router])

  return null
}
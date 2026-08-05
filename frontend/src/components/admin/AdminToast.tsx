'use client'

import { useEffect } from 'react'

export interface ToastState {
  message: string
  variant: 'success' | 'error'
}

// Deliberately not a portal/global provider - each admin page owns one
// piece of { message, variant } | null state and passes it in, same
// pattern as the inline error banners already used on every other page
// in this app. Keeps the "toast" idea consistent with your existing
// error-handling style instead of introducing a new library/pattern.
export function AdminToast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 2600)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null

  const isSuccess = toast.variant === 'success'

  return (
    <div
      className={`fixed bottom-[24px] right-[24px] z-50 px-[16px] py-[12px] rounded-[10px] shadow-[0_10px_25px_rgba(0,0,0,0.15)] text-[13px] font-[600] flex items-center gap-[10px] ${
        isSuccess ? 'bg-[#0f172a] text-white' : 'bg-[#ef4444] text-white'
      }`}
      role="status"
    >
      <i className={`fa-solid ${isSuccess ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-[4px] text-white/70 hover:text-white bg-transparent border-none cursor-pointer text-[14px]"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
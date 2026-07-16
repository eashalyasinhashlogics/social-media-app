'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'

export function LoginForm() {
  const router = useRouter()
  const { login, isLoading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
      router.push('/feed')
    } catch {}
  }

  return (
    <form onSubmit={handleLogin} className="m-0">
      {/* Error Alert */}
      {error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px] font-[500] mb-[20px] animate-[fadeIn_0.2s_ease-in]">
          {error}
        </div>
      )}

      {/* Email Input */}
      <div className="mb-[20px]">
        <label htmlFor="email" className="block text-[14px] font-[600] text-[#1a1a1a] mb-[8px]">
          Email address
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full py-[12px] px-[14px] border border-[#e5e7eb] rounded-[8px] text-[14px] font-inherit transition-all duration-[0.2s] ease box-border outline-none hover:border-[#d1d5db] focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
        />
      </div>

      {/* Password Input */}
      <div className="mb-[24px]">
        <div className="flex justify-between items-center mb-[8px]">
          <label htmlFor="password" className="block text-[14px] font-[600] text-[#1a1a1a]">
            Password
          </label>
          <Link 
            href="/forgot-password" 
            className="text-[13px] text-[#6366f1] no-underline cursor-pointer transition-colors duration-[0.2s] ease hover:text-[#4f46e5]"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full py-[12px] px-[14px] pr-[42px] border border-[#e5e7eb] rounded-[8px] text-[14px] font-inherit transition-all duration-[0.2s] ease box-border outline-none hover:border-[#d1d5db] focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-[14px] top-[50%] translate-y-[-50%] cursor-pointer text-[#9ca3af] text-[18px] bg-transparent border-none p-0 flex items-center justify-center outline-none select-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {/* Login Button */}
      <button
        type="submit"
        disabled={isLoading}
        className={`w-full p-[12px] bg-[linear-gradient(135deg,#6366f1_0%,#7c3aed_100%)] text-white border-none rounded-[8px] text-[15px] font-[600] transition-all duration-[0.2s] ease mb-[16px] ${
          isLoading 
            ? 'cursor-not-allowed opacity-[0.6]' 
            : 'cursor-pointer hover:translate-y-[-2px] hover:shadow-[0_8px_16px_rgba(99,102,241,0.4)] active:translate-y-0'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-[8px]">
            <span className="w-[16px] h-[16px] border-[2px] border-white border-t-transparent rounded-full animate-[spin_0.6s_linear_infinite]"></span>
            Logging in...
          </span>
        ) : (
          'Log in'
        )}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </form>
  )
}
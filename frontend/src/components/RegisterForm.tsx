'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authAPI } from '@/lib/api'

export function RegisterForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    // Validation
    if (!fullName || !email || !password || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (fullName.length < 2) {
      setError('Full name must be at least 2 characters')
      return
    }

    setIsLoading(true)
    try {
      // Split full name into first and last name for the API
      const nameParts = fullName.trim().split(' ')
      const username = nameParts[0].toLowerCase()
      
      await authAPI.register(email, username, password)
      setSuccess('Account created! Check your email for the verification code.')
      setTimeout(() => router.push(`/verify-email?email=${encodeURIComponent(email)}`), 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleRegister} className="m-0">
      {/* Error Alert */}
      {error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px] font-[500] mb-[16px] animate-[fadeIn_0.2s_ease-in]">
          {error}
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="py-[12px] px-[14px] bg-[#f0fdf4] border border-[#dcfce7] rounded-[8px] text-[#15803d] text-[14px] font-[500] mb-[16px] animate-[fadeIn_0.2s_ease-in]">
          {success}
        </div>
      )}

      {/* OAuth Buttons */}
      <div className="flex gap-[16px] mb-[24px]">
        <button
          type="button"
          className="flex-1 py-[10px] px-[16px] border border-[#e5e7eb] rounded-[8px] text-[14px] font-[600] text-[#1a1a1a] bg-white cursor-pointer transition-all duration-[0.2s] ease hover:bg-[#f9fafb] hover:border-[#d1d5db]"
        >
          Google
        </button>
        <button
          type="button"
          className="flex-1 py-[10px] px-[16px] border border-[#e5e7eb] rounded-[8px] text-[14px] font-[600] text-[#1a1a1a] bg-white cursor-pointer transition-all duration-[0.2s] ease hover:bg-[#f9fafb] hover:border-[#d1d5db]"
        >
          GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center mb-[24px] gap-[16px]">
        <div className="flex-1 h-[1px] bg-[#e5e7eb]"></div>
        <span className="text-[12px] font-[500] text-[#9ca3af]">or with email</span>
        <div className="flex-1 h-[1px] bg-[#e5e7eb]"></div>
      </div>

      {/* Full Name Input */}
      <div className="mb-[16px]">
        <label htmlFor="fullName" className="block text-[14px] font-[600] text-[#1a1a1a] mb-[8px]">
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          placeholder="Alex Rivera"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          className="w-full py-[12px] px-[14px] border border-[#e5e7eb] rounded-[8px] text-[14px] font-inherit transition-all duration-[0.2s] ease box-border outline-none hover:border-[#d1d5db] focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] text-[#1a1a1a]"
        />
      </div>

      {/* Email Input */}
      <div className="mb-[16px]">
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
          className="w-full py-[12px] px-[14px] border border-[#e5e7eb] rounded-[8px] text-[14px] font-inherit transition-all duration-[0.2s] ease box-border outline-none hover:border-[#d1d5db] focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] text-[#1a1a1a]"
        />
      </div>

      {/* Password Input */}
      <div className="mb-[16px]">
        <label htmlFor="password" className="block text-[14px] font-[600] text-[#1a1a1a] mb-[8px]">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full py-[12px] px-[14px] pr-[42px] border border-[#e5e7eb] rounded-[8px] text-[14px] font-inherit transition-all duration-[0.2s] ease box-border outline-none hover:border-[#d1d5db] focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] text-[#1a1a1a]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-[14px] top-[50%] translate-y-[-50%] cursor-pointer text-[#9ca3af] text-[18px] bg-transparent border-none p-0 flex items-center justify-center outline-none select-none hover:text-[#475569]"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {/* Confirm Password Input */}
      <div className="mb-[24px]">
        <label htmlFor="confirmPassword" className="block text-[14px] font-[600] text-[#1a1a1a] mb-[8px]">
          Confirm password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full py-[12px] px-[14px] pr-[42px] border border-[#e5e7eb] rounded-[8px] text-[14px] font-inherit transition-all duration-[0.2s] ease box-border outline-none hover:border-[#d1d5db] focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] text-[#1a1a1a]"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-[14px] top-[50%] translate-y-[-50%] cursor-pointer text-[#9ca3af] text-[18px] bg-transparent border-none p-0 flex items-center justify-center outline-none select-none hover:text-[#475569]"
            aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
          >
            {showConfirmPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {/* Register Button */}
      <button
        type="submit"
        disabled={isLoading}
        className={`w-full p-[12px] bg-[linear-gradient(135deg,#6366f1_0%,#7c3aed_100%)] text-white border-none rounded-[8px] text-[15px] font-[600] transition-all duration-[0.2s] ease mt-[8px] mb-[16px] ${
          isLoading 
            ? 'cursor-not-allowed opacity-[0.6]' 
            : 'cursor-pointer hover:translate-y-[-2px] hover:shadow-[0_8px_16px_rgba(99,102,241,0.4)] active:translate-y-0'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-[8px]">
            <span className="w-[16px] h-[16px] border-[2px] border-white border-t-transparent rounded-full animate-[spin_0.6s_linear_infinite]"></span>
            Creating account...
          </span>
        ) : (
          'Create account'
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
        input::placeholder {
          color: #cbd5e1;
        }
      `}</style>
    </form>
  )
}
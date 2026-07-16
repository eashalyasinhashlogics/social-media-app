'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { oauthAPI } from '@/lib/api'
import { LoginForm } from '@/components/LoginForm'

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    try {
      const res = await oauthAPI.getGoogleUrl()
      window.location.href = res.data.auth_url
    } catch {
      alert('Google OAuth not configured yet')
      setGoogleLoading(false)
    }
  }

  const handleGithubLogin = async () => {
    setGithubLoading(true)
    try {
      const res = await oauthAPI.getGithubUrl()
      window.location.href = res.data.auth_url
    } catch {
      alert('GitHub OAuth not configured yet')
      setGithubLoading(false)
    }
  }

  return (
    <div className="font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif] bg-[#f5f5f5] flex justify-center items-center min-h-screen p-[20px]">
      {/* Main Container - Exactly 420px max-width */}
      <div className="bg-white rounded-[12px] shadow-[0_2px_16px_rgba(0,0,0,0.08)] w-full max-w-[420px] pt-[60px] px-[40px] pb-[40px]">
        
        {/* Logo Section */}
        <div className="flex items-center justify-center mb-[40px]">
          <div className="bg-[linear-gradient(135deg,#6366f1,#4f46e5)] text-white text-[22px] font-[700] w-[44px] h-[44px] rounded-[14px] flex items-center justify-center shadow-[0_4px_14px_rgba(79,70,229,0.4)]">
          F
        </div>
            <span className="text-[26px] font-[800] text-[#0f172a] tracking-[-0.5px]">FOMO</span>
        </div>

        {/* Heading */}
        <h1 className="text-[28px] font-[700] text-[#1a1a1a] mb-[8px] text-center">Welcome back</h1>
        <p className="text-[14px] text-[#6b7280] mb-[32px] text-center">Log in to your FOMO account</p>

        {/* OAuth Buttons */}
        <div className="flex gap-[12px] mb-[24px]">
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className={`flex-1 py-[12px] px-[16px] border border-[#e5e7eb] bg-white rounded-[8px] text-[14px] font-[500] text-[#1a1a1a] transition-all duration-[0.2s] ease flex items-center justify-center gap-[8px] ${
              googleLoading 
                ? 'cursor-not-allowed opacity-[0.6]' 
                : 'cursor-pointer hover:bg-[#f9fafb] hover:border-[#d1d5db]'
            }`}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#EA4335">G</text>
            </svg>
            Google
          </button>
          
          <button
            onClick={handleGithubLogin}
            disabled={githubLoading}
            className={`flex-1 py-[12px] px-[16px] border border-[#e5e7eb] bg-white rounded-[8px] text-[14px] font-[500] text-[#1a1a1a] transition-all duration-[0.2s] ease flex items-center justify-center gap-[8px] ${
              githubLoading 
                ? 'cursor-not-allowed opacity-[0.6]' 
                : 'cursor-pointer hover:bg-[#f9fafb] hover:border-[#d1d5db]'
            }`}
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-[12px] mb-[24px] text-[#9ca3af] text-[13px]">
          <div className="flex-1 h-[1px] bg-[#e5e7eb]"></div>
          <span>or continue with email</span>
          <div className="flex-1 h-[1px] bg-[#e5e7eb]"></div>
        </div>

        {/* Login Form */}
        <LoginForm />

        {/* Sign Up Link */}
        <div className="text-center text-[14px] text-[#6b7280] mt-[24px]">
          Don't have an account?{' '}
          <Link 
            href="/register" 
            className="text-[#6366f1] no-underline font-[500] cursor-pointer transition-colors duration-[0.2s] ease"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}
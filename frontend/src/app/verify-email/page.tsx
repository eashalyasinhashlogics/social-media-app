'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authAPI } from '@/lib/api'

// useSearchParams() opts the tree up to the nearest Suspense boundary out of
// prerendering. Without the boundary in the default export below, `next build`
// fails on this route ("should be wrapped in a suspense boundary") - it only
// surfaces in a production build, never in `next dev`.
function VerifyEmailForm() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get('email') || ''
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [countdown, setCountdown] = useState(60)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const handleChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const next = [...otp]
    next[i] = v.slice(-1)
    setOtp(next)
    if (v && i < 5) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      refs.current[5]?.focus()
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await authAPI.verifyEmail(email, code)
      setSuccess('Email verified! Redirecting to login...')
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Verification failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    setError('')
    try {
      await authAPI.resendOTP(email)
      setSuccess('New code sent to your email!')
      setCountdown(60)
      setOtp(['', '', '', '', '', ''])
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resend code')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Helvetica,Arial,sans-serif] bg-[#f8fafc] flex flex-col items-center justify-center min-h-screen p-[20px]">
      
      {/* Brand Header - Outside Card */}
      <div className="flex items-center gap-[12px] mb-[40px]">
        <div className="bg-[linear-gradient(135deg,#6366f1,#4f46e5)] text-white text-[22px] font-[700] w-[44px] h-[44px] rounded-[14px] flex items-center justify-center shadow-[0_4px_14px_rgba(79,70,229,0.4)]">
          F
        </div>
        <span className="text-[26px] font-[800] text-[#0f172a] tracking-[-0.5px]">FOMO</span>
      </div>

      {/* Verification Card */}
      <div className="bg-white rounded-[20px] w-full max-w-[490px] p-[40px] shadow-[0_4px_25px_rgba(0,0,0,0.03)] relative">
        
        {/* Back Button */}
        <Link 
          href="/login" 
          className="inline-flex items-center gap-[8px] text-[#64748b] hover:text-[#475569] no-underline text-[15px] font-[500] mb-[28px] cursor-pointer transition-colors duration-[0.2s] ease"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </Link>

        {/* Icon Container */}
        <div className="w-[60px] h-[60px] bg-[#e0e7ff] rounded-full flex items-center justify-center mb-[24px]">
          <svg className="w-[26px] h-[26px] text-[#4f46e5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        </div>

        {/* Heading */}
        <h2 className="text-[26px] font-[700] text-[#0f172a] mb-[10px] tracking-[-0.3px]">Verify your email</h2>
        
        {/* Instruction Text */}
        <p className="text-[15px] text-[#64748b] mb-[32px] font-[400]">
          We sent a 6-digit code to <strong className="text-[#0f172a] font-[600]">{email}</strong>
        </p>

        {/* Error Alert */}
        {error && (
          <div className="mb-[24px] py-[12px] px-[16px] bg-[#fef2f2] border border-[#fee2e2] rounded-[12px] text-[#991b1b] text-[14px]">
            {error}
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="mb-[24px] py-[12px] px-[16px] bg-[#f0fdf4] border border-[#dcfce7] rounded-[12px] text-[#15803d] text-[14px]">
            {success}
          </div>
        )}

        {/* Code Input Area */}
        <div className="flex flex-col items-center gap-[16px] mb-[36px]" onPaste={handlePaste}>
          <div className="flex justify-between w-full gap-[10px]">
            {otp.map((digit, i) => (
              <div key={i} className="flex flex-col items-center gap-[12px] flex-1">
                <input
                  ref={(el) => {
                    refs.current[i] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  className={`w-full h-[64px] rounded-[14px] text-[24px] font-[600] text-center text-[#0f172a] outline-none bg-transparent transition-all duration-[0.2s] ease cursor-text focus:border-[2px] focus:border-[#4f46e5] focus:shadow-[0_0_0_0.5px_#4f46e5] ${
                    digit 
                      ? 'border-[2px] border-[#4f46e5] shadow-[0_0_0_0.5px_#4f46e5]' 
                      : 'border-[1.5px] border-[#e2e8f0]'
                  }`}
                />
                <div className="w-[24px] h-[2px] bg-[#cbd5e1] rounded-[2px]"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={isLoading || otp.join('').length !== 6}
          className={`w-full p-[12px] bg-[#4f46e5] text-white text-[15px] font-[600] border-none rounded-[12px] transition-all duration-[0.2s] ease mb-[24px] ${
            isLoading || otp.join('').length !== 6
              ? 'cursor-not-allowed opacity-[0.6]'
              : 'cursor-pointer hover:bg-[#4338ca] hover:shadow-[0_4px_12px_rgba(79,70,229,0.3)]'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-[8px]">
              <span className="w-[16px] h-[16px] border-[2px] border-white border-t-transparent rounded-full animate-[spin_0.6s_linear_infinite]"></span>
              Verifying...
            </span>
          ) : (
            'Verify Email'
          )}
        </button>

        {/* Footer Text */}
        <p className="text-[14px] text-[#64748b] text-center mb-[8px]">
          Didn't receive the code?{' '}
          {countdown > 0 ? (
            <span className="font-[500] text-[#94a3b8]">Resend in {countdown}s</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={isResending}
              className={`bg-transparent border-none text-[#4f46e5] font-[500] no-underline transition-colors duration-[0.2s] ease text-inherit ${
                isResending ? 'cursor-not-allowed' : 'cursor-pointer hover:text-[#4338ca]'
              }`}
            >
              {isResending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </p>
        
        <p className="text-[12px] text-[#94a3b8] text-center font-[400]">Code expires in 15 minutes</p>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#f8fafc] flex flex-col items-center justify-center min-h-screen p-[20px]" />
      }
    >
      <VerifyEmailForm />
    </Suspense>
  )
}
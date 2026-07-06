'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authAPI } from '@/lib/api'

export default function VerifyEmailPage() {
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
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      {/* Brand Header - Outside Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '40px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          color: '#ffffff',
          fontSize: '22px',
          fontWeight: '700',
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
        }}>
          F
        </div>
        <span style={{
          fontSize: '26px',
          fontWeight: '800',
          color: '#0f172a',
          letterSpacing: '-0.5px'
        }}>FOMO</span>
      </div>

      {/* Verification Card */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '490px',
        padding: '40px',
        boxShadow: '0 4px 25px rgba(0, 0, 0, 0.03)',
        position: 'relative'
      }}>
        
        {/* Back Button */}
        <Link href="/login" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: '#64748b',
          textDecoration: 'none',
          fontSize: '15px',
          fontWeight: '500',
          marginBottom: '28px',
          cursor: 'pointer',
          transition: 'color 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#475569'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#64748b'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </Link>

        {/* Icon Container */}
        <div style={{
          width: '60px',
          height: '60px',
          backgroundColor: '#e0e7ff',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <svg style={{
            width: '26px',
            height: '26px',
            color: '#4f46e5'
          }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        </div>

        {/* Heading */}
        <h2 style={{
          fontSize: '26px',
          fontWeight: '700',
          color: '#0f172a',
          marginBottom: '10px',
          letterSpacing: '-0.3px'
        }}>Verify your email</h2>
        
        {/* Instruction Text */}
        <p style={{
          fontSize: '15px',
          color: '#64748b',
          marginBottom: '32px',
          fontWeight: '400'
        }}>We sent a 6-digit code to <strong style={{
          color: '#0f172a',
          fontWeight: '600'
        }}>{email}</strong></p>

        {/* Error Alert */}
        {error && (
          <div style={{
            marginBottom: '24px',
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '12px',
            color: '#991b1b',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div style={{
            marginBottom: '24px',
            padding: '12px 16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #dcfce7',
            borderRadius: '12px',
            color: '#15803d',
            fontSize: '14px'
          }}>
            {success}
          </div>
        )}

        {/* Code Input Area */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '36px'
        }} onPaste={handlePaste}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            gap: '10px'
          }}>
            {otp.map((digit, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                flex: 1
              }}>
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
                  style={{
                    width: '100%',
                    height: '64px',
                    border: digit || document.activeElement === refs.current[i] ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    fontSize: '24px',
                    fontWeight: '600',
                    textAlign: 'center',
                    color: '#0f172a',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    transition: 'all 0.2s ease',
                    cursor: 'text',
                    boxShadow: (digit || document.activeElement === refs.current[i]) ? '0 0 0 0.5px #4f46e5' : 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#4f46e5'
                    e.currentTarget.style.borderWidth = '2px'
                    e.currentTarget.style.boxShadow = '0 0 0 0.5px #4f46e5'
                  }}
                  onBlur={(e) => {
                    if (!e.currentTarget.value) {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.borderWidth = '1.5px'
                      e.currentTarget.style.boxShadow = 'none'
                    }
                  }}
                />
                <div style={{
                  width: '24px',
                  height: '2px',
                  backgroundColor: '#cbd5e1',
                  borderRadius: '2px'
                }}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={isLoading || otp.join('').length !== 6}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#4f46e5',
            color: 'white',
            fontSize: '15px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '12px',
            cursor: isLoading || otp.join('').length !== 6 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isLoading || otp.join('').length !== 6 ? 0.6 : 1,
            marginBottom: '24px'
          }}
          onMouseEnter={(e) => {
            if (!isLoading && otp.join('').length === 6) {
              e.currentTarget.style.backgroundColor = '#4338ca'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.3)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && otp.join('').length === 6) {
              e.currentTarget.style.backgroundColor = '#4f46e5'
              e.currentTarget.style.boxShadow = 'none'
            }
          }}
        >
          {isLoading ? (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span style={{
                width: '16px',
                height: '16px',
                border: '2px solid white',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite'
              }}></span>
              Verifying...
            </span>
          ) : (
            'Verify Email'
          )}
        </button>

        {/* Footer Text */}
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          textAlign: 'center',
          marginBottom: '8px'
        }}>
          Didn't receive the code? {countdown > 0 ? (
            <span style={{ fontWeight: '500', color: '#94a3b8' }}>Resend in {countdown}s</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={isResending}
              style={{
                background: 'none',
                border: 'none',
                color: '#4f46e5',
                fontWeight: '500',
                cursor: isResending ? 'not-allowed' : 'pointer',
                textDecoration: 'none',
                transition: 'color 0.2s ease',
                fontSize: 'inherit'
              }}
              onMouseEnter={(e) => {
                if (!isResending) {
                  e.currentTarget.style.color = '#4338ca'
                }
              }}
              onMouseLeave={(e) => {
                if (!isResending) {
                  e.currentTarget.style.color = '#4f46e5'
                }
              }}
            >
              {isResending ? 'Sending...' : 'Resend code'}
            </button>
          )}
        </p>
        
        <p style={{
          fontSize: '12px',
          color: '#94a3b8',
          textAlign: 'center',
          fontWeight: '400'
        }}>Code expires in 15 minutes</p>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
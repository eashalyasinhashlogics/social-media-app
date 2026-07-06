'use client'
import Link from 'next/link'
import { RegisterForm } from '@/components/RegisterForm'

export default function RegisterPage() {
  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
      background: '#f8fafc',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      color: '#1e293b'
    }}>
      {/* Logo - Outside Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '32px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          background: '#6366f1',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '20px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}>
          F
        </div>
        <span style={{
          fontWeight: '800',
          fontSize: '24px',
          letterSpacing: '-0.025em'
        }}>FOMO</span>
      </div>

      {/* Card Container */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        padding: '32px',
        width: '100%',
        maxWidth: '448px'
      }}>
        
        {/* Heading */}
        <h1 style={{
          fontSize: '24px',
          fontWeight: '700',
          marginBottom: '4px',
          color: '#1e293b'
        }}>Create account</h1>
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          marginBottom: '24px'
        }}>Join millions connecting authentically</p>

        {/* Register Form */}
        <RegisterForm />

        {/* Login Link */}
        <p style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#64748b'
        }}>
          Already have an account?{' '}
          <Link 
            href="/login"
            style={{
              color: '#6366f1',
              fontWeight: '700',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s ease'
            }}
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
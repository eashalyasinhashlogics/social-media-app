'use client'
import Link from 'next/link'
import { RegisterForm } from '@/components/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="font-[-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif] bg-[#f8fafc] min-h-screen flex flex-col items-center justify-center p-[16px] text-[#1e293b]">
      {/* Logo - Outside Card */}
      <div className="flex items-center gap-[12px] mb-[32px]">
      <div className="bg-[linear-gradient(135deg,#6366f1,#4f46e5)] text-white text-[22px] font-[700] w-[44px] h-[44px] rounded-[14px] flex items-center justify-center shadow-[0_4px_14px_rgba(79,70,229,0.4)]">
          F
        </div>
        <span className="text-[26px] font-[800] text-[#0f172a] tracking-[-0.5px]">FOMO</span>
      </div>

      {/* Card Container */}
      <div className="bg-white rounded-[16px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-[#e2e8f0] p-[32px] w-full max-w-[448px]">
        
        {/* Heading */}
        <h1 className="text-[24px] font-[700] mb-[4px] text-[#1e293b]">Create account</h1>
        <p className="text-[14px] text-[#64748b] mb-[24px]">Join millions connecting authentically</p>

        {/* Register Form */}
        <RegisterForm />

        {/* Login Link */}
        <p className="mt-[24px] text-center text-[14px] text-[#64748b]">
          Already have an account?{' '}
          <Link 
            href="/login"
            className="text-[#6366f1] font-[700] no-underline cursor-pointer transition-colors duration-[0.2s] ease"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
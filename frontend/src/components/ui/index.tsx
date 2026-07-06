'use client'
import { useState } from 'react'

interface InputProps {
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  icon?: React.ReactNode
  label?: string
  error?: string
  rightElement?: React.ReactNode
}

export function Input({ type = 'text', placeholder, value, onChange, icon, label, error, rightElement }: InputProps) {
  const [show, setShow] = useState(false)
  const actualType = type === 'password' ? (show ? 'text' : 'password') : type

  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
        <input
          type={actualType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 border-1.5 border-gray-200 rounded-lg text-sm font-normal outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 ${
            icon ? 'pl-11' : ''
          } ${rightElement || type === 'password' ? 'pr-11' : ''} ${error ? 'border-red-400' : ''}`}
        />
        {type === 'password' && (
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button' }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'outline'
  type?: 'button' | 'submit'
}) {
  if (variant === 'outline') {
    return (
      <button type={type} onClick={onClick} disabled={disabled}
        className="w-full py-3 px-4 border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:border-purple-400 hover:text-purple-600 transition-all flex items-center justify-center gap-2 bg-white disabled:opacity-60 disabled:cursor-not-allowed">
        {children}
      </button>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="btn-primary">
      {children}
    </button>
  )
}

export function ErrorAlert({ message, onClose }: { message: string; onClose?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-red-700 text-sm flex-1">{message}</p>
      {onClose && <button onClick={onClose} className="text-red-400 hover:text-red-600">✕</button>}
    </div>
  )
}

export function SuccessAlert({ message }: { message: string }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3">
      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-green-700 text-sm">{message}</p>
    </div>
  )
}

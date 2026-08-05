'use client'

export default function MessagesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-[640px] mx-auto py-[40px] text-center">
      <p className="text-[15px] font-[600] text-[#0f172a] mb-[6px]">Couldn't load your conversations.</p>
      <p className="text-[13px] text-[#64748b] mb-[16px]">{error.message || 'Please try again.'}</p>
      <button
        onClick={reset}
        className="px-[16px] py-[8px] text-[13px] font-[600] text-white bg-[#4f46e5] border-none rounded-[8px] cursor-pointer"
      >
        Try again
      </button>
    </div>
  )
}

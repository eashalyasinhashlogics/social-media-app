'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { postsAPI, Post, extractErrorMessage } from '@/lib/api'

interface ShareModalProps {
  post: Post
  onClose: () => void
  onShared: (share: Post) => void
}

export function ShareModal({ post, onClose, onShared }: ShareModalProps) {
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleShare = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await postsAPI.share(post.id, caption.trim())
      onShared(res.data)
      onClose()
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to share post'))
      setSubmitting(false)
    }
  }

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    width: '420px',
    maxWidth: '90vw',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  }

  const modal = (
    <div style={backdropStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-[14px]">
          <h3 className="text-[16px] font-[700] text-[#1a202c]">Share post</h3>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-[18px] text-[#9ca3af]">✕</button>
        </div>

        {error && (
          <div className="mb-[10px] py-[8px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px]">
            {error}
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)"
          rows={2}
          maxLength={10000}
          className="w-full resize-none border border-[#e2e8f0] rounded-[8px] p-[10px] text-[14px] outline-none focus:border-[#6366f1] mb-[12px]"
        />

        <div className="border border-[#e2e8f0] rounded-[10px] p-[10px] bg-[#f8fafc] mb-[16px]">
          <div className="text-[12px] font-[600] text-[#1a202c] mb-[2px]">{post.author_username || 'Unknown user'}</div>
          <p className="text-[13px] text-[#374151] line-clamp-3">{post.content}</p>
        </div>

        <div className="flex justify-end gap-[8px]">
          <button onClick={onClose} disabled={submitting} className="px-[16px] py-[8px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer">
            Cancel
          </button>
          <button onClick={handleShare} disabled={submitting} className="px-[16px] py-[8px] text-[13px] font-[600] text-white bg-[#6366f1] border-none rounded-[8px] cursor-pointer disabled:opacity-60">
            {submitting ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
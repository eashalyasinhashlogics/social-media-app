'use client'

import { useState } from 'react'
import { postsAPI, Post } from '@/lib/api'

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
      const res = await postsAPI.share(post.id, caption.trim() || undefined)
      onShared(res.data)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to share post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-50 p-[20px]" onClick={onClose}>
      <div className="bg-white rounded-[16px] p-[20px] w-full max-w-[440px]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[16px] font-bold text-[#1a202c] mb-[12px]">Share post</h3>

        {error && (
          <div className="py-[8px] px-[12px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px] font-[500] mb-[10px]">
            {error}
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption (optional)..."
          rows={2}
          maxLength={10000}
          className="w-full resize-none border border-[#e2e8f0] rounded-[8px] p-[10px] text-[13px] outline-none focus:border-[#6366f1] mb-[10px]"
        />

        <div className="bg-[#f8fafc] rounded-[10px] p-[10px] mb-[14px] border border-[#e2e8f0]">
          <div className="text-[12px] font-[600] text-[#1a202c] mb-[2px]">{post.author_username || 'Unknown user'}</div>
          <p className="text-[12px] text-[#64748b] line-clamp-3">{post.content}</p>
        </div>

        <div className="flex gap-[8px] justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-[14px] py-[8px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={submitting}
            className="px-[14px] py-[8px] text-[13px] font-[600] text-white bg-[#6366f1] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
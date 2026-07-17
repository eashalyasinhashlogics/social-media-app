'use client'

import { useEffect, useState } from 'react'
import { commentsAPI, Comment } from '@/lib/api'

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

interface CommentSectionProps {
  postId: string
  postAuthorId: string
  currentUserId: string
  onCountChange: (count: number) => void
}

export function CommentSection({ postId, postAuthorId, currentUserId, onCountChange }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    commentsAPI.list(postId)
      .then((res) => { setComments(res.data); onCountChange(res.data.length) })
      .catch(() => setError('Failed to load comments'))
      .finally(() => setLoading(false))
  }, [postId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await commentsAPI.create(postId, draft.trim())
      const next = [...comments, res.data]
      setComments(next)
      onCountChange(next.length)
      setDraft('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return
    try {
      await commentsAPI.delete(commentId)
      const next = comments.filter((c) => c.id !== commentId)
      setComments(next)
      onCountChange(next.length)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete comment')
    }
  }

  return (
    <div className="mt-[12px] pt-[12px] border-t border-[#f1f5f9]">
      {loading && <div className="text-[12px] text-[#9ca3af] py-[8px]">Loading comments...</div>}

      {error && (
        <div className="py-[6px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px] font-[500] mb-[8px]">
          {error}
        </div>
      )}

      {!loading && comments.length === 0 && (
        <div className="text-[12px] text-[#9ca3af] py-[4px] mb-[8px]">No comments yet. Be the first to reply.</div>
      )}

      <div className="flex flex-col gap-[10px] mb-[10px]">
        {comments.map((comment) => {
          // matches the backend's real moderation rule: comment author OR post owner may delete.
          // This is UI convenience only — the backend still enforces it independently.
          const canDelete = comment.user_id === currentUserId || postAuthorId === currentUserId
          return (
            <div key={comment.id} className="flex items-start justify-between gap-[8px] bg-[#f8fafc] rounded-[10px] p-[10px]">
              <div className="min-w-0">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[12px] font-[600] text-[#1a202c]">{comment.username || 'Unknown user'}</span>
                  <span className="text-[11px] text-[#9ca3af]">{timeAgo(comment.created_at)}</span>
                </div>
                <p className="text-[13px] text-[#374151] mt-[2px] whitespace-pre-wrap break-words">{comment.content}</p>
              </div>
              {canDelete && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-[#9ca3af] hover:text-[#ef4444] bg-transparent border-none cursor-pointer text-[12px] flex-shrink-0"
                  aria-label="Delete comment"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              )}
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-[8px]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment..."
          maxLength={2000}
          className="flex-1 border border-[#e2e8f0] rounded-[8px] px-[10px] py-[8px] text-[13px] outline-none focus:border-[#6366f1]"
        />
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="px-[14px] py-[8px] text-[12px] font-[600] text-white bg-[#6366f1] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
        >
          {submitting ? '...' : 'Post'}
        </button>
      </form>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { commentsAPI, Comment } from '@/lib/api'

interface CommentSectionProps {
  postId: string
  postAuthorId: string
  currentUserId: string
  onCountChange: (count: number) => void
}

// Splits a flat comment list into top-level comments + a map of replies keyed
// by their parent's id. A reply whose parent was deleted (or never existed)
// is promoted to top-level so it never silently disappears.
function buildThreaded(comments: Comment[]) {
  const byId = new Map(comments.map((c) => [c.id, c]))
  const topLevel: Comment[] = []
  const repliesMap = new Map<string, Comment[]>()

  comments.forEach((c) => {
    if (c.parent_comment_id && byId.has(c.parent_comment_id)) {
      const list = repliesMap.get(c.parent_comment_id) || []
      list.push(c)
      repliesMap.set(c.parent_comment_id, list)
    } else {
      topLevel.push(c)
    }
  })

  return { topLevel, repliesMap }
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
  showReplyButton,
  onReplyClick,
}: {
  comment: Comment
  canDelete: boolean
  onDelete: (id: string) => void
  showReplyButton: boolean
  onReplyClick?: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-[8px]">
      <div className="flex-1">
        <span className="text-[13px] font-[600] text-[#1a202c] mr-[6px]">{comment.author_username || 'Unknown user'}</span>
        <span className="text-[13px] text-[#374151]">{comment.content}</span>
        {showReplyButton && (
          <div>
            <button
              onClick={onReplyClick}
              className="text-[11px] text-[#6366f1] font-[600] bg-transparent border-none cursor-pointer mt-[2px]"
            >
              Reply
            </button>
          </div>
        )}
      </div>
      {canDelete && (
        <button
          onClick={() => onDelete(comment.id)}
          className="text-[11px] text-[#9ca3af] hover:text-[#ef4444] bg-transparent border-none cursor-pointer shrink-0"
        >
          Delete
        </button>
      )}
    </div>
  )
}

export function CommentSection({ postId, postAuthorId, currentUserId, onCountChange }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    commentsAPI.list(postId)
      .then((res) => {
        if (cancelled) return
        setComments(res.data)
        onCountChange(res.data.length)
      })
      .catch(() => !cancelled && setError('Failed to load comments'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [postId])

  const canDelete = (c: Comment) => c.user_id === currentUserId || postAuthorId === currentUserId

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await commentsAPI.create(postId, newComment.trim())
      const updated = [...comments, res.data]
      setComments(updated)
      onCountChange(updated.length)
      setNewComment('')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddReply = async (parentId: string) => {
    if (!replyDraft.trim()) return
    setReplySubmitting(true)
    setError(null)
    try {
      const res = await commentsAPI.create(postId, replyDraft.trim(), parentId)
      const updated = [...comments, res.data]
      setComments(updated)
      onCountChange(updated.length)
      setReplyDraft('')
      setReplyingToId(null)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to post reply')
    } finally {
      setReplySubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    try {
      await commentsAPI.delete(commentId)
      const updated = comments.filter((c) => c.id !== commentId)
      setComments(updated)
      onCountChange(updated.length)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete comment')
    }
  }

  const { topLevel, repliesMap } = buildThreaded(comments)

  return (
    <div className="mt-[14px] pt-[12px] border-t border-[#f1f5f9]">
      {error && (
        <div className="mb-[8px] py-[6px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px]">
          {error}
        </div>
      )}

      {loading && <p className="text-[12px] text-[#9ca3af]">Loading comments...</p>}

      {!loading && topLevel.length === 0 && (
        <p className="text-[12px] text-[#9ca3af] mb-[10px]">No comments yet. Be the first to comment.</p>
      )}

      <div className="flex flex-col gap-[12px] mb-[10px]">
        {topLevel.map((c) => (
          <div key={c.id}>
            <CommentRow
              comment={c}
              canDelete={canDelete(c)}
              onDelete={handleDelete}
              showReplyButton={true}
              onReplyClick={() => { setReplyingToId(c.id); setReplyDraft('') }}
            />

            {replyingToId === c.id && (
              <div className="flex gap-[8px] mt-[6px] ml-[16px]">
                <input
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder={`Reply to ${c.author_username || 'this comment'}...`}
                  maxLength={2000}
                  autoFocus
                  className="flex-1 border border-[#e2e8f0] rounded-[8px] px-[10px] py-[6px] text-[12px] outline-none focus:border-[#6366f1]"
                />
                <button
                  onClick={() => handleAddReply(c.id)}
                  disabled={replySubmitting || !replyDraft.trim()}
                  className="px-[12px] py-[6px] text-[11px] font-[600] text-white bg-[#6366f1] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
                >
                  Reply
                </button>
                <button
                  onClick={() => { setReplyingToId(null); setReplyDraft('') }}
                  className="px-[12px] py-[6px] text-[11px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {(repliesMap.get(c.id) || []).length > 0 && (
              <div className="mt-[8px] ml-[16px] pl-[12px] border-l-[2px] border-[#f1f5f9] flex flex-col gap-[8px]">
                {(repliesMap.get(c.id) || []).map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    canDelete={canDelete(reply)}
                    onDelete={handleDelete}
                    showReplyButton={false}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleAddComment} className="flex gap-[8px]">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          maxLength={2000}
          className="flex-1 border border-[#e2e8f0] rounded-[8px] px-[10px] py-[7px] text-[13px] outline-none focus:border-[#6366f1]"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="px-[14px] py-[7px] text-[12px] font-[600] text-white bg-[#6366f1] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  )
}
'use client'

import { useState } from 'react'
import { postsAPI, Post } from '@/lib/api'
import { CommentSection } from '@/components/CommentSection'
import { ShareModal } from '@/components/ShareModal'

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

interface PostCardProps {
  post: Post
  currentUserId: string
  onUpdated: (post: Post) => void
  onDeleted: (postId: string) => void
  onShared: (share: Post) => void
}

export function PostCard({ post, currentUserId, onUpdated, onDeleted, onShared }: PostCardProps) {
  const isOwner = post.author_id === currentUserId

  // ── Edit / delete / archive (baseline post-owner controls) ──
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(post.content)
  const [editSaving, setEditSaving] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const handleSaveEdit = async () => {
    if (!editDraft.trim()) return
    setEditSaving(true)
    setRowError(null)
    try {
      const res = await postsAPI.update(post.id, editDraft.trim())
      onUpdated(res.data)
      setEditing(false)
    } catch (err: any) {
      setRowError(err.response?.data?.detail || 'Failed to save changes')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await postsAPI.delete(post.id)
      onDeleted(post.id)
    } catch (err: any) {
      setRowError(err.response?.data?.detail || 'Failed to delete post')
    }
  }

  const handleToggleArchive = async () => {
    try {
      const res = post.status === 'archived'
        ? await postsAPI.unarchive(post.id)
        : await postsAPI.archive(post.id)
      onUpdated(res.data)
    } catch (err: any) {
      setRowError(err.response?.data?.detail || 'Failed to update post status')
    } finally {
      setMenuOpen(false)
    }
  }

  // ── F5: likes ──
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [likeBusy, setLikeBusy] = useState(false)

  const handleToggleLike = async () => {
    if (likeBusy) return
    const prevLiked = liked
    const prevCount = likeCount
    setLiked(!prevLiked)
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1)
    setLikeBusy(true)
    try {
      const res = await postsAPI.toggleLike(post.id)
      setLiked(res.data.liked)
      setLikeCount(res.data.like_count)
      onUpdated({ ...post, liked_by_me: res.data.liked, like_count: res.data.like_count })
    } catch {
      setLiked(prevLiked)
      setLikeCount(prevCount)
    } finally {
      setLikeBusy(false)
    }
  }

  // ── F6: comments ──
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count)

  // ── F8: share ──
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-[18px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] mb-[16px]">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-[10px]">
          <img
            src={'https://api.dicebear.com/7.x/initials/svg?seed=' + (post.author_username || post.author_id)}
            className="w-[40px] h-[40px] rounded-full object-cover border border-[#e2e8f0]"
            alt={`${post.author_username || 'Unknown'} avatar`}
          />
          <div>
            <div className="flex items-center gap-[6px]">
              <span className="text-[14px] font-[700] text-[#1a202c]">{post.author_username || 'Unknown user'}</span>
              {post.status === 'archived' && (
                <span className="text-[10px] font-[600] text-[#9ca3af] bg-[#f1f5f9] px-[8px] py-[2px] rounded-full">Archived</span>
              )}
            </div>
            <span className="text-[11px] text-[#9ca3af]">{timeAgo(post.created_at)}</span>
          </div>
        </div>

        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-[#9ca3af] hover:text-[#374151] bg-transparent border-none cursor-pointer text-[14px] p-[4px]"
              aria-label="Post options"
            >
              <i className="fa-solid fa-ellipsis"></i>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[28px] bg-white border border-[#e2e8f0] rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.08)] z-10 min-w-[140px] py-[4px]">
                <button
                  onClick={() => { setEditing(true); setEditDraft(post.content); setMenuOpen(false) }}
                  className="w-full text-left px-[12px] py-[8px] text-[13px] text-[#374151] hover:bg-[#f8fafc] bg-transparent border-none cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={handleToggleArchive}
                  className="w-full text-left px-[12px] py-[8px] text-[13px] text-[#374151] hover:bg-[#f8fafc] bg-transparent border-none cursor-pointer"
                >
                  {post.status === 'archived' ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); handleDelete() }}
                  className="w-full text-left px-[12px] py-[8px] text-[13px] text-[#ef4444] hover:bg-[#fef2f2] bg-transparent border-none cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {rowError && (
        <div className="mt-[8px] py-[6px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px] font-[500]">
          {rowError}
        </div>
      )}

      {/* Content / edit mode */}
      {editing ? (
        <div className="mt-[10px]">
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={3}
            maxLength={10000}
            className="w-full resize-none border border-[#e2e8f0] rounded-[8px] p-[10px] text-[14px] outline-none focus:border-[#6366f1] mb-[8px]"
          />
          <div className="flex gap-[8px]">
            <button
              onClick={handleSaveEdit}
              disabled={editSaving || !editDraft.trim()}
              className="px-[14px] py-[6px] text-[12px] font-[600] text-white bg-[#6366f1] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
            >
              {editSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-[14px] py-[6px] text-[12px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-[10px] text-[14px] text-[#1a202c] whitespace-pre-wrap break-words">{post.content}</p>
      )}

      {/* F8: quoted original post (only null-vs-empty distinguishes a deleted source) */}
      {post.original_post_id && (
        <div className="mt-[10px] border border-[#e2e8f0] rounded-[10px] p-[10px] bg-[#f8fafc]">
          {post.original_content !== null ? (
            <>
              <div className="text-[12px] font-[600] text-[#1a202c] mb-[2px]">
                {post.original_author_username || 'Unknown user'}
              </div>
              <p className="text-[13px] text-[#374151] whitespace-pre-wrap">{post.original_content}</p>
            </>
          ) : (
            <p className="text-[12px] text-[#9ca3af] italic">Original post unavailable</p>
          )}
        </div>
      )}

      {/* F7: attached image */}
      {post.media_url && (
        <img
          src={post.media_url}
          alt="Post attachment"
          className="mt-[10px] rounded-[10px] max-h-[420px] w-full object-cover border border-[#e2e8f0]"
        />
      )}

      {/* F5/F6/F8: stats row */}
      <div className="flex items-center gap-[20px] mt-[14px] pt-[12px] border-t border-[#f1f5f9] text-[13px] text-[#64748b]">
        <button
          onClick={handleToggleLike}
          disabled={likeBusy}
          className={`bg-transparent border-none cursor-pointer flex items-center gap-[4px] text-[13px] transition-colors duration-150 ease disabled:opacity-60 ${liked ? 'text-[#ef4444] font-[600]' : 'text-[#64748b] hover:text-[#ef4444]'}`}
        >
          <i className={liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
          <span>{likeCount}</span>
        </button>
        <button
          onClick={() => setCommentsOpen(!commentsOpen)}
          className="bg-transparent border-none cursor-pointer flex items-center gap-[4px] text-[13px] text-[#64748b] hover:text-[#6366f1] transition-colors duration-150 ease"
        >
          💬 <span>{commentCount}</span>
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="bg-transparent border-none cursor-pointer flex items-center gap-[4px] text-[13px] text-[#64748b] hover:text-[#10b981] transition-colors duration-150 ease"
        >
          ↻ <span>{post.share_count}</span>
        </button>
      </div>

      {/* F6: comments */}
      {commentsOpen && (
        <CommentSection
          postId={post.id}
          postAuthorId={post.author_id}
          currentUserId={currentUserId}
          onCountChange={setCommentCount}
        />
      )}

      {/* F8: share modal */}
      {shareOpen && (
        <ShareModal
          post={post}
          onClose={() => setShareOpen(false)}
          onShared={(share) => {
            onShared(share)
          }}
        />
      )}
    </div>
  )
}
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { postsAPI, Post, extractErrorMessage, resolveMediaUrl } from '@/lib/api'
import { CommentSection } from '@/components/CommentSection'
import { ShareModal } from '@/components/ShareModal'

// Bug fix: the backend now serializes created_at/updated_at with an
// explicit UTC offset (e.g. "...+00:00"), which `new Date(...)` parses
// correctly on its own. The fallback branch below is defense-in-depth
// for any timestamp that somehow arrives without an offset (e.g. an
// older cached response) - it's treated as UTC instead of the browser's
// local timezone, which was the root cause of "wrong" times before.
function timeAgo(dateString: string): string {
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(dateString)
  const normalized = hasOffset ? dateString : `${dateString}Z`
  const diffMs = Date.now() - new Date(normalized).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

// A username on a post always links to that author's profile - their
// own profile page if it's the viewer's own post, otherwise the public
// profile route.
function profileHref(authorId: string, currentUserId: string): string {
  return authorId === currentUserId ? '/profile' : `/profile/${authorId}`
}

// Compact count formatting for the stats row, e.g. 1800 -> "1.8K".
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function pluralize(n: number, word: string): string {
  return `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`
}

const CONTENT_TRUNCATE_LENGTH = 220

type PostWithPresence = Post & {
  // Optional additions on top of the existing Post type - safe to omit.
  // Falls back to just the username / no dot if your API doesn't send
  // these yet. Wire these up on the backend to get the "@handle" and
  // green online indicator shown in the mockup. `author_avatar_url`
  // itself now comes from the base Post type.
  author_display_name?: string
  author_is_online?: boolean
}

interface PostCardProps {
  post: PostWithPresence
  currentUserId: string
  onUpdated: (post: Post) => void
  onDeleted: (postId: string) => void
  onShared: (share: Post) => void
}

export function PostCard({ post, currentUserId, onUpdated, onDeleted, onShared }: PostCardProps) {
  const isOwner = String(post.author_id) === String(currentUserId)

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
      setRowError(extractErrorMessage(err, 'Failed to save changes'))
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
      setRowError(extractErrorMessage(err, 'Failed to delete post'))
    }
  }

  const handleToggleArchive = async () => {
    try {
      const res = post.status === 'archived'
        ? await postsAPI.unarchive(post.id)
        : await postsAPI.archive(post.id)
      onUpdated(res.data)
    } catch (err: any) {
      setRowError(extractErrorMessage(err, 'Failed to update post status'))
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

  // ── Header: display name / handle / online status ──
  const displayName = post.author_display_name || post.author_username || 'Unknown user'
  const isOnline = post.author_is_online === true

  // ── Read more / less ──
  const [expanded, setExpanded] = useState(false)
  const isLongContent = post.content.length > CONTENT_TRUNCATE_LENGTH
  const displayContent = expanded || !isLongContent ? post.content : post.content.slice(0, CONTENT_TRUNCATE_LENGTH)

  // ── Save (bookmark) - UI-only until postsAPI exposes a save/unsave call ──
  const [saved, setSaved] = useState(false)

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-[16px] p-[18px] shadow-sm mb-[16px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-[10px]">
          <Link href={profileHref(post.author_id, currentUserId)} className="relative shrink-0">
            <img
              src={'https://api.dicebear.com/7.x/initials/svg?seed=' + (post.author_username || post.author_id)}
              className="w-[40px] h-[40px] rounded-full object-cover border border-[#e2e8f0] cursor-pointer"
              alt={`${post.author_username || 'Unknown'} avatar`}
            />
            {isOnline && (
              <span
                className="absolute bottom-0 right-0 w-[11px] h-[11px] bg-[#22c55e] border-[2px] border-white rounded-full"
                aria-hidden="true"
              ></span>
            )}
          </Link>
          <div>
            <div className="flex flex-col gap-y-[2px]">
              <Link
                href={profileHref(post.author_id, currentUserId)}
                className="text-[14px] font-[700] text-[#1a202c] no-underline"
              >
                {displayName}
              </Link>
              <div className="flex items-center flex-wrap gap-x-[6px] gap-y-[2px] text-[13px] text-[#9ca3af]">
                <span>@{post.author_username}</span>
                <span>· {timeAgo(post.created_at)}</span>
                {post.status === 'archived' && (
                  <span className="text-[10px] font-[600] bg-[#f1f5f9] px-[8px] py-[2px] rounded-full">Archived</span>
                )}
              </div>
            </div>
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
        <p className="mt-[10px] text-[14px] text-[#1a202c] whitespace-pre-wrap break-words">
          {displayContent}
          {isLongContent && !expanded && (
            <>
              {'... '}
              <button
                onClick={() => setExpanded(true)}
                className="text-[#6366f1] bg-transparent border-none cursor-pointer p-0 text-[14px] hover:underline"
              >
                more
              </button>
            </>
          )}
          {isLongContent && expanded && (
            <>
              {' '}
              <button
                onClick={() => setExpanded(false)}
                className="text-[#6366f1] bg-transparent border-none cursor-pointer p-0 text-[14px] hover:underline"
              >
                less
              </button>
            </>
          )}
        </p>
      )}

      {/* F8: quoted original post (only null-vs-empty distinguishes a deleted source) */}
      {post.original_post_id && (
        <div className="mt-[10px] border border-[#e2e8f0] rounded-[10px] p-[10px] bg-white">
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

      {post.media && post.media.length > 0 && (
        <div className="mt-[10px]">
          {post.media.map((m) =>
            m.media_type === 'video' ? (
              <video
                key={m.id}
                src={resolveMediaUrl(m.url)}
                controls
                className="rounded-[10px] max-h-[420px] w-full object-cover border border-[#e2e8f0]"
              />
            ) : (
              <img
                key={m.id}
                src={resolveMediaUrl(m.url)}
                alt="Post attachment"
                className="rounded-[10px] max-h-[420px] w-full object-cover border border-[#e2e8f0]"
              />
            )
          )}
        </div>
      )}

      {/* Stats summary: likes / comments / shares */}
      <div className="flex items-center justify-between mt-[14px] pt-[12px] border-t border-[#f1f5f9] text-[13px] text-[#64748b]">
        <span>{pluralize(likeCount, 'like')}</span>
        <span className="flex items-center gap-[14px]">
          <span>{pluralize(commentCount, 'comment')}</span>
          <span>{pluralize(post.share_count, 'share')}</span>
        </span>
      </div>

      {/* Action buttons: Like / Comment / Share / Save */}
      <div className="flex items-center justify-between gap-[8px] mt-[6px] pt-[6px] border-t border-[#f1f5f9]">
        <button
          onClick={handleToggleLike}
          disabled={likeBusy}
          className={`flex items-center justify-center gap-[6px] py-[8px] rounded-[8px] bg-transparent border-none cursor-pointer text-[13px] font-[600] transition-colors duration-150 ease hover:bg-[#f8fafc] disabled:opacity-60 ${liked ? 'text-[#ef4444]' : 'text-[#64748b] hover:text-[#ef4444]'}`}
        >
          <i className={liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
          <span>Like</span>
        </button>
        <button
          onClick={() => setCommentsOpen(!commentsOpen)}
          className="flex items-center justify-center gap-[6px] py-[8px] rounded-[8px] bg-transparent border-none cursor-pointer text-[13px] font-[600] text-[#64748b] hover:bg-[#f8fafc] hover:text-[#6366f1] transition-colors duration-150 ease"
        >
          <i className="fa-regular fa-comment"></i>
          <span>Comment</span>
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className="flex items-center justify-center gap-[6px] py-[8px] rounded-[8px] bg-transparent border-none cursor-pointer text-[13px] font-[600] text-[#64748b] hover:bg-[#f8fafc] hover:text-[#10b981] transition-colors duration-150 ease"
        >
          <i className="fa-solid fa-share-nodes"></i>
          <span>Share</span>
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
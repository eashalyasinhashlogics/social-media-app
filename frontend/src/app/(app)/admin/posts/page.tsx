'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { adminAPI, extractErrorMessage, resolveMediaUrl, Post } from '@/lib/api'
import { AdminToast, ToastState } from '@/components/admin/AdminToast'

const PAGE_SIZE = 20

const STATUS_OPTIONS = ['', 'active', 'archived', 'deleted'] as const

const SELECT_CLASSES =
  'px-[12px] py-[8px] text-[13px] font-[500] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] outline-none focus:border-[#5B52E7] cursor-pointer'

const INPUT_CLASSES =
  'px-[12px] py-[8px] text-[13px] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] outline-none focus:border-[#5B52E7] w-full sm:w-[240px]'

const OUTLINE_BTN =
  'px-[12px] py-[6px] text-[12px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-50 disabled:cursor-not-allowed'

const DANGER_BTN =
  'px-[12px] py-[6px] text-[12px] font-[600] text-[#ef4444] bg-white border border-[#fecaca] rounded-[8px] cursor-pointer hover:bg-[#fef2f2] disabled:opacity-50 disabled:cursor-not-allowed'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-[#dcfce7] text-[#166534]',
    archived: 'bg-[#fef9c3] text-[#854d0e]',
    deleted: 'bg-[#fef2f2] text-[#991b1b]',
  }
  return (
    <span className={`text-[11px] font-[700] px-[8px] py-[2px] rounded-full capitalize ${styles[status] || 'bg-[#f1f5f9] text-[#64748b]'}`}>
      {status}
    </span>
  )
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function AdminPostRow({
  post,
  busy,
  onSave,
  onDelete,
}: {
  post: Post
  busy: boolean
  onSave: (postId: string, content: string) => Promise<void>
  onDelete: (postId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.content)
  const [rowError, setRowError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!draft.trim()) return
    setRowError(null)
    try {
      await onSave(post.id, draft.trim())
      setEditing(false)
    } catch (err: any) {
      setRowError(extractErrorMessage(err, 'Failed to save changes.'))
    }
  }

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-[16px] mb-[10px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div className="flex items-center gap-[10px] min-w-0">
          <img
            src={
              resolveMediaUrl(post.author_avatar_url) ||
              'https://api.dicebear.com/7.x/initials/svg?seed=' + (post.author_username || post.author_id)
            }
            alt=""
            className="w-[32px] h-[32px] rounded-full object-cover border border-[#e2e8f0] shrink-0"
          />
          <div className="min-w-0">
            <Link
              href={`/profile/${post.author_id}`}
              className="text-[13px] font-[700] text-[#1a202c] no-underline hover:underline"
            >
              {post.author_username || 'Unknown user'}
            </Link>
            <div className="text-[11px] text-[#94a3b8]">{formatDate(post.created_at)}</div>
          </div>
        </div>
        <div className="flex items-center gap-[8px] shrink-0">
          <StatusBadge status={post.status} />
        </div>
      </div>

      {rowError && (
        <div className="mt-[8px] py-[6px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px]">
          {rowError}
        </div>
      )}

      {editing ? (
        <div className="mt-[10px]">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={10000}
            className="w-full resize-none border border-[#e2e8f0] rounded-[8px] p-[10px] text-[14px] outline-none focus:border-[#5B52E7] mb-[8px]"
          />
          <div className="flex gap-[8px]">
            <button type="button" onClick={handleSave} disabled={busy || !draft.trim()} className={OUTLINE_BTN}>
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(post.content)
                setEditing(false)
              }}
              disabled={busy}
              className={OUTLINE_BTN}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-[10px] text-[14px] text-[#1a202c] whitespace-pre-wrap break-words">{post.content}</p>
      )}

      <div className="flex items-center justify-between mt-[12px] pt-[10px] border-t border-[#f1f5f9] flex-wrap gap-[8px]">
        <span className="text-[12px] text-[#64748b]">
          {post.like_count} likes · {post.comment_count} comments · {post.share_count} shares
        </span>
        {!editing && post.status !== 'deleted' && (
          <div className="flex gap-[8px]">
            <button type="button" onClick={() => setEditing(true)} className={OUTLINE_BTN}>
              Edit
            </button>
            <button type="button" onClick={() => onDelete(post.id)} disabled={busy} className={DANGER_BTN}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [authorIdFilter, setAuthorIdFilter] = useState('')
  const [authorIdInput, setAuthorIdInput] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.listPosts({
        skip,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        author_id: authorIdFilter || undefined,
      })
      setPosts(res.data.items)
      setTotal(res.data.total)
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load posts.'))
    } finally {
      setLoading(false)
    }
  }, [skip, statusFilter, authorIdFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value)
    setSkip(0)
  }

  const handleAuthorFilterSubmit = () => {
    setAuthorIdFilter(authorIdInput.trim())
    setSkip(0)
  }

  const handleSave = async (postId: string, content: string) => {
    setBusyId(postId)
    try {
      const res = await adminAPI.updatePost(postId, content)
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.data : p)))
      setToast({ message: 'Post updated.', variant: 'success' })
    } catch (err: any) {
      setToast({ message: extractErrorMessage(err, 'Could not save post.'), variant: 'error' })
      throw err
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (postId: string) => {
    if (!window.confirm('Delete this post? This cannot be undone from here.')) return
    setBusyId(postId)
    try {
      const res = await adminAPI.deletePost(postId)
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.data : p)))
      setToast({ message: 'Post deleted.', variant: 'success' })
    } catch (err: any) {
      setToast({ message: extractErrorMessage(err, 'Could not delete post.'), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const from = total === 0 ? 0 : skip + 1
  const to = Math.min(skip + PAGE_SIZE, total)
  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div>
      <div className="flex items-center justify-between mb-[20px] flex-wrap gap-[10px]">
        <h1 className="text-[20px] font-[800] text-[#0f172a]">Posts</h1>
        <div className="flex items-center gap-[8px] flex-wrap">
          <input
            value={authorIdInput}
            onChange={(e) => setAuthorIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuthorFilterSubmit()}
            placeholder="Filter by author id..."
            className={INPUT_CLASSES}
          />
          <button type="button" onClick={handleAuthorFilterSubmit} className={OUTLINE_BTN}>
            Apply
          </button>
          <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value)} className={SELECT_CLASSES}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All statuses' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading posts...</div>}

      {!loading && error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px]">
          {error}
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="text-center text-[#64748b] text-[14px] py-[40px]">No posts match these filters.</div>
      )}

      {!loading && !error && posts.length > 0 && (
        <>
          {posts.map((post) => (
            <AdminPostRow key={post.id} post={post} busy={busyId === post.id} onSave={handleSave} onDelete={handleDelete} />
          ))}

          <div className="flex items-center justify-between mt-[6px] flex-wrap gap-[10px]">
            <span className="text-[13px] text-[#64748b]">
              Showing {from}-{to} of {total}
            </span>
            <div className="flex gap-[8px]">
              <button type="button" onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))} disabled={!canPrev} className={OUTLINE_BTN}>
                Previous
              </button>
              <button type="button" onClick={() => setSkip((s) => s + PAGE_SIZE)} disabled={!canNext} className={OUTLINE_BTN}>
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
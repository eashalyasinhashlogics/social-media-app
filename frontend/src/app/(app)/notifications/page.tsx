'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import {
  notificationsAPI,
  friendsAPI,
  followAPI,
  extractErrorMessage,
  parseServerDate,
  resolveMediaUrl,
  Notification,
} from '@/lib/api'

// Inline hex, not Tailwind classes — Tailwind's JIT scanner can't see
// class names built from a JS object at runtime, so bg-rose-500 etc.
// get purged from the shipped CSS. Hex avoids that entirely.
const TYPE_ICON: Record<Notification['type'], { icon: string; bg: string }> = {
  like: { icon: 'fa-heart', bg: '#F43F5E' },          // rose
  comment: { icon: 'fa-comment', bg: '#06B6D4' },     // cyan
  reply: { icon: 'fa-reply', bg: '#06B6D4' },         // cyan
  follow: { icon: 'fa-user-plus', bg: '#8B5CF6' },    // violet
  friend_request: { icon: 'fa-user-plus', bg: '#8B5CF6' },
  friend_accept: { icon: 'fa-user-check', bg: '#10B981' }, // emerald
}

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - parseServerDate(dateString).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function messageFor(n: Notification): string {
  switch (n.type) {
    case 'like':
      return 'liked your recent post'
    case 'comment':
      return 'commented on your post'
    case 'reply':
      return 'replied to your comment'
    case 'follow':
      return 'started following you'
    case 'friend_request':
      return 'sent you a friend request'
    case 'friend_accept':
      return 'accepted your friend request'
    default:
      return ''
  }
}

// NOTE: There is no /posts/[id] route in this app yet (confirmed 404),
// so like/comment/reply notifications route to the actor's profile for
// now instead of a post detail page. Swap the `like`/`comment`/`reply`
// branch below to `/posts/${n.post_id}` (or whatever your real post
// route ends up being) once that page exists.
function destinationFor(n: Notification): string | null {
  switch (n.type) {
    case 'like':
    case 'comment':
    case 'reply':
      return n.actor ? `/profile/${n.actor.id}` : null
    case 'follow':
    case 'friend_accept':
    case 'friend_request':
      return n.actor ? `/profile/${n.actor.id}` : null
    default:
      return null
  }
}

export default function NotificationsPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await notificationsAPI.list(0, 50)
      setItems(res.data)
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load notifications.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    load()
    notificationsAPI.markAllRead().catch(() => {})
  }, [user, load])

  const handleRowClick = (n: Notification) => {
    if (!n.is_read) {
      notificationsAPI.markRead(n.id).catch(() => {})
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)))
    }
    const dest = destinationFor(n)
    if (dest) router.push(dest)
  }

  const handleAccept = async (e: React.MouseEvent, n: Notification) => {
    e.stopPropagation()
    if (!n.friend_request_id) return
    setBusyId(n.id)
    setActionError(null)
    try {
      await friendsAPI.accept(n.friend_request_id)
      setItems((prev) => prev.filter((i) => i.id !== n.id))
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Could not accept request.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (e: React.MouseEvent, n: Notification) => {
    e.stopPropagation()
    if (!n.friend_request_id) return
    setBusyId(n.id)
    setActionError(null)
    try {
      await friendsAPI.reject(n.friend_request_id)
      setItems((prev) => prev.filter((i) => i.id !== n.id))
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Could not reject request.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleFollowBack = async (e: React.MouseEvent, n: Notification) => {
    e.stopPropagation()
    if (!n.actor) return
    setBusyId(n.id)
    setActionError(null)
    try {
      await followAPI.follow(n.actor.id)
      setFollowedIds((prev) => new Set(prev).add(n.actor!.id))
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Could not follow user.'))
    } finally {
      setBusyId(null)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-[600px] mx-auto">
      <h1 className="text-[20px] font-[800] text-[#ffffff] mb-[20px]">Notifications</h1>

      {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading...</div>}

      {error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px] mb-[16px]">
          {error}
        </div>
      )}

      {actionError && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px] mb-[16px]">
          {actionError}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-[80px]">
          <div className="w-[64px] h-[64px] rounded-full bg-[#EEF2FF] text-[#5B52E7] flex items-center justify-center mx-auto mb-[16px] text-[24px]">
            <i className="fa-solid fa-bell"></i>
          </div>
          <h2 className="text-[20px] font-[700] text-[#ffffff] mb-[8px]">Notifications</h2>
          <p className="text-[14px] text-[#64748b]">You're all caught up.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-sm p-[24px]">
          <div className="text-[11px] font-[700] tracking-wider text-[#94a3b8] uppercase mb-[8px]">Today</div>
          <div className="flex flex-col divide-y divide-[#f1f5f9]">
            {items.map((n) => {
              const badge = TYPE_ICON[n.type]
              const actorName = n.actor?.username || 'Someone'
              const alreadyFollowed = n.actor ? followedIds.has(n.actor.id) : false
              const clickable = destinationFor(n) !== null

              return (
                <div
                  key={n.id}
                  onClick={() => handleRowClick(n)}
                  className={`py-[16px] flex items-center justify-between gap-[12px] first:pt-0 last:pb-0 ${
                    clickable ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-center gap-[16px] min-w-0">
                    {/* Extra bottom margin makes room for the badge to overlap the avatar's bottom edge without clipping */}
                    <div className="relative flex-shrink-0 mb-[10px]">
                      <img
                        src={
                          resolveMediaUrl(n.actor?.avatar_url || null) ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${actorName}`
                        }
                        alt=""
                        className={`w-[56px] h-[56px] rounded-full object-cover ${
                          !n.is_read ? 'ring-[3px] ring-offset-2' : 'border border-[#e2e8f0]'
                        }`}
                        style={!n.is_read ? ({ '--tw-ring-color': badge.bg } as React.CSSProperties) : undefined}
                      />
                      <div
                        className="absolute left-1/2 -bottom-[10px] -translate-x-1/2 w-[26px] h-[26px] rounded-full flex items-center justify-center border-[3px] border-white text-[12px] text-white"
                        style={{ backgroundColor: badge.bg }}
                      >
                        <i className={`fa-solid ${badge.icon}`}></i>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] text-[#1e293b] leading-snug">
                        {n.actor ? (
                          <Link
                            href={`/profile/${n.actor.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-[700] text-[#0f172a] no-underline hover:underline"
                          >
                            {actorName}
                          </Link>
                        ) : (
                          <span className="font-[700] text-[#0f172a]">FOMO</span>
                        )}{' '}
                        {messageFor(n)}
                      </div>
                      {n.comment_preview && (
                        <div className="text-[13px] text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] rounded-[8px] px-[10px] py-[4px] mt-[4px] truncate max-w-[320px]">
                          "{n.comment_preview}"
                        </div>
                      )}
                      {!n.comment_preview && n.post_preview && (
                        <div className="text-[12px] text-[#94a3b8] mt-[2px] truncate max-w-[320px]">
                          "{n.post_preview}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-[10px] flex-shrink-0">
                    {n.type === 'follow' && n.actor && (
                      <button
                        onClick={(e) => handleFollowBack(e, n)}
                        disabled={busyId === n.id || alreadyFollowed}
                        className="px-[16px] py-[7px] text-[13px] font-[600] text-white bg-[#5B52E7] border-none rounded-[8px] cursor-pointer hover:bg-[#4C43D4] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {alreadyFollowed ? 'Following' : 'Follow'}
                      </button>
                    )}
                    {n.type === 'friend_request' && n.friend_request_id && (
                      <>
                        <button
                          onClick={(e) => handleAccept(e, n)}
                          disabled={busyId === n.id}
                          className="px-[14px] py-[7px] text-[13px] font-[600] text-white bg-[#5B52E7] border-none rounded-[8px] cursor-pointer hover:bg-[#4C43D4] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {busyId === n.id ? '...' : 'Accept'}
                        </button>
                        <button
                          onClick={(e) => handleReject(e, n)}
                          disabled={busyId === n.id}
                          className="px-[14px] py-[7px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <span className="text-[12px] text-[#94a3b8] whitespace-nowrap">{timeAgo(n.created_at)}</span>
                    {!n.is_read && <div className="w-[8px] h-[8px] bg-cyan-500 rounded-full"></div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
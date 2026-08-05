'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { conversationsAPI, profileAPI, extractErrorMessage, resolveMediaUrl, Conversation } from '@/lib/api'

interface ResolvedUser {
  id: string
  username: string
  avatarUrl: string | null
}

function timeAgo(dateString: string): string {
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(dateString)
  const normalized = hasOffset ? dateString : `${dateString}Z`
  const diffMs = Date.now() - new Date(normalized).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  return `${Math.floor(diffHours / 24)}d`
}

export default function MessagesPage() {
  const { user } = useAuthStore()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [userCache, setUserCache] = useState<Record<string, ResolvedUser>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const otherParticipantId = useCallback(
    (conv: Conversation) => conv.participant_ids.find((id) => id !== user?.id) || conv.participant_ids[0],
    [user?.id]
  )

  const resolveUsers = useCallback((userIds: string[]) => {
    setUserCache((prevCache) => {
      const unresolved = Array.from(new Set(userIds)).filter((id) => !prevCache[id])
      if (unresolved.length === 0) return prevCache

      Promise.all(
        unresolved.map((id) =>
          profileAPI
            .getPublicProfile(id)
            .then((res) => [id, { id, username: res.data.username, avatarUrl: res.data.avatar_url }] as const)
            .catch(() => [id, { id, username: 'Unknown user', avatarUrl: null }] as const)
        )
      ).then((results) => {
        setUserCache((prev) => {
          const next = { ...prev }
          for (const [id, resolved] of results) next[id] = resolved
          return next
        })
      })

      return prevCache
    })
  }, [])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    conversationsAPI
      .list()
      .then((res) => {
        setConversations(res.data)
        resolveUsers(res.data.map((c) => otherParticipantId(c)))
      })
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load conversations.')))
      .finally(() => setLoading(false))
  }, [user, resolveUsers, otherParticipantId])

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((conv) => {
      const other = userCache[otherParticipantId(conv)]
      const nameMatch = other?.username?.toLowerCase().includes(q)
      const previewMatch = conv.last_message?.content?.toLowerCase().includes(q)
      return nameMatch || previewMatch
    })
  }, [conversations, search, userCache, otherParticipantId])

  if (!user) return null

  return (
    <div className="max-w-[600px] mx-auto">
      <h1 className="text-[20px] font-[800] text-[#0f172a] mb-[20px]">Messages</h1>

      <div className="flex items-center gap-[10px] bg-[#f1f5f9] rounded-[12px] px-[14px] py-[10px] mb-[16px]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search messages..."
          className="w-full border-none bg-transparent outline-none text-[14px] text-[#334155] placeholder:text-[#94a3b8]"
        />
      </div>

      {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading conversations...</div>}

      {error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px] mb-[16px]">
          {error}
        </div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="text-center text-[#64748b] text-[14px] py-[40px]">
          No conversations yet. Message a friend to get started.
        </div>
      )}

      {!loading && !error && conversations.length > 0 && filteredConversations.length === 0 && (
        <div className="text-center text-[#64748b] text-[14px] py-[40px]">No conversations match your search.</div>
      )}

      {!loading && !error && filteredConversations.length > 0 && (
        <div className="flex flex-col">
          {filteredConversations.map((conv) => {
            const otherId = otherParticipantId(conv)
            const other = userCache[otherId]
            const avatarSrc = resolveMediaUrl(other?.avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${other?.username || otherId}`
            return (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}?otherUserId=${otherId}&otherUsername=${encodeURIComponent(other?.username || '')}`}
                onClick={() => {
                  setConversations((prev) =>
                    prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
                  )
                }}
                className="flex items-center gap-[12px] px-[16px] py-[14px] no-underline hover:bg-[#f8fafc] rounded-[12px] transition-colors"
              >
                <img
                  src={avatarSrc}
                  alt=""
                  className="w-[44px] h-[44px] rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-[8px] mb-[4px]">
                    <span className="text-[14px] font-[700] text-[#0f172a] truncate">
                      {other?.username || 'Loading...'}
                    </span>
                    {conv.last_message_at && (
                      <span className="text-[12px] text-[#94a3b8] flex-shrink-0">{timeAgo(conv.last_message_at)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-[8px]">
                    <p className="text-[13px] text-[#94a3b8] truncate m-0">
                      {conv.last_message ? conv.last_message.content : 'No messages yet'}
                    </p>
                    {conv.unread_count > 0 && (
                      <span
                        className="w-[18px] h-[18px] rounded-full bg-[#06b6d4] text-[11px] font-[700] flex items-center justify-center flex-shrink-0"
                        style={{ color: '#ffffff' }}
                      >
                        {conv.unread_count > 99 ? '99+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
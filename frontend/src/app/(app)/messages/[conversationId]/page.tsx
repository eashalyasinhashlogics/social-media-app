'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import {
  conversationsAPI,
  profileAPI,
  getChatWsUrl,
  extractErrorMessage,
  parseServerDate,
  resolveMediaUrl,
  Message,
  MessageReaction,
  MessageAttachment,
} from '@/lib/api'
import { MessageBubble } from '@/components/Messagebubble'

function sortByTime(list: Message[]): Message[] {
  return [...list].sort((a, b) => parseServerDate(a.created_at).getTime() - parseServerDate(b.created_at).getTime())
}

interface WsMessagePayload {
  type: 'message'
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}
interface WsMessageUpdatedPayload {
  type: 'message_updated'
  id: string
  conversation_id: string
  content: string
  updated_at?: string
}
interface WsMessageDeletedPayload {
  type: 'message_deleted'
  id: string
  conversation_id: string
}
interface WsReactionPayload {
  type: 'reaction_updated'
  id: string
  conversation_id: string
  reactions: MessageReaction[]
}
interface WsErrorPayload {
  type: 'error'
  detail: string
}
type WsPayload = WsMessagePayload | WsMessageUpdatedPayload | WsMessageDeletedPayload | WsReactionPayload | WsErrorPayload

const POLL_INTERVAL_MS = 5000

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()

  const [otherUserId, setOtherUserId] = useState<string | null>(searchParams.get('otherUserId'))
  const [otherUsername, setOtherUsername] = useState<string | null>(searchParams.get('otherUsername'))
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [editedMessageIds, setEditedMessageIds] = useState<Set<string>>(new Set())

  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!user || otherUserId) return
    conversationsAPI.list(0, 100).then((res) => {
      const conv = res.data.find((c) => c.id === conversationId)
      const otherId = conv?.participant_ids.find((id) => id !== user.id)
      if (!otherId) return
      setOtherUserId(otherId)
    })
  }, [user, otherUserId, conversationId])

  useEffect(() => {
    if (!otherUserId) return
    profileAPI
      .getPublicProfile(otherUserId)
      .then((res) => {
        setOtherAvatarUrl(res.data.avatar_url)
        setOtherUsername((prev) => prev || res.data.username)
      })
      .catch(() => {})
  }, [otherUserId])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    conversationsAPI
      .messages(conversationId)
      .then((res) => setMessages(sortByTime(res.data)))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load messages.')))
      .finally(() => setLoading(false))

    conversationsAPI.markRead(conversationId).catch(() => {})
  }, [user, conversationId])

  useEffect(() => {
    if (!user) return

    const poll = () => {
      conversationsAPI
        .messages(conversationId)
        .then((res) => {
          const serverList = sortByTime(res.data)
          setMessages((prev) => {
            const hasNewIncoming = serverList.some(
              (m) => m.sender_id !== user.id && !prev.some((pm) => pm.id === m.id)
            )
            if (hasNewIncoming) conversationsAPI.markRead(conversationId).catch(() => {})

            const serverIds = new Set(serverList.map((m) => m.id))
            const localOnly = prev.filter((m) => !serverIds.has(m.id))
            return sortByTime([...serverList, ...localOnly])
          })
        })
        .catch(() => {})
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') poll()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', poll)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', poll)
    }
  }, [user, conversationId])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    const connect = () => {
      if (cancelled) return
      const ws = new WebSocket(getChatWsUrl())
      wsRef.current = ws

      ws.onopen = () => {
        attempt = 0
        setWsConnected(true)
      }

      ws.onclose = () => {
        setWsConnected(false)
        if (cancelled) return
        const delay = Math.min(1000 * 2 ** attempt, 15000)
        attempt += 1
        reconnectTimer = setTimeout(connect, delay)
      }

      ws.onmessage = (event) => {
        let payload: WsPayload
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }

        if (payload.type === 'error') {
          setError(payload.detail)
          return
        }
        if (payload.conversation_id !== conversationId) return

        if (payload.type === 'message') {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.id) ? prev : sortByTime([...prev, payload as Message])
          )
          if (payload.sender_id !== user.id) {
            conversationsAPI.markRead(conversationId).catch(() => {})
          }
        } else if (payload.type === 'message_updated') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.id ? { ...m, content: payload.content, updated_at: payload.updated_at ?? m.updated_at } : m
            )
          )
          setEditedMessageIds((prev) => new Set(prev).add(payload.id))
        } else if (payload.type === 'message_deleted') {
          setMessages((prev) => prev.filter((m) => m.id !== payload.id))
        } else if (payload.type === 'reaction_updated') {
          setMessages((prev) => prev.map((m) => (m.id === payload.id ? { ...m, reactions: payload.reactions } : m)))
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [user, conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    const attachmentIds = pendingAttachments.map((a) => a.id)
    if (!content && attachmentIds.length === 0) return
    if (sending || uploading) return
    setSending(true)
    setError(null)

    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN && attachmentIds.length === 0) {
      ws.send(JSON.stringify({ conversation_id: conversationId, content }))
      setDraft('')
      setSending(false)
      return
    }

    try {
      const res = await conversationsAPI.send(conversationId, content, attachmentIds)
      setMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : sortByTime([...prev, res.data])))
      setDraft('')
      setPendingAttachments([])
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to send message.'))
    } finally {
      setSending(false)
    }
  }

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    setUploadProgress(0)
    setError(null)
    try {
      const res = await conversationsAPI.uploadAttachment(conversationId, file, setUploadProgress)
      setPendingAttachments((prev) => [...prev, res.data])
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to upload attachment.'))
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleMessageEdited = useCallback((updated: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    setEditedMessageIds((prev) => new Set(prev).add(updated.id))
  }, [])

  const handleMessageReacted = useCallback((updated: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }, [])

  const handleMessageDeleted = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }, [])

  if (!user) return null

  return (
    <div className="max-w-[640px] mx-auto flex flex-col h-[calc(100vh-140px)] bg-white">
      <div className="flex items-center gap-[12px] pb-[16px] border-b border-[#f1f5f9] mb-[16px]">
        <Link href="/messages" className="text-[#64748b] hover:text-[#1a202c] no-underline" aria-label="Back to messages">
          <i className="fa-solid fa-arrow-left"></i>
        </Link>
        {otherUserId ? (
          <Link href={`/profile/${otherUserId}`} className="flex items-center gap-[10px] no-underline group">
            <img
              src={resolveMediaUrl(otherAvatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${otherUsername || otherUserId}`}
              alt=""
              className="w-[36px] h-[36px] rounded-full object-cover flex-shrink-0"
            />
            <span className="text-[16px] font-[700] text-[#0f172a] group-hover:underline">{otherUsername || 'Conversation'}</span>
          </Link>
        ) : (
          <span className="text-[16px] font-[700] text-[#0f172a]">Conversation</span>
        )}
        <span
          className={`ml-auto text-[11px] font-[600] px-[8px] py-[3px] rounded-full ${
            wsConnected ? 'bg-[#f0fdf4] text-[#16a34a]' : 'bg-[#f8fafc] text-[#94a3b8]'
          }`}
        >
          {wsConnected ? 'Live' : 'Offline'}
        </span>
      </div>

      {error && (
        <div className="py-[10px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[13px] mb-[12px]">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-[16px] px-[4px] pb-[16px]">
        {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading messages...</div>}

        {!loading && messages.length === 0 && (
          <div className="text-center text-[#64748b] text-[14px] py-[40px]">No messages yet. Say hello!</div>
        )}

        {messages.map((m) => {
          const isMine = m.sender_id === user.id
          const showAvatar = !isMine
          // Compare actual timestamps, not raw strings - created_at and
          // updated_at can come back from the API with different string
          // formatting/precision even when they represent the exact same
          // instant, which was making every message look "edited" the
          // moment it was sent.
          const isEdited =
            editedMessageIds.has(m.id) ||
            (Boolean(m.updated_at) &&
              parseServerDate(m.updated_at as string).getTime() !== parseServerDate(m.created_at).getTime())
          return (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={isMine}
              showAvatar={showAvatar}
              avatarUrl={otherAvatarUrl}
              avatarSeed={otherUsername || otherUserId || m.sender_id}
              currentUserId={user.id}
              otherUsername={otherUsername || 'them'}
              isEdited={isEdited}
              conversationId={conversationId}
              onEdited={handleMessageEdited}
              onDeleted={handleMessageDeleted}
              onReacted={handleMessageReacted}
            />
          )
        })}
        <div ref={bottomRef} />
      </div>

      {pendingAttachments.length > 0 && (
        <div className="flex items-center gap-[8px] pb-[10px] flex-wrap">
          {pendingAttachments.map((att) => (
            <div key={att.id} className="relative flex items-center gap-[6px] bg-[#f1f5f9] rounded-[10px] px-[10px] py-[6px] text-[12px] text-[#374151]">
              {att.media_type === 'image' ? (
                <img src={resolveMediaUrl(att.url)} alt="" className="w-[24px] h-[24px] rounded-[6px] object-cover" />
              ) : (
                <i className={`fa-regular ${att.media_type === 'video' ? 'fa-file-video' : 'fa-file-lines'}`}></i>
              )}
              <span className="max-w-[120px] truncate">{att.file_name || 'Attachment'}</span>
              <button
                type="button"
                onClick={() => removePendingAttachment(att.id)}
                aria-label="Remove attachment"
                className="w-[16px] h-[16px] flex items-center justify-center text-[#94a3b8] hover:text-[#ef4444] bg-transparent border-none cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {uploading && (
        <div className="text-[12px] text-[#64748b] pb-[6px]">Uploading... {uploadProgress}%</div>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-[12px] pt-[16px] pb-[4px]">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Add attachment"
          className="w-[36px] h-[36px] flex items-center justify-center text-[#94a3b8] hover:text-[#64748b] bg-transparent border-none cursor-pointer text-[20px] flex-shrink-0 disabled:opacity-60"
        >
          +
        </button>
        <div className="flex-1 bg-[#f1f5f9] rounded-[20px] px-[18px] py-[10px]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message..."
            maxLength={5000}
            className="w-full border-none bg-transparent outline-none text-[14px] text-[#0f172a] placeholder:text-[#94a3b8]"
          />
        </div>
        <button
          type="submit"
          disabled={sending || uploading || (!draft.trim() && pendingAttachments.length === 0)}
          aria-label="Send message"
          className="w-[36px] h-[36px] rounded-full bg-[#818cf8] hover:bg-[#6366f1] border-none text-white flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  )
}
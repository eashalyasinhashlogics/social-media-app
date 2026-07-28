'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { conversationsAPI, usersAPI, getChatWsUrl, extractErrorMessage, Message } from '@/lib/api'

function formatTime(dateString: string): string {
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(dateString)
  const normalized = hasOffset ? dateString : `${dateString}Z`
  return new Date(normalized).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface WsMessagePayload {
  type: 'message'
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}
interface WsErrorPayload {
  type: 'error'
  detail: string
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()

  const [otherUserId, setOtherUserId] = useState<string | null>(searchParams.get('otherUserId'))
  const [otherUsername, setOtherUsername] = useState<string | null>(searchParams.get('otherUsername'))

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!user || otherUserId) return
    conversationsAPI.list(0, 100).then((res) => {
      const conv = res.data.find((c) => c.id === conversationId)
      const otherId = conv?.participant_ids.find((id) => id !== user.id)
      if (!otherId) return
      setOtherUserId(otherId)
      usersAPI.getById(otherId).then((r) => setOtherUsername(r.data.username)).catch(() => {})
    })
  }, [user, otherUserId, conversationId])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    conversationsAPI
      .messages(conversationId)
      .then((res) => setMessages(res.data))
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load messages.')))
      .finally(() => setLoading(false))

    conversationsAPI.markRead(conversationId).catch(() => {})
  }, [user, conversationId])

  // Connect on mount, close on unmount - forgetting this cleanup is the
  // #1 source of duplicate-message bugs when navigating between
  // conversations, since a stale socket would keep delivering into a
  // component that's no longer showing.
  useEffect(() => {
    if (!user) return

    const ws = new WebSocket(getChatWsUrl())
    wsRef.current = ws

    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)

    ws.onmessage = (event) => {
      let payload: WsMessagePayload | WsErrorPayload
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }

      if (payload.type === 'error') {
        setError(payload.detail)
        return
      }

      if (payload.type === 'message') {
        // Only append for this conversation, and only if we don't
        // already have the id - the backend broadcasts to every
        // participant including the sender, so a message we sent
        // ourselves also arrives back here over the socket.
        if (payload.conversation_id !== conversationId) return
        setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload as Message]))
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [user, conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)

    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Sent over the socket - don't append locally here, the server
      // broadcasts it straight back to us and the dedupe-by-id check in
      // onmessage above takes care of adding it exactly once.
      ws.send(JSON.stringify({ conversation_id: conversationId, content }))
      setDraft('')
      setSending(false)
      return
    }

    // Socket isn't open (still connecting, or dropped) - fall back to
    // REST so sending never silently fails.
    try {
      const res = await conversationsAPI.send(conversationId, content)
      setMessages((prev) => [...prev, res.data])
      setDraft('')
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to send message.'))
    } finally {
      setSending(false)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-[600px] mx-auto flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center gap-[12px] pb-[16px] border-b border-[#e2e8f0] mb-[16px]">
        <Link href="/messages" className="text-[#64748b] hover:text-[#1a202c] no-underline" aria-label="Back to messages">
          <i className="fa-solid fa-arrow-left"></i>
        </Link>
        {otherUserId ? (
          <Link href={`/profile/${otherUserId}`} className="text-[16px] font-[700] text-[#0f172a] no-underline hover:underline">
            {otherUsername || 'Conversation'}
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

      <div className="flex-1 overflow-y-auto flex flex-col gap-[8px] pb-[12px]">
        {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading messages...</div>}

        {!loading && messages.length === 0 && (
          <div className="text-center text-[#64748b] text-[14px] py-[40px]">No messages yet. Say hello!</div>
        )}

        {messages.map((m) => {
          const isMine = m.sender_id === user.id
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  isMine
                    ? 'max-w-[75%] bg-[#5B52E7] text-white rounded-[14px] rounded-br-[4px] px-[14px] py-[9px]'
                    : 'max-w-[75%] bg-white border border-[#e2e8f0] text-[#1a202c] rounded-[14px] rounded-bl-[4px] px-[14px] py-[9px]'
                }
              >
                <p className="text-[14px] whitespace-pre-wrap break-words">{m.content}</p>
                <span className={`block text-[10px] mt-[4px] ${isMine ? 'text-[rgba(255,255,255,0.7)]' : 'text-[#94a3b8]'}`}>
                  {formatTime(m.created_at)}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-[8px] pt-[12px] border-t border-[#e2e8f0]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          maxLength={5000}
          className="flex-1 border border-[#e2e8f0] rounded-[10px] px-[14px] py-[10px] text-[14px] outline-none focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="px-[18px] py-[10px] text-[13px] font-[600] text-white bg-[#5B52E7] border-none rounded-[10px] cursor-pointer hover:bg-[#4C43D4] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
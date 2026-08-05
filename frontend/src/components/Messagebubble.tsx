'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Message, MessageAttachment, MessageReaction, conversationsAPI, extractErrorMessage, parseServerDate, resolveMediaUrl } from '@/lib/api'

function formatTime(dateString: string): string {
  return parseServerDate(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const POPOVER_WIDTH = 170

interface MessageBubbleProps {
  message: Message
  isMine: boolean
  showAvatar: boolean
  avatarUrl: string | null
  avatarSeed: string
  currentUserId: string
  otherUsername: string
  isEdited: boolean
  isRead?: boolean
  conversationId: string
  onEdited: (message: Message) => void
  onDeleted: (messageId: string) => void
  onReacted: (message: Message) => void
}

export function MessageBubble({
  message,
  isMine,
  showAvatar,
  avatarUrl,
  avatarSeed,
  currentUserId,
  otherUsername,
  isEdited,
  isRead,
  conversationId,
  onEdited,
  onDeleted,
  onReacted,
}: MessageBubbleProps) {
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(message.content)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)

  const controlsRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen && !pickerOpen) {
      setPopoverPos(null)
      return
    }
    const updatePosition = () => {
      const rect = controlsRef.current?.getBoundingClientRect()
      if (!rect) return
      let left = isMine ? rect.right - POPOVER_WIDTH : rect.left
      left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_WIDTH - 8))
      setPopoverPos({ top: rect.top - 8, left })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [menuOpen, pickerOpen, isMine])

  // Close whichever popover is open on an outside click - checks both the
  // trigger buttons AND the portal content, since the portal now lives
  // outside controlsRef in the DOM tree.
  useEffect(() => {
    if (!menuOpen && !pickerOpen) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      const insideControls = controlsRef.current?.contains(target)
      const insidePopover = popoverRef.current?.contains(target)
      if (!insideControls && !insidePopover) {
        setMenuOpen(false)
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen, pickerOpen])

  const handleSaveEdit = async () => {
    const content = editDraft.trim()
    if (!content || saving) return
    if (content === message.content) {
      setEditing(false)
      return
    }
    setSaving(true)
    setActionError(null)
    try {
      const res = await conversationsAPI.updateMessage(conversationId, message.id, content)
      onEdited(res.data)
      setEditing(false)
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Failed to save changes.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return
    setDeleting(true)
    setActionError(null)
    try {
      await conversationsAPI.deleteMessage(conversationId, message.id)
      onDeleted(message.id)
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Failed to delete message.'))
      setDeleting(false)
    }
  }

  const handleReact = async (emoji: string) => {
    setPickerOpen(false)
    setActionError(null)
    try {
      const res = await conversationsAPI.toggleReaction(conversationId, message.id, emoji)
      onReacted(res.data)
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Failed to react to message.'))
    }
  }

  const reactionLabel = (r: MessageReaction) =>
    r.user_ids.map((id) => (id === currentUserId ? 'You' : otherUsername)).join(', ')

  const bubbleClasses = isMine
    ? 'max-w-full bg-[#4f46e5] text-white rounded-[18px] rounded-br-[4px] px-[18px] py-[12px]'
    : 'max-w-full bg-[#f1f5f9] text-[#0f172a] rounded-[18px] rounded-bl-[4px] px-[18px] py-[12px]'

  const controls = (
    <div ref={controlsRef} className="flex items-center gap-[3px] flex-shrink-0 mb-[2px]">
      <button
        onClick={() => {
          setPickerOpen((v) => !v)
          setMenuOpen(false)
        }}
        aria-label="React to message"
        className="w-[24px] h-[24px] rounded-full bg-white border border-[#e2e8f0] text-[#94a3b8] hover:text-[#4f46e5] hover:border-[#c7d2fe] flex items-center justify-center cursor-pointer transition-colors duration-150 ease"
      >
        <i className="fa-regular fa-face-smile text-[11px]"></i>
      </button>
      {isMine && (
        <button
          onClick={() => {
            setMenuOpen((v) => !v)
            setPickerOpen(false)
          }}
          aria-label="Message options"
          className="w-[24px] h-[24px] rounded-full bg-white border border-[#e2e8f0] text-[#94a3b8] hover:text-[#374151] flex items-center justify-center cursor-pointer transition-colors duration-150 ease"
        >
          <i className="fa-solid fa-ellipsis text-[11px]"></i>
        </button>
      )}
    </div>
  )

  const popover =
    popoverPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              transform: 'translateY(-100%)',
              width: POPOVER_WIDTH,
            }}
            className="z-[100]"
          >
            {pickerOpen && (
              <div className="bg-white border border-[#e2e8f0] rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08)] px-[6px] py-[5px] flex items-center gap-[2px] w-fit whitespace-nowrap">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="text-[17px] leading-none w-[26px] h-[26px] flex items-center justify-center rounded-full hover:bg-[#f8fafc] cursor-pointer bg-transparent border-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {menuOpen && (
              <div className="bg-white border border-[#e2e8f0] rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.08)] min-w-[130px] py-[4px] whitespace-nowrap">
                <button
                  onClick={() => {
                    setEditing(true)
                    setEditDraft(message.content)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-[8px] text-left px-[12px] py-[8px] text-[13px] text-[#374151] hover:bg-[#f8fafc] bg-transparent border-none cursor-pointer"
                >
                  <i className="fa-regular fa-pen-to-square text-[12px] w-[14px]"></i>
                  Edit
                </button>
                <div className="h-px bg-[#f1f5f9] mx-[8px] my-[2px]" />
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    handleDelete()
                  }}
                  disabled={deleting}
                  className="w-full flex items-center gap-[8px] text-left px-[12px] py-[8px] text-[13px] text-[#ef4444] hover:bg-[#fef2f2] bg-transparent border-none cursor-pointer disabled:opacity-60"
                >
                  <i className="fa-regular fa-trash-can text-[12px] w-[14px]"></i>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            )}
          </div>,
          document.body
        )
      : null

  const reactions = message.reactions ?? []

  return (
    <div className={`flex items-end gap-[12px] ${isMine ? 'justify-end' : 'justify-start'}`}>
      {popover}

      {!isMine &&
        (showAvatar ? (
          <img
            src={resolveMediaUrl(avatarUrl) || `https://api.dicebear.com/7.x/initials/svg?seed=${avatarSeed}`}
            alt=""
            className="w-[28px] h-[28px] rounded-full object-cover flex-shrink-0 mb-[2px]"
          />
        ) : (
          <div className="w-[28px] flex-shrink-0" aria-hidden="true" />
        ))}

      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {editing ? (
          <div className="w-full min-w-[220px]">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={2}
              maxLength={5000}
              autoFocus
              className="w-full resize-none border border-[#e2e8f0] rounded-[10px] p-[10px] text-[14px] outline-none focus:border-[#6366f1] mb-[6px]"
            />
            <div className="flex gap-[6px] justify-end">
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editDraft.trim()}
                className="px-[12px] py-[6px] text-[12px] font-[600] text-white bg-[#4f46e5] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setEditDraft(message.content)
                }}
                className="px-[12px] py-[6px] text-[12px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex items-end gap-[6px] ${isMine ? 'flex-row' : 'flex-row-reverse'}`}>
            {isMine && controls}
            <div className={bubbleClasses}>
              {message.attachments && message.attachments.length > 0 && (
                <div className={`flex flex-col gap-[8px] ${message.content ? 'mb-[8px]' : ''}`}>
                  {message.attachments.map((att) => (
                    <AttachmentPreview key={att.id} attachment={att} />
                  ))}
                </div>
              )}
              {message.content && (
                <p className="text-[14px] whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
            {!isMine && controls}
          </div>
        )}

        {!editing && (
          <span className="flex items-center gap-[4px] text-[11px] text-[#94a3b8] mt-[4px] px-[2px]">
            {formatTime(message.created_at)}
            {isEdited && ' · edited'}
            {isMine && (
              <span
                className={`inline-flex ${isRead ? 'text-[#4f46e5]' : ''}`}
                title={isRead ? 'Read' : 'Sent'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L7 17l-5-5"></path>
                </svg>
                {isRead && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-7px' }}>
                    <path d="M18 6L7 17l-5-5"></path>
                  </svg>
                )}
              </span>
            )}
          </span>
        )}

        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-[4px] mt-[4px] ${isMine ? 'justify-end' : 'justify-start'}`}>
            {reactions
              .filter((r) => r.user_ids.length > 0)
              .map((r) => {
                const reactedByMe = r.user_ids.includes(currentUserId)
                return (
                  <button
                    key={r.emoji}
                    onClick={() => handleReact(r.emoji)}
                    title={reactionLabel(r)}
                    className={`text-[11px] leading-none px-[7px] py-[4px] rounded-full border cursor-pointer flex items-center gap-[3px] ${
                      reactedByMe ? 'bg-[#EEF2FF] border-[#c7d2fe] text-[#4f46e5]' : 'bg-white border-[#e2e8f0] text-[#374151]'
                    }`}
                  >
                    <span>{r.emoji}</span>
                    <span className="font-[600]">{r.user_ids.length}</span>
                  </button>
                )
              })}
          </div>
        )}

        {actionError && <p className="text-[11px] text-[#ef4444] mt-[4px]">{actionError}</p>}
      </div>
    </div>
  )
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentPreview({ attachment }: { attachment: MessageAttachment }) {
  const url = resolveMediaUrl(attachment.url)

  if (attachment.media_type === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={attachment.file_name || 'attachment'}
          className="max-w-[240px] max-h-[240px] rounded-[12px] object-cover border border-black/5"
        />
      </a>
    )
  }

  if (attachment.media_type === 'video') {
    return (
      <video
        src={url}
        controls
        className="max-w-[240px] max-h-[240px] rounded-[12px] border border-black/5"
      />
    )
  }

  // Document (PDF, DOCX, TXT, etc.) - preview isn't feasible inline, so
  // show a downloadable file chip instead.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.file_name || undefined}
      className="flex items-center gap-[10px] bg-black/5 rounded-[10px] px-[12px] py-[10px] no-underline text-inherit max-w-[240px]"
    >
      <i className="fa-regular fa-file-lines text-[18px]"></i>
      <div className="min-w-0">
        <p className="text-[13px] font-[600] truncate">{attachment.file_name || 'Document'}</p>
        <p className="text-[11px] opacity-70">{formatFileSize(attachment.file_size)}</p>
      </div>
    </a>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { postsAPI, Post } from '@/lib/api'
import { PostCard } from '@/components/PostCard'

interface ArchivedPostsModalProps {
  currentUserId: string
  onClose: () => void
  onPostChanged: (post: Post) => void
  onPostDeleted: (postId: string) => void
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: 16,
}

const panelStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 16,
  width: '100%',
  maxWidth: 560,
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
}

export function ArchivedPostsModal({ currentUserId, onClose, onPostChanged, onPostDeleted }: ArchivedPostsModalProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    postsAPI.listMyArchived()
      .then((res) => setPosts(res.data))
      .catch(() => setError('Failed to load archived posts'))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdated = (updated: Post) => {
    onPostChanged(updated)
    if (updated.status !== 'archived') {
      setPosts((prev) => prev.filter((p) => p.id !== updated.id))
    } else {
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    }
  }

  const handleDeleted = (postId: string) => {
    onPostDeleted(postId)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  const modal = (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[20px] py-[16px] border-b border-[#f1f5f9] sticky top-0 bg-white">
          <h2 className="text-[16px] font-[700] text-[#1a202c]">Archived posts</h2>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#374151] bg-transparent border-none cursor-pointer text-[16px]"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="px-[20px] py-[16px]">
          {loading && <p className="text-[13px] text-[#9ca3af] text-center py-[24px]">Loading...</p>}
          {error && (
            <div className="py-[8px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px] mb-[12px]">
              {error}
            </div>
          )}
          {!loading && posts.length === 0 && !error && (
            <p className="text-[13px] text-[#9ca3af] text-center py-[24px]">
              Nothing archived yet. Archived posts are hidden from your profile grid but stay here until you unarchive or delete them.
            </p>
          )}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              onShared={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
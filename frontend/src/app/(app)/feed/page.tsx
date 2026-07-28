'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { postsAPI, feedAPI, Post } from '@/lib/api'
import { PostCard } from '@/components/PostCard'
import { CreatePostForm } from '@/components/CreatePostForm'

type FeedTab = 'all' | 'following'

export default function FeedPage() {
  const { user } = useAuthStore()

  const [activeTab, setActiveTab] = useState<FeedTab>('all')
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setPostsLoading(true)
    setPostsError(null)

    // listWithLikeState() already resolves to Post[]; getFollowingFeed()
    // returns the raw axios response, so unwrap it to keep both branches
    // the same shape.
    const load =
      activeTab === 'following'
        ? feedAPI.getFollowingFeed().then((res) => res.data)
        : postsAPI.listWithLikeState()

    load
      .then((data) => {
        if (!cancelled) setPosts(data)
      })
      .catch(() => {
        if (!cancelled) setPostsError('Failed to load feed')
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, activeTab])

  const handlePostCreated = (post: Post) => {
    // A brand-new post only belongs on "For You" until someone follows
    // the author, so only prepend it when that's the active tab.
    if (activeTab === 'all') {
      setPosts((prev) => [post, ...prev])
    }
  }

  const handlePostUpdated = (updated: Post) => {
    setPosts((prev) => {
      // an archived post should drop out of the public feed view,
      // matching what a fresh GET /posts would return
      if (updated.status === 'archived') {
        return prev.filter((p) => p.id !== updated.id)
      }
      return prev.map((p) => (p.id === updated.id ? updated : p))
    })
  }

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  if (!user) return null

  const TAB_BASE = 'px-[16px] py-[8px] text-[13px] font-[600] rounded-[8px] cursor-pointer border-none bg-transparent text-[#64748b] hover:text-[#1a202c]'
  const TAB_ACTIVE = 'px-[16px] py-[8px] text-[13px] font-[600] rounded-[8px] cursor-pointer border-none bg-[#EEF2FF] text-[#5B52E7]'

  return (
    <div className="max-w-[600px] mx-auto">
      <CreatePostForm onCreated={handlePostCreated} />

      <div className="flex items-center gap-[4px] bg-white p-[4px] rounded-[12px] border border-[#e2e8f0] mb-[16px] w-fit">
        <button className={activeTab === 'all' ? TAB_ACTIVE : TAB_BASE} onClick={() => setActiveTab('all')}>
          For You
        </button>
        <button className={activeTab === 'following' ? TAB_ACTIVE : TAB_BASE} onClick={() => setActiveTab('following')}>
          Following
        </button>
      </div>

      {postsLoading && (
        <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading feed...</div>
      )}

      {postsError && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px] mb-[16px]">
          {postsError}
        </div>
      )}

      {!postsLoading && !postsError && posts.length === 0 && (
        <div className="text-center text-[#64748b] text-[14px] py-[40px]">
          {activeTab === 'following'
            ? 'No posts yet. Follow people to see their posts here.'
            : 'No posts yet. Be the first to post something!'}
        </div>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={user.id}
          onUpdated={handlePostUpdated}
          onDeleted={handlePostDeleted}
          onShared={(share) => setPosts((prev) => (activeTab === 'all' ? [share, ...prev] : prev))}
        />
      ))}
    </div>
  )
}
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { postsAPI, feedAPI, Post } from '@/lib/api'
import { PostCard } from '@/components/PostCard'
import { CreatePostForm } from '@/components/CreatePostForm'

type FeedTab = 'all' | 'following'

const PAGE_SIZE = 20

export default function FeedPage() {
  const { user } = useAuthStore()

  const [activeTab, setActiveTab] = useState<FeedTab>('all')
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const sentinelRef = useRef<HTMLDivElement>(null)

  // fetchPage(skip) already unwraps to Post[] for both tabs - listWithLikeState()
  // resolves to Post[] directly, getFollowingFeed() returns the raw axios
  // response, so unwrap it here to keep both branches the same shape.
  const fetchPage = useCallback(
    (skip: number): Promise<Post[]> =>
      activeTab === 'following'
        ? feedAPI.getFollowingFeed(skip, PAGE_SIZE).then((res) => res.data)
        : postsAPI.listWithLikeState(skip, PAGE_SIZE),
    [activeTab]
  )

  // Load page one whenever the user or active tab changes, and reset
  // pagination state so switching tabs doesn't carry over "loaded 40 posts"
  // from the previous tab.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setPostsLoading(true)
    setPostsError(null)
    setHasMore(true)

    fetchPage(0)
      .then((data) => {
        if (cancelled) return
        setPosts(data)
        setHasMore(data.length === PAGE_SIZE)
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
  }, [user, activeTab, fetchPage])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || postsLoading) return
    setLoadingMore(true)
    fetchPage(posts.length)
      .then((data) => {
        setPosts((prev) => [...prev, ...data])
        setHasMore(data.length === PAGE_SIZE)
      })
      .catch(() => setPostsError('Failed to load more posts'))
      .finally(() => setLoadingMore(false))
  }, [fetchPage, posts.length, loadingMore, hasMore, postsLoading])

  // Infinite scroll still auto-triggers loadMore when the sentinel comes
  // into view - the button below is what makes it VISIBLE that pagination
  // ran (a spinner + state change), rather than posts silently appearing
  // with no feedback while scrolling.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loadingMore || postsLoading) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { rootMargin: '200px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadingMore, postsLoading, loadMore])

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

      {/* Sentinel: scrolling this into view auto-loads the next page (see
          the IntersectionObserver effect above). It also holds the visible
          "Load more" button your team lead asked for, so pagination is
          obviously happening rather than a silent background fetch. */}
      {!postsLoading && posts.length > 0 && (
        <div ref={sentinelRef} className="flex justify-center py-[24px]">
          {loadingMore ? (
            <div className="flex items-center gap-[10px] text-[#64748b] text-[13px] font-[600]">
              <span className="w-[16px] h-[16px] border-[2px] border-[#e2e8f0] border-t-[#5B52E7] rounded-full animate-[spin_0.8s_linear_infinite]" />
              Loading more posts...
            </div>
          ) : hasMore ? (
            <button
              onClick={loadMore}
              className="px-[20px] py-[10px] text-[13px] font-[600] rounded-[8px] border border-[#e2e8f0] bg-white text-[#5B52E7] cursor-pointer hover:bg-[#EEF2FF] transition-colors"
            >
              Load more
            </button>
          ) : (
            <span className="text-[13px] text-[#94a3b8]">You&apos;re all caught up</span>
          )}
        </div>
      )}
    </div>
  )
}
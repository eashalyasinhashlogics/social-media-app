'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { postsAPI, Post } from '@/lib/api'
import { PostCard } from '@/components/PostCard'
import { CreatePostForm } from '@/components/CreatePostForm'

export default function FeedPage() {
  const { user } = useAuthStore()

  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setPostsLoading(true)
    postsAPI.listWithLikeState()
      .then((data) => setPosts(data))
      .catch(() => setPostsError('Failed to load feed'))
      .finally(() => setPostsLoading(false))
  }, [user])

  const handlePostCreated = (post: Post) => {
    setPosts((prev) => [post, ...prev])
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

  return (
    <div className="max-w-[600px] mx-auto">
      <CreatePostForm onCreated={handlePostCreated} />

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
          No posts yet. Be the first to post something!
        </div>
      )}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={user.id}
          onUpdated={handlePostUpdated}
          onDeleted={handlePostDeleted}
          onShared={(share) => setPosts((prev) => [share, ...prev])}
        />
      ))}
    </div>
  )
}
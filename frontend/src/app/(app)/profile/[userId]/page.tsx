'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { profileAPI, Profile, Post } from '@/lib/api'
import { ProfileView } from '@/components/ProfileView'

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    // A username on a post always links here as /profile/{author_id} -
    // when that id happens to be the viewer's own, send them to the
    // canonical /profile route instead of rendering a second copy of
    // their own profile at a different URL.
    if (userId === user.id) {
      router.replace('/profile')
      return
    }

    setLoading(true)
    setError(null)
    profileAPI.getPublicProfile(userId)
      .then((res) => setProfile(res.data))
      .catch((err) => {
        setError(err?.response?.status === 404 ? 'This profile does not exist.' : 'Failed to load profile.')
      })
      .finally(() => setLoading(false))
  }, [userId, user])

  if (!user || userId === user.id) return null

  if (loading) {
    return <div className="text-center text-[#64748b] text-[14px] py-[60px]">Loading profile...</div>
  }

  if (error || !profile) {
    return <div className="text-center text-[#991b1b] text-[14px] py-[60px]">{error || 'Profile not found.'}</div>
  }

  const handlePostUpdated = (updatedPost: Post) => {
    setProfile((prev) =>
      prev ? { ...prev, posts: prev.posts.map((p) => (p.id === updatedPost.id ? updatedPost : p)) } : prev
    )
  }

  const handlePostDeleted = (postId: string) => {
    setProfile((prev) =>
      prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId) } : prev
    )
  }

  return (
    <ProfileView
      profile={profile}
      isOwnProfile={false}
      currentUserId={user.id}
      onProfileUpdated={setProfile as (p: Profile) => void}
      onPostUpdated={handlePostUpdated}
      onPostDeleted={handlePostDeleted}
    />
  )
}
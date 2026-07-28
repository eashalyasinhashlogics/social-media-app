'use client'

import { useAuthStore } from '@/store/authStore'
import { useProfile } from '@/context/ProfileContext'
import { ProfileView } from '@/components/ProfileView'
import { Post, Profile } from '@/lib/api'

export default function OwnProfilePage() {
  const { user } = useAuthStore()
  const { ownProfile, profileLoading, setOwnProfile } = useProfile()

  if (!user) return null

  if (profileLoading || !ownProfile) {
    return <div className="text-center text-[#64748b] text-[14px] py-[60px]">Loading profile...</div>
  }

  const handleProfileUpdated = (updated: Profile) => {
    setOwnProfile(updated)
  }

  const handlePostUpdated = (updatedPost: Post) => {
    setOwnProfile((prev: Profile | null) =>
      prev
        ? { ...prev, posts: prev.posts.map((p) => (p.id === updatedPost.id ? updatedPost : p)) }
        : prev
    )
  }

  const handlePostDeleted = (postId: string) => {
    setOwnProfile((prev: Profile | null) =>
      prev
        ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId), post_count: Math.max(0, prev.post_count - 1) }
        : prev
    )
  }

  return (
    <ProfileView
      profile={ownProfile}
      isOwnProfile={true}
      currentUserId={user.id}
      onProfileUpdated={handleProfileUpdated}
      onPostUpdated={handlePostUpdated}
      onPostDeleted={handlePostDeleted}
    />
  )
}
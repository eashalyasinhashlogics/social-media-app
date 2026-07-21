'use client'

import { useState } from 'react'
import { Profile, Post, resolveMediaUrl } from '@/lib/api'
import { PostCard } from '@/components/PostCard'
import { EditProfileModal } from '@/components/EditProfileModal'
import { ArchivedPostsModal } from '@/components/ArchivedPostsModal'

interface ProfileViewProps {
  profile: Profile
  isOwnProfile: boolean
  currentUserId: string
  onProfileUpdated: (profile: Profile) => void
  onPostUpdated: (post: Post) => void
  onPostDeleted: (postId: string) => void
}

export function ProfileView({
  profile,
  isOwnProfile,
  currentUserId,
  onProfileUpdated,
  onPostUpdated,
  onPostDeleted,
}: ProfileViewProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)

  // Archived posts are excluded from the grid on purpose (own profile
  // response includes them so the owner can still act on them via the
  // "View archived posts" panel; a public viewer's response never
  // contains them in the first place).
  const visiblePosts = profile.posts.filter((p) => p.status !== 'archived')

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Cover photo */}
      <div
        className="h-[180px] rounded-t-[16px] bg-[linear-gradient(135deg,#6366f1,#4f46e5)] bg-cover bg-center border border-b-0 border-[#e2e8f0]"
        style={profile.cover_photo_url ? { backgroundImage: `url(${resolveMediaUrl(profile.cover_photo_url)})` } : undefined}
      />

      <div className="bg-white border border-t-0 border-[#e2e8f0] rounded-b-[16px] px-[24px] pb-[20px] mb-[24px] relative">
        <div className="flex items-end justify-between">
          <img
            src={resolveMediaUrl(profile.avatar_url) || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.username}`}
            alt={`${profile.username} avatar`}
            className="w-[96px] h-[96px] rounded-full object-cover border-[4px] border-white -mt-[48px] shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
          />

          {isOwnProfile && (
            <div className="flex items-center gap-[8px] pt-[14px]">
              <button
                onClick={() => setEditOpen(true)}
                className="px-[16px] py-[8px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc]"
              >
                Edit profile
              </button>
              <div className="relative">
                <button
                  onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                  className="w-[36px] h-[36px] flex items-center justify-center text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc]"
                  aria-label="Profile settings"
                >
                  <i className="fa-solid fa-ellipsis"></i>
                </button>
                {settingsMenuOpen && (
                  <div className="absolute right-0 top-[42px] bg-white border border-[#e2e8f0] rounded-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.08)] z-10 min-w-[190px] py-[4px]">
                    <button
                      onClick={() => { setSettingsMenuOpen(false); setArchivedOpen(true) }}
                      className="w-full text-left px-[14px] py-[10px] text-[13px] text-[#374151] hover:bg-[#f8fafc] bg-transparent border-none cursor-pointer flex items-center gap-[8px]"
                    >
                      <i className="fa-solid fa-box-archive text-[12px]"></i>
                      View archived posts
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-[12px]">
          <h1 className="text-[20px] font-[800] text-[#0f172a]">{profile.display_name || profile.username}</h1>
          <p className="text-[13px] text-[#64748b]">@{profile.username}</p>
        </div>

        {profile.bio && <p className="mt-[10px] text-[14px] text-[#374151] whitespace-pre-wrap">{profile.bio}</p>}

        <div className="flex items-center gap-[20px] mt-[14px] text-[13px]">
          <span><b className="text-[#1a202c]">{profile.post_count}</b> <span className="text-[#64748b]">posts</span></span>
          <span><b className="text-[#1a202c]">{profile.follower_count}</b> <span className="text-[#64748b]">followers</span></span>
          <span><b className="text-[#1a202c]">{profile.following_count}</b> <span className="text-[#64748b]">following</span></span>
        </div>
      </div>

      {/* F5: Post management menu (Edit/Archive/Delete) reuses the same
          PostCard used on the feed, so the "⋯" per-post menu shows up
          here too whenever the viewer owns the post. */}
      {visiblePosts.length === 0 ? (
        <div className="text-center text-[#64748b] text-[14px] py-[40px]">No posts yet.</div>
      ) : (
        visiblePosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onUpdated={onPostUpdated}
            onDeleted={onPostDeleted}
            onShared={() => {}}
          />
        ))
      )}

      {editOpen && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={onProfileUpdated}
        />
      )}

      {archivedOpen && (
        <ArchivedPostsModal
          currentUserId={currentUserId}
          onClose={() => setArchivedOpen(false)}
          onPostChanged={onPostUpdated}
          onPostDeleted={onPostDeleted}
        />
      )}
    </div>
  )
}
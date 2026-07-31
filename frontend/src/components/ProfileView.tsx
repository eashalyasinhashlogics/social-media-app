'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Post, resolveMediaUrl, profileAPI, followAPI, friendsAPI, conversationsAPI, extractErrorMessage } from '@/lib/api'
import { PostCard } from '@/components/PostCard'
import { EditProfileModal } from '@/components/EditProfileModal'
import { ArchivedPostsModal } from '@/components/ArchivedPostsModal'
import { FollowListModal, FollowListType } from '@/components/FollowListModal'

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

  // ── Follow list modal (followers / following / friends) ──
  const [listModalType, setListModalType] = useState<FollowListType | null>(null)
  const [friendCount, setFriendCount] = useState<number | null>(null)

  // ── Follow state ──────────────────────────────────────
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(profile.follower_count)
  const [followLoading, setFollowLoading] = useState(false)
  const [followRelationLoading, setFollowRelationLoading] = useState(!isOwnProfile)
  const [followError, setFollowError] = useState<string | null>(null)

  // ── Friend request state ──────────────────────────────
  type FriendStatus = 'none' | 'pending' | 'friends'
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none')
  const [outgoingRequestId, setOutgoingRequestId] = useState<string | null>(null)
  const [friendActionLoading, setFriendActionLoading] = useState(false)
  const [friendRelationLoading, setFriendRelationLoading] = useState(!isOwnProfile)
  const [friendError, setFriendError] = useState<string | null>(null)

  // ── Message button ────────────────────────────────────
  const router = useRouter()
  const [messageLoading, setMessageLoading] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)

  const handleMessage = async () => {
    if (messageLoading) return
    setMessageLoading(true)
    setMessageError(null)
    try {
      const res = await conversationsAPI.start(profile.user_id)
      router.push(
        `/messages/${res.data.id}?otherUserId=${profile.user_id}&otherUsername=${encodeURIComponent(profile.username)}`
      )
    } catch (err: any) {
      setMessageError(extractErrorMessage(err, 'Could not start conversation.'))
    } finally {
      setMessageLoading(false)
    }
  }

  // Keep the local follower count in sync if the parent ever hands us a
  // freshly-refetched `profile` prop.
  useEffect(() => {
    setFollowerCount(profile.follower_count)
  }, [profile.follower_count])

  // ProfileResponse doesn't include "do I follow this person", so resolve
  // it by checking whether profile.user_id shows up in our own following list.
  useEffect(() => {
    if (isOwnProfile) return
    let cancelled = false
    setFollowRelationLoading(true)

    followAPI
      .following(currentUserId)
      .then((res) => {
        if (cancelled) return
        setIsFollowing(res.data.some((u) => u.id === profile.user_id))
      })
      .catch(() => {
        // Non-fatal - button falls back to "Follow"
      })
      .finally(() => {
        if (!cancelled) setFollowRelationLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOwnProfile, currentUserId, profile.user_id])

  // Figure out "none / pending / friends" up front.
  useEffect(() => {
    if (isOwnProfile) return
    let cancelled = false
    setFriendRelationLoading(true)

    Promise.all([friendsAPI.listOutgoing(), friendsAPI.listFriends()])
      .then(([outgoingRes, friendsRes]) => {
        if (cancelled) return
        const alreadyFriends = friendsRes.data.some((f) => f.friend.id === profile.user_id)
        if (alreadyFriends) {
          setFriendStatus('friends')
          return
        }
        const outgoing = outgoingRes.data.find(
          (r) => r.to_user_id === profile.user_id && r.status === 'pending'
        )
        if (outgoing) {
          setFriendStatus('pending')
          setOutgoingRequestId(outgoing.id)
        } else {
          setFriendStatus('none')
        }
      })
      .catch(() => {
        // Non-fatal - button falls back to "Add friend"
      })
      .finally(() => {
        if (!cancelled) setFriendRelationLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOwnProfile, profile.user_id])

  // Friend count for this profile - only used to render the "Friends" stat,
  // fetched once regardless of whose profile this is.
  useEffect(() => {
    let cancelled = false
    profileAPI
      .getFriendsCount(profile.user_id)
      .then((res) => {
        if (!cancelled) setFriendCount(res.data.count)
      })
      .catch(() => {
        // Non-fatal - stat just won't render
      })
    return () => {
      cancelled = true
    }
  }, [profile.user_id])

  const handleSendFriendRequest = async () => {
    if (friendActionLoading) return
    setFriendActionLoading(true)
    setFriendError(null)
    try {
      const res = await friendsAPI.send(profile.user_id)
      setFriendStatus('pending')
      setOutgoingRequestId(res.data.id)
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setFriendStatus('pending')
      }
      setFriendError(extractErrorMessage(err, 'Could not send friend request.'))
    } finally {
      setFriendActionLoading(false)
    }
  }

  const handleUnfriend = async () => {
    if (friendActionLoading) return
    const confirmed = window.confirm(`Unfriend ${profile.display_name || profile.username}? You can send a new friend request later.`)
    if (!confirmed) return

    setFriendActionLoading(true)
    setFriendError(null)
    try {
      await friendsAPI.unfriend(profile.user_id)
      setFriendStatus('none')
      setFriendCount((prev) => (prev !== null ? Math.max(0, prev - 1) : prev))
    } catch (err: any) {
      setFriendError(extractErrorMessage(err, 'Could not unfriend this user.'))
    } finally {
      setFriendActionLoading(false)
    }
  }

  const handleCancelFriendRequest = async () => {
    if (friendActionLoading || !outgoingRequestId) return
    setFriendActionLoading(true)
    setFriendError(null)
    try {
      await friendsAPI.cancel(outgoingRequestId)
      setFriendStatus('none')
      setOutgoingRequestId(null)
    } catch (err: any) {
      setFriendError(extractErrorMessage(err, 'Could not cancel friend request.'))
    } finally {
      setFriendActionLoading(false)
    }
  }

  const handleFollowToggle = async () => {
    if (followLoading) return
    setFollowLoading(true)
    setFollowError(null)
    try {
      const res = isFollowing
        ? await followAPI.unfollow(profile.user_id)
        : await followAPI.follow(profile.user_id)
      setIsFollowing(res.data.following)
      setFollowerCount(res.data.follower_count)
    } catch (err: any) {
      setFollowError(extractErrorMessage(err, 'Something went wrong. Please try again.'))
    } finally {
      setFollowLoading(false)
    }
  }

  // Called by the list modal whenever a follow/friend action happens
  // inside it, so this profile's own stats stay in sync without a full
  // page refresh.
  const refreshCounts = () => {
    profileAPI
      .getPublicProfile(profile.user_id)
      .then((res) => {
        setFollowerCount(res.data.follower_count)
        onProfileUpdated(res.data)
      })
      .catch(() => {})
    profileAPI
      .getFriendsCount(profile.user_id)
      .then((res) => setFriendCount(res.data.count))
      .catch(() => {})
  }

  // Filter out archived/deleted posts safely
  const visiblePosts = (profile.posts || []).filter(
    (p) => p.status !== 'archived' && p.status !== 'deleted'
  )

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

          {isOwnProfile ? (
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
          ) : (
            <div className="flex flex-col items-end gap-[6px] pt-[14px]">
              <div className="flex items-center gap-[8px]">
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading || followRelationLoading}
                  className={
                    isFollowing
                      ? 'px-[18px] py-[8px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed'
                      : 'px-[18px] py-[8px] text-[13px] font-[600] text-white bg-[#5B52E7] border-none rounded-[8px] cursor-pointer hover:bg-[#4C43D4] disabled:opacity-60 disabled:cursor-not-allowed'
                  }
                >
                  {followLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                </button>

                {friendStatus === 'friends' && (
                  <button
                    onClick={handleUnfriend}
                    disabled={friendActionLoading || friendRelationLoading}
                    className="group px-[16px] py-[8px] text-[13px] font-[600] text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] rounded-[8px] cursor-pointer flex items-center gap-[6px] hover:text-[#dc2626] hover:bg-[#fef2f2] hover:border-[#fecaca] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <i className="fa-solid fa-user-check text-[12px] group-hover:hidden"></i>
                    <i className="fa-solid fa-user-xmark text-[12px] hidden group-hover:inline"></i>
                    <span className="group-hover:hidden">{friendActionLoading ? '...' : 'Friends'}</span>
                    <span className="hidden group-hover:inline">{friendActionLoading ? '...' : 'Unfriend'}</span>
                  </button>
                )}
                {friendStatus === 'pending' && (
                  <button
                    onClick={handleCancelFriendRequest}
                    disabled={friendActionLoading || friendRelationLoading}
                    className="px-[16px] py-[8px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {friendActionLoading ? '...' : 'Cancel request'}
                  </button>
                )}
                {friendStatus === 'none' && (
                  <button
                    onClick={handleSendFriendRequest}
                    disabled={friendActionLoading || friendRelationLoading}
                    className="px-[16px] py-[8px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {friendActionLoading ? '...' : 'Add friend'}
                  </button>
                )}

                <button
                  onClick={handleMessage}
                  disabled={messageLoading}
                  className="px-[16px] py-[8px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-[6px]"
                >
                  <i className="fa-solid fa-comment-dots text-[12px]"></i>
                  {messageLoading ? '...' : 'Message'}
                </button>
              </div>
              {(followError || friendError || messageError) && (
                <span className="text-[12px] text-[#dc2626] max-w-[220px] text-right">
                  {followError || friendError || messageError}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-[12px]">
          <h1 className="text-[20px] font-[800] text-[#0f172a]">{profile.display_name || profile.username}</h1>
          <p className="text-[13px] text-[#64748b]">@{profile.username}</p>
        </div>

        {profile.bio && <p className="mt-[10px] text-[14px] text-[#374151] whitespace-pre-wrap">{profile.bio}</p>}

        <div className="flex items-center gap-[20px] mt-[14px] text-[13px]">
          <span>
            <b className="text-[#1a202c]">{visiblePosts.length}</b> <span className="text-[#64748b]">posts</span>
          </span>
          <button
            onClick={() => setListModalType('followers')}
            className="bg-transparent border-none cursor-pointer p-0 hover:underline"
          >
            <b className="text-[#1a202c]">{followerCount}</b> <span className="text-[#64748b]">followers</span>
          </button>
          <button
            onClick={() => setListModalType('following')}
            className="bg-transparent border-none cursor-pointer p-0 hover:underline"
          >
            <b className="text-[#1a202c]">{profile.following_count}</b> <span className="text-[#64748b]">following</span>
          </button>
          <button
            onClick={() => setListModalType('friends')}
            className="bg-transparent border-none cursor-pointer p-0 hover:underline"
          >
            <b className="text-[#1a202c]">{friendCount ?? '–'}</b> <span className="text-[#64748b]">friends</span>
          </button>
        </div>
      </div>

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

      {listModalType && (
        <FollowListModal
          userId={profile.user_id}
          currentUserId={currentUserId}
          initialType={listModalType}
          onClose={() => setListModalType(null)}
          onRelationshipChanged={refreshCounts}
        />
      )}
    </div>
  )
}
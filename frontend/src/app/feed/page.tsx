'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { postsAPI, profileAPI, mediaAPI, Post, Profile } from '@/lib/api'
import { PostCard } from '@/components/PostCard'
import { CreatePostForm } from '@/components/CreatePostForm'

export default function FeedPage() {
  const router = useRouter()
  const { user, isAuthenticated, fetchMe, logout, isLoading } = useAuthStore()
  const [activeTab, setActiveTab] = useState('home')

  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState<string | null>(null)

  // Profile tab state
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [bioEditing, setBioEditing] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [bioSaving, setBioSaving] = useState(false)

  // Avatar upload state
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  useEffect(() => {
    fetchMe().then(() => {
      const auth = useAuthStore.getState().isAuthenticated
      if (!auth) router.replace('/login')
    })
  }, [])

  useEffect(() => {
    if (!user) return
    setPostsLoading(true)
    postsAPI.list()
      .then((res) => setPosts(res.data))
      .catch(() => setPostsError('Failed to load feed'))
      .finally(() => setPostsLoading(false))
  }, [user])

  useEffect(() => {
    if (!user) return
    setProfileLoading(true)
    profileAPI.getOwnProfile()
      .then((res) => { setProfile(res.data); setBioDraft(res.data.bio || '') })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
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

  const handlePostShared = (share: Post) => {
    setPosts((prev) => [share, ...prev])
  }

  const handleSaveBio = async () => {
    setBioSaving(true)
    try {
      const res = await profileAPI.updateBio(bioDraft.trim())
      setProfile(res.data)
      setBioEditing(false)
    } catch {
      // leave editing open so they can retry
    } finally {
      setBioSaving(false)
    }
  }

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError(null)
    setAvatarUploading(true)
    try {
      // /media/avatar sets the avatar server-side and returns the Media
      // record (with the new url) - there's no separate profile PATCH for it.
      const res = await mediaAPI.uploadAvatar(file)
      const avatarUrl = res.data.url
      setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev))
    } catch {
      setAvatarError('Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const switchTab = (tab: string) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#5B52E7_0%,#4C43D4_100%)] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-[48px] h-[48px] border-[4px] border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-[spin_0.8s_linear_infinite] mx-auto mb-[12px]" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  const TAB_BASE_CLASSES = "px-[16px] py-[8px] rounded-[8px] text-[14px] font-medium transition-all duration-[0.2s] ease flex items-center gap-[8px] text-[#64748b] hover:text-[#1a202c] bg-transparent border-none relative cursor-pointer"

  const TAB_ACTIVE_CLASSES = "px-[16px] py-[8px] rounded-[8px] text-[14px] font-medium transition-all duration-[0.2s] ease flex items-center gap-[8px] bg-[#EEF2FF] text-[#5B52E7] border-none relative cursor-pointer"

  return (
    <ProtectedRoute>
      <>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>

        <div className="font-[inherit] text-[#1a202c] min-h-screen pb-[48px]">

          {/* Navbar */}
          <nav className="sticky top-0 z-50 bg-white border-b border-[#e2e8f0] py-[12px] px-[24px] flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-[12px] cursor-pointer">
              <div className="bg-[linear-gradient(135deg,#6366f1,#4f46e5)] text-white text-[22px] font-[700] w-[44px] h-[44px] rounded-[14px] flex items-center justify-center shadow-[0_4px_14px_rgba(79,70,229,0.4)]">
          F
        </div>
              <span className="text-[26px] font-[800] text-[#0f172a] tracking-[-0.5px]">FOMO</span>
            </div>

            <div className="flex items-center gap-[4px] bg-[#f8fafc] p-[4px] rounded-[12px] border border-[#e2e8f0]">
              {['home', 'explore', 'messages', 'notifications', 'communities', 'profile'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={activeTab === tab ? TAB_ACTIVE_CLASSES : TAB_BASE_CLASSES}
                >
                  <i className={`fa-solid fa-${tab === 'home' ? 'house' : tab === 'explore' ? 'compass' : tab === 'messages' ? 'comment-dots' : tab === 'notifications' ? 'bell' : tab === 'communities' ? 'users' : 'user'}`}></i>
                  <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                  {(tab === 'messages' || tab === 'notifications') && (
                    <span className="absolute top-[-4px] right-[-4px] bg-[#06b6d4] text-white text-[10px] font-bold w-[16px] h-[16px] rounded-full flex items-center justify-center border border-white">{tab === 'messages' ? '4' : '3'}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-[16px]">
              <button className="bg-[#5B52E7] hover:bg-[#4C43D4] text-white px-[20px] py-[8px] rounded-full text-[14px] font-medium shadow-[0_4px_6px_rgba(91,82,231,0.1)] border-none cursor-pointer flex items-center gap-[8px] transition-all duration-200 ease">
                <i className="fa-solid fa-plus text-[12px]"></i>
                <span>Create</span>
              </button>
              <div className="flex items-center gap-[8px] cursor-pointer" onClick={() => switchTab('profile')}>
                <div className="relative">
                  <img src={profile?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + user.username} alt={`${user.username} Avatar`} className="w-[32px] h-[32px] rounded-full object-cover border border-[#e2e8f0]" />
                  <span className="absolute bottom-0 right-0 w-[10px] h-[10px] bg-[#10b981] border-[2px] border-white rounded-full"></span>
                </div>
                <span className="text-[14px] font-semibold text-[#374151]">{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-[16px] py-[8px] rounded-[8px] text-[14px] font-medium border-none cursor-pointer flex items-center gap-[6px] transition-all duration-200 ease"
              >
                <i className="fa-solid fa-sign-out-alt text-[14px]"></i>
                <span>Logout</span>
              </button>
            </div>
          </nav>

          <main className="max-w-[1240px] mx-auto px-[24px] mt-[32px]">

            {/* HOME TAB - real feed, wired to the backend */}
            {activeTab === 'home' && (
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
                    onShared={handlePostShared}
                  />
                ))}
              </div>
            )}

            {/* EXPLORE TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'explore' && (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-[60px] px-[40px] text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] max-w-[500px]">
                  <div className="text-[48px] mb-[16px]">🔍</div>
                  <h2 className="text-[24px] font-bold text-[#1a202c] mb-[12px]">Update Coming Soon</h2>
                  <p className="text-[#64748b] text-[14px] leading-[1.6]">Explore feature is under development. Check back soon!</p>
                </div>
              </div>
            )}

            {/* MESSAGES TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'messages' && (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-[60px] px-[40px] text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] max-w-[500px]">
                  <div className="text-[48px] mb-[16px]">💬</div>
                  <h2 className="text-[24px] font-bold text-[#1a202c] mb-[12px]">Update Coming Soon</h2>
                  <p className="text-[#64748b] text-[14px] leading-[1.6]">Messaging feature is coming soon. We'll notify you when it's ready!</p>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'notifications' && (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-[60px] px-[40px] text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] max-w-[500px]">
                  <div className="text-[48px] mb-[16px]">🔔</div>
                  <h2 className="text-[24px] font-bold text-[#1a202c] mb-[12px]">Update Coming Soon</h2>
                  <p className="text-[#64748b] text-[14px] leading-[1.6]">Notifications are being refined. Stay tuned for updates!</p>
                </div>
              </div>
            )}

            {/* COMMUNITIES TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'communities' && (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-[60px] px-[40px] text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] max-w-[500px]">
                  <div className="text-[48px] mb-[16px]">👥</div>
                  <h2 className="text-[24px] font-bold text-[#1a202c] mb-[12px]">Update Coming Soon</h2>
                  <p className="text-[#64748b] text-[14px] leading-[1.6]">Communities feature is being built. Exciting things coming your way!</p>
                </div>
              </div>
            )}

            {/* PROFILE TAB - wired to backend (Step F3) */}
            {activeTab === 'profile' && (
              <div className="max-w-[960px] mx-auto flex flex-col gap-[24px]">
                {profileLoading && (
                  <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading profile...</div>
                )}

                {!profileLoading && profile && (
                  <>
                    <div className="bg-white border border-[#e2e8f0] rounded-[16px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden relative">
                      <div className="h-[192px] bg-[#d1d5db] relative">
                        <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80" className="w-full h-full object-cover" />
                        <button className="absolute top-[16px] right-[16px] bg-[rgba(0,0,0,0.5)] text-white text-[12px] font-medium px-[12px] py-[6px] rounded-[8px] border-none cursor-pointer flex items-center gap-[6px] transition-all duration-200 ease">
                          <i className="fa-regular fa-image"></i>
                          <span>Edit cover</span>
                        </button>
                      </div>
                      <div className="p-[24px] relative">
                        <div className="absolute top-[-64px] left-[24px]">
                          <div className="relative">
                            <img
                              src={profile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=' + profile.username}
                              className="w-[112px] h-[112px] rounded-full object-cover border-[4px] border-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                            />
                            <span className="absolute bottom-[4px] right-[8px] w-[16px] h-[16px] bg-[#10b981] border-[2px] border-white rounded-full"></span>
                            <button
                              onClick={() => avatarInputRef.current?.click()}
                              disabled={avatarUploading}
                              className="absolute inset-0 rounded-full bg-[rgba(0,0,0,0.4)] opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[20px] border-none cursor-pointer transition-opacity duration-200 ease disabled:opacity-70"
                              aria-label="Change avatar"
                            >
                              <i className={avatarUploading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-camera'}></i>
                            </button>
                            <input
                              ref={avatarInputRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={handleAvatarSelected}
                              className="hidden"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-[12px] pt-[16px] mb-[24px]">
                          <button
                            onClick={() => { setBioEditing(!bioEditing); setBioDraft(profile.bio || '') }}
                            className="border border-[#e2e8f0] text-[#374151] text-[12px] font-semibold px-[16px] py-[8px] rounded-[12px] bg-white hover:bg-[#f8fafc] cursor-pointer flex items-center gap-[6px] transition-all duration-200 ease"
                          >
                            <i className="fa-solid fa-pen text-[10px]"></i>
                            <span>{bioEditing ? 'Cancel' : 'Edit profile'}</span>
                          </button>
                          <button onClick={handleLogout} className="border border-[#e2e8f0] text-[#374151] text-[12px] font-semibold px-[12px] py-[8px] rounded-[12px] bg-white hover:bg-[#f8fafc] cursor-pointer transition-all duration-200 ease">
                            <i className="fa-solid fa-gear"></i>
                          </button>
                        </div>

                        <div className="mt-[24px] flex flex-col gap-[12px]">
                          <div>
                            <div className="flex items-center gap-[6px]">
                              <h2 className="text-[20px] font-bold text-[#1a202c]">{profile.username}</h2>
                              <i className="fa-solid fa-circle-check text-[#3b82f6] text-[14px]"></i>
                            </div>
                            <span className="text-[12px] text-[#9ca3af]">@{profile.username}</span>
                          </div>

                          {bioEditing ? (
                            <div>
                              <textarea
                                value={bioDraft}
                                onChange={(e) => setBioDraft(e.target.value)}
                                rows={2}
                                maxLength={500}
                                placeholder="Tell people about yourself..."
                                className="w-full resize-none border border-[#e2e8f0] rounded-[8px] p-[10px] text-[13px] outline-none focus:border-[#6366f1] mb-[8px]"
                              />
                              <button
                                onClick={handleSaveBio}
                                disabled={bioSaving}
                                className="px-[14px] py-[6px] text-[12px] font-[600] text-white bg-[#6366f1] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
                              >
                                {bioSaving ? 'Saving...' : 'Save bio'}
                              </button>
                            </div>
                          ) : (
                            <p className="text-[12px] text-[#374151] font-medium">
                              {profile.bio || <span className="text-[#9ca3af] italic">No bio yet — click Edit profile to add one.</span>}
                            </p>
                          )}

                          {avatarError && (
                            <div className="py-[6px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px] font-[500]">
                              {avatarError}
                            </div>
                          )}

                          <div className="flex items-center gap-[24px] pt-[8px] border-t border-[#f1f5f9]">
                            <div className="text-[12px] text-[#64748b]"><strong className="text-[#1a202c] font-bold text-[14px]">{profile.post_count}</strong> Posts</div>
                            <div className="text-[12px] text-[#64748b]"><strong className="text-[#1a202c] font-bold text-[14px]">{profile.follower_count}</strong> Followers</div>
                            <div className="text-[12px] text-[#64748b]"><strong className="text-[#1a202c] font-bold text-[14px]">{profile.following_count}</strong> Following</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-[#e2e8f0] rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-[6px] flex items-center justify-center max-w-[336px] mx-auto">
                      {['Posts', 'Media', 'Saved'].map((tab) => (
                        <button
                          key={tab}
                          className={`flex-1 text-center p-[8px] text-[12px] rounded-[8px] border-none cursor-pointer flex items-center justify-center gap-[6px] transition-all duration-200 ease ${
                            tab === 'Posts'
                              ? 'font-bold text-[#5B52E7] bg-[#EEF2FF]'
                              : 'font-medium text-[#9ca3af] bg-transparent hover:text-[#1a202c]'
                          }`}
                        >
                          <i className={`text-[10px] ${tab === 'Posts' ? 'fa-solid fa-table-cells' : 'fa-regular fa-' + (tab === 'Media' ? 'image' : 'bookmark')}`}></i>
                          <span>{tab}</span>
                        </button>
                      ))}
                    </div>

                    <div className="max-w-[600px] mx-auto w-full">
                      {profile.posts.length === 0 && (
                        <div className="text-center text-[#64748b] text-[14px] py-[40px]">No posts yet.</div>
                      )}
                      {profile.posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentUserId={user.id}
                          onUpdated={(updated) => {
                            setProfile((prev) => prev ? { ...prev, posts: prev.posts.map((p) => p.id === updated.id ? updated : p) } : prev)
                          }}
                          onDeleted={(postId) => {
                            setProfile((prev) => prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== postId), post_count: Math.max(prev.post_count - 1, 0) } : prev)
                          }}
                          onShared={() => {}}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

          </main>
        </div>
      </>
    </ProtectedRoute>
  )
}
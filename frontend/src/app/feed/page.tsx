'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function FeedPage() {
  const router = useRouter()
  const { user, isAuthenticated, fetchMe, logout, isLoading } = useAuthStore()
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => {
    fetchMe().then(() => {
      const auth = useAuthStore.getState().isAuthenticated
      if (!auth) router.replace('/login')
    })
  }, [])

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
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt={`${user.username} Avatar`} className="w-[32px] h-[32px] rounded-full object-cover border border-[#e2e8f0]" />
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

            {/* HOME TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'home' && (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="bg-white border border-[#e2e8f0] rounded-[16px] py-[60px] px-[40px] text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] max-w-[500px]">
                  <div className="text-[48px] mb-[16px]">🚀</div>
                  <h2 className="text-[24px] font-bold text-[#1a202c] mb-[12px]">Update Coming Soon</h2>
                  <p className="text-[#64748b] text-[14px] leading-[1.6]">We're working hard to bring you an amazing feed experience. Stay tuned!</p>
                </div>
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

            {/* PROFILE TAB - KEPT AS IS - NO CHANGES */}
            {activeTab === 'profile' && (
              <div className="max-w-[960px] mx-auto flex flex-col gap-[24px]">
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
                        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80" className="w-[112px] h-[112px] rounded-full object-cover border-[4px] border-white shadow-[0_1px_3px_rgba(0,0,0,0.1)]" />
                        <span className="absolute bottom-[4px] right-[8px] w-[16px] h-[16px] bg-[#10b981] border-[2px] border-white rounded-full"></span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-[12px] pt-[16px] mb-[24px]">
                      <button className="border border-[#e2e8f0] text-[#374151] text-[12px] font-semibold px-[16px] py-[8px] rounded-[12px] bg-white hover:bg-[#f8fafc] cursor-pointer flex items-center gap-[6px] transition-all duration-200 ease">
                        <i className="fa-solid fa-pen text-[10px]"></i>
                        <span>Edit profile</span>
                      </button>
                      <button onClick={handleLogout} className="border border-[#e2e8f0] text-[#374151] text-[12px] font-semibold px-[12px] py-[8px] rounded-[12px] bg-white hover:bg-[#f8fafc] cursor-pointer transition-all duration-200 ease">
                        <i className="fa-solid fa-gear"></i>
                      </button>
                    </div>

                    <div className="mt-[24px] flex flex-col gap-[12px]">
                      <div>
                        <div className="flex items-center gap-[6px]">
                          <h2 className="text-[20px] font-bold text-[#1a202c]">{user.username}</h2>
                          <i className="fa-solid fa-circle-check text-[#3b82f6] text-[14px]"></i>
                        </div>
                        <span className="text-[12px] text-[#9ca3af]">@{user.username}</span>
                      </div>
                      <p className="text-[12px] text-[#374151] font-medium flex items-center gap-[6px]">
                        <span>Designer & creator</span> <span>·</span> <span>Building beautiful things</span> <span>✦</span> <span className="text-[#9ca3af]"><i className="fa-solid fa-location-dot text-[10px] mr-[4px]"></i>NYC</span>
                      </p>
                      <div className="flex items-center gap-[24px] pt-[8px] border-t border-[#f1f5f9]">
                        <div className="text-[12px] text-[#64748b]"><strong className="text-[#1a202c] font-bold text-[14px]">247</strong> Posts</div>
                        <div className="text-[12px] text-[#64748b]"><strong className="text-[#1a202c] font-bold text-[14px]">12.4K</strong> Followers</div>
                        <div className="text-[12px] text-[#64748b]"><strong className="text-[#1a202c] font-bold text-[14px]">891</strong> Following</div>
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
              </div>
            )}

          </main>
        </div>
      </>
    </ProtectedRoute>
  )
}
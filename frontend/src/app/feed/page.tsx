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
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #5B52E7 0%, #4C43D4 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  const TAB_BASE = {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#64748b',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    position: 'relative' as const
  }

  const TAB_ACTIVE = {
    ...TAB_BASE,
    background: '#EEF2FF',
    color: '#5B52E7'
  }

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

        <div style={{ fontFamily: 'inherit', color: '#1a202c', minHeight: '100vh', paddingBottom: '48px' }}>

          {/* Navbar */}
          <nav style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'white',
            borderBottom: '1px solid #e2e8f0',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <div style={{
                width: '36px',
                height: '36px',
                background: '#5B52E7',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '18px',
                boxShadow: '0 4px 6px rgba(91, 82, 231, 0.2)'
              }}>F</div>
              <span style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>FOMO</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#f8fafc',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0'
            }}>
              {['home', 'explore', 'messages', 'notifications', 'communities', 'profile'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  style={activeTab === tab ? TAB_ACTIVE : TAB_BASE}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab) {
                      (e.target as HTMLButtonElement).style.color = '#1a202c'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab) {
                      (e.target as HTMLButtonElement).style.color = '#64748b'
                    }
                  }}
                >
                  <i className={`fa-solid fa-${tab === 'home' ? 'house' : tab === 'explore' ? 'compass' : tab === 'messages' ? 'comment-dots' : tab === 'notifications' ? 'bell' : tab === 'communities' ? 'users' : 'user'}`}></i>
                  <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                  {(tab === 'messages' || tab === 'notifications') && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#06b6d4',
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid white'
                    }}>{tab === 'messages' ? '4' : '3'}</span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button style={{
                background: '#5B52E7',
                color: 'white',
                padding: '8px 20px',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 4px 6px rgba(91, 82, 231, 0.1)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#4C43D4'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#5B52E7'
              }}>
                <i className="fa-solid fa-plus" style={{ fontSize: '12px' }}></i>
                <span>Create</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => switchTab('profile')}>
                <div style={{ position: 'relative' }}>
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt={`${user.username} Avatar`} style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid #e2e8f0'
                  }} />
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '10px',
                    height: '10px',
                    background: '#10b981',
                    border: '2px solid white',
                    borderRadius: '50%'
                  }}></span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#dc2626'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ef4444'
                }}
              >
                <i className="fa-solid fa-sign-out-alt" style={{ fontSize: '14px' }}></i>
                <span>Logout</span>
              </button>
            </div>
          </nav>

          <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px', marginTop: '32px' }}>

            {/* HOME TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'home' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '60px 40px',
                  textAlign: 'center',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  maxWidth: '500px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', marginBottom: '12px' }}>Update Coming Soon</h2>
                  <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>We're working hard to bring you an amazing feed experience. Stay tuned!</p>
                </div>
              </div>
            )}

            {/* EXPLORE TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'explore' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '60px 40px',
                  textAlign: 'center',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  maxWidth: '500px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', marginBottom: '12px' }}>Update Coming Soon</h2>
                  <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>Explore feature is under development. Check back soon!</p>
                </div>
              </div>
            )}

            {/* MESSAGES TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'messages' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '60px 40px',
                  textAlign: 'center',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  maxWidth: '500px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', marginBottom: '12px' }}>Update Coming Soon</h2>
                  <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>Messaging feature is coming soon. We'll notify you when it's ready!</p>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'notifications' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '60px 40px',
                  textAlign: 'center',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  maxWidth: '500px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔔</div>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', marginBottom: '12px' }}>Update Coming Soon</h2>
                  <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>Notifications are being refined. Stay tuned for updates!</p>
                </div>
              </div>
            )}

            {/* COMMUNITIES TAB - COMMENTED OUT: Update coming soon */}
            {activeTab === 'communities' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '60px 40px',
                  textAlign: 'center',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  maxWidth: '500px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a202c', marginBottom: '12px' }}>Update Coming Soon</h2>
                  <p style={{ color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>Communities feature is being built. Exciting things coming your way!</p>
                </div>
              </div>
            )}

            {/* PROFILE TAB - KEPT AS IS - NO CHANGES */}
            {activeTab === 'profile' && (
              <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    height: '192px',
                    background: '#d1d5db',
                    position: 'relative'
                  }}>
                    <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80" style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }} />
                    <button style={{
                      position: 'absolute',
                      top: '16px',
                      right: '16px',
                      background: 'rgba(0, 0, 0, 0.5)',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '500',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}>
                      <i className="fa-regular fa-image"></i>
                      <span>Edit cover</span>
                    </button>
                  </div>
                  <div style={{ padding: '24px', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-64px', left: '24px' }}>
                      <div style={{ position: 'relative' }}>
                        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80" style={{
                          width: '112px',
                          height: '112px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '4px solid white',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }} />
                        <span style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '8px',
                          width: '16px',
                          height: '16px',
                          background: '#10b981',
                          border: '2px solid white',
                          borderRadius: '50%'
                        }}></span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', marginBottom: '24px' }}>
                      <button style={{
                        border: '1px solid #e2e8f0',
                        color: '#374151',
                        fontSize: '12px',
                        fontWeight: '600',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                        <i className="fa-solid fa-pen" style={{ fontSize: '10px' }}></i>
                        <span>Edit profile</span>
                      </button>
                      <button onClick={handleLogout} style={{
                        border: '1px solid #e2e8f0',
                        color: '#374151',
                        fontSize: '12px',
                        fontWeight: '600',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        background: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                        <i className="fa-solid fa-gear"></i>
                      </button>
                    </div>

                    <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a202c' }}>{user.username}</h2>
                          <i className="fa-solid fa-circle-check" style={{ color: '#3b82f6', fontSize: '14px' }}></i>
                        </div>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>@{user.username}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#374151', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Designer & creator</span> <span>·</span> <span>Building beautiful things</span> <span>✦</span> <span style={{ color: '#9ca3af' }}><i className="fa-solid fa-location-dot" style={{ fontSize: '10px', marginRight: '4px' }}></i>NYC</span>
                      </p>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '24px',
                        paddingTop: '8px',
                        borderTop: '1px solid #f1f5f9'
                      }}>
                        <div style={{ fontSize: '12px', color: '#64748b' }}><strong style={{ color: '#1a202c', fontWeight: 'bold', fontSize: '14px' }}>247</strong> Posts</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}><strong style={{ color: '#1a202c', fontWeight: 'bold', fontSize: '14px' }}>12.4K</strong> Followers</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}><strong style={{ color: '#1a202c', fontWeight: 'bold', fontSize: '14px' }}>891</strong> Following</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  maxWidth: '336px',
                  margin: '0 auto'
                }}>
                  {['Posts', 'Media', 'Saved'].map((tab) => (
                    <button key={tab} style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '8px',
                      fontSize: '12px',
                      fontWeight: tab === 'Posts' ? 'bold' : '500',
                      color: tab === 'Posts' ? '#5B52E7' : '#9ca3af',
                      background: tab === 'Posts' ? '#EEF2FF' : 'transparent',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (tab !== 'Posts') e.currentTarget.style.color = '#1a202c'
                    }}
                    onMouseLeave={(e) => {
                      if (tab !== 'Posts') e.currentTarget.style.color = '#9ca3af'
                    }}>
                      <i className={`fa-${tab === 'Posts' ? 'solid fa-table-cells' : 'regular fa-' + (tab === 'Media' ? 'image' : 'bookmark')}`} style={{ fontSize: '10px' }}></i>
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
'use client'

import { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { resolveMediaUrl, profileAPI, followAPI, friendsAPI } from '@/lib/api'

// Inline styles for the overlay positioning only - kept out of Tailwind
// classes so this modal renders correctly even if the JIT compiler hasn't
// picked up this file (new files sometimes get missed by the dev-server
// watcher, especially on Windows). Same convention as EditProfileModal.
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.6)', // Darkened to 0.6 for better contrast
}

class FollowListErrorBoundary extends Component<
  { onClose: () => void; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FollowListModal crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      const content = (
        <div style={overlayStyle} onClick={this.props.onClose}>
          <div
            className="w-[400px] rounded-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.15)] p-[20px]"
            // FORCED INLINE WHITE BACKGROUND
            style={{ backgroundColor: '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[14px] font-[600] text-[#dc2626] mb-[8px]">
              Something went wrong loading this list.
            </p>
            <p className="text-[12px] text-[#64748b] mb-[16px]">{this.state.error.message}</p>
            <button
              onClick={this.props.onClose}
              className="px-[14px] py-[8px] text-[13px] font-[600] text-white bg-[#5B52E7] border-none rounded-[8px] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )
      if (typeof document === 'undefined') return null
      return createPortal(content, document.body)
    }
    return this.props.children
  }
}

export type FollowListType = 'followers' | 'following' | 'friends'

export interface FollowListUser {
  id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
}

interface FollowListModalProps {
  userId: string
  currentUserId: string
  initialType: FollowListType
  onClose: () => void
  onRelationshipChanged?: () => void
}

type RelationStatus = 'self' | 'none' | 'following' | 'pending' | 'friends'

const TABS: { type: FollowListType; label: string }[] = [
  { type: 'followers', label: 'Followers' },
  { type: 'following', label: 'Following' },
  { type: 'friends', label: 'Friends' },
]

const PAGE_SIZE = 20

const fetchersByType: Record<
  FollowListType,
  (userId: string, skip: number, limit: number) => Promise<{ data: FollowListUser[] }>
> = {
  followers: (userId, skip, limit) => profileAPI.getFollowers(userId, skip, limit),
  following: (userId, skip, limit) => profileAPI.getFollowing(userId, skip, limit),
  friends: (userId, skip, limit) => profileAPI.getFriends(userId, skip, limit),
}

function FollowListModalInner({
  userId,
  currentUserId,
  initialType,
  onClose,
  onRelationshipChanged,
}: FollowListModalProps) {
  const [activeTab, setActiveTab] = useState<FollowListType>(initialType)

  const [listCache, setListCache] = useState<Partial<Record<FollowListType, FollowListUser[]>>>({})
  const [loadingTabs, setLoadingTabs] = useState<Partial<Record<FollowListType, boolean>>>({})
  const [errorTabs, setErrorTabs] = useState<Partial<Record<FollowListType, string>>>({})

  const [hasMoreTabs, setHasMoreTabs] = useState<Partial<Record<FollowListType, boolean>>>({})
  const [loadingMoreTabs, setLoadingMoreTabs] = useState<Partial<Record<FollowListType, boolean>>>({})

  const [viewerFollowingIds, setViewerFollowingIds] = useState<Set<string> | null>(null)
  const [viewerFriendIds, setViewerFriendIds] = useState<Set<string> | null>(null)
  const [viewerOutgoing, setViewerOutgoing] = useState<Map<string, string> | null>(null)
  const [viewerDataError, setViewerDataError] = useState(false)

  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const setRowLoading = (id: string, loading: boolean) => {
    setActionLoading((prev) => {
      const next = new Set(prev)
      if (loading) next.add(id)
      else next.delete(id)
      return next
    })
  }

  useEffect(() => {
    let cancelled = false

    const safeCall = <T,>(label: string, promise: Promise<T> | undefined): Promise<T | null> => {
      if (!promise || typeof (promise as any).then !== 'function') {
        console.error(`FollowListModal: ${label} did not return a promise — check that this method exists on your API client.`)
        return Promise.resolve(null)
      }
      return promise.catch((err) => {
        console.error(`FollowListModal: ${label} failed:`, err)
        return null
      })
    }

    Promise.all([
      safeCall('followAPI.following(currentUserId)', followAPI?.following?.(currentUserId)),
      safeCall('friendsAPI.listFriends()', friendsAPI?.listFriends?.()),
      safeCall('friendsAPI.listOutgoing()', friendsAPI?.listOutgoing?.()),
    ])
      .then(([followingRes, friendsRes, outgoingRes]) => {
        if (cancelled) return
        if (!followingRes || !friendsRes || !outgoingRes) {
          setViewerDataError(true)
          return
        }
        setViewerFollowingIds(new Set((followingRes as any).data.map((u: any) => u.id)))
        setViewerFriendIds(new Set((friendsRes as any).data.map((f: any) => f.friend.id)))
        setViewerOutgoing(
          new Map(
            (outgoingRes as any).data
              .filter((r: any) => r.status === 'pending')
              .map((r: any) => [r.to_user_id, r.id])
          )
        )
      })
      .catch((err) => {
        console.error('FollowListModal: unexpected error resolving viewer relationship data:', err)
        if (!cancelled) setViewerDataError(true)
      })

    return () => {
      cancelled = true
    }
  }, [currentUserId])

  useEffect(() => {
    if (listCache[activeTab] !== undefined || loadingTabs[activeTab]) return
    let cancelled = false
    setLoadingTabs((prev) => ({ ...prev, [activeTab]: true }))
    setErrorTabs((prev) => ({ ...prev, [activeTab]: undefined }))

    const fetcher = fetchersByType[activeTab]
    let call: Promise<{ data: FollowListUser[] }>
    try {
      call = fetcher(userId, 0, PAGE_SIZE)
      if (!call || typeof call.then !== 'function') {
        throw new Error(`profileAPI method for "${activeTab}" did not return a promise`)
      }
    } catch (err) {
      console.error(`FollowListModal: fetching "${activeTab}" tab threw synchronously:`, err)
      setErrorTabs((prev) => ({ ...prev, [activeTab]: 'Failed to load list.' }))
      setLoadingTabs((prev) => ({ ...prev, [activeTab]: false }))
      return
    }

    call
      .then((res) => {
        if (cancelled) return
        if (!res || !Array.isArray(res.data)) {
          throw new Error(`Unexpected response shape for "${activeTab}": ${JSON.stringify(res)}`)
        }
        setListCache((prev) => ({ ...prev, [activeTab]: res.data }))
        setHasMoreTabs((prev) => ({ ...prev, [activeTab]: res.data.length === PAGE_SIZE }))
      })
      .catch((err) => {
        console.error(`FollowListModal: fetching "${activeTab}" tab failed:`, err)
        if (!cancelled) setErrorTabs((prev) => ({ ...prev, [activeTab]: 'Failed to load list.' }))
      })
      .finally(() => {
        if (!cancelled) setLoadingTabs((prev) => ({ ...prev, [activeTab]: false }))
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, userId])

  const loadMore = (tab: FollowListType) => {
    const current = listCache[tab]
    if (!current || loadingTabs[tab] || loadingMoreTabs[tab] || hasMoreTabs[tab] === false) return

    setLoadingMoreTabs((prev) => ({ ...prev, [tab]: true }))

    let call: Promise<{ data: FollowListUser[] }>
    try {
      call = fetchersByType[tab](userId, current.length, PAGE_SIZE)
      if (!call || typeof call.then !== 'function') {
        throw new Error(`profileAPI method for "${tab}" did not return a promise`)
      }
    } catch (err) {
      console.error(`FollowListModal: loading more "${tab}" threw synchronously:`, err)
      setLoadingMoreTabs((prev) => ({ ...prev, [tab]: false }))
      return
    }

    call
      .then((res) => {
        if (!res || !Array.isArray(res.data)) {
          throw new Error(`Unexpected response shape for "${tab}": ${JSON.stringify(res)}`)
        }
        setListCache((prev) => ({ ...prev, [tab]: [...(prev[tab] || []), ...res.data] }))
        setHasMoreTabs((prev) => ({ ...prev, [tab]: res.data.length === PAGE_SIZE }))
      })
      .catch((err) => {
        console.error(`FollowListModal: loading more "${tab}" failed:`, err)
      })
      .finally(() => {
        setLoadingMoreTabs((prev) => ({ ...prev, [tab]: false }))
      })
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      loadMore(activeTab)
    }
  }

  const getRelationStatus = (rowUserId: string): RelationStatus => {
    if (rowUserId === currentUserId) return 'self'
    if (viewerFriendIds?.has(rowUserId)) return 'friends'
    if (viewerOutgoing?.has(rowUserId)) return 'pending'
    if (viewerFollowingIds?.has(rowUserId)) return 'following'
    return 'none'
  }

  const handleFollow = async (rowUserId: string) => {
    setRowLoading(rowUserId, true)
    try {
      await followAPI.follow(rowUserId)
      setViewerFollowingIds((prev) => new Set(prev).add(rowUserId))
      onRelationshipChanged?.()
    } catch (err) {
    } finally {
      setRowLoading(rowUserId, false)
    }
  }

  const handleUnfollow = async (rowUserId: string) => {
    setRowLoading(rowUserId, true)
    try {
      await followAPI.unfollow(rowUserId)
      setViewerFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(rowUserId)
        return next
      })
      onRelationshipChanged?.()
    } catch (err) {
    } finally {
      setRowLoading(rowUserId, false)
    }
  }

  const handleAddFriend = async (rowUserId: string) => {
    setRowLoading(rowUserId, true)
    try {
      const res = await friendsAPI.send(rowUserId)
      setViewerOutgoing((prev) => new Map(prev).set(rowUserId, res.data.id))
      onRelationshipChanged?.()
    } catch (err) {
    } finally {
      setRowLoading(rowUserId, false)
    }
  }

  const handleCancelRequest = async (rowUserId: string) => {
    const requestId = viewerOutgoing?.get(rowUserId)
    if (!requestId) return
    setRowLoading(rowUserId, true)
    try {
      await friendsAPI.cancel(requestId)
      setViewerOutgoing((prev) => {
        const next = new Map(prev)
        next.delete(rowUserId)
        return next
      })
      onRelationshipChanged?.()
    } catch (err) {
    } finally {
      setRowLoading(rowUserId, false)
    }
  }

  const handleUnfriend = async (rowUserId: string, rowName: string) => {
    const confirmed = window.confirm(`Unfriend ${rowName}? You can send a new friend request later.`)
    if (!confirmed) return
    setRowLoading(rowUserId, true)
    try {
      await friendsAPI.unfriend(rowUserId)
      setViewerFriendIds((prev) => {
        const next = new Set(prev)
        next.delete(rowUserId)
        return next
      })
      if (userId === currentUserId && activeTab === 'friends') {
        setListCache((prev) => ({
          ...prev,
          friends: (prev.friends || []).filter((u) => u.id !== rowUserId),
        }))
      }
      onRelationshipChanged?.()
    } catch (err) {
    } finally {
      setRowLoading(rowUserId, false)
    }
  }

  const renderRelationButton = (u: FollowListUser) => {
    const status = getRelationStatus(u.id)
    if (status === 'self') return null

    const isLoading = actionLoading.has(u.id)

    if (status === 'friends') {
      return (
        <button
          onClick={(e) => {
            e.preventDefault()
            handleUnfriend(u.id, u.display_name || u.username)
          }}
          disabled={isLoading || !viewerFriendIds}
          className="group flex-shrink-0 px-[12px] py-[6px] text-[12px] font-[600] text-[#16a34a] bg-[#f0fdf4] border border-[#bbf7d0] rounded-[7px] cursor-pointer flex items-center gap-[5px] hover:text-[#dc2626] hover:bg-[#fef2f2] hover:border-[#fecaca] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i className="fa-solid fa-user-check text-[11px] group-hover:hidden"></i>
          <i className="fa-solid fa-user-xmark text-[11px] hidden group-hover:inline"></i>
          <span className="group-hover:hidden">{isLoading ? '...' : 'Friends'}</span>
          <span className="hidden group-hover:inline">{isLoading ? '...' : 'Unfriend'}</span>
        </button>
      )
    }

    return (
      <div className="flex-shrink-0 flex items-center gap-[6px]">
        <button
          onClick={(e) => {
            e.preventDefault()
            status === 'following' ? handleUnfollow(u.id) : handleFollow(u.id)
          }}
          disabled={isLoading || !viewerFollowingIds}
          className={
            status === 'following'
              ? 'px-[12px] py-[6px] text-[12px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[7px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed'
              : 'px-[12px] py-[6px] text-[12px] font-[600] text-white bg-[#5B52E7] border-none rounded-[7px] cursor-pointer hover:bg-[#4C43D4] disabled:opacity-60 disabled:cursor-not-allowed'
          }
        >
          {isLoading ? '...' : status === 'following' ? 'Following' : 'Follow'}
        </button>

        {status === 'pending' ? (
          <button
            onClick={(e) => {
              e.preventDefault()
              handleCancelRequest(u.id)
            }}
            disabled={isLoading}
            aria-label="Cancel friend request"
            title="Pending — click to cancel"
            className="w-[26px] h-[26px] flex items-center justify-center text-[12px] text-[#b45309] bg-[#fffbeb] border border-[#fde68a] rounded-[7px] cursor-pointer hover:bg-[#fef3c7] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-clock"></i>
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault()
              handleAddFriend(u.id)
            }}
            disabled={isLoading || !viewerOutgoing}
            aria-label="Add friend"
            title="Add friend"
            className="w-[26px] h-[26px] flex items-center justify-center text-[12px] text-[#374151] bg-white border border-[#e2e8f0] rounded-[7px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-user-plus"></i>
          </button>
        )}
      </div>
    )
  }

  const users = listCache[activeTab]
  const isLoading = loadingTabs[activeTab]
  const isLoadingMore = loadingMoreTabs[activeTab]
  const error = errorTabs[activeTab]

  if (!mounted) return null

  const modalContent = (
    <div style={overlayStyle} onClick={onClose}>
      <div
        className="w-[400px] max-h-[75vh] rounded-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden"
        // FORCED INLINE WHITE BACKGROUND 
        style={{ backgroundColor: '#ffffff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-[18px] py-[14px] border-b border-[#e2e8f0]">
          <h2 className="text-[15px] font-[700] text-[#0f172a]">
            {TABS.find((t) => t.type === activeTab)?.label}
            {!isLoading && !error && users && (
              <span className="ml-[6px] text-[13px] font-[500] text-[#64748b]">({users.length})</span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-[28px] h-[28px] flex items-center justify-center text-[#64748b] hover:text-[#0f172a] bg-transparent border-none cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex border-b border-[#e2e8f0]">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={
                activeTab === tab.type
                  ? 'flex-1 py-[10px] text-[13px] font-[700] text-[#5B52E7] bg-transparent border-none border-b-[2px] border-[#5B52E7] cursor-pointer'
                  : 'flex-1 py-[10px] text-[13px] font-[600] text-[#64748b] bg-transparent border-none border-b-[2px] border-transparent cursor-pointer hover:text-[#374151]'
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1" onScroll={handleScroll}>
          {isLoading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading...</div>}

          {!isLoading && error && (
            <div className="text-center text-[#dc2626] text-[14px] py-[40px]">{error}</div>
          )}

          {!isLoading && !error && users && users.length === 0 && (
            <div className="text-center text-[#64748b] text-[14px] py-[40px]">
              No {TABS.find((t) => t.type === activeTab)?.label.toLowerCase()} yet.
            </div>
          )}

          {!isLoading &&
            !error &&
            users?.map((u) => (
              <Link
                key={u.id}
                href={`/profile/${u.id}`}
                onClick={onClose}
                className="flex items-center gap-[10px] px-[18px] py-[10px] hover:bg-[#f8fafc]"
              >
                <img
                  src={
                    resolveMediaUrl(u.avatar_url) ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`
                  }
                  alt={`${u.username} avatar`}
                  className="w-[38px] h-[38px] rounded-full object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-[600] text-[#0f172a] truncate">
                    {u.display_name || u.username}
                  </div>
                  <div className="text-[12px] text-[#64748b] truncate">@{u.username}</div>
                </div>
                {renderRelationButton(u)}
              </Link>
            ))}

          {!isLoading && !error && users && users.length > 0 && isLoadingMore && (
            <div className="text-center text-[#64748b] text-[12px] py-[14px]">Loading more...</div>
          )}
        </div>
      </div>
    </div>
  )
  return createPortal(modalContent, document.body)
}

export function FollowListModal(props: FollowListModalProps) {
  return (
    <FollowListErrorBoundary onClose={props.onClose}>
      <FollowListModalInner {...props} />
    </FollowListErrorBoundary>
  )
}
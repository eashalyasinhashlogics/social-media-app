'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'
import { friendsAPI, usersAPI, conversationsAPI, extractErrorMessage, FriendRequest, Friendship } from '@/lib/api'

interface ResolvedUser {
  id: string
  username: string
}

const OUTLINE_BTN =
  'px-[14px] py-[7px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed'

function RowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-white border border-[#e2e8f0] rounded-[10px] px-[16px] py-[12px]">
      {children}
    </div>
  )
}

export default function FriendsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<Friendship[]>([])
  const [userCache, setUserCache] = useState<Record<string, ResolvedUser>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // FriendRequestResponse only carries from_user_id/to_user_id (no
  // username), so resolve each unique id once via GET /users/{id} and
  // cache the result instead of re-fetching on every render.
  const resolveUsers = useCallback(async (userIds: string[]) => {
    setUserCache((prevCache) => {
      const unresolved = Array.from(new Set(userIds)).filter((id) => !prevCache[id])
      if (unresolved.length === 0) return prevCache

      Promise.all(
        unresolved.map((id) =>
          usersAPI
            .getById(id)
            .then((res) => [id, { id, username: res.data.username }] as const)
            .catch(() => [id, { id, username: 'Unknown user' }] as const)
        )
      ).then((results) => {
        setUserCache((prev) => {
          const next = { ...prev }
          for (const [id, resolved] of results) next[id] = resolved
          return next
        })
      })

      return prevCache
    })
  }, [])

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [outgoingRes, friendsRes] = await Promise.all([
        friendsAPI.listOutgoing(),
        friendsAPI.listFriends(),
      ])
      setOutgoing(outgoingRes.data)
      setFriends(friendsRes.data)
      resolveUsers(outgoingRes.data.map((r) => r.to_user_id))
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load friends.'))
    } finally {
      setLoading(false)
    }
  }, [resolveUsers])

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user, loadAll])

  const handleCancel = async (requestId: string) => {
    setBusyId(requestId)
    setActionError(null)
    try {
      await friendsAPI.cancel(requestId)
      setOutgoing((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Could not cancel request.'))
    } finally {
      setBusyId(null)
    }
  }

  const [messageBusyId, setMessageBusyId] = useState<string | null>(null)

  const handleMessage = async (friendId: string, username: string) => {
    if (messageBusyId) return
    setMessageBusyId(friendId)
    setActionError(null)
    try {
      const res = await conversationsAPI.start(friendId)
      router.push(`/messages/${res.data.id}?otherUserId=${friendId}&otherUsername=${encodeURIComponent(username)}`)
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Could not start conversation.'))
    } finally {
      setMessageBusyId(null)
    }
  }

  const handleUnfriend = async (userId: string) => {
    setBusyId(userId)
    setActionError(null)
    try {
      await friendsAPI.unfriend(userId)
      setFriends((prev) => prev.filter((f) => f.friend.id !== userId))
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Could not remove friend.'))
    } finally {
      setBusyId(null)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-[600px] mx-auto">
      <h1 className="text-[20px] font-[800] text-[#0f172a] mb-[20px]">Friends</h1>

      {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading...</div>}

      {error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px] mb-[16px]">
          {error}
        </div>
      )}

      {actionError && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px] mb-[16px]">
          {actionError}
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="text-[13px] text-[#64748b] mb-[24px]">
            Incoming friend requests now show up under{' '}
            <Link href="/notifications" className="text-[#5B52E7] font-[600] no-underline hover:underline">
              Notifications
            </Link>
            .
          </p>

          {/* Outgoing requests */}
          <section className="mb-[28px]">
            <h2 className="text-[15px] font-[700] text-[#0f172a] mb-[10px]">Sent requests</h2>
            {outgoing.length === 0 ? (
              <p className="text-[13px] text-[#64748b]">No pending sent requests.</p>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {outgoing.map((req) => (
                  <RowShell key={req.id}>
                    <Link
                      href={`/profile/${req.to_user_id}`}
                      className="text-[14px] font-[600] text-[#0f172a] no-underline hover:underline"
                    >
                      {userCache[req.to_user_id]?.username || 'Loading...'}
                    </Link>
                    <button onClick={() => handleCancel(req.id)} disabled={busyId === req.id} className={OUTLINE_BTN}>
                      Cancel
                    </button>
                  </RowShell>
                ))}
              </div>
            )}
          </section>

          {/* Friends list */}
          <section>
            <h2 className="text-[15px] font-[700] text-[#0f172a] mb-[10px]">
              Friends{friends.length > 0 ? ` (${friends.length})` : ''}
            </h2>
            {friends.length === 0 ? (
              <p className="text-[13px] text-[#64748b]">No friends yet.</p>
            ) : (
              <div className="flex flex-col gap-[8px]">
                {friends.map((f) => (
                  <RowShell key={f.friend.id}>
                    <Link
                      href={`/profile/${f.friend.id}`}
                      className="text-[14px] font-[600] text-[#0f172a] no-underline hover:underline"
                    >
                      {f.friend.username}
                    </Link>
                    <div className="flex items-center gap-[8px]">
                      <button
                        onClick={() => handleMessage(f.friend.id, f.friend.username)}
                        disabled={messageBusyId === f.friend.id}
                        className={OUTLINE_BTN}
                      >
                        {messageBusyId === f.friend.id ? '...' : 'Message'}
                      </button>
                      <button onClick={() => handleUnfriend(f.friend.id)} disabled={busyId === f.friend.id} className={OUTLINE_BTN}>
                        Unfriend
                      </button>
                    </div>
                  </RowShell>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
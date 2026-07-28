'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { friendsAPI, usersAPI, extractErrorMessage, FriendRequest } from '@/lib/api'

interface ResolvedUser {
  id: string
  username: string
}

export default function NotificationsPage() {
  const { user } = useAuthStore()

  const [incoming, setIncoming] = useState<FriendRequest[]>([])
  const [userCache, setUserCache] = useState<Record<string, ResolvedUser>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // FriendRequestResponse only carries from_user_id (no username) -
  // resolve each unique id once via GET /users/{id} and cache it,
  // same approach used on the Friends page.
  const resolveUsers = useCallback((userIds: string[]) => {
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

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await friendsAPI.listIncoming()
      setIncoming(res.data)
      resolveUsers(res.data.map((r) => r.from_user_id))
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load notifications.'))
    } finally {
      setLoading(false)
    }
  }, [resolveUsers])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  const handleAccept = async (requestId: string) => {
    setBusyId(requestId)
    setActionError(null)
    try {
      await friendsAPI.accept(requestId)
      setIncoming((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Could not accept request.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    setBusyId(requestId)
    setActionError(null)
    try {
      await friendsAPI.reject(requestId)
      setIncoming((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err: any) {
      setActionError(extractErrorMessage(err, 'Could not reject request.'))
    } finally {
      setBusyId(null)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-[600px] mx-auto">
      <h1 className="text-[20px] font-[800] text-[#0f172a] mb-[20px]">Notifications</h1>

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

      {!loading && !error && incoming.length === 0 && (
        <div className="text-center py-[80px]">
          <div className="w-[64px] h-[64px] rounded-full bg-[#EEF2FF] text-[#5B52E7] flex items-center justify-center mx-auto mb-[16px] text-[24px]">
            <i className="fa-solid fa-bell"></i>
          </div>
          <h2 className="text-[20px] font-[700] text-[#1a202c] mb-[8px]">Notifications</h2>
          <p className="text-[14px] text-[#64748b]">No pending friend requests right now.</p>
        </div>
      )}

      {!loading && !error && incoming.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          {incoming.map((req) => {
            const sender = userCache[req.from_user_id]
            return (
              <div
                key={req.id}
                className="flex items-center gap-[12px] bg-white border border-[#e2e8f0] rounded-[12px] px-[16px] py-[14px]"
              >
                <img
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${sender?.username || req.from_user_id}`}
                  alt=""
                  className="w-[40px] h-[40px] rounded-full object-cover border border-[#e2e8f0] flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-[#1a202c]">
                    <Link
                      href={`/profile/${req.from_user_id}`}
                      className="font-[700] text-[#0f172a] no-underline hover:underline"
                    >
                      {sender?.username || 'Someone'}
                    </Link>{' '}
                    sent you a friend request.
                  </p>
                </div>
                <div className="flex items-center gap-[8px] flex-shrink-0">
                  <button
                    onClick={() => handleAccept(req.id)}
                    disabled={busyId === req.id}
                    className="px-[14px] py-[7px] text-[13px] font-[600] text-white bg-[#5B52E7] border-none rounded-[8px] cursor-pointer hover:bg-[#4C43D4] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busyId === req.id ? '...' : 'Add friend'}
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={busyId === req.id}
                    className="px-[14px] py-[7px] text-[13px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
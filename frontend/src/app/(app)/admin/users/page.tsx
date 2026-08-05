'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '@/store/authStore'
import { adminAPI, extractErrorMessage, AdminUser, AdminUserUpdatePayload } from '@/lib/api'
import { AdminToast, ToastState } from '@/components/admin/AdminToast'

const PAGE_SIZE = 20

const STATUS_OPTIONS = ['', 'active', 'blocked', 'suspended', 'deleted'] as const
const ROLE_OPTIONS = ['', 'user', 'admin'] as const

const SELECT_CLASSES =
  'px-[12px] py-[8px] text-[13px] font-[500] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] outline-none focus:border-[#5B52E7] cursor-pointer'

const OUTLINE_BTN =
  'px-[12px] py-[6px] text-[12px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-50 disabled:cursor-not-allowed'

const DANGER_BTN =
  'px-[12px] py-[6px] text-[12px] font-[600] text-[#ef4444] bg-white border border-[#fecaca] rounded-[8px] cursor-pointer hover:bg-[#fef2f2] disabled:opacity-50 disabled:cursor-not-allowed'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-[#dcfce7] text-[#166534]',
    blocked: 'bg-[#fef2f2] text-[#991b1b]',
    suspended: 'bg-[#fef9c3] text-[#854d0e]',
    deleted: 'bg-[#f1f5f9] text-[#64748b]',
  }
  return (
    <span className={`text-[11px] font-[700] px-[8px] py-[2px] rounded-full capitalize ${styles[status] || 'bg-[#f1f5f9] text-[#64748b]'}`}>
      {status}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`text-[11px] font-[700] px-[8px] py-[2px] rounded-full capitalize ${
        role === 'admin' ? 'bg-[#EEF2FF] text-[#5B52E7]' : 'bg-[#f1f5f9] text-[#374151]'
      }`}
    >
      {role}
    </span>
  )
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser
  onClose: () => void
  onSaved: (updated: AdminUser) => void
}) {
  const [username, setUsername] = useState(user.username)
  const [role, setRole] = useState(user.role)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Ensure portal rendering occurs only on the client side (prevents Next.js SSR hydration error)
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSave = async () => {
    const trimmedUsername = username.trim()
    if (!trimmedUsername) return

    const payload: AdminUserUpdatePayload = {}
    if (trimmedUsername !== user.username) payload.username = trimmedUsername
    if (role !== user.role) payload.role = role as 'user' | 'admin'

    // If no changes were made, close modal without making an API request
    if (Object.keys(payload).length === 0) {
      onClose()
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await adminAPI.updateUser(user.id, payload)
      onSaved(res.data)
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to update user.'))
    } finally {
      setSaving(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(15,23,42,0.5)] flex items-center justify-center z-[9999] p-[16px]"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="bg-white rounded-[14px] shadow-[0_20px_40px_rgba(0,0,0,0.15)] w-full max-w-[400px] p-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16px] font-[700] text-[#0f172a] mb-[16px]">Edit user</h3>

        {error && (
          <div className="py-[8px] px-[10px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[12px] mb-[12px]">
            {error}
          </div>
        )}

        <label className="block text-[12px] font-[600] text-[#374151] mb-[6px]">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={100}
          placeholder="Minimum 3 characters"
          className="w-full px-[12px] py-[8px] border border-[#e2e8f0] rounded-[8px] text-[14px] outline-none focus:border-[#5B52E7] mb-[14px]"
        />

        <label className="block text-[12px] font-[600] text-[#374151] mb-[6px]">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={`${SELECT_CLASSES} w-full mb-[20px]`}
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>

        <div className="flex justify-end gap-[8px]">
          <button type="button" onClick={onClose} disabled={saving} className={OUTLINE_BTN}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || (username.trim().length > 0 && username.trim().length < 3)}
            className="px-[14px] py-[7px] text-[12px] font-[700] text-white bg-[#5B52E7] hover:bg-[#4C43D4] border-none rounded-[8px] cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [roleFilter, setRoleFilter] = useState<string>('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.listUsers({
        skip,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
      })
      setUsers(res.data.items)
      setTotal(res.data.total)
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load users.'))
    } finally {
      setLoading(false)
    }
  }, [skip, statusFilter, roleFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value)
    setSkip(0)
  }
  const handleRoleFilter = (value: string) => {
    setRoleFilter(value)
    setSkip(0)
  }

  const replaceUser = (updated: AdminUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }

  const handleBlockToggle = async (target: AdminUser) => {
    setBusyId(target.id)
    try {
      const res =
        target.status === 'blocked' ? await adminAPI.unblockUser(target.id) : await adminAPI.blockUser(target.id)
      replaceUser(res.data)
      setToast({
        message: res.data.status === 'blocked' ? `${res.data.username} blocked.` : `${res.data.username} unblocked.`,
        variant: 'success',
      })
    } catch (err: any) {
      setToast({ message: extractErrorMessage(err, 'Could not update block status.'), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (target: AdminUser) => {
    if (!window.confirm(`Delete ${target.username}? This is a soft delete and can be reviewed later.`)) return
    setBusyId(target.id)
    try {
      const res = await adminAPI.deleteUser(target.id)
      replaceUser(res.data)
      setToast({ message: `${res.data.username} deleted.`, variant: 'success' })
    } catch (err: any) {
      setToast({ message: extractErrorMessage(err, 'Could not delete user.'), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const from = total === 0 ? 0 : skip + 1
  const to = Math.min(skip + PAGE_SIZE, total)
  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div>
      <div className="flex items-center justify-between mb-[20px] flex-wrap gap-[10px]">
        <h1 className="text-[20px] font-[800] text-[#0f172a]">Users</h1>
        <div className="flex items-center gap-[8px]">
          <select value={statusFilter} onChange={(e) => handleStatusFilter(e.target.value)} className={SELECT_CLASSES}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <select value={roleFilter} onChange={(e) => handleRoleFilter(e.target.value)} className={SELECT_CLASSES}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === '' ? 'All roles' : r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading users...</div>}

      {!loading && error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px]">
          {error}
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="text-center text-[#64748b] text-[14px] py-[40px]">No users match these filters.</div>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          <div className="bg-white border border-[#e2e8f0] rounded-[12px] overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">User</th>
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">Role</th>
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">Status</th>
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">Joined</th>
                  <th className="text-right text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id
                  const isDeleted = u.status === 'deleted'
                  return (
                    <tr key={u.id} className="border-b border-[#f1f5f9] last:border-b-0">
                      <td className="px-[16px] py-[12px]">
                        <div className="text-[14px] font-[600] text-[#1a202c]">
                          {u.username}
                          {isSelf && <span className="text-[11px] text-[#94a3b8] font-[500]"> (you)</span>}
                        </div>
                        <div className="text-[12px] text-[#94a3b8]">{u.email}</div>
                      </td>
                      <td className="px-[16px] py-[12px]">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-[16px] py-[12px]">
                        <div className="flex flex-col gap-[4px] items-start">
                          <StatusBadge status={u.status} />
                          {u.deleted_at && (
                            <span className="text-[10px] text-[#94a3b8]">deleted {formatDate(u.deleted_at)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-[16px] py-[12px] text-[13px] text-[#64748b]">{formatDate(u.created_at)}</td>
                      <td className="px-[16px] py-[12px]">
                        <div className="flex justify-end gap-[6px]">
                          <button
                            type="button"
                            onClick={() => setEditingUser(u)}
                            disabled={isDeleted}
                            className={OUTLINE_BTN}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBlockToggle(u)}
                            disabled={busyId === u.id || isSelf || isDeleted}
                            className={OUTLINE_BTN}
                          >
                            {busyId === u.id ? '...' : u.status === 'blocked' ? 'Unblock' : 'Block'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={busyId === u.id || isSelf || isDeleted}
                            className={DANGER_BTN}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-[14px] flex-wrap gap-[10px]">
            <span className="text-[13px] text-[#64748b]">
              Showing {from}-{to} of {total}
            </span>
            <div className="flex gap-[8px]">
              <button
                type="button"
                onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
                disabled={!canPrev}
                className={OUTLINE_BTN}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setSkip((s) => s + PAGE_SIZE)}
                disabled={!canNext}
                className={OUTLINE_BTN}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {editingUser && (
        <EditUserModal
          key={editingUser.id}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            replaceUser(updated)
            setEditingUser(null)
            setToast({ message: `${updated.username} updated.`, variant: 'success' })
          }}
        />
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
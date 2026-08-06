'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { adminAPI, extractErrorMessage, AuditLog, AdminUser } from '@/lib/api'

const PAGE_SIZE = 50

const ACTION_OPTIONS = [
  '',
  'user_block',
  'user_unblock',
  'user_delete',
  'user_edit',
  'post_edit',
  'post_delete',
] as const

const ENTITY_TYPE_OPTIONS = ['', 'user', 'post'] as const

const ACTION_META: Record<string, { label: string; classes: string }> = {
  user_block: { label: 'User blocked', classes: 'bg-[#fef2f2] text-[#991b1b]' },
  user_unblock: { label: 'User unblocked', classes: 'bg-[#dcfce7] text-[#166534]' },
  user_delete: { label: 'User deleted', classes: 'bg-[#fef2f2] text-[#991b1b]' },
  user_edit: { label: 'User edited', classes: 'bg-[#EEF2FF] text-[#5B52E7]' },
  post_edit: { label: 'Post edited', classes: 'bg-[#EEF2FF] text-[#5B52E7]' },
  post_delete: { label: 'Post deleted', classes: 'bg-[#fef2f2] text-[#991b1b]' },
}

function actionMeta(action: string) {
  return ACTION_META[action] || { label: action, classes: 'bg-[#f1f5f9] text-[#374151]' }
}

function EntityTypeBadge({ entityType }: { entityType: string }) {
  const classes = entityType === 'user' ? 'bg-[#f0fdfa] text-[#0f766e]' : 'bg-[#fdf4ff] text-[#a21caf]'
  return (
    <span className={`text-[11px] font-[700] px-[8px] py-[2px] rounded-full capitalize ${classes}`}>
      {entityType}
    </span>
  )
}

const SELECT_CLASSES =
  'px-[12px] py-[8px] text-[13px] font-[500] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] outline-none focus:border-[#5B52E7] cursor-pointer'

const INPUT_CLASSES =
  'px-[12px] py-[8px] text-[13px] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] outline-none focus:border-[#5B52E7] w-full sm:w-[220px]'

const OUTLINE_BTN =
  'px-[12px] py-[6px] text-[12px] font-[600] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] cursor-pointer hover:bg-[#f8fafc] disabled:opacity-50 disabled:cursor-not-allowed'

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`
}

function DiffValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-[#cbd5e1] italic">—</span>
  }
  if (typeof value === 'object') {
    return <span className="whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</span>
  }
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>
}

function AuditLogDetailModal({
  log,
  adminUsername,
  loading,
  error,
  onRetry,
  onClose,
}: {
  log: AuditLog
  adminUsername: string | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onClose: () => void
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Depend explicitly on the fields that actually drive the diff, not just
  // the `log` object reference. This keeps the diff table correct even if
  // some future caller ever mutates fields on the same object instead of
  // replacing it wholesale.
  const keys = useMemo(() => {
    const prevKeys = Object.keys(log.previous_data || {})
    const newKeys = Object.keys(log.new_data || {})
    return Array.from(new Set([...prevKeys, ...newKeys]))
  }, [log.previous_data, log.new_data])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!mounted) return null

  const meta = actionMeta(log.action)

  return createPortal(
    <div
      className="fixed inset-[0px] bg-[rgba(15,23,42,0.5)] flex items-center justify-center z-[9999] p-[16px]"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        style={{ backgroundColor: '#ffffff' }}
        className="rounded-[14px] shadow-[0_20px_40px_rgba(0,0,0,0.15)] w-full max-w-[640px] max-h-[85vh] overflow-y-auto p-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[12px] mb-[16px]">
          <div>
            <h3 className="text-[16px] font-[700] text-[#0f172a] mb-[6px]">Audit log detail</h3>
            <div className="flex items-center gap-[8px] flex-wrap">
              <span className={`text-[11px] font-[700] px-[8px] py-[2px] rounded-full ${meta.classes}`}>
                {meta.label}
              </span>
              <EntityTypeBadge entityType={log.entity_type} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#1a202c] bg-transparent border-none cursor-pointer text-[16px] shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-[16px] gap-y-[8px] text-[13px] mb-[18px] pb-[16px] border-b border-[#f1f5f9]">
          <div>
            <dt className="text-[11px] font-[700] text-[#94a3b8] uppercase tracking-[0.4px]">Admin</dt>
            <dd className="text-[#0f172a] font-[600]">{adminUsername || shortId(log.admin_id)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-[700] text-[#94a3b8] uppercase tracking-[0.4px]">Timestamp</dt>
            <dd className="text-[#0f172a] font-[600]">{formatDateTime(log.created_at)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-[700] text-[#94a3b8] uppercase tracking-[0.4px]">Entity ID</dt>
            <dd className="text-[#0f172a] font-mono text-[12px] break-all">{log.entity_id}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-[700] text-[#94a3b8] uppercase tracking-[0.4px]">IP address</dt>
            <dd className="text-[#0f172a] font-[600]">{log.ip_address || '—'}</dd>
          </div>
          {log.reason && (
            <div className="col-span-2">
              <dt className="text-[11px] font-[700] text-[#94a3b8] uppercase tracking-[0.4px]">Reason</dt>
              <dd className="text-[#0f172a]">{log.reason}</dd>
            </div>
          )}
        </dl>

        {error && (
          <div className="py-[10px] px-[12px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[13px] mb-[14px] flex items-center justify-between gap-[10px]">
            <span>{error}</span>
            <button
              type="button"
              onClick={onRetry}
              className="text-[12px] font-[700] text-[#991b1b] underline bg-transparent border-none cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/*
        */}
        {loading && (
          <div className="text-[11px] text-[#94a3b8] mb-[8px]">Refreshing with latest data...</div>
        )}

        {keys.length === 0 && !error && (
          <div className="text-center text-[#64748b] text-[13px] py-[20px]">No before/after data recorded.</div>
        )}

        {keys.length > 0 && (
          <div style={{ backgroundColor: '#ffffff' }} className="border border-[#e2e8f0] rounded-[10px] overflow-hidden">
            <div style={{ backgroundColor: '#f8fafc' }} className="grid grid-cols-[100px_1fr_1fr] border-b border-[#e2e8f0]">
              <div className="text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[12px] py-[8px]">
                Field
              </div>
              <div className="text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[12px] py-[8px]">
                Before
              </div>
              <div className="text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[12px] py-[8px]">
                After
              </div>
            </div>
            {keys.map((key) => {
              const prevVal = log.previous_data ? log.previous_data[key] : undefined
              const newVal = log.new_data ? log.new_data[key] : undefined
              const changed = JSON.stringify(prevVal) !== JSON.stringify(newVal)
              return (
                <div
                  key={key}
                  style={{ backgroundColor: '#ffffff' }}
                  className="grid grid-cols-[100px_1fr_1fr] border-b border-[#f1f5f9] last:border-b-0"
                >
                  <div className="px-[12px] py-[8px] text-[12px] font-[600] text-[#0f172a] break-words">{key}</div>
                  <div
                    style={{ backgroundColor: changed ? '#fef2f2' : '#ffffff' }}
                    className="px-[12px] py-[8px] text-[12px] text-[#0f172a]"
                  >
                    <DiffValue value={prevVal} />
                  </div>
                  <div
                    style={{ backgroundColor: changed ? '#f0fdf4' : '#ffffff' }}
                    className="px-[12px] py-[8px] text-[12px] text-[#0f172a]"
                  >
                    <DiffValue value={newVal} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end mt-[18px]">
          <button type="button" onClick={onClose} className={OUTLINE_BTN}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main page ─────────────────────────────────────────────────────────

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [skip, setSkip] = useState(0)

  const [actionFilter, setActionFilter] = useState<string>('')
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('')
  const [adminFilter, setAdminFilter] = useState<string>('')
  const [entityIdInput, setEntityIdInput] = useState('')
  const [entityIdFilter, setEntityIdFilter] = useState('')
  const [search, setSearch] = useState('')

  const [admins, setAdmins] = useState<AdminUser[]>([])
  const adminUsernameById = useMemo(() => {
    const map = new Map<string, string>()
    admins.forEach((a) => map.set(a.id, a.username))
    return map
  }, [admins])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalLog, setModalLog] = useState<AuditLog | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const activeLogIdRef = useRef<string | null>(null)

  useEffect(() => {
    adminAPI
      .listUsers({ role: 'admin', limit: 100 })
      .then((res) => setAdmins(res.data.items))
      .catch(() => {
        /* Non-critical: table still works, just shows truncated IDs. */
      })
  }, [])

  const fetchLogDetail = useCallback(async (logId: string) => {
    activeLogIdRef.current = logId
    setModalLoading(true)
    setModalError(null)
    try {
      const res = await adminAPI.getAuditLog(logId)
      // Ignore this response if the user has since closed the modal or
      // opened a different log while this request was in flight.
      if (activeLogIdRef.current !== logId) return
      setModalLog(res.data)
    } catch (err: any) {
      if (activeLogIdRef.current !== logId) return
      setModalError(extractErrorMessage(err, 'Failed to load audit log detail.'))
    } finally {
      if (activeLogIdRef.current === logId) {
        setModalLoading(false)
      }
    }
  }, [])

  const handleViewLog = (log: AuditLog) => {
    setModalLog(log)
    fetchLogDetail(log.id)
  }

  const closeModal = () => {
    activeLogIdRef.current = null
    setModalLog(null)
    setModalError(null)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.listAuditLogs({
        skip,
        limit: PAGE_SIZE,
        action: actionFilter || undefined,
        entity_type: entityTypeFilter || undefined,
        admin_id: adminFilter || undefined,
        entity_id: entityIdFilter || undefined,
      })
      setLogs(res.data.items)
      setTotal(res.data.total)
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load audit logs.'))
    } finally {
      setLoading(false)
    }
  }, [skip, actionFilter, entityTypeFilter, adminFilter, entityIdFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleActionFilter = (value: string) => {
    setActionFilter(value)
    setSkip(0)
  }
  const handleEntityTypeFilter = (value: string) => {
    setEntityTypeFilter(value)
    setSkip(0)
  }
  const handleAdminFilter = (value: string) => {
    setAdminFilter(value)
    setSkip(0)
  }
  const handleEntityIdSubmit = () => {
    setEntityIdFilter(entityIdInput.trim())
    setSkip(0)
  }
  const handleClearFilters = () => {
    setActionFilter('')
    setEntityTypeFilter('')
    setAdminFilter('')
    setEntityIdInput('')
    setEntityIdFilter('')
    setSearch('')
    setSkip(0)
  }

  const hasActiveFilters = Boolean(actionFilter || entityTypeFilter || adminFilter || entityIdFilter || search)

  const visibleLogs = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.trim().toLowerCase()
    return logs.filter((log) => {
      const adminName = adminUsernameById.get(log.admin_id) || ''
      const haystack = [
        actionMeta(log.action).label,
        log.action,
        log.entity_type,
        log.entity_id,
        adminName,
        log.reason || '',
        log.ip_address || '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [logs, search, adminUsernameById])

  const from = total === 0 ? 0 : skip + 1
  const to = Math.min(skip + PAGE_SIZE, total)
  const canPrev = skip > 0
  const canNext = skip + PAGE_SIZE < total

  return (
    <div>
      <div className="flex items-center justify-between mb-[16px] flex-wrap gap-[10px]">
        <h1 className="text-[20px] font-[800] text-[#0f172a]">Audit Logs</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search this page..."
          className={INPUT_CLASSES}
        />
      </div>

      <div className="flex items-center gap-[8px] flex-wrap mb-[20px]">
        <select value={actionFilter} onChange={(e) => handleActionFilter(e.target.value)} className={SELECT_CLASSES}>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a === '' ? 'All actions' : actionMeta(a).label}
            </option>
          ))}
        </select>
        <select
          value={entityTypeFilter}
          onChange={(e) => handleEntityTypeFilter(e.target.value)}
          className={SELECT_CLASSES}
        >
          {ENTITY_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === '' ? 'All entity types' : t}
            </option>
          ))}
        </select>
        <select value={adminFilter} onChange={(e) => handleAdminFilter(e.target.value)} className={SELECT_CLASSES}>
          <option value="">All admins</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.username}
            </option>
          ))}
        </select>
        <input
          value={entityIdInput}
          onChange={(e) => setEntityIdInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleEntityIdSubmit()}
          placeholder="Filter by entity id..."
          className={INPUT_CLASSES}
        />
        <button type="button" onClick={handleEntityIdSubmit} className={OUTLINE_BTN}>
          Apply
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={handleClearFilters} className={OUTLINE_BTN}>
            Clear filters
          </button>
        )}
      </div>

      {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading audit logs...</div>}

      {!loading && error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px]">
          {error}
        </div>
      )}

      {!loading && !error && visibleLogs.length === 0 && (
        <div className="text-center text-[#64748b] text-[14px] py-[40px]">
          {logs.length === 0 ? 'No audit logs match these filters.' : 'No logs on this page match your search.'}
        </div>
      )}

      {!loading && !error && visibleLogs.length > 0 && (
        <>
          <div className="bg-white border border-[#e2e8f0] rounded-[12px] overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">
                    Timestamp
                  </th>
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">
                    Admin
                  </th>
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">
                    Action
                  </th>
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">
                    Entity
                  </th>
                  <th className="text-left text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">
                    IP address
                  </th>
                  <th className="text-right text-[11px] font-[700] text-[#64748b] uppercase tracking-[0.4px] px-[16px] py-[10px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((log) => {
                  const meta = actionMeta(log.action)
                  return (
                    <tr key={log.id} className="border-b border-[#f1f5f9] last:border-b-0">
                      <td className="px-[16px] py-[12px] text-[13px] text-[#64748b] whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-[16px] py-[12px] text-[13px] font-[600] text-[#1a202c] whitespace-nowrap">
                        {adminUsernameById.get(log.admin_id) || shortId(log.admin_id)}
                      </td>
                      <td className="px-[16px] py-[12px]">
                        <span className={`text-[11px] font-[700] px-[8px] py-[2px] rounded-full ${meta.classes}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-[16px] py-[12px]">
                        <div className="flex items-center gap-[6px]">
                          <EntityTypeBadge entityType={log.entity_type} />
                          <span className="text-[12px] text-[#94a3b8] font-mono">{shortId(log.entity_id)}</span>
                        </div>
                      </td>
                      <td className="px-[16px] py-[12px] text-[13px] text-[#64748b]">{log.ip_address || '—'}</td>
                      <td className="px-[16px] py-[12px]">
                        <div className="flex justify-end">
                          <button type="button" onClick={() => handleViewLog(log)} className={OUTLINE_BTN}>
                            View
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

      {modalLog && (
        <AuditLogDetailModal
          key={modalLog.id}
          log={modalLog}
          adminUsername={adminUsernameById.get(modalLog.admin_id) || null}
          loading={modalLoading}
          error={modalError}
          onRetry={() => fetchLogDetail(modalLog.id)}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
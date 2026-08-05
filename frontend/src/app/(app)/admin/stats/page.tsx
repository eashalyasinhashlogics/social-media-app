'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { adminAPI, extractErrorMessage, AdminStats, DailyCount } from '@/lib/api'

const DAYS_OPTIONS = [7, 30, 90] as const

const SELECT_CLASSES =
  'px-[12px] py-[8px] text-[13px] font-[500] text-[#374151] bg-white border border-[#e2e8f0] rounded-[8px] outline-none focus:border-[#5B52E7] cursor-pointer'

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-[18px]">
      <div className="text-[12px] font-[600] text-[#64748b] uppercase tracking-[0.4px] mb-[6px]">{label}</div>
      <div className="text-[26px] font-[800] text-[#0f172a]">{value.toLocaleString()}</div>
    </div>
  )
}

function fillDailySeries(data: DailyCount[], days: number): DailyCount[] {
  const byDate = new Map(data.map((d) => [d.date, d.count]))
  const out: DailyCount[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, count: byDate.get(key) ?? 0 })
  }
  return out
}

function formatAxisDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ChartCard({ title, data, color }: { title: string; data: DailyCount[]; color: string }) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-[18px]">
      <h3 className="text-[14px] font-[700] text-[#1a202c] mb-[12px]">{title}</h3>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              labelFormatter={(label) => formatAxisDate(String(label))}
              contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${title.replace(/\s+/g, '')})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function AdminStatsPage() {
  const [days, setDays] = useState<number>(30)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.getStats(days)
      setStats(res.data)
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load stats.'))
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between mb-[20px]">
        <h1 className="text-[20px] font-[800] text-[#0f172a]">Stats</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className={SELECT_CLASSES}
        >
          {DAYS_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center text-[#64748b] text-[14px] py-[40px]">Loading stats...</div>}

      {!loading && error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px]">
          {error}
        </div>
      )}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[12px] mb-[20px]">
            <StatCard label="Total users" value={stats.total_users} />
            <StatCard label="Total posts" value={stats.total_posts} />
            <StatCard label="Active posts" value={stats.active_posts} />
            <StatCard label="Archived posts" value={stats.archived_posts} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-[16px]">
            <ChartCard title="Signups" data={fillDailySeries(stats.signups_by_day, days)} color="#5B52E7" />
            <ChartCard title="Likes" data={fillDailySeries(stats.likes_by_day, days)} color="#ef4444" />
            <ChartCard title="Comments" data={fillDailySeries(stats.comments_by_day, days)} color="#06b6d4" />
          </div>
        </>
      )}
    </div>
  )
}
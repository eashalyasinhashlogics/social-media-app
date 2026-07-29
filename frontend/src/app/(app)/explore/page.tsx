'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  exploreAPI,
  followAPI,
  extractErrorMessage,
  resolveMediaUrl,
  UserSearchResult,
  TrendingHashtag,
} from '@/lib/api'

type ExploreTab = 'all' | 'people' | 'posts' | 'tags'

function ComingSoon({ icon, title, blurb }: { icon: string; title: string; blurb: string }) {
  return (
    <div className="max-w-[600px] mx-auto text-center py-[80px]">
      <div className="w-[64px] h-[64px] rounded-full bg-[#EEF2FF] text-[#5B52E7] flex items-center justify-center mx-auto mb-[16px] text-[24px]">
        <i className={`fa-solid fa-${icon}`}></i>
      </div>
      <h2 className="text-[20px] font-[700] text-[#1a202c] mb-[8px]">{title}</h2>
      <p className="text-[14px] text-[#64748b]">{blurb}</p>
    </div>
  )
}

function UserCard({
  user,
  onToggleFollow,
  busy,
}: {
  user: UserSearchResult
  onToggleFollow: (user: UserSearchResult) => void
  busy: boolean
}) {
  return (
    <div className="border border-[#e2e8f0] rounded-[12px] p-[16px] flex items-center justify-between">
      <Link href={`/profile/${user.id}`} className="flex items-center gap-[12px] no-underline min-w-0">
        <img
          src={resolveMediaUrl(user.avatar_url) || `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`}
          alt=""
          className="w-[44px] h-[44px] rounded-full object-cover flex-shrink-0"
        />
        <div className="min-w-0">
          <div className="font-[700] text-[14px] text-[#1a202c] truncate">
            {user.display_name || user.username}
          </div>
          <div className="text-[12px] text-[#94a3b8] truncate">
            @{user.username} · {user.follower_count.toLocaleString()} followers
          </div>
        </div>
      </Link>
      <button
        onClick={() => onToggleFollow(user)}
        disabled={busy}
        className={`text-[12px] font-[600] px-[16px] py-[7px] rounded-[8px] cursor-pointer flex-shrink-0 disabled:opacity-60 ${
          user.is_following
            ? 'border border-[#e2e8f0] text-[#374151] bg-white hover:bg-[#f8fafc]'
            : 'bg-[#5B52E7] hover:bg-[#4C43D4] text-white border-none'
        }`}
      >
        {user.is_following ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}

export default function ExplorePage() {
  const [tab, setTab] = useState<ExploreTab>('all')
  const [query, setQuery] = useState('')

  const [trending, setTrending] = useState<TrendingHashtag[]>([])
  const [featured, setFeatured] = useState<UserSearchResult[]>([])
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])

  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([exploreAPI.trendingHashtags(5), exploreAPI.featuredCreators(4)])
      .then(([trendingRes, featuredRes]) => {
        setTrending(trendingRes.data)
        setFeatured(featuredRes.data)
      })
      .catch((err) => setError(extractErrorMessage(err, 'Failed to load Explore.')))
      .finally(() => setLoading(false))
  }, [])

  const runSearch = useCallback((q: string) => {
    setSearching(true)
    exploreAPI
      .search(q, 0, 20)
      .then((res) => setSearchResults(res.data))
      .catch((err) => setError(extractErrorMessage(err, 'Search failed.')))
      .finally(() => setSearching(false))
  }, [])

  useEffect(() => {
    if (tab !== 'people') return
    const handle = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(handle)
  }, [tab, query, runSearch])

  const handleToggleFollow = async (user: UserSearchResult, source: 'featured' | 'search') => {
    setBusyId(user.id)
    setError(null)
    try {
      if (user.is_following) {
        await followAPI.unfollow(user.id)
      } else {
        await followAPI.follow(user.id)
      }
      const updater = (list: UserSearchResult[]) =>
        list.map((u) => (u.id === user.id ? { ...u, is_following: !u.is_following } : u))
      if (source === 'featured') setFeatured(updater)
      else setSearchResults(updater)
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Action failed.'))
    } finally {
      setBusyId(null)
    }
  }

  const TABS: { key: ExploreTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'people', label: 'People' },
    { key: 'posts', label: 'Posts' },
    { key: 'tags', label: 'Tags' },
  ]

  return (
    <div className="max-w-[720px] mx-auto space-y-[24px]">
      <div className="bg-white rounded-[16px] border border-[#e2e8f0] p-[20px] shadow-sm space-y-[16px] block mb-[10px]">
        <div className="flex items-center gap-[12px] bg-[#f8fafc] border border-[#e2e8f0] rounded-[12px] px-[16px] py-[12px] block mb-[10px]">
          <i className="fa-solid fa-magnifying-glass text-[#94a3b8] text-[16px]"></i>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (tab !== 'people') setTab('people')
            }}
            placeholder="Search users, posts, topics..."
            className="w-full bg-transparent border-none text-[14px] placeholder-[#94a3b8] focus:outline-none focus:ring-0"
          />
        </div>
        <div className="flex items-center gap-[8px] block mb-[10px]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-[16px] py-[6px] rounded-[8px] text-[12px] font-[600] cursor-pointer border-none ${
                tab === t.key ? 'bg-[#5B52E7] text-white' : 'text-[#64748b] hover:bg-[#f1f5f9]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* extra 1-line spacer below the search/tabs card */}
      <div className="h-[24px]" aria-hidden="true"></div>

      {error && (
        <div className="py-[12px] px-[14px] bg-[#fef2f2] border border-[#fee2e2] rounded-[8px] text-[#991b1b] text-[14px]">
          {error}
        </div>
      )}

      {tab === 'all' && (
        <>
          <div className="bg-white rounded-[16px] border border-[#e2e8f0] p-[24px] shadow-sm space-y-[16px]">
            <div className="flex items-center gap-[8px] text-[#1a202c] font-[700] text-[16px]">
              <i className="fa-solid fa-arrow-trend-up text-[#5B52E7]"></i>
              <span className="block mb-[10px]">Trending Topics</span>
            </div>
            {loading && <div className="text-[13px] text-[#94a3b8]">Loading...</div>}
            {!loading && trending.length === 0 && (
              <div className="text-[13px] text-[#94a3b8]">No trending hashtags yet — be the first to post one.</div>
            )}
            {!loading && trending.length > 0 && (
              <div className="flex flex-wrap gap-[10px]">
                {trending.map((h) => (
                  <div
                    key={h.tag}
                    className="border border-[#e2e8f0] rounded-full px-[16px] py-[8px] text-[13px] font-[500] text-[#5B52E7] bg-[#EEF2FF] flex items-center gap-[6px] cursor-pointer"
                  >
                    <span>#{h.tag}</span>
                    <span className="text-[#94a3b8] font-[400]">
                      {h.post_count} {h.post_count === 1 ? 'post' : 'posts'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[16px] border border-[#e2e8f0] p-[24px] shadow-sm space-y-[16px]">
            <div className="flex items-center gap-[8px] text-[#1a202c] font-[700] text-[16px]">
              <i className="fa-regular fa-star text-[#5B52E7]"></i>
               <span className="block mb-[10px]">Featured Creators</span>
            </div>
            {loading && <div className="text-[13px] text-[#94a3b8]">Loading...</div>}
            {!loading && featured.length === 0 && (
              <div className="text-[13px] text-[#94a3b8]">No creators to show yet.</div>
            )}
            {!loading && featured.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
                {featured.map((u) => (
                  <UserCard key={u.id} user={u} busy={busyId === u.id} onToggleFollow={(user) => handleToggleFollow(user, 'featured')} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'people' && (
        <div className="bg-white rounded-[16px] border border-[#e2e8f0] p-[24px] shadow-sm space-y-[16px]">
          {searching && <div className="text-[13px] text-[#94a3b8]">Searching...</div>}
          {!searching && searchResults.length === 0 && (
            <div className="text-center py-[40px] text-[14px] text-[#64748b]">
              {query ? `No users found for "${query}".` : 'Start typing to find people.'}
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
              {searchResults.map((u) => (
                <UserCard key={u.id} user={u} busy={busyId === u.id} onToggleFollow={(user) => handleToggleFollow(user, 'search')} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'posts' && (
        <ComingSoon icon="file-lines" title="Post search" blurb="Searching posts by keyword is coming soon." />
      )}

      {tab === 'tags' && (
        <ComingSoon icon="hashtag" title="Tag search" blurb="Browsing all hashtags is coming soon — check Trending Topics for now." />
      )}
    </div>
  )
}
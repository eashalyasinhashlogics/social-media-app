import type { FollowListUser } from '@/components/FollowListModal'
import axios from 'axios'
import { notifyUnreadChanged } from '@/lib/unreadEvents'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// Origin without the /api/v1 suffix, used to resolve relative media URLs
// (e.g. "/uploads/abc.jpg") returned by the backend against the API host
// instead of the frontend's own origin.
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '')
// ─── WebSocket ──────────────────────────────────────────
// BP-11: previously derived by string-replacing "http" -> "ws" on the REST
// API origin. That only works by coincidence when the socket happens to
// terminate on the same host as the API - the moment WS moves behind its
// own load balancer/domain, this silently builds the wrong URL and chat
// falls back to (or gets stuck on) polling with no visible error.
// NEXT_PUBLIC_WS_URL lets the two be configured independently; the old
// derivation is kept only as a fallback for local dev where they match.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `${API_ORIGIN.replace(/^http/, 'ws')}/ws/chat`

export function getChatWsUrl(): string {
  return WS_URL
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // Tokens now live in httpOnly cookies set by the backend, so every
  // request must include credentials for the browser to send them
  // (and for Set-Cookie responses to be honored).
  withCredentials: true,
})

// Pages that never require a session - a 401 here is expected for an
// anonymous visitor and must never trigger a redirect (that's what caused
// the infinite /login <-> refresh reload loop).
const PUBLIC_PATHS = ['/login', '/register', '/verify-email', '/oauth', '/']

function isOnPublicPath(): boolean {
  if (typeof window === 'undefined') return true
  const pathname = window.location.pathname
  return PUBLIC_PATHS.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)))
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && typeof window !== 'undefined' && !originalRequest?._retry) {
      originalRequest._retry = true
      try {
        await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
        return api(originalRequest)
      } catch {
        // Refresh failed - the session is genuinely gone. Only force a
        // redirect if we're on a page that actually requires auth; a 401
        // on a public page (e.g. AuthContext's background getMe() probe
        // while sitting on /login) is expected for anonymous visitors and
        // must not trigger navigation, or it causes an infinite reload
        // loop (redirect to /login -> mounts AuthContext -> probes again).
        if (!isOnPublicPath()) {
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)

export default api

// ─── Error handling ─────────────────────────────────────
// FastAPI/Pydantic v2 validation errors return `detail` as an ARRAY of
// objects shaped like { type, loc, msg, input, ctx, url } - not a string.
// Rendering `err.response?.data?.detail` directly in JSX crashes React
// with "Objects are not valid as a React child" whenever a request fails
// validation (422). Always run caught errors through this before putting
// them in state that gets rendered.
export function extractErrorMessage(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((d: any) => (typeof d === 'string' ? d : d?.msg))
      .filter(Boolean)
    return messages.length > 0 ? messages.join('; ') : fallback
  }

  // Some backends nest a single error object directly under `detail`
  if (detail && typeof detail === 'object' && typeof detail.msg === 'string') {
    return detail.msg
  }

  return fallback
}

// ─── Media URLs ─────────────────────────────────────────
// The backend may return relative paths (e.g. "/uploads/abc.jpg"). Left
// as-is, the browser resolves those against the frontend's own origin
// (localhost:3000) instead of the API's origin (localhost:8000), which
// 404s. Absolute URLs (http/https) are passed through untouched.
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

// ─── Dates ──────────────────────────────────────────────
// The backend serializes created_at/updated_at with an explicit UTC
// offset in the common case (e.g. "...+00:00"), which `new Date(...)`
// parses correctly on its own. This is defense-in-depth for any
// timestamp that arrives without one (e.g. an older cached response) -
// treat it as UTC instead of the browser's local timezone.
export function parseServerDate(dateString: string): Date {
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(dateString)
  return new Date(hasOffset ? dateString : `${dateString}Z`)
}

// ─── Auth ───────────────────────────────────────────────
export const authAPI = {
  register: (email: string, username: string, password: string) =>
    api.post('/auth/register', { email, username, password }),

  verifyEmail: (email: string, otp_code: string) =>
    api.post('/auth/verify-email', { email, otp_code }),

  resendOTP: (email: string) =>
    api.post('/auth/resend-otp', { email }),

  login: (email: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string; token_type: string }>(
      '/auth/login', { email, password }
    ),

  // No refresh token argument needed anymore - the httpOnly cookie is
  // sent automatically and the backend reads it from there.
  logout: () =>
    api.post('/auth/logout', {}),
}

// ─── Users ──────────────────────────────────────────────
export interface UserSummary {
  id: string
  email: string
  username: string
  email_verified: boolean
  role: string
  status: string
  created_at: string
  updated_at: string
}

export const usersAPI = {
  getMe: () => api.get<UserSummary>('/users/me'),

  // GET /users/{user_id} - used to resolve a bare user id (e.g. from a
  // friend-request payload, which only carries from_user_id/to_user_id)
  // into a username for display.
  getById: (userId: string) => api.get<UserSummary>(`/users/${userId}`),
}

// ─── OAuth ──────────────────────────────────────────────
export const oauthAPI = {
  getGoogleUrl: () => api.get<{ auth_url: string }>('/oauth/google/authorize'),
  getGithubUrl: () => api.get<{ auth_url: string }>('/oauth/github/authorize'),
}

// ─── Profile ────────────────────────────────────────────
export interface Profile {
  user_id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  cover_photo_url: string | null
  follower_count: number
  following_count: number
  post_count: number
  posts: Post[]
}

export interface ProfileUpdatePayload {
  username?: string
  display_name?: string
  bio?: string
}

export const profileAPI = {
  getOwnProfile: () => api.get<Profile>('/users/me/profile'),
  getPublicProfile: (userId: string) => api.get<Profile>(`/users/${userId}/profile`),
  updateProfile: (payload: ProfileUpdatePayload) => api.patch<Profile>('/users/me/profile', payload),
  updateBio: (bio: string) => api.patch<Profile>('/users/me/profile', { bio }),

  // NOTE: these previously pointed at `/profiles/${userId}/...`, a prefix
  // that was never registered on the backend (only `/users/...` exists),
  // so every one of these calls 404'd silently. Fixed to hit the real,
  // already-working endpoints.
  //
  // `skip`/`limit` are optional so existing call sites that want the full
  // list in one shot (e.g. ProfileView's friend-count fetch) keep working
  // unchanged - axios omits params that are `undefined`. The FollowListModal
  // passes both explicitly to page through results.
  getFollowers: (userId: string, skip?: number, limit?: number) =>
    api.get<FollowListUser[]>(`/users/${userId}/followers`, { params: { skip, limit } }),
  getFollowing: (userId: string, skip?: number, limit?: number) =>
    api.get<FollowListUser[]>(`/users/${userId}/following`, { params: { skip, limit } }),
  getFriends: (userId: string, skip?: number, limit?: number) =>
    api.get<FollowListUser[]>(`/users/${userId}/friends`, { params: { skip, limit } }),
  // Total friend count, independent of the paginated list's page size -
  // powers the profile's "Friends" stat (list length alone would cap at
  // whatever page size the list endpoint returns).
  getFriendsCount: (userId: string) =>
    api.get<{ count: number }>(`/users/${userId}/friends/count`),
}

// ─── Media ──────────────────────────────────────────────
export interface Media {
  id: string
  uploader_id: string
  post_id: string | null
  url: string
  media_type: string
  file_size: number | null
  created_at: string
}

export const mediaAPI = {
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Media>('/media/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadCoverPhoto: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Media>('/media/cover', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadPostMedia: (postId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/media/post/${postId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  removeAvatar: () => api.delete('/media/avatar'),
  removeCoverPhoto: () => api.delete('/media/cover'),
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  author_username: string | null
  parent_comment_id: string | null
  content: string
  like_count: number
  created_at: string
  updated_at: string
}

export const commentsAPI = {
  list: (postId: string) =>
    api.get<Comment[]>(`/posts/${postId}/comments`),

  create: (postId: string, content: string, parentCommentId?: string) =>
    api.post<Comment>(`/posts/${postId}/comments`, {
      content,
      parent_comment_id: parentCommentId || null,
    }),

  delete: (commentId: string) =>
    api.delete(`/comments/${commentId}`),
}

export interface MediaItem {
  id: string
  url: string
  media_type: 'image' | 'video' | 'avatar' | 'cover'
}

export interface Post {
  id: string
  author_id: string
  author_username: string | null
  author_avatar_url: string | null
  content: string
  status: string
  like_count: number
  comment_count: number
  share_count: number
  created_at: string
  updated_at: string
  original_post_id: string | null
  original_author_username: string | null
  original_content: string | null
  media: MediaItem[]
  liked_by_me: boolean
}

export interface LikeToggleResult {
  liked: boolean
  like_count: number
}

export const postsAPI = {
  list: (skip = 0, limit = 20) =>
    api.get<Post[]>('/posts', { params: { skip, limit } }),

  // The backend now computes `liked_by_me` correctly for the calling
  // user directly on GET /posts (via an optional-auth dependency), so
  // this no longer needs a second round trip to /posts/me/liked-ids -
  // it's kept only so existing call sites don't need to change.
  listWithLikeState: async (skip = 0, limit = 20): Promise<Post[]> => {
    const res = await api.get<Post[]>('/posts', { params: { skip, limit } })
    return res.data
  },

  create: (content: string) => api.post<Post>('/posts', { content }),
  get: (postId: string) => api.get<Post>(`/posts/${postId}`),
  update: (postId: string, content: string) => api.patch<Post>(`/posts/${postId}`, { content }),
  delete: (postId: string) => api.delete(`/posts/${postId}`),
  archive: (postId: string) => api.patch<Post>(`/posts/${postId}/archive`),
  unarchive: (postId: string) => api.patch<Post>(`/posts/${postId}/unarchive`),
  listMyArchived: () => api.get<Post[]>('/posts/me/archived'),
  toggleLike: (postId: string) => api.post<LikeToggleResult>(`/posts/${postId}/like`),
  share: (postId: string, caption: string) => api.post<Post>(`/posts/${postId}/share`, { caption: caption || null }),
}

// ─── Follow ─────────────────────────────────────────────
export interface FollowResult {
  following: boolean
  follower_count: number
  following_count: number
}
export interface FollowerUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}
export const followAPI = {
  follow: (userId: string) => api.post<FollowResult>(`/users/${userId}/follow`),
  unfollow: (userId: string) => api.delete<FollowResult>(`/users/${userId}/follow`),
  followers: (userId: string) => api.get<FollowerUser[]>(`/users/${userId}/followers`),
  following: (userId: string) => api.get<FollowerUser[]>(`/users/${userId}/following`),
}

// ─── Feed (following) ───────────────────────────────────
export const feedAPI = {
  getFollowingFeed: (skip = 0, limit = 2) =>
    api.get<Post[]>('/posts/feed/following', { params: { skip, limit } }),
}

// ─── Friends ────────────────────────────────────────────
export interface FriendRequest {
  id: string
  from_user_id: string
  to_user_id: string
  status: string
  created_at: string
  updated_at: string
}
export interface FriendUser {
  id: string
  email: string
  username: string
  role: string
  status: string
}
export interface Friendship {
  friend: FriendUser
  friends_since: string
}
export const friendsAPI = {
  send: (toUserId: string) => api.post<FriendRequest>('/friend-requests', { to_user_id: toUserId }),
  listIncoming: () => api.get<FriendRequest[]>('/friend-requests', { params: { direction: 'incoming' } }),
  listOutgoing: () => api.get<FriendRequest[]>('/friend-requests', { params: { direction: 'outgoing' } }),
  accept: (requestId: string) => api.post<FriendRequest>(`/friend-requests/${requestId}/accept`),
  reject: (requestId: string) => api.post<FriendRequest>(`/friend-requests/${requestId}/reject`),
  cancel: (requestId: string) => api.delete(`/friend-requests/${requestId}`),
  listFriends: () => api.get<Friendship[]>('/friends'),
  unfriend: (userId: string) => api.delete(`/friends/${userId}`),
}
// ─── Conversations / Chat ───────────────────────────────
export interface MessageReaction {
  emoji: string
  user_ids: string[]
}
export interface MessageAttachment {
  id: string
  url: string
  media_type: 'image' | 'video' | 'document'
  file_name?: string | null
  file_size?: number | null
}
export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at?: string | null
  reactions?: MessageReaction[]
  attachments?: MessageAttachment[]
  // BP-14: user ids (other than the sender) who have read this message -
  // lets the client render a per-message ✓/✓✓ instead of only the
  // conversation-level unread badge.
  read_by?: string[]
}
export interface Conversation {
  id: string
  type: string
  participant_ids: string[]
  last_message: Message | null
  last_message_at: string | null
  unread_count: number
  created_at: string
  updated_at: string
}
export const conversationsAPI = {
  start: (userId: string) => api.post<Conversation>('/conversations', { user_id: userId }),
  list: (skip = 0, limit = 20) => api.get<Conversation[]>('/conversations', { params: { skip, limit } }),
  messages: (conversationId: string, skip = 0, limit = 50) =>
    api.get<Message[]>(`/conversations/${conversationId}/messages`, { params: { skip, limit } }),
  send: (conversationId: string, content: string, attachmentIds: string[] = []) =>
    api.post<Message>(`/conversations/${conversationId}/messages`, {
      content,
      attachment_ids: attachmentIds,
    }),
  markRead: (conversationId: string) =>
    api.post<{ marked_read: number }>(`/conversations/${conversationId}/read`).then((res) => {
      // See lib/unreadEvents.ts - this is the single place every mark-read
      // call in the app goes through, so it's the right place to fire the
      // "unread state changed" signal rather than scattering the call
      // across every screen that happens to call markRead.
      notifyUnreadChanged()
      return res
    }),
  unreadCount: (conversationId: string) =>
    api.get<{ conversation_id: string; unread_count: number }>(`/conversations/${conversationId}/unread-count`),

  updateMessage: (conversationId: string, messageId: string, content: string) =>
    api.patch<Message>(`/conversations/${conversationId}/messages/${messageId}`, { content }),
  deleteMessage: (conversationId: string, messageId: string) =>
    api.delete(`/conversations/${conversationId}/messages/${messageId}`),
  toggleReaction: (conversationId: string, messageId: string, emoji: string) =>
    api.post<Message>(`/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji }),

  uploadAttachment: (conversationId: string, file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<MessageAttachment>(`/media/message-attachment/${conversationId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
  },
}

// ─── Notifications ────────────────────────────────────
export interface NotificationActor {
  id: string
  username: string
  avatar_url: string | null
}
export interface Notification {
  id: string
  type: 'like' | 'comment' | 'reply' | 'friend_request' | 'friend_accept' | 'follow'
  actor: NotificationActor | null
  post_id: string | null
  comment_id: string | null
  post_preview: string | null
  comment_preview: string | null
  friend_request_id: string | null
  is_read: boolean
  created_at: string
}
export const notificationsAPI = {
  list: (skip = 0, limit = 30) => api.get<Notification[]>('/notifications', { params: { skip, limit } }),
  unreadCount: () => api.get<{ unread_count: number }>('/notifications/unread-count'),
  markRead: (notificationId: string) => api.post(`/notifications/${notificationId}/read`),
  markAllRead: () => api.post<{ marked_read: number }>('/notifications/read-all'),
}
// ─── Explore ──────────────────────────────────────────
export interface UserSearchResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  follower_count: number
  is_following: boolean
}
export interface TrendingHashtag {
  tag: string
  post_count: number
}
export const exploreAPI = {
  search: (q: string, skip = 0, limit = 20) =>
    api.get<UserSearchResult[]>('/users/search/results', { params: { q, skip, limit } }),
  featuredCreators: (limit = 8) => api.get<UserSearchResult[]>('/users/featured/creators', { params: { limit } }),
  trendingHashtags: (limit = 5) => api.get<TrendingHashtag[]>('/posts/trending/hashtags', { params: { limit } }),
}
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// Origin without the /api/v1 suffix, used to resolve relative media URLs
// (e.g. "/uploads/abc.jpg") returned by the backend against the API host
// instead of the frontend's own origin.
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '')

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
export const usersAPI = {
  getMe: () => api.get<{
    id: string; email: string; username: string
    email_verified: boolean; role: string; status: string
    created_at: string; updated_at: string
  }>('/users/me'),
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

  // Powers the Edit Profile modal - send only the fields that changed.
  updateProfile: (payload: ProfileUpdatePayload) => api.patch<Profile>('/users/me/profile', payload),

  // Kept as a thin convenience wrapper - some older call sites only
  // ever touched bio.
  updateBio: (bio: string) => api.patch<Profile>('/users/me/profile', { bio }),
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
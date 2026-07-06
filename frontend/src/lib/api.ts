import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

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

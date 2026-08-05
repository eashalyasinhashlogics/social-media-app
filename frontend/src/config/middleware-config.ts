export const PROTECTED_ROUTES = [
  '/feed',
  '/messages',
  '/notifications',
  '/communities',
  '/user',
  '/profile',
  '/admin'
] as const

export const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/verify-email',
  '/oauth',
  '/'
] as const

export const AUTH_ROUTES = [
  '/login',
  '/register'
] as const

export const SPECIAL_ROUTES = {
  verifyEmail: '/verify-email',
  oauthCallback: '/oauth/callback'
} as const

export const MIDDLEWARE_CONFIG = {
  loginRedirect: '/login',
  defaultRedirect: '/feed',
  logoutRedirect: '/login',
  tokenCookieName: 'access_token',
  refreshTokenCookieName: 'refresh_token',
  tokenHeaderName: 'Authorization',
  accessTokenExpiration: 60 * 60,
  refreshTokenExpiration: 60 * 60 * 24 * 7,
  secureCookie: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax' as const,
  debug: process.env.NODE_ENV === 'development'
} as const

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))
}

export function getSpecialRoute(pathname: string): keyof typeof SPECIAL_ROUTES | null {
  for (const [key, route] of Object.entries(SPECIAL_ROUTES)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return key as keyof typeof SPECIAL_ROUTES
    }
  }
  return null
}

export function getRedirectForUnauthenticated(currentPath: string): string {
  return MIDDLEWARE_CONFIG.loginRedirect
}

export function getRedirectForAuthenticated(currentPath: string): string {
  return MIDDLEWARE_CONFIG.defaultRedirect
}

export const MIDDLEWARE_MATCHER = [
  '/feed/:path*',
  '/messages/:path*',
  '/notifications/:path*',
  '/communities/:path*',
  '/user/:path*',
  '/profile/:path*',
  '/admin/:path*',
  '/login',
  '/register',
  '/verify-email',
  '/oauth/:path*'
] as const

export const ROUTE_INFO = {
  feed: { path: '/feed', protected: true, description: 'Main feed with posts and stories', requiresAuth: true },
  messages: { path: '/messages', protected: true, description: 'Direct messages and conversations', requiresAuth: true },
  notifications: { path: '/notifications', protected: true, description: 'User notifications and alerts', requiresAuth: true },
  communities: { path: '/communities', protected: true, description: 'Communities and groups', requiresAuth: true },
  userProfile: { path: '/user/[id]', protected: true, description: 'User profile page', requiresAuth: true },
  profile: { path: '/profile', protected: true, description: 'Current user profile', requiresAuth: true },
  login: { path: '/login', protected: false, description: 'User login page', requiresAuth: false },
  register: { path: '/register', protected: false, description: 'User registration page', requiresAuth: false },
  verifyEmail: { path: '/verify-email', protected: false, description: 'Email verification after signup', requiresAuth: false, special: true },
  oauth: { path: '/oauth/callback', protected: false, description: 'OAuth provider callback', requiresAuth: false, special: true },
  home: { path: '/', protected: false, description: 'Home/landing page', requiresAuth: false }
} as const

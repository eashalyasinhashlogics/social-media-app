import { NextRequest, NextResponse } from 'next/server'
import {
  isProtectedRoute,
  isAuthRoute,
  getSpecialRoute,
  MIDDLEWARE_CONFIG,
  MIDDLEWARE_MATCHER,
} from '@/config/middleware-config'
import {
  getTokenFromRequest,
  hasValidTokenInRequest,
  isRequestTokenExpired,
} from '@/lib/auth-utils'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (MIDDLEWARE_CONFIG.debug) {
    console.log(`[Proxy] Processing request to: ${pathname}`)
  }

  if (getSpecialRoute(pathname)) {
    return NextResponse.next()
  }

  const token = getTokenFromRequest(request, MIDDLEWARE_CONFIG.tokenCookieName)
  const isAuthenticated = hasValidTokenInRequest(request) && !isRequestTokenExpired(request)

  // NEW: Handle root path based on auth status.
  // If user is authenticated, skip the splash page and go straight to feed.
  // If not authenticated, let splash page render (it will show the loading screen).
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/feed', request.url))
    }
    // Not authenticated: let the splash page render, which will then
    // decide whether to show splash or redirect to login after checking auth.
    return NextResponse.next()
  }

  if (isProtectedRoute(pathname) && !isAuthenticated) {
    const loginUrl = new URL(MIDDLEWARE_CONFIG.loginRedirect, request.url)
    loginUrl.searchParams.set('redirect', pathname)

    const response = NextResponse.redirect(loginUrl)
    if (token) {
      response.cookies.delete(MIDDLEWARE_CONFIG.tokenCookieName)
      response.cookies.delete(MIDDLEWARE_CONFIG.refreshTokenCookieName)
    }
    return response
  }

  if (isAuthRoute(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL(MIDDLEWARE_CONFIG.defaultRedirect, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: MIDDLEWARE_MATCHER,
}
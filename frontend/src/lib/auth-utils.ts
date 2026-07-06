import { NextRequest } from 'next/server'

export interface JWTPayload {
  sub: string
  email: string
  username: string
  iat: number
  exp: number
  [key: string]: any
}

export interface TokenValidationResult {
  isValid: boolean
  error?: string
  payload?: JWTPayload
}

export function getTokenFromCookie(
  request: NextRequest,
  cookieName: string = 'access_token'
): string | null {
  try {
    const token = request.cookies.get(cookieName)?.value
    return token || null
  } catch (error) {
    return null
  }
}

export function getTokenFromHeader(request: NextRequest): string | null {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return null
    }
    if (!authHeader.startsWith('Bearer ')) {
      return null
    }
    const token = authHeader.slice(7)
    return token || null
  } catch (error) {
    return null
  }
}

export function getTokenFromRequest(
  request: NextRequest,
  cookieName: string = 'access_token'
): string | null {
  const tokenFromCookie = getTokenFromCookie(request, cookieName)
  if (tokenFromCookie) {
    return tokenFromCookie
  }
  const tokenFromHeader = getTokenFromHeader(request)
  if (tokenFromHeader) {
    return tokenFromHeader
  }
  return null
}

export function isValidTokenFormat(token: string): boolean {
  try {
    if (typeof token !== 'string') {
      return false
    }
    if (token.length === 0) {
      return false
    }
    const parts = token.split('.')
    if (parts.length !== 3) {
      return false
    }
    if (parts.some(part => part.length === 0)) {
      return false
    }
    return true
  } catch (error) {
    return false
  }
}

export function hasToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && token.length > 0
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    if (!isValidTokenFormat(token)) {
      return null
    }
    const parts = token.split('.')
    const payload = parts[1]
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8')
    const parsed = JSON.parse(decoded) as JWTPayload
    return parsed
  } catch (error) {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJWT(token)
    if (!payload || !payload.exp) {
      return true
    }
    const expirationTime = payload.exp * 1000
    const currentTime = Date.now()
    return currentTime > expirationTime
  } catch (error) {
    return true
  }
}

export function isTokenExpiringSoon(
  token: string,
  warningTimeSeconds: number = 60
): boolean {
  try {
    const payload = decodeJWT(token)
    if (!payload || !payload.exp) {
      return true
    }
    const expirationTime = payload.exp * 1000
    const currentTime = Date.now()
    const warningTime = warningTimeSeconds * 1000
    return (expirationTime - currentTime) < warningTime
  } catch (error) {
    return true
  }
}

export function validateToken(token: string): TokenValidationResult {
  try {
    if (!isValidTokenFormat(token)) {
      return { isValid: false, error: 'Invalid token format' }
    }
    if (isTokenExpired(token)) {
      return { isValid: false, error: 'Token expired' }
    }
    const payload = decodeJWT(token)
    if (!payload) {
      return { isValid: false, error: 'Failed to decode token' }
    }
    return { isValid: true, payload }
  } catch (error) {
    return { isValid: false, error: `Validation error: ${error instanceof Error ? error.message : 'Unknown'}` }
  }
}

export function hasValidTokenInRequest(request: NextRequest): boolean {
  const token = getTokenFromRequest(request)
  return hasToken(token) && isValidTokenFormat(token)
}

export function isRequestTokenExpired(request: NextRequest): boolean {
  const token = getTokenFromRequest(request)
  if (!hasToken(token)) {
    return true
  }
  return isTokenExpired(token)
}

export function getUserInfoFromRequest(request: NextRequest): { userId: string; email: string } | null {
  try {
    const token = getTokenFromRequest(request)
    if (!hasToken(token)) {
      return null
    }
    const payload = decodeJWT(token)
    if (!payload || !payload.sub || !payload.email) {
      return null
    }
    return { userId: payload.sub, email: payload.email }
  } catch (error) {
    return null
  }
}

export function getTokenInfo(token: string | null) {
  if (!token) {
    return { hasToken: false, validFormat: false, isExpired: false, payload: null }
  }
  return {
    hasToken: true,
    validFormat: isValidTokenFormat(token),
    isExpired: isTokenExpired(token),
    payload: decodeJWT(token),
    tokenPreview: `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
  }
}

export function logTokenInfo(token: string | null, label: string = 'Token') {
  const info = getTokenInfo(token)
  console.log(`[auth-utils] ${label}:`, info)
}

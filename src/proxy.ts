import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'pp_session'

const PUBLIC_PATHS = new Set(['/', '/login', '/setup', '/health'])

/**
 * Edge middleware:
 *  - Guards panel pages by cookie presence (real verification happens server-side in the API).
 *  - Adds baseline security headers.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSession = req.cookies.has(SESSION_COOKIE)

  let response: NextResponse

  if (!hasSession && !PUBLIC_PATHS.has(pathname) && !pathname.startsWith('/api/')) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    response = NextResponse.redirect(url)
  } else if (hasSession && (pathname === '/login' || pathname === '/setup')) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    response = NextResponse.redirect(url)
  } else {
    response = NextResponse.next()
  }

  // Security headers.
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.svg|robots.txt|logo.svg).*)'],
}

import { NextResponse, type NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { db } from './db'
import { getSessionUser, clearSessionCookieOptions, SESSION_COOKIE, type SessionUser } from './auth'
import { logger } from './logger'
import { getIp, rateLimit } from './rate-limit'
import type { Role } from '@prisma/client'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** CSRF defense: mutating JSON requests must be same-origin. */
function sameOriginOk(req: NextRequest): boolean {
  if (!MUTATING.has(req.method)) return true
  const origin = req.headers.get('origin')
  if (!origin) return true // non-browser clients (curl, API keys, tests)
  try {
    const o = new URL(origin)
    const host = req.headers.get('host')
    return host ? o.host === host : true
  } catch {
    return false
  }
}

/** Serialized with BigInt support (BigInt → string). */
export function jsonBody(payload: unknown): string {
  return JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return new NextResponse(jsonBody({ success: true, data }), {
    status: 200,
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export function fail(status: number, code: string, message: string): NextResponse {
  return new NextResponse(
    jsonBody({ success: false, error: { code, message } }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  )
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    if (err.status >= 500) logger.error(`API ${err.code}: ${err.message}`)
    return fail(err.status, err.code, err.message)
  }
  if (err instanceof ZodError) {
    const first = err.issues[0]
    const message = first
      ? `${first.path.join('.') || 'input'}: ${first.message}`
      : 'Invalid input.'
    return fail(422, 'VALIDATION_ERROR', message)
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: unknown }).code)
    if (code === 'P2002') return fail(409, 'CONFLICT', 'A record with this value already exists.')
    if (code === 'P2025') return fail(404, 'NOT_FOUND', 'Record not found.')
    if (code.startsWith('P')) {
      logger.error('Database error', { code })
      return fail(500, 'DB_ERROR', 'A database error occurred.')
    }
  }
  logger.error('Unhandled API error', {
    message: err instanceof Error ? err.message : String(err),
  })
  return fail(500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
}

export type RouteCtx<P> = { params: P }
export type AuthedCtx<P> = RouteCtx<P> & { auth: SessionUser }

/** Next 15+/16 delivers params as a Promise — resolve it once here. */
async function resolveParams<P>(routeCtx: { params?: Promise<P> } | undefined): Promise<P> {
  if (routeCtx?.params) return (await routeCtx.params) as P
  return {} as P
}

/** Request tracking → analytics (fire-and-forget, never blocks the response). */
function trackRequest(req: NextRequest, authId?: string) {
  const path = new URL(req.url).pathname
  if (path === '/api/me' || path === '/health') return
  db.analyticsEvent
    .create({
      data: {
        type: 'REQUEST',
        level: 'INFO',
        source: 'api',
        message: `${req.method} ${path}`,
        meta: { method: req.method, path, actorId: authId ?? null },
      },
    })
    .catch(() => undefined)
}

const GENERAL_LIMIT = 600 // requests / minute / IP across the API

function generalRateOk(req: NextRequest): boolean {
  return rateLimit(`api:${getIp(req)}`, GENERAL_LIMIT, 60_000)
}

export function withPublic<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: RouteCtx<P>) => Promise<Response>,
) {
  return async (req: NextRequest, routeCtx: { params?: Promise<P> }): Promise<Response> => {
    try {
      if (!generalRateOk(req)) return fail(429, 'RATE_LIMITED', 'Too many requests. Slow down.')
      if (!sameOriginOk(req)) return fail(403, 'CSRF_BLOCKED', 'Cross-origin request blocked.')
      const params = await resolveParams<P>(routeCtx)
      const res = await handler(req, { params })
      trackRequest(req)
      return res
    } catch (err) {
      return handleError(err)
    }
  }
}

export function withAuth<P = Record<string, never>>(
  handler: (req: NextRequest, ctx: AuthedCtx<P>) => Promise<Response>,
  opts: { roles?: Role[]; track?: boolean } = {},
) {
  return async (req: NextRequest, routeCtx: { params?: Promise<P> }): Promise<Response> => {
    try {
      if (!generalRateOk(req)) return fail(429, 'RATE_LIMITED', 'Too many requests. Slow down.')
      if (!sameOriginOk(req)) return fail(403, 'CSRF_BLOCKED', 'Cross-origin request blocked.')
      const auth = await getSessionUser(req)
      if (!auth) {
        // Invalid/expired session: expire the stale cookie so edge middleware
        // stops treating the browser as signed in (unblocks /login and /setup).
        const res = fail(401, 'UNAUTHENTICATED', 'Authentication required.')
        res.cookies.set(SESSION_COOKIE, '', clearSessionCookieOptions())
        return res
      }
      if (opts.roles && !opts.roles.includes(auth.role)) {
        return fail(403, 'FORBIDDEN', 'You do not have permission to perform this action.')
      }
      const params = await resolveParams<P>(routeCtx)
      const res = await handler(req, { params, auth })
      if (opts.track !== false) trackRequest(req, auth.id)
      return res
    } catch (err) {
      return handleError(err)
    }
  }
}

// ───────────────────────── Parsing helpers ─────────────────────────

export async function parseBody<T>(req: NextRequest, schema: { parse: (v: unknown) => T }): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'BAD_JSON', 'Request body must be valid JSON.')
  }
  return schema.parse(raw)
}

export function searchParams(req: NextRequest): URLSearchParams {
  return new URL(req.url).searchParams
}

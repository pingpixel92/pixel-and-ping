import type { NextRequest } from 'next/server'
import type { Prisma, Role } from '@prisma/client'
import { db } from './db'
import { newSessionToken, sha256 } from './crypto'
import { env } from './env'

export const SESSION_COOKIE = 'pp_session'

export interface SessionUser {
  id: string
  email: string
  username: string
  displayName: string
  role: Role
  prefs: Prisma.JsonValue
  sessionId: string
}

export interface CreatedSession {
  token: string
  expiresAt: Date
  maxAgeSec: number
}

export async function createSession(
  userId: string,
  opts: { ip?: string | null; userAgent?: string | null; remember?: boolean; timeoutMin?: number } = {},
): Promise<CreatedSession> {
  const token = newSessionToken()
  const baseMinutes = opts.timeoutMin ?? 12 * 60
  const maxAgeSec = Math.max(300, opts.remember ? 30 * 24 * 3600 : baseMinutes * 60)
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000)
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      expiresAt,
    },
  })
  return { token, expiresAt, maxAgeSec }
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const raw = req.cookies.get(SESSION_COOKIE)?.value
  if (!raw) return null

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  })
  if (!session) return null

  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  if (session.user.status !== 'ACTIVE') return null

  // Throttled last-seen update (at most once per minute per session).
  if (Date.now() - session.lastSeenAt.getTime() > 60_000) {
    db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined)
  }

  return {
    id: session.user.id,
    email: session.user.email,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
    prefs: session.user.prefs,
    sessionId: session.id,
  }
}

export function sessionCookieOptions(expires: Date, maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.IS_PROD,
    path: '/',
    expires,
    maxAge: maxAgeSec,
  }
}

export function publicUser(u: {
  id: string
  email: string
  username: string
  displayName: string
  role: Role
  status: string
  lastLoginAt: Date | null
  prefs: Prisma.JsonValue
  createdAt: Date
}) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    prefs: u.prefs,
    createdAt: u.createdAt.toISOString(),
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createSession, publicUser, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'
import { verifyPassword } from '@/lib/crypto'
import { ApiError, ok, parseBody, withPublic } from '@/lib/api'
import { getIp, rateLimit } from '@/lib/rate-limit'
import { audit, logEvent, trackEvent } from '@/lib/audit'
import { getSettings } from '@/lib/services/settings.service'
import { logger } from '@/lib/logger'

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Required').max(255),
  password: z.string().min(1, 'Required').max(200),
  remember: z.boolean().default(false),
})

export const POST = withPublic(async (req) => {
  const body = await parseBody(req, loginSchema)
  const ip = getIp(req)

  // Failed-login protection: per-identifier and per-IP limits.
  const idKey = `login:id:${body.identifier.toLowerCase()}:${ip}`
  const ipKey = `login:ip:${ip}`
  if (!rateLimit(idKey, 5, 5 * 60_000) || !rateLimit(ipKey, 10, 5 * 60_000)) {
    await logEvent({
      level: 'WARN',
      action: 'LOGIN_RATE_LIMITED',
      message: `Too many login attempts for "${body.identifier.slice(0, 64)}"`,
      ip,
    })
    throw new ApiError(429, 'RATE_LIMITED', 'Too many login attempts. Try again in a few minutes.')
  }

  const user = await db.user.findFirst({
    where: { OR: [{ email: body.identifier.toLowerCase() }, { username: body.identifier }] },
  })
  const passwordOk = user ? verifyPassword(body.password, user.passwordHash) : false

  if (!user || !passwordOk) {
    await audit({ actorLabel: body.identifier.slice(0, 64), action: 'LOGIN_FAILED', ip })
    await trackEvent({ type: 'LOGIN_FAILED', level: 'WARN', source: 'auth', message: 'Failed login attempt', meta: { ip } })
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials.')
  }
  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account is disabled.')
  }

  const settings = await getSettings()
  const session = await createSession(user.id, {
    ip,
    userAgent: req.headers.get('user-agent'),
    remember: body.remember,
    timeoutMin: settings.sessionTimeoutMin,
  })

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await audit({ actorId: user.id, actorLabel: user.username, action: 'LOGIN', ip })
  await trackEvent({ type: 'LOGIN', source: 'auth', message: `User "${user.username}" signed in`, meta: { ip } })

  const res = ok({ user: publicUser(user) }) as NextResponse
  res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt, session.maxAgeSec))
  logger.info('Login success', { actor: user.username })
  return res
})

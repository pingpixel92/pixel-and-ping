import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, parseBody, withPublic } from '@/lib/api'
import { hashPassword } from '@/lib/crypto'
import { createSession, publicUser, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { getIp, rateLimit } from '@/lib/rate-limit'
import { env } from '@/lib/env'

/**
 * First-admin bootstrap.
 * - Fresh install (no users): open setup.
 * - After that: only with a valid SETUP_TOKEN from the environment.
 * No hardcoded credentials are ever created.
 */

export const GET = withPublic(async () => {
  const userCount = await db.user.count()
  return ok({ available: userCount === 0, tokenRequired: userCount > 0 })
})

const schema = z.object({
  displayName: z.string().min(2, 'At least 2 characters').max(100),
  email: z.string().email().max(255),
  username: z
    .string()
    .regex(/^[a-zA-Z0-9._-]{3,32}$/, '3–32 chars: letters, digits, . _ -')
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(10, 'At least 10 characters')
    .max(200)
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z0-9]/, 'Must contain an uppercase letter or a digit'),
  setupToken: z.string().optional(),
})

export const POST = withPublic(async (req) => {
  const ip = getIp(req)
  if (!rateLimit(`setup:${ip}`, 5, 10 * 60_000)) {
    return ok({ rateLimited: true as const })
  }

  const body = await parseBody(req, schema)
  const userCount = await db.user.count()

  if (userCount > 0) {
    if (!env.SETUP_TOKEN || !body.setupToken || body.setupToken !== env.SETUP_TOKEN) {
      return ok({ forbidden: true as const })
    }
  }

  const email = body.email.toLowerCase()
  const conflict = await db.user.findFirst({ where: { OR: [{ email }, { username: body.username }] } })
  if (conflict) return ok({ conflict: true as const })

  const user = await db.user.create({
    data: {
      displayName: body.displayName,
      email,
      username: body.username,
      passwordHash: hashPassword(body.password),
      role: 'ADMIN',
    },
  })

  await audit({
    actorId: user.id,
    actorLabel: user.username,
    action: 'SYSTEM_SETUP',
    resourceType: 'USER',
    resourceId: user.id,
    ip,
    metadata: { bootstrap: userCount === 0 },
  })

  const session = await createSession(user.id, { ip, userAgent: req.headers.get('user-agent') })
  const res = ok({ user: publicUser(user) })
  res.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt, session.maxAgeSec))
  return res
})

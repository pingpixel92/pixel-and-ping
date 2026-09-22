import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, parseBody, withAuth } from '@/lib/api'
import { publicUser } from '@/lib/auth'

export const GET = withAuth(async (_req, ctx) => {
  const [user, unreadCount] = await Promise.all([
    db.user.findUnique({ where: { id: ctx.auth.id } }),
    db.notification.count({ where: { read: false } }),
  ])
  if (!user) return ok({ user: null, unreadCount: 0 })
  return ok({ user: publicUser(user), unreadCount })
})

const prefsSchema = z.object({
  locale: z.enum(['en', 'fa', 'ru', 'zh']).optional(),
  reducedMotion: z.boolean().optional(),
  autoRefresh: z.boolean().optional(),
})

const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  prefs: prefsSchema.optional(),
})

export const PATCH = withAuth(async (req, ctx) => {
  const body = await parseBody(req, patchSchema)

  if (body.email) {
    const existing = await db.user.findFirst({ where: { email: body.email.toLowerCase(), NOT: { id: ctx.auth.id } } })
    if (existing) {
      return ok({ conflict: 'email' as const })
    }
  }

  const prefs = { ...((ctx.auth.prefs as Record<string, unknown>) ?? {}), ...(body.prefs ?? {}) }
  const user = await db.user.update({
    where: { id: ctx.auth.id },
    data: {
      ...(body.displayName ? { displayName: body.displayName } : {}),
      ...(body.email ? { email: body.email.toLowerCase() } : {}),
      ...(body.prefs ? { prefs: prefs as never } : {}),
    },
  })
  return ok({ user: publicUser(user) })
})

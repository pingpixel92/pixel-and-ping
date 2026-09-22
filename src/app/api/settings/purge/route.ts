import { z } from 'zod'
import { db } from '@/lib/db'
import { ok, parseBody, withAuth } from '@/lib/api'
import { rolesFor } from '@/lib/rbac'
import { getIp } from '@/lib/rate-limit'
import { audit, logEvent } from '@/lib/audit'

const schema = z.object({
  target: z.enum(['traffic', 'analytics']),
})

/** POST /api/settings/purge — admin-only destructive maintenance. */
export const POST = withAuth(async (req, ctx) => {
  const body = await parseBody(req, schema)
  const ip = getIp(req)

  let deleted = 0
  if (body.target === 'traffic') {
    const res = await db.trafficRecord.deleteMany({})
    deleted = res.count
  } else {
    const res = await db.analyticsEvent.deleteMany({})
    deleted = res.count
  }

  await audit({
    actorId: ctx.auth.id,
    actorLabel: ctx.auth.username,
    action: body.target === 'traffic' ? 'TRAFFIC_PURGE' : 'ANALYTICS_PURGE',
    resourceType: 'SETTINGS',
    resourceId: body.target,
    ip,
    metadata: { deleted },
  })
  await logEvent({
    level: 'WARN',
    action: body.target === 'traffic' ? 'TRAFFIC_PURGE' : 'ANALYTICS_PURGE',
    actor: ctx.auth.username,
    userId: ctx.auth.id,
    message: `Purged ${deleted} ${body.target} records`,
    ip,
  })

  return ok({ deleted })
}, { roles: rolesFor('danger:execute') })
